// dream-weaver.js — Abstract dream environment controlled by voice
// Flowing organic shapes, particle clouds, light ribbons.
// Web LLM interprets visual patterns as dream journal entries.
// pitch → dream depth, energy → lucidity, vowel → dream color theme,
// coherence → stability, pulse → transitions

import { KI } from './core.js';

const TAU = Math.PI * 2;
const PHI = 1.618033988749;

// Dream layers
const MAX_RIBBONS = 12;
const RIBBON_SEGMENTS = 80;
const MAX_ORBS = 60;
const MAX_MOTES = 400;
const CLOUD_POINTS = 2000;

// Dream themes
const THEMES = [
  { name: 'Falling', palette: [[0.1,0,0.3],[0.4,0,0.6],[0.8,0.2,1]], drift: [0,-1,0] },
  { name: 'Flying', palette: [[0,0.2,0.4],[0.2,0.5,0.8],[0.5,0.8,1]], drift: [0,1,0] },
  { name: 'Memory', palette: [[0.4,0.3,0.1],[0.6,0.5,0.2],[1,0.9,0.5]], drift: [0,0,-1] },
  { name: 'Labyrinth', palette: [[0.2,0,0],[0.5,0.1,0.1],[1,0.3,0.2]], drift: [1,0,0] },
  { name: 'Ocean', palette: [[0,0.1,0.2],[0,0.3,0.5],[0.2,0.6,0.8]], drift: [0,0,1] },
  { name: 'Void', palette: [[0,0,0],[0.1,0.1,0.1],[0.3,0.3,0.3]], drift: [0,0,0] }
];

let group = null;
let ribbons = [];     // flowing light ribbons
let orbs = [];        // floating dream orbs
let moteSystem = null, motePos = null, moteCol = null, moteSizes = null;
let cloudSystem = null, cloudPos = null, cloudCol = null;
let dreamCore = null; // central pulsing form
let mirrorPlane = null;

// Dream state
let dreamDepth = 0;   // 0=surface, 1=deep
let lucidity = 0;
let stability = 0;
let currentTheme = 0;
let dreamPhase = 0;
let transitionProgress = 0;
let dreamSequence = 0;
let symbols = [];      // recognized dream symbols

