// voice-code.js — Voice-controlled AI code editor/generator
// Speak and it writes code. Uses voice-ai-core LLM + tool registry.
// Features:
// - "Write a function that..." → generates code
// - "Fix this..." → reads code, suggests fix
// - "Explain line 5" → explains specific code
// - "Add tests for..." → generates unit tests
// - Voice-to-regex: "match emails" → /[\w.-]+@[\w.-]+\.\w+/
// - Voice-to-shader: "blue gradient" → GLSL fragment
// - Live code buffer rendered as syntax-highlighted text
// - Auto-detect language from context

import { KI } from './core.js';

// ── State ──
let codeBuffer = '';       // current code being worked on
let language = 'javascript';
let fileName = 'untitled.js';
let cursorLine = 0;
let history = [];          // code edit history
let codeOutput = '';       // last execution output
let annotations = [];      // line annotations
const MAX_HISTORY = 30;

// ── 3D visualization ──
let group = null;
let codeLines = [];        // 3D text representations
let cursorMesh = null;
let particleSystem = null, particlePos = null, particleCol = null;
const MAX_PARTICLES = 150;

// Languages and their visual themes
const LANG_THEMES = {
  javascript: { hue: 0.15, label: 'JS', ext: '.js' },
  python: { hue: 0.6, label: 'PY', ext: '.py' },
  html: { hue: 0.05, label: 'HTML', ext: '.html' },
  css: { hue: 0.55, label: 'CSS', ext: '.css' },
  rust: { hue: 0.03, label: 'RS', ext: '.rs' },
  go: { hue: 0.5, label: 'GO', ext: '.go' },
  sql: { hue: 0.7, label: 'SQL', ext: '.sql' },
  glsl: { hue: 0.8, label: 'GLSL', ext: '.glsl' },
  regex: { hue: 0.35, label: 'REGEX', ext: '.txt' }
};

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 2, -3];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── Code line visualizer (horizontal bars) ──
  for (let i = 0; i < 30; i++) {
    const geo = new THREE.PlaneGeometry(6, 0.08);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ff00, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 2 - i * 0.14, 0);
    group.add(mesh);
    codeLines.push(mesh);
  }

  // ── Cursor ──
  const curGeo = new THREE.PlaneGeometry(6.2, 0.1);
  cursorMesh = new THREE.Mesh(curGeo, new THREE.MeshBasicMaterial({
    color: 0xffff00, transparent: true, opacity: 0.15,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  }));
  group.add(cursorMesh);

  // ── Typing particles ──
  const pGeo = new THREE.BufferGeometry();
  particlePos = new Float32Array(MAX_PARTICLES * 3);
  particleCol = new Float32Array(MAX_PARTICLES * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(particleCol, 3));
  particleSystem = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.06, vertexColors: true, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(particleSystem);

  // ── Register tools with voice-ai-core ──
  KI.on('voice-ai-core:ready', registerTools);
  // If core already ready
  const core = KI.get('voice-ai-core');
  if (core?.isReady()) registerTools();

  // ── Listen for commands ──
  KI.on('voice-ai-core:command', handleCommand);

  KI.register('voice-code', {
    update, group,
    getCode: () => codeBuffer,
    setCode: (code) => { codeBuffer = code; },
    getLanguage: () => language,
    getFileName: () => fileName
  });

  KI.emit('voice-code:ready');
}

function registerTools() {
  const core = KI.get('voice-ai-core');
  if (!core) return;

  core.registerTool('voice-code', {
    description: 'Generate, edit, or explain code from voice commands',
    parameters: { command: 'string', language: 'string' },
    handler: handleCodeTool
  });

  core.registerTool('voice-test', {
    description: 'Generate unit tests from description',
    parameters: { command: 'string' },
    handler: async (p) => {
      const result = await core.infer(
        `Write unit tests for: ${p.command}\nLanguage: ${language}\nReturn only the test code.`,
        { maxTokens: 150, temperature: 0.3, system: 'You are a testing expert. Write concise tests.' }
      );
      if (result) appendCode('\n// Tests\n' + result);
      return { code: result };
    }
  });

  core.registerTool('voice-refactor', {
    description: 'Refactor or optimize existing code',
    parameters: { command: 'string' },
    handler: async (p) => {
      const result = await core.infer(
        `Refactor this code. Instruction: ${p.command}\n\nCode:\n${codeBuffer}\n\nReturn only the refactored code.`,
        { maxTokens: 200, temperature: 0.3, system: 'You are a code refactoring expert. Return only code.' }
      );
      if (result) setCodeBuffer(result);
      return { code: result };
    }
  });

  core.registerTool('voice-shader', {
    description: 'Generate GLSL shader from description',
    parameters: { description: 'string' },
    handler: async (p) => {
      const result = await core.infer(
        `Write a GLSL fragment shader for: ${p.command || p.description}\nReturn only the GLSL code.`,
        { maxTokens: 150, temperature: 0.4, system: 'You are a shader programmer. Write GLSL fragment shaders.' }
      );
      if (result) {
        language = 'glsl';
        setCodeBuffer(result);
      }
      return { shader: result };
    }
  });

  core.registerTool('voice-schema', {
    description: 'Generate database schema from description',
    parameters: { description: 'string' },
    handler: async (p) => {
      const result = await core.infer(
        `Design a database schema for: ${p.command || p.description}\nReturn CREATE TABLE SQL statements.`,
        { maxTokens: 150, temperature: 0.3, system: 'You are a database architect. Write SQL schemas.' }
      );
      if (result) {
        language = 'sql';
        setCodeBuffer(result);
      }
      return { schema: result };
    }
  });
}

