// dev-agent/server.js — Backend API for AudioFabric dev agent
// Provides real git, file, module scaffolding, and LLM proxy endpoints.
// Run: cd dev-agent && npm install && npm start

import express from 'express';
import cors from 'cors';
import { execSync, exec } from 'child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync, unlinkSync } from 'fs';
import { join, basename, extname, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const PORT = process.env.PORT || 3777;
const isDev = process.argv.includes('--dev');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Serve frontend
app.use(express.static(join(__dirname, 'public')));

// Serve repo files for preview (arena pages, modules, shared)
app.use('/repo', express.static(REPO_ROOT));

// ═══════════════════════════════════════════════
// GIT ENDPOINTS
// ═══════════════════════════════════════════════

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 15000 }).trim();
  } catch (e) {
    return { error: e.stderr || e.message };
  }
}

app.get('/api/git/status', (req, res) => {
  const branch = git('branch --show-current');
  const status = git('status --porcelain -u');
  const log = git('log --oneline -20');
  res.json({
    branch: typeof branch === 'string' ? branch : '(unknown)',
    files: typeof status === 'string' ? status.split('\n').filter(Boolean).map(l => ({
      status: l.slice(0, 2).trim(),
      path: l.slice(3)
    })) : [],
    log: typeof log === 'string' ? log.split('\n').filter(Boolean).map(l => {
      const [hash, ...msg] = l.split(' ');
      return { hash, message: msg.join(' ') };
    }) : []
  });
});

app.get('/api/git/diff', (req, res) => {
  const diff = git('diff');
  const staged = git('diff --cached');
  res.json({
    diff: typeof diff === 'string' ? diff : '',
    staged: typeof staged === 'string' ? staged : ''
  });
});

app.post('/api/git/add', (req, res) => {
  const { files } = req.body; // array of paths or '.'
  const target = Array.isArray(files) ? files.map(f => `"${f}"`).join(' ') : '.';
  const result = git(`add ${target}`);
  res.json({ ok: !result?.error, result });
});

app.post('/api/git/commit', (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });
  const result = git(`commit -m "${message.replace(/"/g, '\\"')}"`);
  res.json({ ok: !result?.error, result });
});

app.post('/api/git/push', (req, res) => {
  const branch = git('branch --show-current');
  if (typeof branch !== 'string') return res.status(500).json({ error: 'Cannot determine branch' });
  const result = git(`push -u origin ${branch}`);
  res.json({ ok: !result?.error, result, branch });
});

app.post('/api/git/pull', (req, res) => {
  const branch = git('branch --show-current');
  if (typeof branch !== 'string') return res.status(500).json({ error: 'Cannot determine branch' });
  const result = git(`pull origin ${branch}`);
  res.json({ ok: !result?.error, result });
});

app.get('/api/git/branches', (req, res) => {
  const result = git('branch -a');
  res.json({
    branches: typeof result === 'string' ? result.split('\n').map(b => b.trim().replace(/^\* /, '')) : []
  });
});

app.post('/api/git/checkout', (req, res) => {
  const { branch } = req.body;
  const result = git(`checkout ${branch}`);
  res.json({ ok: !result?.error, result });
});

// ═══════════════════════════════════════════════
// FILE ENDPOINTS
// ═══════════════════════════════════════════════

function safePath(p) {
  const resolved = join(REPO_ROOT, p);
  if (!resolved.startsWith(REPO_ROOT)) throw new Error('Path escape');
  return resolved;
}

