// sound-landscape.js — 3D sound visualization
// Spectral waterfall terrain (FFT history as scrolling 3D surface),
// cymatics rings (standing wave patterns), waveform ribbon,
// harmonic pillars (12-band energy columns)

import { KI } from './core.js';

const FREQ_BINS = 64;    // FFT bins per row
const TIME_DEPTH = 96;   // history rows
const CYMATIC_RINGS = 8;
const CYMATIC_RES = 48;  // verts per ring

const state = {
  group: null,
  time: 0,
  fftHistory: null,   // Float32Array [TIME_DEPTH × FREQ_BINS]
  historyRow: 0,
  frameCount: 0,
  terrain: null,
  terrainPos: null,
  terrainCol: null,
  cymatics: null,
  cymaticPos: null,
  waveform: null,
  waveformPos: null,
  pillars: null,
  analyser: null,
  fftData: null,
  timeData: null
};

export function init(opts = {}) {
  const pos = opts.position || [0, 1, 4];
  const scale = opts.scale || 1;

  state.group = new THREE.Group();
  state.group.position.set(pos[0], pos[1], pos[2]);
  state.group.scale.setScalar(scale);
  KI.scene.add(state.group);

  state.fftHistory = new Float32Array(TIME_DEPTH * FREQ_BINS);
  state.fftData = new Float32Array(128);
  state.timeData = new Float32Array(256);

  if (KI.analyser) state.analyser = KI.analyser;
  else KI.on('audio:ready', () => { state.analyser = KI.analyser; });

  buildTerrain();
  buildCymatics();
  buildWaveform();
  buildPillars();

  KI.register('sound-landscape', { update, state });
  KI.emit('sound-landscape:ready');
}

// === SPECTRAL WATERFALL TERRAIN ===
// X = frequency, Z = time (scrolling), Y = amplitude
function buildTerrain() {
  const verts = FREQ_BINS * TIME_DEPTH;
  const positions = new Float32Array(verts * 3);
  const colors = new Float32Array(verts * 3);

  for (let row = 0; row < TIME_DEPTH; row++) {
    for (let col = 0; col < FREQ_BINS; col++) {
      const idx = (row * FREQ_BINS + col) * 3;
      positions[idx] = (col / FREQ_BINS - 0.5) * 6;     // x: frequency
      positions[idx + 1] = 0;                            // y: amplitude
      positions[idx + 2] = (row / TIME_DEPTH) * -8;     // z: time (back)
      colors[idx] = 0.03; colors[idx + 1] = 0.03; colors[idx + 2] = 0.06;
    }
  }

  // Triangle indices
  const indices = [];
  for (let row = 0; row < TIME_DEPTH - 1; row++) {
    for (let col = 0; col < FREQ_BINS - 1; col++) {
      const a = row * FREQ_BINS + col;
      const b = a + 1;
      const c = a + FREQ_BINS;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);

  state.terrain = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.75,
    wireframe: true, side: THREE.DoubleSide
  }));
  state.terrain.position.set(0, -0.5, -2);
  state.terrainPos = positions;
  state.terrainCol = colors;
  state.group.add(state.terrain);
}

// === CYMATICS — concentric rings with standing-wave displacement ===
function buildCymatics() {
  const totalVerts = CYMATIC_RINGS * CYMATIC_RES;
  const positions = new Float32Array(totalVerts * 3);
  const colors = new Float32Array(totalVerts * 3);

  for (let r = 0; r < CYMATIC_RINGS; r++) {
    const radius = 0.5 + r * 0.4;
    for (let i = 0; i < CYMATIC_RES; i++) {
      const theta = (i / CYMATIC_RES) * Math.PI * 2;
      const idx = (r * CYMATIC_RES + i) * 3;
      positions[idx] = Math.cos(theta) * radius;
      positions[idx + 1] = 0;
      positions[idx + 2] = Math.sin(theta) * radius;
      colors[idx] = 0.1; colors[idx + 1] = 0.25; colors[idx + 2] = 0.5;
    }
  }

  // Line loop indices per ring
  const indices = [];
  for (let r = 0; r < CYMATIC_RINGS; r++) {
    const start = r * CYMATIC_RES;
    for (let i = 0; i < CYMATIC_RES; i++) {
      indices.push(start + i, start + (i + 1) % CYMATIC_RES);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);

  state.cymatics = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending
  }));
  state.cymatics.position.set(0, -1.8, 0);
  state.cymaticPos = positions;
  state.group.add(state.cymatics);
}

// === WAVEFORM RIBBON — time-domain audio ===
function buildWaveform() {
  const count = 256;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const c = new THREE.Color();

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (i / count - 0.5) * 7;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;
    c.setHSL(i / count, 1, 0.6);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  state.waveform = new THREE.Line(geo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending
  }));
  state.waveform.position.set(0, 2.5, -1);
  state.waveformPos = positions;
  state.group.add(state.waveform);
}

