// genesis.js — From Singularity to Universe
// One unified object that expands from a tiny point to a full cosmic body.
// Combines: glowing core, prime recursion orbits, wormhole tunnel rings,
// waveform corona ribbons, explosion burst particles.
// Voice energy ACCUMULATES expansion over time (not instant).
// Stages: Singularity → Core Ignition → Prime Eruption →
//         Wormhole Breach → Waveform Corona → Universe

import { KI } from './core.js';

const PRIME_N = 300;
const TUNNEL_RINGS = 10;
const RING_CUBES = 8;
const WAVE_LINES = 4;
const WAVE_PTS = 200;
const BURST_N = 200;
const BAND_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37];

const STAGES = [
  { name: 'SINGULARITY',     threshold: 0.00 },
  { name: 'CORE IGNITION',   threshold: 0.10 },
  { name: 'PRIME ERUPTION',  threshold: 0.30 },
  { name: 'WORMHOLE BREACH', threshold: 0.50 },
  { name: 'WAVEFORM CORONA', threshold: 0.70 },
  { name: 'UNIVERSE',        threshold: 0.90 }
];

const state = {
  group: null,
  time: 0,
  expansion: 0,       // accumulates 0→1 over session
  smoothExp: 0,
  stage: 0,
  burstForce: 0,      // decaying burst intensity
  // meshes
  core: null,
  coreGlow: null,
  atmosphere: null,
  primePoints: null, primePos: null, primeCol: null,
  tunnelMesh: null,
  waveLines: [], wavePos: [], waveCol: [],
  burstPoints: null, burstPos: null, burstCol: null, burstDir: null, burstPhase: null,
  // data
  primeSet: null,
  analyser: null,
  timeData: null
};

function isPrime(n) {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

export function init(opts = {}) {
  const pos = opts.position || [0, 3, -2];
  const scale = opts.scale || 1;

  state.group = new THREE.Group();
  state.group.position.set(pos[0], pos[1], pos[2]);
  state.group.scale.setScalar(scale);
  KI.scene.add(state.group);

  state.timeData = new Float32Array(256);
  if (KI.analyser) state.analyser = KI.analyser;
  else KI.on('audio:ready', () => { state.analyser = KI.analyser; });

  state.primeSet = new Set();
  for (let n = 2; n <= PRIME_N; n++) if (isPrime(n)) state.primeSet.add(n);

  buildCore();
  buildPrimes();
  buildTunnel();
  buildWaves();
  buildBurst();

  KI.register('genesis', { update, state, STAGES });
  KI.emit('genesis:ready');
}

// === CORE: sphere + glow + atmosphere ===
function buildCore() {
  state.core = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 24),
    new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  state.core.scale.setScalar(0.01);
  state.group.add(state.core);

  state.coreGlow = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0xff8800, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    })
  );
  state.group.add(state.coreGlow);

  state.atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(3, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0x4488ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    })
  );
  state.group.add(state.atmosphere);
}

// === PRIME SPIRAL: points orbiting the core ===
function buildPrimes() {
  const pos = new Float32Array(PRIME_N * 3);
  const col = new Float32Array(PRIME_N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  state.primePoints = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.08, vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  state.primePos = pos;
  state.primeCol = col;
  state.group.add(state.primePoints);
}

// === WORMHOLE RINGS: InstancedMesh cubes orbiting in tilted planes ===
function buildTunnel() {
  const count = TUNNEL_RINGS * RING_CUBES;
  const geo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
  state.tunnelMesh = new THREE.InstancedMesh(geo,
    new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending }),
    count);
  state.tunnelMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  state.tunnelMesh.count = count;
  const d = new THREE.Object3D(), c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    d.position.set(0, 0, 0); d.scale.setScalar(0.001); d.updateMatrix();
    state.tunnelMesh.setMatrixAt(i, d.matrix);
    c.setRGB(0, 0, 0);
    state.tunnelMesh.setColorAt(i, c);
  }
  state.tunnelMesh.instanceMatrix.needsUpdate = true;
  state.tunnelMesh.instanceColor.needsUpdate = true;
  state.group.add(state.tunnelMesh);
}

