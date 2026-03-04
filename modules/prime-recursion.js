// prime-recursion.js — Prime number recursive geometry
// Ulam spiral, Golden angle spiral, Sacks spiral — all voice-reactive
// Maps 12 frequency bands to the first 12 primes: 2,3,5,7,11,13,17,19,23,29,31,37
// Primes and their multiples glow when the corresponding band is active
// Twin prime pairs connected by arcs

import { KI } from './core.js';

const BAND_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37];
const MAX_N = 500;

const state = {
  group: null,
  time: 0,
  mode: 0,          // 0=ulam, 1=golden, 2=sacks
  primeSet: null,
  primeList: null,
  ulamCoords: null,  // pre-computed [x,y] pairs
  ulamMesh: null,
  goldenMesh: null,
  sacksMesh: null,
  twinArcs: null
};

// === PRIME SIEVE ===
function sieve(n) {
  const s = new Uint8Array(n + 1);
  s[0] = s[1] = 1;
  for (let i = 2; i * i <= n; i++) {
    if (!s[i]) for (let j = i * i; j <= n; j += i) s[j] = 1;
  }
  return s;
}

// === ULAM SPIRAL: integer n → (x, y) coordinate ===
function computeUlam(count) {
  const coords = new Float32Array(count * 2);
  let x = 0, y = 0, dx = 1, dy = 0;
  let segLen = 1, segDone = 0, turns = 0;
  coords[0] = 0; coords[1] = 0;
  for (let i = 1; i < count; i++) {
    x += dx; y += dy; segDone++;
    if (segDone === segLen) {
      segDone = 0;
      const tmp = dx; dx = -dy; dy = tmp;
      turns++;
      if (turns % 2 === 0) segLen++;
    }
    coords[i * 2] = x;
    coords[i * 2 + 1] = y;
  }
  return coords;
}

export function init(opts = {}) {
  const pos = opts.position || [3, 5, 0];
  const scale = opts.scale || 1;

  const sieveArr = sieve(MAX_N);
  state.primeSet = new Set();
  state.primeList = [];
  for (let i = 2; i <= MAX_N; i++) {
    if (!sieveArr[i]) { state.primeSet.add(i); state.primeList.push(i); }
  }
  state.ulamCoords = computeUlam(MAX_N);

  state.group = new THREE.Group();
  state.group.position.set(pos[0], pos[1], pos[2]);
  state.group.scale.setScalar(scale);
  KI.scene.add(state.group);

  buildUlam();
  buildGolden();
  buildSacks();
  buildTwinArcs();
  setMode(0);

  KI.register('prime-recursion', { update, state, setMode, cycleMode });
  KI.emit('prime-recursion:ready');
}

// === ULAM SPIRAL — InstancedMesh of spheres ===
function buildUlam() {
  const sp = 0.12;
  const geo = new THREE.SphereGeometry(0.04, 4, 4);
  state.ulamMesh = new THREE.InstancedMesh(geo,
    new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending }),
    MAX_N);
  state.ulamMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const d = new THREE.Object3D(), c = new THREE.Color();
  for (let i = 0; i < MAX_N; i++) {
    d.position.set(state.ulamCoords[i * 2] * sp, state.ulamCoords[i * 2 + 1] * sp, 0);
    d.scale.setScalar(1); d.updateMatrix();
    state.ulamMesh.setMatrixAt(i, d.matrix);
    if (state.primeSet.has(i + 1)) c.setHSL(((i + 1) * 0.618) % 1, 1, 0.65);
    else c.setRGB(0.06, 0.06, 0.1);
    state.ulamMesh.setColorAt(i, c);
  }
  state.ulamMesh.instanceMatrix.needsUpdate = true;
  state.ulamMesh.instanceColor.needsUpdate = true;
  state.group.add(state.ulamMesh);
}