// === HARMONIC PILLARS — 12 columns for band energy ===
function buildPillars() {
  const geo = new THREE.CylinderGeometry(0.06, 0.1, 1, 6);
  state.pillars = new THREE.InstancedMesh(geo,
    new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending }),
    12);
  state.pillars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  state.pillars.position.set(0, -1.5, 1.5);
  state.group.add(state.pillars);
}

function update(dt, t) {
  state.time = t;
  state.frameCount++;

  // Grab FFT + time-domain data
  if (state.analyser) {
    state.analyser.getFloatFrequencyData(state.fftData);
    state.analyser.getFloatTimeDomainData(state.timeData);
  }

  const fb = KI.get('freq-bands-12');
  const energy = fb ? Array.from({ length: 12 }, (_, i) => fb.getEnergy(i)) : new Array(12).fill(0);

  // Scroll FFT history every 2 frames
  if (state.frameCount % 2 === 0) {
    const row = state.historyRow % TIME_DEPTH;
    for (let i = 0; i < FREQ_BINS; i++) {
      const db = state.fftData[i] || -100;
      state.fftHistory[row * FREQ_BINS + i] = Math.max(0, (db + 100) / 100);
    }
    state.historyRow++;
  }

  updateTerrain(t, energy);
  updateCymatics(t, energy);
  updateWaveform(t);
  updatePillars(t, energy);
}

function updateTerrain(t, energy) {
  const pos = state.terrainPos;
  const col = state.terrainCol;
  const c = new THREE.Color();

  for (let row = 0; row < TIME_DEPTH; row++) {
    // Map visual row to history buffer (scrolling)
    const histRow = ((state.historyRow - TIME_DEPTH + row) % TIME_DEPTH + TIME_DEPTH) % TIME_DEPTH;
    for (let ci = 0; ci < FREQ_BINS; ci++) {
      const vi = (row * FREQ_BINS + ci) * 3;
      const val = state.fftHistory[histRow * FREQ_BINS + ci] || 0;
      pos[vi + 1] = val * 1.8; // Y displacement

      const bandIdx = Math.floor((ci / FREQ_BINS) * 12);
      const hue = bandIdx / 12;
      c.setHSL(hue, 0.6 + val * 0.4, 0.15 + val * 0.6);
      col[vi] = c.r; col[vi + 1] = c.g; col[vi + 2] = c.b;
    }
  }
  state.terrain.geometry.attributes.position.needsUpdate = true;
  state.terrain.geometry.attributes.color.needsUpdate = true;
}

function updateCymatics(t, energy) {
  const pos = state.cymaticPos;
  const col = state.cymatics.geometry.attributes.color.array;
  const c = new THREE.Color();
  const total = energy.reduce((a, b) => a + b, 0);

  for (let r = 0; r < CYMATIC_RINGS; r++) {
    const baseRadius = 0.5 + r * 0.4;
    const bandA = r % 12, bandB = (r + 6) % 12;
    const eA = energy[bandA], eB = energy[bandB];
    const nodes = 3 + r; // standing wave node count increases with ring

    for (let i = 0; i < CYMATIC_RES; i++) {
      const theta = (i / CYMATIC_RES) * Math.PI * 2;
      const idx = (r * CYMATIC_RES + i) * 3;

      // Standing wave displacement
      const wave = Math.sin(theta * nodes + t * 2) * eA * 0.3
                 + Math.cos(theta * (nodes + 2) - t * 1.5) * eB * 0.2;
      const dr = baseRadius + wave;

      pos[idx] = Math.cos(theta) * dr;
      pos[idx + 1] = wave * 0.5 + Math.sin(t * 0.8 + r) * total * 0.1; // vertical displacement
      pos[idx + 2] = Math.sin(theta) * dr;

      const brightness = 0.3 + (eA + eB) * 0.5;
      c.setHSL((r / CYMATIC_RINGS + t * 0.02) % 1, 0.8, brightness);
      col[idx] = c.r; col[idx + 1] = c.g; col[idx + 2] = c.b;
    }
  }
  state.cymatics.geometry.attributes.position.needsUpdate = true;
  state.cymatics.geometry.attributes.color.needsUpdate = true;
}

function updateWaveform(t) {
  const pos = state.waveformPos;
  for (let i = 0; i < 256; i++) {
    const sample = state.timeData[i] || 0;
    pos[i * 3 + 1] = sample * 1.5; // Y = amplitude
  }
  state.waveform.geometry.attributes.position.needsUpdate = true;
}

function updatePillars(t, energy) {
  const d = new THREE.Object3D(), c = new THREE.Color();
  const spacing = 0.6;
  for (let i = 0; i < 12; i++) {
    const h = 0.1 + energy[i] * 3;
    d.position.set((i - 5.5) * spacing, h / 2, 0);
    d.scale.set(1, h, 1);
    d.rotation.set(0, 0, 0);
    d.updateMatrix();
    state.pillars.setMatrixAt(i, d.matrix);
    c.setHSL(i / 12, 0.9, 0.3 + energy[i] * 0.6);
    state.pillars.setColorAt(i, c);
  }
  state.pillars.instanceMatrix.needsUpdate = true;
  state.pillars.instanceColor.needsUpdate = true;
}