app.get('/api/files/tree', (req, res) => {
  const dir = req.query.dir || '';
  const depth = parseInt(req.query.depth) || 2;
  try {
    const tree = buildTree(safePath(dir), depth, dir || '.');
    res.json({ ok: true, tree });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

function buildTree(absPath, depth, relPath) {
  const entries = [];
  if (depth <= 0) return entries;
  try {
    const items = readdirSync(absPath);
    for (const item of items) {
      if (item.startsWith('.') || item === 'node_modules') continue;
      const full = join(absPath, item);
      const rel = relPath ? `${relPath}/${item}` : item;
      const stat = statSync(full);
      if (stat.isDirectory()) {
        entries.push({ name: item, path: rel, type: 'dir', children: buildTree(full, depth - 1, rel) });
      } else {
        entries.push({ name: item, path: rel, type: 'file', size: stat.size, ext: extname(item) });
      }
    }
  } catch (e) { /* skip unreadable */ }
  entries.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
  return entries;
}

app.get('/api/files/read', (req, res) => {
  const { path: p } = req.query;
  if (!p) return res.status(400).json({ error: 'Path required' });
  try {
    const content = readFileSync(safePath(p), 'utf8');
    res.json({ ok: true, path: p, content, size: content.length });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

app.post('/api/files/write', (req, res) => {
  const { path: p, content } = req.body;
  if (!p) return res.status(400).json({ error: 'Path required' });
  try {
    const full = safePath(p);
    const dir = dirname(full);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(full, content, 'utf8');
    res.json({ ok: true, path: p, size: content.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/files/delete', (req, res) => {
  const { path: p } = req.body;
  try {
    unlinkSync(safePath(p));
    res.json({ ok: true, path: p });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/files/search', (req, res) => {
  const { q, glob: g } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });
  try {
    const grepCmd = g
      ? `grep -rl --include="${g}" "${q}" .`
      : `grep -rl "${q}" . --include="*.js" --include="*.html" --include="*.css"`;
    const result = execSync(grepCmd, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 10000 }).trim();
    const files = result ? result.split('\n').map(f => f.replace(/^\.\//, '')) : [];
    res.json({ ok: true, query: q, files, count: files.length });
  } catch (e) {
    res.json({ ok: true, query: q, files: [], count: 0 });
  }
});

// ═══════════════════════════════════════════════
// MODULE / ARENA CATALOG
// ═══════════════════════════════════════════════

app.get('/api/modules/list', (req, res) => {
  try {
    const modDir = join(REPO_ROOT, 'modules');
    const files = readdirSync(modDir).filter(f => f.endsWith('.js')).sort();
    const modules = files.map(f => {
      const content = readFileSync(join(modDir, f), 'utf8');
      const firstLine = content.split('\n')[0] || '';
      const desc = firstLine.startsWith('//') ? firstLine.slice(2).trim() : f;
      return { name: f.replace('.js', ''), file: f, desc, size: content.length };
    });
    res.json({ ok: true, modules, count: modules.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/arenas/list', (req, res) => {
  try {
    const htmlFiles = readdirSync(REPO_ROOT)
      .filter(f => f.startsWith('ki-arena-') && f.endsWith('.html'))
      .sort();
    const arenas = htmlFiles.map(f => {
      const content = readFileSync(join(REPO_ROOT, f), 'utf8');
      const titleMatch = content.match(/<title>([^<]+)<\/title>/);
      return {
        file: f,
        name: f.replace('ki-arena-', '').replace('.html', ''),
        title: titleMatch ? titleMatch[1] : f,
        size: content.length
      };
    });
    res.json({ ok: true, arenas, count: arenas.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════
// MODULE SCAFFOLDING — Quick orb/arena generation
// ═══════════════════════════════════════════════

app.post('/api/scaffold/orb', (req, res) => {
  const { name, description, features, vowelModes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const camel = slug.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const pascal = camel[0].toUpperCase() + camel.slice(1);
  const modes = vowelModes || ['alpha', 'beta', 'gamma', 'delta', 'omega'];
  const desc = description || `${pascal} central orb visualization`;
  const feats = features || ['particles', 'glow', 'rotation'];

  // Generate module JS
  const moduleCode = generateOrbModule(slug, pascal, desc, modes, feats);
  const modulePath = `modules/${slug}.js`;
  writeFileSync(safePath(modulePath), moduleCode, 'utf8');

  // Generate arena HTML
  const arenaCode = generateArenaHTML(slug, pascal, modes);
  const arenaPath = `ki-arena-${slug}.html`;
  writeFileSync(safePath(arenaPath), arenaCode, 'utf8');

  res.json({
    ok: true,
    module: modulePath,
    arena: arenaPath,
    name: slug,
    pascal,
    note: 'Remember to add to arena-assembler.js catalog + presets'
  });
});

app.get('/api/scaffold/templates', (req, res) => {
  res.json({
    ok: true,
    templates: [
      { id: 'orb', name: 'Central Orb', desc: 'Voice-reactive sphere — IS the central shape (no geo-folder)' },
      { id: 'effect', name: 'Effect Layer', desc: 'Visual effect overlay (particles, lines, etc.)' },
      { id: 'arena', name: 'Arena Page', desc: 'Full arena HTML page with HUD and boot sequence' }
    ]
  });
});

// ═══════════════════════════════════════════════
// LLM PROXY — Forward to external API
// ═══════════════════════════════════════════════

app.post('/api/llm/chat', async (req, res) => {
  const { messages, model, apiKey, provider } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'Messages required' });

  // System context about the repo
  const systemCtx = buildRepoContext();

  // If no API key, use built-in responses
  if (!apiKey) {
    return res.json({
      ok: true,
      response: buildLocalResponse(messages, systemCtx),
      model: 'local-helper',
      note: 'Set API key for full LLM capability'
    });
  }

  // Proxy to external LLM
  try {
    const fullMessages = [
      { role: 'system', content: systemCtx },
      ...messages
    ];

    const endpoint = provider === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://api.anthropic.com/v1/messages';

    if (provider === 'openai') {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: model || 'gpt-4o', messages: fullMessages, max_tokens: 4096 })
      });
      const data = await resp.json();
      res.json({ ok: true, response: data.choices?.[0]?.message?.content || 'No response', model });
    } else {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model || 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemCtx,
          messages: messages
        })
      });
      const data = await resp.json();
      res.json({ ok: true, response: data.content?.[0]?.text || 'No response', model });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════
// LLM TOOL EXECUTION — Agent can call tools
// ═══════════════════════════════════════════════

app.post('/api/llm/tool', async (req, res) => {
  const { tool, args } = req.body;
  try {
    switch (tool) {
      case 'read_file':
        const content = readFileSync(safePath(args.path), 'utf8');
        return res.json({ ok: true, result: content });

      case 'write_file':
        const wfull = safePath(args.path);
        const wdir = dirname(wfull);
        if (!existsSync(wdir)) mkdirSync(wdir, { recursive: true });
        writeFileSync(wfull, args.content, 'utf8');
        return res.json({ ok: true, result: `Wrote ${args.path}` });

      case 'search':
        const sresult = execSync(
          `grep -rn --include="*.js" --include="*.html" "${args.query}" .`,
          { cwd: REPO_ROOT, encoding: 'utf8', timeout: 10000 }
        ).trim();
        return res.json({ ok: true, result: sresult.split('\n').slice(0, 30).join('\n') });

      case 'git_status':
        return res.json({ ok: true, result: git('status --short') });

      case 'git_commit':
        git('add .');
        return res.json({ ok: true, result: git(`commit -m "${args.message.replace(/"/g, '\\"')}"`) });

      case 'git_push':
        const br = git('branch --show-current');
        return res.json({ ok: true, result: git(`push -u origin ${br}`) });

      case 'list_modules':
        const mods = readdirSync(join(REPO_ROOT, 'modules')).filter(f => f.endsWith('.js')).sort();
        return res.json({ ok: true, result: mods.join('\n') });

      case 'scaffold_orb':
        const slug = args.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const pascal = slug.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        const Pc = pascal[0].toUpperCase() + pascal.slice(1);
        const mc = generateOrbModule(slug, Pc, args.desc || `${Pc} orb`, args.modes || ['a','b','c','d','e'], ['particles','glow']);
        writeFileSync(safePath(`modules/${slug}.js`), mc, 'utf8');
        const ac = generateArenaHTML(slug, Pc, args.modes || ['a','b','c','d','e']);
        writeFileSync(safePath(`ki-arena-${slug}.html`), ac, 'utf8');
        return res.json({ ok: true, result: `Created modules/${slug}.js + ki-arena-${slug}.html` });

      case 'run_command':
        // Limited safe commands only
        const allowed = ['ls', 'find', 'wc', 'cat', 'head', 'tail', 'grep', 'git'];
        const cmd = (args.command || '').trim();
        const first = cmd.split(' ')[0];
        if (!allowed.includes(first)) return res.json({ ok: false, result: `Command not allowed: ${first}` });
        const cmdResult = execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 10000 });
        return res.json({ ok: true, result: cmdResult.slice(0, 5000) });

      default:
        return res.json({ ok: false, result: `Unknown tool: ${tool}` });
    }
  } catch (e) {
    res.json({ ok: false, result: e.message || String(e) });
  }
});

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

function buildRepoContext() {
  const branch = git('branch --show-current');
  const modCount = readdirSync(join(REPO_ROOT, 'modules')).filter(f => f.endsWith('.js')).length;
  const arenaCount = readdirSync(REPO_ROOT).filter(f => f.startsWith('ki-arena-') && f.endsWith('.html')).length;
  return `You are a dev agent for the AudioFabric project.
Repository: AudioFabric (voice-reactive 3D visualizations with Three.js)
Branch: ${typeof branch === 'string' ? branch : 'unknown'}
Modules: ${modCount} JS modules in modules/
Arenas: ${arenaCount} arena HTML pages
Architecture: Browser-based, no build step. ES modules imported via <script type="module">.
Core pattern: KI.register(name, {update, group}), KI.voice for voice data, KI.emit for events.
Voice data: energy(0-1), coherence(0-1), pn(pitch 0-1), vowel(a/e/i/o/u), sounding(bool), pulseRate.
Available tools: read_file, write_file, search, git_status, git_commit, git_push, list_modules, scaffold_orb, run_command.
When creating orb modules, follow the pattern: import KI from core.js, export init(), register with KI, emit events.`;
}

function buildLocalResponse(messages, ctx) {
  const last = messages[messages.length - 1]?.content || '';
  const lower = last.toLowerCase();

  if (lower.includes('list') && lower.includes('module')) {
    const mods = readdirSync(join(REPO_ROOT, 'modules')).filter(f => f.endsWith('.js')).sort();
    return `Found ${mods.length} modules:\n${mods.map(m => '  ' + m).join('\n')}`;
  }
  if (lower.includes('list') && lower.includes('arena')) {
    const arenas = readdirSync(REPO_ROOT).filter(f => f.startsWith('ki-arena-')).sort();
    return `Found ${arenas.length} arenas:\n${arenas.map(a => '  ' + a).join('\n')}`;
  }
  if (lower.includes('status') || lower.includes('git')) {
    return `Git status:\n${git('status --short')}\nBranch: ${git('branch --show-current')}`;
  }
  if (lower.includes('scaffold') || lower.includes('create') && lower.includes('orb')) {
    return `To scaffold a new orb, use the scaffold tool or POST to /api/scaffold/orb with:\n{\n  "name": "my-orb",\n  "description": "description here",\n  "vowelModes": ["mode1","mode2","mode3","mode4","mode5"]\n}\nI can also do it if you give me an API key for full LLM mode.`;
  }
  return `I'm the AudioFabric dev agent (local mode). Set an API key (Anthropic or OpenAI) for full LLM capability.\n\nI can help with:\n- List modules/arenas\n- Git status/commit/push\n- Scaffold new orb modules\n- Read/write/search files\n- Preview arena pages\n\nTry: "list modules", "git status", "scaffold new orb"`;
}

// ═══════════════════════════════════════════════
// CODE GENERATORS
// ═══════════════════════════════════════════════

function generateOrbModule(slug, pascal, desc, modes, features) {
  const eventName = slug;
  const modeMap = modes.map((m, i) => {
    const vowels = ['a', 'e', 'i', 'o', 'u'];
    return `${vowels[i]}: '${m}'`;
  }).join(', ');

  return `// ${slug}.js — ${desc}
// Voice-reactive central orb. Vowel modes: ${modes.join(', ')}

import { KI } from './core.js';

const TAU = Math.PI * 2;
const MAX_PARTICLES = 500;

let group = null;
let coreMesh = null, coreMat = null;
let shellMesh = null, shellMat = null;
let particleSystem = null, particlePos = null, particleCol = null;
let particleData = [];
let currentMode = '${modes[0]}';

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 2.5, -3.5];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // Core sphere
  const coreGeo = new THREE.SphereGeometry(0.4, 24, 16);
  coreMat = new THREE.MeshBasicMaterial({
    color: 0x4488ff, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  coreMesh = new THREE.Mesh(coreGeo, coreMat);
  group.add(coreMesh);

  // Outer shell
  const shellGeo = new THREE.SphereGeometry(1.2, 32, 20);
  shellMat = new THREE.MeshBasicMaterial({
    color: 0x224466, transparent: true, opacity: 0.08,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  shellMesh = new THREE.Mesh(shellGeo, shellMat);
  group.add(shellMesh);

  // Particles
  const pGeo = new THREE.BufferGeometry();
  particlePos = new Float32Array(MAX_PARTICLES * 3);
  particleCol = new Float32Array(MAX_PARTICLES * 3);
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const theta = Math.acos(2 * Math.random() - 1);
    const phi = TAU * Math.random();
    const r = 0.3 + Math.random() * 0.9;
    particlePos[i * 3] = Math.sin(theta) * Math.cos(phi) * r;
    particlePos[i * 3 + 1] = Math.cos(theta) * r;
    particlePos[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * r;
    particleData.push({ theta, phi, r, speed: (Math.random() - 0.5) * 0.8 });
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(particleCol, 3));
  particleSystem = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.04, vertexColors: true, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(particleSystem);

  KI.register('${eventName}', { update, group, getMode: () => currentMode });
  KI.emit('${eventName}:ready');
}

function update(dt, t) {
  const v = KI.voice;
  const energy = v.energy || 0;
  const coherence = v.coherence || 0;
  const pitch = v.pn || 0;
  const sounding = v.sounding;
  const pulseRate = v.pulseRate || 1;

  // Vowel -> mode
  if (sounding) {
    const modes = { ${modeMap} };
    currentMode = modes[v.vowel || 'a'] || '${modes[0]}';
  }

  // Core pulse
  const pulse = 1 + Math.sin(t * pulseRate * 4) * 0.15 * energy;
  coreMesh.scale.setScalar(pulse);
  coreMat.opacity = 0.4 + energy * 0.4;

  // Shell
  shellMat.opacity = 0.04 + energy * 0.06;

  // Particles
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const pd = particleData[i];
    pd.phi += dt * pd.speed * (0.5 + energy * 1.5);
    particlePos[i * 3] = Math.sin(pd.theta) * Math.cos(pd.phi) * pd.r;
    particlePos[i * 3 + 1] = Math.cos(pd.theta) * pd.r;
    particlePos[i * 3 + 2] = Math.sin(pd.theta) * Math.sin(pd.phi) * pd.r;

    const bright = 0.1 + energy * 0.3;
    const hue = (0.5 + pitch * 0.3 + i * 0.001) % 1;
    const rgb = hslToRgb(hue, 0.5, bright);
    particleCol[i * 3] = rgb[0];
    particleCol[i * 3 + 1] = rgb[1];
    particleCol[i * 3 + 2] = rgb[2];
  }
  particleSystem.geometry.attributes.position.needsUpdate = true;
  particleSystem.geometry.attributes.color.needsUpdate = true;

  group.rotation.y += dt * 0.04;

  KI.emit('${eventName}:update', {
    mode: currentMode,
    energy: Math.round(energy * 100),
    particles: MAX_PARTICLES
  });
}

function hslToRgb(h, s, l) {
  if (KI.hslToRgb) return KI.hslToRgb(h, s, l);
  let r, g, b;
  if (s === 0) { r = g = b = l; } else {
    const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q-p)*6*t; if (t < 1/2) return q; if (t < 2/3) return p + (q-p)*(2/3-t)*6; return p; };
    const q = l < 0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
    r = hue2rgb(p, q, h+1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h-1/3);
  }
  return [r, g, b];
}
`;
}

function generateArenaHTML(slug, pascal, modes) {
  const eventName = slug;
  const modeColors = {
    0: '#4cf', 1: '#f84', 2: '#8f4', 3: '#f4c', 4: '#ff4'
  };
  const roomPrefix = slug.replace(/-/g, '').slice(0, 4).toUpperCase();

  const pills = modes.map((m, i) =>
    `  <div class="mode-pill${i === 0 ? ' active' : ''}">${m}</div>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ki Arena — ${pascal}</title>
<link rel="stylesheet" href="shared/styles.css">
<style>
canvas{position:fixed;top:0;left:0;width:100%;height:100%}
#hud{position:fixed;top:0;left:0;right:0;z-index:50;display:none;padding:10px 16px;
  background:linear-gradient(180deg,rgba(0,0,0,0.7),transparent);pointer-events:none}
#hud.on{display:flex;justify-content:space-between;align-items:flex-start}
.hud-l,.hud-r{display:flex;flex-direction:column;gap:2px}
.hud-r{align-items:flex-end;text-align:right}
#nick{font-size:11px;color:#0f0;cursor:pointer;pointer-events:auto;text-decoration:underline dotted #0f04}
#modeName{font-size:16px;color:#4cf;text-shadow:0 0 12px #4cf;text-transform:uppercase;letter-spacing:3px}
#energyInfo{font-size:11px;color:#888}
#modePills{position:fixed;right:12px;bottom:12px;z-index:55;display:flex;gap:4px;pointer-events:none}
.mode-pill{padding:3px 10px;font-size:9px;color:#446;border:1px solid #fff1;
  border-radius:10px;background:rgba(0,0,0,0.4);transition:all 0.3s}
.mode-pill.active{color:#4cf;border-color:#4cf4}
#meter{position:fixed;left:12px;bottom:12px;z-index:55;width:6px;height:80px;
  background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;pointer-events:none}
#meterFill{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(0deg,#224,#4cf,#8ef);
  border-radius:3px;transition:height 0.15s}
#meterLabel{position:fixed;left:22px;bottom:12px;z-index:55;font-size:8px;color:#468;
  writing-mode:vertical-rl;pointer-events:none}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="hud">
  <div class="hud-l">
    <div style="font-size:9px;color:#555;letter-spacing:2px">${slug.toUpperCase().replace(/-/g, ' ')}</div>
    <div id="modeName">${modes[0]}</div>
  </div>
  <div class="hud-r">
    <div id="nick" onclick="changeNick()"></div>
    <div id="energyInfo">energy 0%</div>
  </div>
</div>
<div id="modePills">
${pills}
</div>
<div id="meter"><div id="meterFill" style="height:0%"></div></div>
<div id="meterLabel">ENERGY</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>
<script type="module">
import { KI } from './modules/core.js';
import * as Scene from './modules/scene.js';
import * as VoiceEngine from './modules/voice-engine.js';
import * as FreqBands from './modules/freq-bands-12.js';
import * as Synths from './modules/synths.js';
import * as Resonance from './modules/resonance.js';
import * as ${pascal} from './modules/${slug}.js';
import * as MqttNet from './modules/mqtt-net.js';
import * as WebRTCNet from './modules/webrtc-net.js';
import * as Presence from './modules/presence.js';
import * as Chat from './modules/chat.js';
import * as PlayerProfile from './modules/player-profile.js';
import * as NavOverlay from './modules/nav-overlay.js';

const ROOM = '${roomPrefix}-' + Math.random().toString(36).slice(2, 6).toUpperCase();
KI.player.name = KI.genHash();
document.getElementById('nick').textContent = KI.player.name;
window.changeNick = function() {
  const n = prompt('Nickname:', KI.player.name);
  if (n && n.trim()) { KI.player.name = n.trim().slice(0,16); document.getElementById('nick').textContent = KI.player.name; }
};

KI.on('${eventName}:update', data => {
  document.getElementById('modeName').textContent = data.mode;
  document.getElementById('energyInfo').textContent = 'energy ' + data.energy + '%';
  document.getElementById('meterFill').style.height = data.energy + '%';
  document.querySelectorAll('.mode-pill').forEach(p => {
    p.classList.toggle('active', p.textContent === data.mode);
  });
});

async function boot() {
  document.getElementById('hud').classList.add('on');
  Scene.init({ stars: 800 });
  try { await VoiceEngine.init(); } catch(e) { console.warn('voice:', e); }
  FreqBands.init(); Synths.init(); Resonance.init();
  ${pascal}.init({ position: [0, 2.5, -3.5] });
  MqttNet.init({ room: ROOM }); WebRTCNet.init({ room: ROOM });
  Presence.init(); Chat.init(); PlayerProfile.init(); NavOverlay.init();
  KI.running = true;
  const clock = KI.clock;
  (function animate() {
    if (!KI.running) return; requestAnimationFrame(animate);
    const dt = clock.getDelta(), t = clock.elapsedTime;
    KI.runUpdates(dt, t); KI.renderer.render(KI.scene, KI.camera);
  })();
  console.log('%c ${slug.toUpperCase()} BOOTED ', 'background:#000;color:#4cf;font-size:22px;padding:12px');
}
window.addEventListener('load', boot);
</script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(\`
┌──────────────────────────────────────────────┐
│  AudioFabric Dev Agent                       │
│  http://localhost:\${PORT}                      │
│                                              │
│  API:     http://localhost:\${PORT}/api          │
│  Preview: http://localhost:\${PORT}/repo         │
│  Git:     \${git('branch --show-current')}      │
│  Modules: \${readdirSync(join(REPO_ROOT, 'modules')).filter(f => f.endsWith('.js')).length} JS files                        │
│  Arenas:  \${readdirSync(REPO_ROOT).filter(f => f.startsWith('ki-arena-')).length} HTML pages                      │
└──────────────────────────────────────────────┘
\`);
});
`;
}