// === GOLDEN ANGLE SPIRAL — Points ===
function buildGolden() {
  const phi = Math.PI * (3 - Math.sqrt(5));
  const pos = new Float32Array(MAX_N * 3);
  const col = new Float32Array(MAX_N * 3);
  const c = new THREE.Color();
  for (let i = 0; i < MAX_N; i++) {
    const n = i + 1, r = Math.sqrt(n) * 0.12, theta = i * phi;
    pos[i * 3] = r * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(theta);
    pos[i * 3 + 2] = 0;
    if (state.primeSet.has(n)) c.setHSL((n * 7 % 360) / 360, 1, 0.7);
    else c.setRGB(0.08, 0.08, 0.12);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  state.goldenMesh = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.1, vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  state.group.add(state.goldenMesh);
}

// === SACKS SPIRAL — Points (n at angle 2pi*sqrt(n), radius sqrt(n)) ===
function buildSacks() {
  const pos = new Float32Array(MAX_N * 3);
  const col = new Float32Array(MAX_N * 3);
  const c = new THREE.Color();
  for (let i = 0; i < MAX_N; i++) {
    const n = i + 1, sqn = Math.sqrt(n);
    const theta = 2 * Math.PI * sqn, r = sqn * 0.1;
    pos[i * 3] = r * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(theta);
    pos[i * 3 + 2] = 0;
    if (state.primeSet.has(n)) c.setHSL((sqn * 0.3) % 1, 1, 0.7);
    else c.setRGB(0.05, 0.05, 0.08);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  state.sacksMesh = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.1, vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  state.group.add(state.sacksMesh);
}

// === TWIN PRIME ARCS — LineSegments connecting (p, p+2) pairs on Ulam ===
function buildTwinArcs() {
  const sp = 0.12;
  const arcPoints = [];
  const arcColors = [];
  const c = new THREE.Color();
  for (let i = 0; i < state.primeList.length - 1; i++) {
    if (state.primeList[i + 1] - state.primeList[i] !== 2) continue;
    const p1 = state.primeList[i] - 1, p2 = state.primeList[i + 1] - 1;
    const x1 = state.ulamCoords[p1 * 2] * sp, y1 = state.ulamCoords[p1 * 2 + 1] * sp;
    const x2 = state.ulamCoords[p2 * 2] * sp, y2 = state.ulamCoords[p2 * 2 + 1] * sp;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    // 8-segment bezier arc
    for (let s = 0; s < 8; s++) {
      const t0 = s / 8, t1 = (s + 1) / 8;
      for (const t of [t0, t1]) {
        const u = 1 - t;
        const px = u * u * x1 + 2 * u * t * mx + t * t * x2;
        const py = u * u * y1 + 2 * u * t * my + t * t * y2;
        const pz = 4 * t * (1 - t) * 0.2; // parabolic arc height
        arcPoints.push(px, py, pz);
        c.setHSL((state.primeList[i] * 0.05) % 1, 1, 0.5);
        arcColors.push(c.r, c.g, c.b);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(arcPoints, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(arcColors, 3));
  state.twinArcs = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending
  }));
  state.group.add(state.twinArcs);
}

export function setMode(m) {
  state.mode = m % 3;
  state.ulamMesh.visible = state.mode === 0;
  state.goldenMesh.visible = state.mode === 1;
  state.sacksMesh.visible = state.mode === 2;
  state.twinArcs.visible = state.mode === 0;
  const names = ['Ulam Spiral', 'Golden Angle', 'Sacks Spiral'];
  KI.emit('prime-recursion:mode', { mode: state.mode, name: names[state.mode] });
}

export function cycleMode() { setMode(state.mode + 1); }

function update(dt, t) {
  state.time = t;
  const fb = KI.get('freq-bands-12');
  const energy = fb ? Array.from({ length: 12 }, (_, i) => fb.getEnergy(i)) : new Array(12).fill(0);

  state.group.rotation.y = t * 0.05;
  state.group.rotation.x = Math.sin(t * 0.08) * 0.1;

  if (state.mode === 0) updateUlam(t, energy);
  else if (state.mode === 1) updateGolden(t, energy);
  else updateSacks(t, energy);

  const activePrimes = BAND_PRIMES.filter((_, i) => energy[i] > 0.1);
  KI.emit('prime-recursion:update', { mode: state.mode, activePrimes, energy: energy.reduce((a, b) => a + b, 0) });
}

function updateUlam(t, energy) {
  const sp = 0.12;
  const d = new THREE.Object3D(), c = new THREE.Color();
  for (let i = 0; i < MAX_N; i++) {
    const n = i + 1;
    let glow = 0;
    if (state.primeSet.has(n)) {
      for (let b = 0; b < 12; b++) {
        if (n === BAND_PRIMES[b] || n % BAND_PRIMES[b] === 0) glow = Math.max(glow, energy[b]);
      }
    } else {
      for (let b = 0; b < 12; b++) {
        if (n % BAND_PRIMES[b] === 0) glow = Math.max(glow, energy[b] * 0.15);
      }
    }
    d.position.set(state.ulamCoords[i * 2] * sp, state.ulamCoords[i * 2 + 1] * sp, glow * 0.4);
    d.scale.setScalar(state.primeSet.has(n) ? 1 + glow * 2.5 : 0.5 + glow);
    d.updateMatrix();
    state.ulamMesh.setMatrixAt(i, d.matrix);
    if (state.primeSet.has(n)) c.setHSL(((n * 0.618) + t * 0.02) % 1, 0.9, 0.35 + glow * 0.55);
    else c.setRGB(0.06 + glow * 0.4, 0.06 + glow * 0.1, 0.1 + glow * 0.5);
    state.ulamMesh.setColorAt(i, c);
  }
  state.ulamMesh.instanceMatrix.needsUpdate = true;
  state.ulamMesh.instanceColor.needsUpdate = true;
}

function updateGolden(t, energy) {
  const phi = Math.PI * (3 - Math.sqrt(5));
  const pos = state.goldenMesh.geometry.attributes.position.array;
  const col = state.goldenMesh.geometry.attributes.color.array;
  const c = new THREE.Color();
  for (let i = 0; i < MAX_N; i++) {
    const n = i + 1, r = Math.sqrt(n) * 0.12;
    const theta = i * phi + t * 0.05;
    pos[i * 3] = r * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(theta);
    let glow = 0;
    if (state.primeSet.has(n)) {
      for (let b = 0; b < 12; b++) {
        if (n === BAND_PRIMES[b] || n % BAND_PRIMES[b] === 0) glow = Math.max(glow, energy[b]);
      }
      pos[i * 3 + 2] = glow * 0.6;
      c.setHSL((n * 7 % 360) / 360, 1, 0.45 + glow * 0.45);
    } else {
      pos[i * 3 + 2] = 0;
      c.setRGB(0.06, 0.06, 0.1);
    }
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  state.goldenMesh.geometry.attributes.position.needsUpdate = true;
  state.goldenMesh.geometry.attributes.color.needsUpdate = true;
}

function updateSacks(t, energy) {
  const pos = state.sacksMesh.geometry.attributes.position.array;
  const col = state.sacksMesh.geometry.attributes.color.array;
  const c = new THREE.Color();
  for (let i = 0; i < MAX_N; i++) {
    const n = i + 1, sqn = Math.sqrt(n);
    const theta = 2 * Math.PI * sqn + t * 0.03, r = sqn * 0.1;
    pos[i * 3] = r * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(theta);
    let glow = 0;
    if (state.primeSet.has(n)) {
      for (let b = 0; b < 12; b++) {
        if (n === BAND_PRIMES[b] || n % BAND_PRIMES[b] === 0) glow = Math.max(glow, energy[b]);
      }
      pos[i * 3 + 2] = glow * 0.5 + Math.sin(t + n) * 0.05;
      c.setHSL((sqn * 0.3 + t * 0.01) % 1, 1, 0.45 + glow * 0.45);
    } else {
      pos[i * 3 + 2] = 0;
      c.setRGB(0.05, 0.05, 0.08);
    }
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  state.sacksMesh.geometry.attributes.position.needsUpdate = true;
  state.sacksMesh.geometry.attributes.color.needsUpdate = true;
}