// LLM
let llmPipeline = null, llmReady = false;
let lastDreamTime = 0;
let dreamEntry = '';
let dreamJournal = [];

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 2, -1];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── Dream core — breathing organic form ──
  const coreGeo = new THREE.IcosahedronGeometry(1, 3);
  dreamCore = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({
    color: 0x8844ff, transparent: true, opacity: 0.3,
    wireframe: true, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(dreamCore);

  // ── Light ribbons ──
  for (let i = 0; i < MAX_RIBBONS; i++) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(RIBBON_SEGMENTS * 3);
    const colors = new Float32Array(RIBBON_SEGMENTS * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending
    }));
    group.add(line);
    ribbons.push({
      line, positions, colors,
      phase: i * TAU / MAX_RIBBONS,
      speed: 0.3 + Math.random() * 0.5,
      radius: 2 + Math.random() * 3,
      twist: 0.5 + Math.random() * 2,
      hueOffset: i / MAX_RIBBONS
    });
  }

  // ── Dream orbs ──
  for (let i = 0; i < MAX_ORBS; i++) {
    const r = 0.05 + Math.random() * 0.15;
    const geo = new THREE.SphereGeometry(r, 8, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    group.add(mesh);
    orbs.push({
      mesh, active: false, age: 0, maxAge: 5 + Math.random() * 10,
      x: 0, y: 0, z: 0,
      vx: (Math.random()-0.5)*0.5, vy: (Math.random()-0.5)*0.5, vz: (Math.random()-0.5)*0.5,
      pulse: Math.random() * TAU, r
    });
  }

  // ── Mote particles (tiny floating dust) ──
  const mGeo = new THREE.BufferGeometry();
  motePos = new Float32Array(MAX_MOTES * 3);
  moteCol = new Float32Array(MAX_MOTES * 3);
  for (let i = 0; i < MAX_MOTES; i++) {
    motePos[i*3] = (Math.random()-0.5) * 15;
    motePos[i*3+1] = (Math.random()-0.5) * 10;
    motePos[i*3+2] = (Math.random()-0.5) * 15;
  }
  mGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  mGeo.setAttribute('color', new THREE.BufferAttribute(moteCol, 3));
  moteSystem = new THREE.Points(mGeo, new THREE.PointsMaterial({
    size: 0.04, vertexColors: true, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(moteSystem);

  // ── Cloud system (large soft particles) ──
  const cGeo = new THREE.BufferGeometry();
  cloudPos = new Float32Array(CLOUD_POINTS * 3);
  cloudCol = new Float32Array(CLOUD_POINTS * 3);
  for (let i = 0; i < CLOUD_POINTS; i++) {
    const theta = Math.random() * TAU;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 4 + Math.random() * 6;
    cloudPos[i*3] = r * Math.sin(phi) * Math.cos(theta);
    cloudPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    cloudPos[i*3+2] = r * Math.cos(phi);
  }
  cGeo.setAttribute('position', new THREE.BufferAttribute(cloudPos, 3));
  cGeo.setAttribute('color', new THREE.BufferAttribute(cloudCol, 3));
  cloudSystem = new THREE.Points(cGeo, new THREE.PointsMaterial({
    size: 0.3, vertexColors: true, transparent: true, opacity: 0.15,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(cloudSystem);

  // ── Mirror plane (reflection of the dream) ──
  const mpGeo = new THREE.PlaneGeometry(20, 20);
  mirrorPlane = new THREE.Mesh(mpGeo, new THREE.MeshBasicMaterial({
    color: 0x112233, transparent: true, opacity: 0.08,
    side: THREE.DoubleSide, depthWrite: false
  }));
  mirrorPlane.rotation.x = -Math.PI / 2;
  mirrorPlane.position.y = -3;
  group.add(mirrorPlane);

  // ── LLM ──
  initLLM();

  KI.register('dream-weaver', {
    update, group,
    state: { depth: 0, lucidity: 0, theme: '', entry: '' },
    getDreamEntry: () => dreamEntry
  });

  KI.emit('dream-weaver:ready');
}

// ── LLM ──
function initLLM() {
  if (typeof window !== 'undefined' && window.transformers) loadLLM();
}

async function loadLLM() {
  try {
    const { pipeline } = window.transformers;
    llmPipeline = await pipeline('text-generation', 'Qwen/Qwen2.5-0.5B', {
      device: 'webgpu', dtype: 'q4'
    });
    llmReady = true;
    KI.emit('dream-weaver:llm-ready');
  } catch (e) { console.warn('Dream LLM unavailable:', e.message); }
}

async function writeDreamEntry(t) {
  if (!llmReady || t - lastDreamTime < 12) return;
  lastDreamTime = t;
  const theme = THEMES[currentTheme];
  const symbolStr = symbols.slice(-5).join(', ') || 'nothing yet';
  const prompt = `Dream journal entry. Theme: ${theme.name}. Depth: ${dreamDepth.toFixed(1)}. Lucidity: ${lucidity.toFixed(1)}. Symbols seen: ${symbolStr}. Sequence #${dreamSequence}.
Write 1 sentence describing this dream moment, poetic and surreal.
Entry:`;
  try {
    const result = await llmPipeline(prompt, { max_new_tokens: 30, temperature: 0.9, do_sample: true });
    const text = result[0].generated_text.split('Entry:').pop().trim().split('\n')[0].trim();
    if (text.length > 5) {
      dreamEntry = text.slice(0, 90);
      dreamJournal.push(dreamEntry);
      if (dreamJournal.length > 30) dreamJournal.shift();
      KI.emit('dream-weaver:entry', { text: dreamEntry, sequence: dreamSequence });
    }
  } catch (e) { /* ignore */ }
}

function update(dt, t) {
  const v = KI.voice;
  const fb = KI.get('freq-bands-12');
  const fbState = fb?.state;
  dreamPhase += dt;

  // ── Voice → dream state ──
  // Pitch → dream depth (low = surface/bright, high = deep/dark)
  dreamDepth += ((v.pn || 0) - dreamDepth) * dt * 2;
  // Energy → lucidity (higher = more vivid)
  lucidity += ((v.energy || 0) - lucidity) * dt * 3;
  // Coherence → stability
  stability += ((v.coherence || 0) - stability) * dt * 2;
  // Pulse → transitions
  const pulse = Math.min(1, (v.pulseRate || 0) / 8);

  // Vowel → theme
  const vowelTheme = { 'ah': 0, 'eh': 1, 'ee': 2, 'oh': 3, 'oo': 4, 'mm': 5 };
  const targetTheme = vowelTheme[v.vowel] ?? currentTheme;
  if (targetTheme !== currentTheme && lucidity > 0.2) {
    currentTheme = targetTheme;
    dreamSequence++;
    // Add symbol based on theme
    symbols.push(THEMES[currentTheme].name.toLowerCase());
    if (symbols.length > 20) symbols.shift();
    KI.emit('dream-weaver:theme-change', { theme: THEMES[currentTheme].name, sequence: dreamSequence });
  }

  const theme = THEMES[currentTheme];

  // ── Dream core ──
  // Breathe
  const breathe = 1 + Math.sin(t * 0.5) * 0.2 + lucidity * 0.3;
  dreamCore.scale.setScalar(breathe);
  // Morph vertices with voice
  const corePositions = dreamCore.geometry.attributes.position;
  for (let i = 0; i < corePositions.count; i++) {
    const ox = corePositions.getX(i);
    const oy = corePositions.getY(i);
    const oz = corePositions.getZ(i);
    const len = Math.sqrt(ox*ox + oy*oy + oz*oz) || 1;
    const nx = ox/len, ny = oy/len, nz = oz/len;
    const wave = Math.sin(nx * 5 + t * 2) * Math.cos(ny * 3 + t * 1.5) * Math.sin(nz * 4 + t);
    const r = 1 + wave * 0.2 * lucidity + dreamDepth * 0.1;
    corePositions.setXYZ(i, nx * r, ny * r, nz * r);
  }
  corePositions.needsUpdate = true;
  // Color
  const coreHue = (dreamDepth * 0.3 + t * 0.02) % 1;
  const coreRgb = KI.hslToRgb(coreHue, 0.6 + lucidity * 0.3, 0.3 + lucidity * 0.2);
  dreamCore.material.color.setRGB(coreRgb[0], coreRgb[1], coreRgb[2]);
  dreamCore.material.opacity = 0.2 + lucidity * 0.3;
  dreamCore.rotation.x += dt * 0.1;
  dreamCore.rotation.y += dt * 0.15 * (1 + lucidity);

  // ── Ribbons ──
  for (let r = 0; r < MAX_RIBBONS; r++) {
    const rib = ribbons[r];
    rib.phase += dt * rib.speed * (1 + lucidity);
    const p = rib.positions;
    const c = rib.colors;
    for (let s = 0; s < RIBBON_SEGMENTS; s++) {
      const frac = s / RIBBON_SEGMENTS;
      const angle = rib.phase + frac * TAU * rib.twist;
      const rad = rib.radius * (0.5 + frac * 0.5) + Math.sin(t * 0.3 + r) * stability;
      // 3D lissajous-like curves
      p[s*3] = Math.cos(angle) * rad + Math.sin(angle * PHI + t * 0.2) * dreamDepth * 2;
      p[s*3+1] = Math.sin(angle * 1.3) * rad * 0.6 + Math.cos(t * 0.4 + r * 0.5) * lucidity;
      p[s*3+2] = Math.sin(angle * 0.7 + t * 0.15) * rad * 0.4;
      // Color from theme palette
      const pi = Math.floor(frac * 2.99);
      const pal = theme.palette[pi];
      const bright = 0.5 + lucidity * 0.5;
      c[s*3] = pal[0] * bright;
      c[s*3+1] = pal[1] * bright;
      c[s*3+2] = pal[2] * bright;
    }
    rib.line.geometry.attributes.position.needsUpdate = true;
    rib.line.geometry.attributes.color.needsUpdate = true;
    rib.line.material.opacity = 0.3 + lucidity * 0.4;
  }

  // ── Dream orbs ──
  // Spawn orbs when voice active
  if (v.sounding && Math.random() < lucidity * 0.3) {
    for (const orb of orbs) {
      if (!orb.active) {
        orb.active = true;
        orb.mesh.visible = true;
        orb.age = 0;
        orb.x = (Math.random()-0.5) * 6;
        orb.y = (Math.random()-0.5) * 4;
        orb.z = (Math.random()-0.5) * 6;
        orb.vx = theme.drift[0] * 0.3 + (Math.random()-0.5) * 0.3;
        orb.vy = theme.drift[1] * 0.3 + (Math.random()-0.5) * 0.3;
        orb.vz = theme.drift[2] * 0.3 + (Math.random()-0.5) * 0.3;
        const pi = Math.floor(Math.random() * 3);
        const pal = theme.palette[pi];
        orb.mesh.material.color.setRGB(pal[0], pal[1], pal[2]);
        break;
      }
    }
  }
  for (const orb of orbs) {
    if (!orb.active) continue;
    orb.age += dt;
    orb.x += orb.vx * dt;
    orb.y += orb.vy * dt;
    orb.z += orb.vz * dt;
    // Gravity toward center
    orb.vx -= orb.x * 0.01 * stability;
    orb.vy -= orb.y * 0.01 * stability;
    orb.vz -= orb.z * 0.01 * stability;
    orb.mesh.position.set(orb.x, orb.y, orb.z);
    const fade = 1 - (orb.age / orb.maxAge);
    const pulse = 0.5 + Math.sin(t * 3 + orb.pulse) * 0.3;
    orb.mesh.material.opacity = fade * pulse * lucidity;
    orb.mesh.scale.setScalar(1 + Math.sin(t * 2 + orb.pulse) * 0.3);
    if (orb.age >= orb.maxAge) {
      orb.active = false;
      orb.mesh.visible = false;
    }
  }

  // ── Motes ──
  for (let i = 0; i < MAX_MOTES; i++) {
    // Drift in theme direction
    motePos[i*3] += (theme.drift[0] * 0.3 + Math.sin(t * 0.3 + i * 0.01) * 0.1) * dt;
    motePos[i*3+1] += (theme.drift[1] * 0.3 + Math.cos(t * 0.2 + i * 0.02) * 0.05) * dt;
    motePos[i*3+2] += (theme.drift[2] * 0.3 + Math.sin(t * 0.4 + i * 0.015) * 0.08) * dt;
    // Wrap
    for (let j = 0; j < 3; j++) {
      if (motePos[i*3+j] > 8) motePos[i*3+j] -= 16;
      if (motePos[i*3+j] < -8) motePos[i*3+j] += 16;
    }
    // Color from palette blend
    const pi = Math.floor((i / MAX_MOTES) * 3);
    const pal = theme.palette[Math.min(pi, 2)];
    const bright = 0.3 + lucidity * 0.7;
    moteCol[i*3] = pal[0] * bright;
    moteCol[i*3+1] = pal[1] * bright;
    moteCol[i*3+2] = pal[2] * bright;
  }
  moteSystem.geometry.attributes.position.needsUpdate = true;
  moteSystem.geometry.attributes.color.needsUpdate = true;
  moteSystem.material.opacity = 0.3 + dreamDepth * 0.3;

  // ── Cloud system ──
  for (let i = 0; i < CLOUD_POINTS; i++) {
    // Slow swirl
    const x = cloudPos[i*3], z = cloudPos[i*3+2];
    const angle = Math.atan2(z, x) + dt * 0.02 * (1 + dreamDepth);
    const r = Math.sqrt(x*x + z*z);
    cloudPos[i*3] = Math.cos(angle) * r;
    cloudPos[i*3+2] = Math.sin(angle) * r;
    cloudPos[i*3+1] += Math.sin(t * 0.1 + i * 0.001) * dt * 0.1;
    // Color
    const frac = i / CLOUD_POINTS;
    const pi = Math.floor(frac * 3);
    const pal = theme.palette[Math.min(pi, 2)];
    cloudCol[i*3] = pal[0] * 0.5;
    cloudCol[i*3+1] = pal[1] * 0.5;
    cloudCol[i*3+2] = pal[2] * 0.5;
  }
  cloudSystem.geometry.attributes.position.needsUpdate = true;
  cloudSystem.geometry.attributes.color.needsUpdate = true;
  cloudSystem.material.opacity = 0.05 + dreamDepth * 0.15;
  cloudSystem.rotation.y += dt * 0.01;

  // ── Mirror plane ──
  mirrorPlane.material.opacity = 0.03 + stability * 0.08;
  const mirrorHue = (dreamDepth + t * 0.01) % 1;
  const mirrorRgb = KI.hslToRgb(mirrorHue, 0.3, 0.15);
  mirrorPlane.material.color.setRGB(mirrorRgb[0], mirrorRgb[1], mirrorRgb[2]);

  // ── LLM dream journal ──
  writeDreamEntry(t);

  // ── Emit state ──
  KI.emit('dream-weaver:update', {
    depth: dreamDepth,
    lucidity,
    stability,
    theme: theme.name,
    sequence: dreamSequence,
    orbCount: orbs.filter(o => o.active).length,
    entry: dreamEntry,
    journalLength: dreamJournal.length
  });
}