// === WAVEFORM CORONA: spiral lines wrapping the outer shell ===
function buildWaves() {
  for (let w = 0; w < WAVE_LINES; w++) {
    const pos = new Float32Array(WAVE_PTS * 3);
    const col = new Float32Array(WAVE_PTS * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    state.waveLines.push(line);
    state.wavePos.push(pos);
    state.waveCol.push(col);
    state.group.add(line);
  }
}

// === BURST PARTICLES: explosion corona ===
function buildBurst() {
  const pos = new Float32Array(BURST_N * 3);
  const col = new Float32Array(BURST_N * 3);
  const dir = new Float32Array(BURST_N * 3);
  const phase = new Float32Array(BURST_N);

  for (let i = 0; i < BURST_N; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    dir[i * 3] = Math.sin(phi) * Math.cos(theta);
    dir[i * 3 + 1] = Math.cos(phi);
    dir[i * 3 + 2] = Math.sin(phi) * Math.sin(theta);
    pos[i * 3] = dir[i * 3] * 0.01;
    pos[i * 3 + 1] = dir[i * 3 + 1] * 0.01;
    pos[i * 3 + 2] = dir[i * 3 + 2] * 0.01;
    phase[i] = Math.random() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  state.burstPoints = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.04, vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  state.burstPos = pos;
  state.burstCol = col;
  state.burstDir = dir;
  state.burstPhase = phase;
  state.group.add(state.burstPoints);
}

// === MAIN UPDATE ===
function update(dt, t) {
  state.time = t;

  if (state.analyser) state.analyser.getFloatTimeDomainData(state.timeData);

  const fb = KI.get('freq-bands-12');
  const energy = fb ? Array.from({ length: 12 }, (_, i) => fb.getEnergy(i)) : new Array(12).fill(0);
  const total = energy.reduce((a, b) => a + b, 0);

  // Expansion: ACCUMULATES with voice, slow decay in silence
  state.expansion += total * dt * 0.25;
  state.expansion -= dt * 0.015;
  state.expansion = Math.max(0, Math.min(1, state.expansion));
  state.smoothExp += (state.expansion - state.smoothExp) * dt * 4;
  const exp = state.smoothExp;

  // Burst force: spikes on loud moments, decays fast
  if (total > 0.5) state.burstForce = Math.max(state.burstForce, total * 2);
  state.burstForce *= 0.94;

  // Stage detection
  let newStage = 0;
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (exp >= STAGES[i].threshold) { newStage = i; break; }
  }
  if (newStage !== state.stage) {
    state.stage = newStage;
    KI.emit('genesis:stage', { stage: newStage, name: STAGES[newStage].name });
  }

  updateCore(t, exp, total, energy);
  updatePrimes(t, exp, total, energy);
  updateTunnel(t, exp, total, energy);
  updateWaves(t, exp, total, energy);
  updateBurst(t, exp, total);

  // Majestic rotation
  state.group.rotation.y = t * 0.04;
  state.group.rotation.x = Math.sin(t * 0.03) * 0.08;

  KI.emit('genesis:update', { expansion: exp, stage: state.stage, energy: total });
}

// === CORE ===
function updateCore(t, exp, total, energy) {
  const scale = 0.01 + exp * 2.5;
  const pulse = 1 + Math.sin(t * 2) * 0.03 * (1 + total * 3);

  state.core.scale.setScalar(scale * pulse);
  const hue = (exp * 0.7 + t * 0.015) % 1;
  state.core.material.color.setHSL(hue, 0.6 + exp * 0.4, Math.min(1, 0.7 - exp * 0.2 + total * 0.2));
  state.core.material.opacity = 0.5 + total * 0.3;

  state.coreGlow.scale.setScalar(scale * 1.4 + total * 0.5);
  state.coreGlow.material.opacity = exp * 0.12 + total * 0.1;
  state.coreGlow.material.color.setHSL((hue + 0.05) % 1, 0.9, 0.4);

  const atmoVis = Math.max(0, (exp - 0.5) * 2);
  state.atmosphere.scale.setScalar(scale * 1.8);
  state.atmosphere.material.opacity = atmoVis * 0.06 + total * 0.03;
  state.atmosphere.material.color.setHSL((hue + 0.3) % 1, 0.7, 0.5);
}

// === PRIME ORBITS ===
function updatePrimes(t, exp, total, energy) {
  const vis = Math.min(1, Math.max(0, (exp - 0.15) / 0.25));
  const coreR = 0.01 + exp * 2.5;
  const pos = state.primePos, col = state.primeCol;
  const c = new THREE.Color();

  for (let i = 0; i < PRIME_N; i++) {
    const n = i + 1;
    const sqn = Math.sqrt(n);

    // Sacks-spiral orbital position
    const phi = Math.acos(1 - 2 * (i / PRIME_N));
    const theta = 2 * Math.PI * sqn + t * 0.08;
    const baseR = coreR * 1.15 + sqn * 0.025 * (1 + exp);

    let glow = 0;
    if (state.primeSet.has(n)) {
      for (let b = 0; b < 12; b++) {
        if (n === BAND_PRIMES[b] || n % BAND_PRIMES[b] === 0)
          glow = Math.max(glow, energy[b]);
      }
    }

    const r = baseR + glow * 0.5;
    pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.cos(phi);
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    if (state.primeSet.has(n)) {
      c.setHSL((sqn * 0.3 + t * 0.01) % 1, 1, 0.4 + glow * 0.5);
    } else {
      c.setRGB(0.05, 0.05, 0.08);
    }
    col[i * 3] = c.r * vis; col[i * 3 + 1] = c.g * vis; col[i * 3 + 2] = c.b * vis;
  }

  state.primePoints.geometry.attributes.position.needsUpdate = true;
  state.primePoints.geometry.attributes.color.needsUpdate = true;
  state.primePoints.material.size = 0.06 + exp * 0.06 + total * 0.04;
}

// === WORMHOLE RINGS ===
function updateTunnel(t, exp, total, energy) {
  const vis = Math.min(1, Math.max(0, (exp - 0.4) / 0.25));
  const coreR = 0.01 + exp * 2.5;
  const d = new THREE.Object3D(), c = new THREE.Color();

  let idx = 0;
  for (let r = 0; r < TUNNEL_RINGS; r++) {
    const ringR = coreR * 1.25 + r * 0.4 * vis;
    const ringSpeed = t * (0.3 + r * 0.06) + r * 0.5;
    const tilt = r * 0.18;

    for (let i = 0; i < RING_CUBES; i++) {
      const a = (i / RING_CUBES) * Math.PI * 2 + ringSpeed;
      let x = Math.cos(a) * ringR;
      let y = Math.sin(a) * ringR;
      let z = 0;
      // tilt each ring differently
      const cosT = Math.cos(tilt), sinT = Math.sin(tilt);
      const ny = y * cosT - z * sinT;
      const nz = y * sinT + z * cosT;

      d.position.set(x, ny, nz);
      d.scale.setScalar(vis * (0.8 + energy[idx % 12] * 0.5));
      d.rotation.set(t * 0.5 + r, t * 0.3 + i, 0);
      d.updateMatrix();
      state.tunnelMesh.setMatrixAt(idx, d.matrix);

      c.setHSL((r / TUNNEL_RINGS + t * 0.02) % 1, 0.8, 0.3 + energy[idx % 12] * 0.5);
      state.tunnelMesh.setColorAt(idx, c);
      idx++;
    }
  }
  state.tunnelMesh.instanceMatrix.needsUpdate = true;
  state.tunnelMesh.instanceColor.needsUpdate = true;
}

// === WAVEFORM CORONA ===
function updateWaves(t, exp, total, energy) {
  const vis = Math.min(1, Math.max(0, (exp - 0.6) / 0.25));
  const coreR = 0.01 + exp * 2.5;
  const c = new THREE.Color();

  for (let w = 0; w < WAVE_LINES; w++) {
    const pos = state.wavePos[w], col = state.waveCol[w];
    const line = state.waveLines[w];
    line.material.opacity = vis * 0.85;

    const tiltX = (w / WAVE_LINES) * Math.PI;
    const tiltZ = w * 0.35;
    const wrapSpeed = t * 0.1 * (1 + w * 0.15);

    for (let i = 0; i < WAVE_PTS; i++) {
      const u = i / (WAVE_PTS - 1);
      const phi = u * Math.PI;
      const theta = u * 6 * Math.PI + wrapSpeed;

      const audioIdx = Math.floor(u * 255);
      const sample = state.timeData[audioIdx] || 0;
      const r = coreR * 1.12 + sample * 0.35 * (1 + total);

      let x = r * Math.sin(phi) * Math.cos(theta);
      let y = r * Math.cos(phi);
      let z = r * Math.sin(phi) * Math.sin(theta);

      // tilt
      const cosT = Math.cos(tiltX), sinT = Math.sin(tiltX);
      const ny = y * cosT - z * sinT, nz = y * sinT + z * cosT;
      y = ny; z = nz;
      const cosZ = Math.cos(tiltZ), sinZ = Math.sin(tiltZ);
      const nx = x * cosZ - y * sinZ, ny2 = x * sinZ + y * cosZ;
      x = nx; y = ny2;

      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      c.setHSL((u + w / WAVE_LINES) % 1, 1, 0.45 + Math.abs(sample) * 0.4);
      col[i * 3] = c.r * vis; col[i * 3 + 1] = c.g * vis; col[i * 3 + 2] = c.b * vis;
    }
    line.geometry.attributes.position.needsUpdate = true;
    line.geometry.attributes.color.needsUpdate = true;
  }
}

// === BURST PARTICLES ===
function updateBurst(t, exp, total) {
  const vis = Math.min(1, Math.max(0, (exp - 0.25) / 0.35));
  const coreR = 0.01 + exp * 2.5;
  const pos = state.burstPos, col = state.burstCol;
  const dir = state.burstDir, phase = state.burstPhase;
  const c = new THREE.Color();
  const bf = state.burstForce;

  for (let i = 0; i < BURST_N; i++) {
    const p = phase[i];
    const baseR = coreR * 1.4 + Math.sin(t * 0.5 + p) * 0.3;
    const r = (baseR + bf * 1.5 * Math.max(0, Math.sin(t * 2 + p))) * vis;

    pos[i * 3] = dir[i * 3] * r;
    pos[i * 3 + 1] = dir[i * 3 + 1] * r;
    pos[i * 3 + 2] = dir[i * 3 + 2] * r;

    const brightness = vis * (0.3 + bf * 0.3 + total * 0.3);
    c.setHSL((i / BURST_N + t * 0.008) % 1, 0.9, Math.min(0.8, brightness * 0.6));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }

  state.burstPoints.geometry.attributes.position.needsUpdate = true;
  state.burstPoints.geometry.attributes.color.needsUpdate = true;
  state.burstPoints.material.size = 0.03 + total * 0.05 + exp * 0.03;
}
