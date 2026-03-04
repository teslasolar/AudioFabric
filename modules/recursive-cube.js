// recursive-cube.js — Voice-driven recursive cube fractal + side tools
// The more resonance/coherence you sing, the deeper the cube recurses.
// Features:
// - Recursive subdivision: cube splits into 8 sub-cubes per level
// - Voice coherence → recursion depth (0-6 levels, 1 to 4096 cubes)
// - Pitch → hue rotation across depth levels
// - Energy → cube glow intensity + edge brightness
// - Vowel → recursion pattern (uniform, diagonal, spiral, random, checkerboard)
// - Pulse → breathing/scaling animation speed
// Side tools:
// - Harmonic Spectrum: visualizes overtone series in voice
// - Color Palette: extracts palette from current cube state
// - Recursion Timeline: records depth over time as mini sparkline
// - Geometry Export: copies recursive params as JSON for generative art
// - Resonance Trainer: target frequency + accuracy meter

import { KI } from './core.js';

const TAU = Math.PI * 2;

// ── Recursion State ──
let maxDepth = 0;          // current recursion depth (0-6)
let targetDepth = 0;       // smoothed target
let depthSmooth = 0;       // interpolated
const MAX_DEPTH = 6;       // max 4096 cubes at depth 6
let recursionPattern = 'uniform'; // which sub-cubes to recurse into
let patternIndex = 0;

// Patterns: which of the 8 octants to recurse at each level
const PATTERNS = {
  uniform:     () => [1,1,1,1,1,1,1,1],          // all 8
  diagonal:    () => [1,0,0,0,0,0,0,1],          // 2 diagonal corners
  spiral:      (d) => { const a = new Array(8).fill(0); for(let i=0;i<Math.min(8,d+3);i++) a[(i*3)%8]=1; return a; },
  random:      () => { const a = new Array(8).fill(0); for(let i=0;i<8;i++) a[i]=Math.random()>0.35?1:0; return a; },
  checkerboard:() => [1,0,1,0,0,1,0,1],          // alternating
  cross:       () => [0,1,0,1,1,0,1,0],          // cross pattern
};
const PATTERN_NAMES = Object.keys(PATTERNS);

// ── 3D State ──
let group = null;
let cubePool = [];         // pre-allocated cube meshes
let edgePool = [];         // wireframe edges
let activeCubes = 0;
let activeEdges = 0;
const MAX_CUBES = 600;     // pool limit (depth 4 = 585 worst case)
const MAX_EDGES = 600;

// ── Glow particles ──
let glowSystem = null, glowPos = null, glowCol = null;
const MAX_GLOW = 300;

// ── Core pulse ──
let coreMesh = null;
let coreGlow = 0;

// ── Side Tool State ──
// Harmonic spectrum
const harmonicBins = new Float32Array(16);   // 16 overtone bins
// Timeline
const timeline = new Float32Array(200);      // 200 samples of depth
let timelineIdx = 0;
let timelineSampleTimer = 0;
// Palette
let currentPalette = [];   // array of hex colors
// Resonance trainer
let trainerTarget = 220;   // target freq Hz
let trainerAccuracy = 0;   // 0-1
let trainerActive = false;
let trainerTimer = 0;