async function handleCodeTool(params) {
  const core = KI.get('voice-ai-core');
  if (!core) return { error: 'Core not ready' };

  const cmd = params.command || '';
  const lower = cmd.toLowerCase();

  // Detect sub-intent
  if (lower.includes('explain')) {
    const result = await core.infer(
      `Explain this code briefly:\n${codeBuffer || '(empty buffer)'}`,
      { maxTokens: 80 }
    );
    core.speak(result);
    return { explanation: result };
  }

  if (lower.includes('fix') || lower.includes('debug')) {
    const result = await core.infer(
      `Fix bugs in this code. ${cmd}\n\nCode:\n${codeBuffer}\n\nReturn only fixed code.`,
      { maxTokens: 200, temperature: 0.2, system: 'You are a debugging expert. Return only fixed code.' }
    );
    if (result) setCodeBuffer(result);
    return { code: result };
  }

  // Default: generate code
  const result = await core.infer(
    `Write ${language} code: ${cmd}\nReturn only the code, no explanation.`,
    { maxTokens: 200, temperature: 0.4, system: `You are a ${language} programmer. Return only code.` }
  );
  if (result) setCodeBuffer(result);
  return { code: result };
}

function handleCommand(cmd) {
  if (cmd.intent !== 'code' && cmd.intent !== 'test' &&
      cmd.intent !== 'refactor' && cmd.intent !== 'shader' &&
      cmd.intent !== 'schema' && cmd.intent !== 'debug') return;

  // Language detection from command
  const lower = cmd.text.toLowerCase();
  if (lower.includes('python')) language = 'python';
  else if (lower.includes('rust')) language = 'rust';
  else if (lower.includes('html')) language = 'html';
  else if (lower.includes('css')) language = 'css';
  else if (lower.includes('sql')) language = 'sql';
  else if (lower.includes('go ') || lower.includes('golang')) language = 'go';
  else if (lower.includes('shader') || lower.includes('glsl')) language = 'glsl';
}

function setCodeBuffer(code) {
  history.push({ code: codeBuffer, language, timestamp: Date.now() });
  if (history.length > MAX_HISTORY) history.shift();
  codeBuffer = code;
  KI.emit('voice-code:update-code', { code, language });
}

function appendCode(code) {
  setCodeBuffer(codeBuffer + code);
}

function update(dt, t) {
  const v = KI.voice;
  const energy = v.energy || 0;
  const theme = LANG_THEMES[language] || LANG_THEMES.javascript;

  // ── Visualize code lines ──
  const lines = codeBuffer.split('\n');
  for (let i = 0; i < codeLines.length; i++) {
    const mesh = codeLines[i];
    if (i < lines.length && lines[i].trim()) {
      const lineLen = Math.min(6, lines[i].length * 0.06);
      mesh.scale.x = lineLen / 6;
      mesh.position.x = -3 + lineLen / 2;
      // Indent detection
      const indent = lines[i].search(/\S/) || 0;
      mesh.position.x += indent * 0.04;

      // Color by content type
      const line = lines[i].trim();
      let hue = theme.hue;
      if (line.startsWith('//') || line.startsWith('#') || line.startsWith('--')) hue = 0.3; // comments green
      else if (line.startsWith('function') || line.startsWith('def') || line.startsWith('fn')) hue = 0.6; // functions blue
      else if (line.startsWith('return') || line.startsWith('export')) hue = 0.1; // keywords orange
      else if (line.startsWith('if') || line.startsWith('for') || line.startsWith('while')) hue = 0.8; // control purple
      const rgb = KI.hslToRgb(hue, 0.7, 0.3 + energy * 0.2);
      mesh.material.color.setRGB(rgb[0], rgb[1], rgb[2]);
      mesh.material.opacity = 0.3 + energy * 0.3;
    } else {
      mesh.material.opacity = 0;
    }
  }

  // ── Cursor ──
  cursorLine = Math.min(cursorLine, Math.max(0, lines.length - 1));
  cursorMesh.position.y = 2 - cursorLine * 0.14;
  cursorMesh.material.opacity = 0.1 + Math.sin(t * 4) * 0.08;

  // ── Typing particles (emit when voice active) ──
  if (v.sounding) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      particlePos[i*3] += (Math.random() - 0.5) * dt * 2;
      particlePos[i*3+1] += dt * (0.5 + Math.random());
      particlePos[i*3+2] += (Math.random() - 0.5) * dt;
      if (particlePos[i*3+1] > 3) {
        particlePos[i*3] = (Math.random() - 0.5) * 4;
        particlePos[i*3+1] = -1;
        particlePos[i*3+2] = (Math.random() - 0.5) * 0.5;
      }
      const rgb = KI.hslToRgb(theme.hue, 0.8, 0.4 + energy * 0.3);
      particleCol[i*3] = rgb[0]; particleCol[i*3+1] = rgb[1]; particleCol[i*3+2] = rgb[2];
    }
  } else {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      particleCol[i*3] *= 0.95; particleCol[i*3+1] *= 0.95; particleCol[i*3+2] *= 0.95;
    }
  }
  particleSystem.geometry.attributes.position.needsUpdate = true;
  particleSystem.geometry.attributes.color.needsUpdate = true;

  // ── Emit state ──
  KI.emit('voice-code:update', {
    code: codeBuffer,
    language,
    fileName,
    lineCount: lines.length,
    cursorLine,
    historyCount: history.length
  });
}