// ── Octant offsets for recursive subdivision ──
const OCTANTS = [
  [-1,-1,-1], [1,-1,-1], [-1,1,-1], [1,1,-1],
  [-1,-1, 1], [1,-1, 1], [-1,1, 1], [1,1, 1]
];

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 3, -2];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── Pre-allocate cube pool ──
  for (let i = 0; i < MAX_CUBES; i++) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ff00, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    group.add(mesh);
    cubePool.push(mesh);
  }

  // ── Edge pool (wireframe lines) ──
  for (let i = 0; i < MAX_EDGES; i++) {
    const geo = new THREE.BufferGeometry();
    // 12 edges per cube × 2 points × 3 coords = 72, but we do 1 edge = 1 line
    // Actually we'll use EdgesGeometry approach: just use wireframe boxes
    const mat = new THREE.LineBasicMaterial({
      color: 0x00ffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending
    });
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const edgesGeo = new THREE.EdgesGeometry(boxGeo);
    const line = new THREE.LineSegments(edgesGeo, mat);
    line.visible = false;
    group.add(line);
    edgePool.push(line);
  }

  // ── Core mesh (inner glowing cube at center) ──
  const coreGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  coreMesh = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(coreMesh);

  // ── Glow particles ──
  const gGeo = new THREE.BufferGeometry();
  glowPos = new Float32Array(MAX_GLOW * 3);
  glowCol = new Float32Array(MAX_GLOW * 3);
  for (let i = 0; i < MAX_GLOW; i++) {
    glowPos[i*3]   = (Math.random() - 0.5) * 4;
    glowPos[i*3+1] = (Math.random() - 0.5) * 4;
    glowPos[i*3+2] = (Math.random() - 0.5) * 4;
  }
  gGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
  gGeo.setAttribute('color', new THREE.BufferAttribute(glowCol, 3));
  glowSystem = new THREE.Points(gGeo, new THREE.PointsMaterial({
    size: 0.05, vertexColors: true, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(glowSystem);

  // ── Register with KI ──
  KI.register('recursive-cube', {
    update, group,
    getDepth: () => depthSmooth,
    getMaxDepth: () => MAX_DEPTH,
    getActiveCubes: () => activeCubes,
    getPattern: () => recursionPattern,
    setPattern: (p) => { if (PATTERNS[p]) recursionPattern = p; },
    getPalette: () => currentPalette,
    getTimeline: () => timeline,
    getHarmonics: () => harmonicBins,
    getTrainer: () => ({ target: trainerTarget, accuracy: trainerAccuracy, active: trainerActive }),
    setTrainerTarget: (hz) => { trainerTarget = Math.max(50, Math.min(2000, hz)); },
    toggleTrainer: () => { trainerActive = !trainerActive; },
    exportGeometry: exportGeometry
  });

  KI.emit('recursive-cube:ready');
}

function buildRecursion(cx, cy, cz, size, depth, maxD, pattern, t, hueBase, energy, cubeIdx, edgeIdx) {
  if (depth > maxD || cubeIdx.val >= MAX_CUBES) return;

  // Place a cube at this position
  const cube = cubePool[cubeIdx.val];
  const edge = edgePool[edgeIdx.val];
  if (!cube) return;

  cube.visible = true;
  cube.position.set(cx, cy, cz);
  cube.scale.setScalar(size);

  // Color: hue shifts with depth, saturation with energy
  const depthRatio = depth / Math.max(1, maxD);
  const hue = (hueBase + depthRatio * 0.4) % 1;
  const lightness = 0.2 + energy * 0.3 + (1 - depthRatio) * 0.1;
  const rgb = hslToRgb(hue, 0.7 + energy * 0.2, lightness);
  cube.material.color.setRGB(rgb[0], rgb[1], rgb[2]);
  cube.material.opacity = (0.08 + energy * 0.15) * (1 - depthRatio * 0.12);

  // Subtle rotation per depth
  cube.rotation.x = t * (0.1 + depth * 0.05) * (depth % 2 === 0 ? 1 : -1);
  cube.rotation.y = t * (0.08 + depth * 0.03);

  cubeIdx.val++;

  // Wireframe edge
  if (edge) {
    edge.visible = true;
    edge.position.set(cx, cy, cz);
    edge.scale.setScalar(size);
    edge.rotation.copy(cube.rotation);
    const edgeHue = (hue + 0.15) % 1;
    const ergb = hslToRgb(edgeHue, 0.9, 0.3 + energy * 0.4);
    edge.material.color.setRGB(ergb[0], ergb[1], ergb[2]);
    edge.material.opacity = 0.1 + energy * 0.25 + (1 - depthRatio) * 0.1;
    edgeIdx.val++;
  }

  // Store palette color
  if (currentPalette.length < 8) {
    const hex = '#' + ((1<<24) + (Math.round(rgb[0]*255)<<16) + (Math.round(rgb[1]*255)<<8) + Math.round(rgb[2]*255)).toString(16).slice(1);
    currentPalette.push(hex);
  }

  // Recurse into octants
  if (depth < maxD) {
    const mask = typeof pattern === 'function' ? pattern(depth) : PATTERNS[recursionPattern](depth);
    const childSize = size * 0.45;
    const offset = size * 0.28;

    for (let i = 0; i < 8; i++) {
      if (!mask[i]) continue;
      if (cubeIdx.val >= MAX_CUBES) break;
      const ox = cx + OCTANTS[i][0] * offset;
      const oy = cy + OCTANTS[i][1] * offset;
      const oz = cz + OCTANTS[i][2] * offset;
      buildRecursion(ox, oy, oz, childSize, depth + 1, maxD, pattern, t, hueBase, energy, cubeIdx, edgeIdx);
    }
  }
}

function update(dt, t) {
  const v = KI.voice;
  const energy = v.energy || 0;
  const coherence = v.coherence || 0;
  const pitch = v.pn || 0;
  const sounding = v.sounding;
  const pulseRate = v.pulseRate || 1;

  // ── Recursion depth from coherence + energy ──
  // Coherence is key: sustained resonant singing → deeper recursion
  const resonanceScore = coherence * 0.7 + energy * 0.3;
  targetDepth = Math.floor(resonanceScore * MAX_DEPTH);
  // Smooth approach (goes up fast, down slow for satisfying feel)
  if (depthSmooth < targetDepth) {
    depthSmooth += dt * 3;  // fast up
  } else {
    depthSmooth -= dt * 0.8; // slow down
  }
  depthSmooth = Math.max(0, Math.min(MAX_DEPTH, depthSmooth));
  maxDepth = Math.round(depthSmooth);

  // ── Pattern from vowel ──
  const vowelPatterns = { a: 'uniform', e: 'diagonal', i: 'spiral', o: 'checkerboard', u: 'cross' };
  const vowel = v.vowel || 'a';
  if (vowelPatterns[vowel] && sounding) {
    recursionPattern = vowelPatterns[vowel];
  }

  // ── Clear previous frame ──
  currentPalette = [];
  for (let i = 0; i < MAX_CUBES; i++) cubePool[i].visible = false;
  for (let i = 0; i < MAX_EDGES; i++) edgePool[i].visible = false;

  // ── Build recursive structure ──
  const cubeIdx = { val: 0 };
  const edgeIdx = { val: 0 };
  const hueBase = pitch * 0.8;  // pitch controls hue

  // Base cube size scales with a breathing effect from pulse
  const baseSize = 2.0 + Math.sin(t * pulseRate * 1.5) * 0.15;

  buildRecursion(0, 0, 0, baseSize, 0, maxDepth, null, t, hueBase, energy, cubeIdx, edgeIdx);
  activeCubes = cubeIdx.val;
  activeEdges = edgeIdx.val;

  // ── Core mesh: bright center cube ──
  coreGlow = energy * 0.8 + coherence * 0.5;
  coreMesh.material.opacity = 0.3 + coreGlow * 0.5;
  const coreRgb = hslToRgb(hueBase, 0.5, 0.5 + coreGlow * 0.3);
  coreMesh.material.color.setRGB(coreRgb[0], coreRgb[1], coreRgb[2]);
  coreMesh.scale.setScalar(0.2 + coreGlow * 0.2 + Math.sin(t * 3) * 0.05);
  coreMesh.rotation.x = t * 0.5;
  coreMesh.rotation.y = t * 0.7;

  // ── Glow particles: orbit around cube, density = depth ──
  for (let i = 0; i < MAX_GLOW; i++) {
    const active = i < maxDepth * 50;
    if (active) {
      const angle = t * 0.5 + (i / MAX_GLOW) * TAU;
      const r = 1.5 + Math.sin(t * 0.3 + i * 0.1) * 1.0;
      const yOff = Math.sin(angle * 2 + i) * 1.2;
      glowPos[i*3]   += (Math.cos(angle) * r - glowPos[i*3]) * dt * 2;
      glowPos[i*3+1] += (yOff - glowPos[i*3+1]) * dt * 2;
      glowPos[i*3+2] += (Math.sin(angle) * r - glowPos[i*3+2]) * dt * 2;

      const pHue = (hueBase + i * 0.02) % 1;
      const pRgb = hslToRgb(pHue, 0.8, 0.3 + energy * 0.4);
      glowCol[i*3] = pRgb[0]; glowCol[i*3+1] = pRgb[1]; glowCol[i*3+2] = pRgb[2];
    } else {
      glowCol[i*3] *= 0.92; glowCol[i*3+1] *= 0.92; glowCol[i*3+2] *= 0.92;
    }
  }
  glowSystem.geometry.attributes.position.needsUpdate = true;
  glowSystem.geometry.attributes.color.needsUpdate = true;

  // ── Whole group slow rotation ──
  group.rotation.y += dt * 0.08;
  group.rotation.x = Math.sin(t * 0.15) * 0.1;

  // ── Side Tools Update ──
  updateHarmonics(v, dt);
  updateTimeline(dt);
  updateTrainer(v, dt);

  // ── Emit state ──
  KI.emit('recursive-cube:update', {
    depth: maxDepth,
    depthSmooth: depthSmooth.toFixed(2),
    activeCubes,
    activeEdges,
    pattern: recursionPattern,
    resonanceScore: resonanceScore.toFixed(2),
    palette: currentPalette.slice(0, 8),
    harmonics: Array.from(harmonicBins),
    trainer: { target: trainerTarget, accuracy: trainerAccuracy.toFixed(2), active: trainerActive }
  });
}

// ── Harmonic Spectrum Tool ──
// Estimates overtone presence from frequency data
function updateHarmonics(v, dt) {
  const f0 = v.f0 || 100;
  const bands = KI.get('freq-bands-12');
  if (!bands) {
    // Fallback: simulate from basic voice data
    for (let i = 0; i < 16; i++) {
      const target = (v.energy || 0) * Math.exp(-i * 0.3) * (1 + (v.coherence || 0) * 0.5);
      harmonicBins[i] += (target - harmonicBins[i]) * dt * 5;
    }
    return;
  }

  const bandData = bands.getBands ? bands.getBands() : null;
  if (bandData) {
    // Map 12 freq bands to 16 harmonic bins
    for (let h = 0; h < 16; h++) {
      const freqRatio = (h + 1); // 1st harmonic, 2nd, etc.
      const expectedFreq = f0 * freqRatio;
      // Find closest band
      let best = 0, bestDist = Infinity;
      for (let b = 0; b < Math.min(12, bandData.length); b++) {
        const dist = Math.abs((b + 1) * 100 - expectedFreq); // rough mapping
        if (dist < bestDist) { bestDist = dist; best = b; }
      }
      const target = (bandData[best]?.energy || 0) * (1 / (1 + h * 0.15));
      harmonicBins[h] += (target - harmonicBins[h]) * dt * 8;
    }
  }
}

// ── Recursion Timeline Tool ──
// Records depth over time as a rolling sparkline
function updateTimeline(dt) {
  timelineSampleTimer += dt;
  if (timelineSampleTimer >= 0.15) { // sample every 150ms
    timelineSampleTimer = 0;
    timeline[timelineIdx % timeline.length] = depthSmooth / MAX_DEPTH;
    timelineIdx++;
  }
}

// ── Resonance Trainer Tool ──
// Gives a target frequency, measures how close your pitch is
function updateTrainer(v, dt) {
  if (!trainerActive) return;

  trainerTimer += dt;
  // Change target every 10 seconds
  if (trainerTimer >= 10) {
    trainerTimer = 0;
    // Pick a new target from harmonic series: A2=110, A3=220, E3=165, etc.
    const targets = [110, 130.81, 146.83, 164.81, 174.61, 196, 220, 261.63, 293.66, 329.63, 349.23, 392, 440];
    trainerTarget = targets[Math.floor(Math.random() * targets.length)];
    KI.emit('recursive-cube:trainer-target', { target: trainerTarget });
  }

  const f0 = v.f0 || 0;
  if (f0 > 50 && v.sounding) {
    // Calculate accuracy: how close is f0 to target (in cents)
    const cents = Math.abs(1200 * Math.log2(f0 / trainerTarget));
    // 0 cents = perfect, 50 cents = half semitone, 100+ = poor
    trainerAccuracy = Math.max(0, 1 - cents / 100);
    trainerAccuracy = trainerAccuracy * 0.3 + trainerAccuracy * 0.7; // smooth
  } else {
    trainerAccuracy *= 0.95; // decay when not singing
  }
}

// ── Geometry Export Tool ──
// Returns a JSON description of the current recursive structure
function exportGeometry() {
  const nodes = [];
  function collect(cx, cy, cz, size, depth, maxD) {
    if (depth > maxD) return;
    nodes.push({ x: cx, y: cy, z: cz, size, depth });
    if (depth < maxD) {
      const mask = PATTERNS[recursionPattern](depth);
      const childSize = size * 0.45;
      const offset = size * 0.28;
      for (let i = 0; i < 8; i++) {
        if (!mask[i]) continue;
        collect(cx + OCTANTS[i][0]*offset, cy + OCTANTS[i][1]*offset, cz + OCTANTS[i][2]*offset, childSize, depth+1, maxD);
      }
    }
  }
  collect(0, 0, 0, 2, 0, maxDepth);
  return {
    depth: maxDepth,
    pattern: recursionPattern,
    cubeCount: nodes.length,
    palette: currentPalette.slice(0, 8),
    nodes
  };
}

// ── HSL helper ──
function hslToRgb(h, s, l) {
  if (KI.hslToRgb) return KI.hslToRgb(h, s, l);
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [r, g, b];
}
