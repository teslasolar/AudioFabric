// liquid-symmetry.js — 3D cymatics interference pattern visualizer
// Voice creates standing wave interference patterns in a 3D field.
// Like Chladni plates but volumetric — sand patterns floating in space.
// Features:
// - 3D wave field: multiple point sources create interference
// - Pitch → wave frequency (controls pattern complexity)
// - Energy → wave amplitude (pattern visibility/height)
// - Coherence → symmetry order (2-fold, 3-fold, 5-fold, 8-fold)
// - Vowel → wave type (sine, square, sawtooth, triangle, noise)
// - Pulse → phase animation speed
// - Particles collect at nodal points (where waves cancel)
// - Crystal formations grow at high-energy intersections

import { KI } from './core.js';

const TAU = Math.PI * 2;

// ── Wave field parameters ──
const FIELD_RES = 32;           // 32x32x8 sample grid
const FIELD_DEPTH = 8;
const MAX_SOURCES = 8;          // interference point sources
let symmetryOrder = 4;
let waveFreq = 3;
let waveType = 'sine';
let phaseOffset = 0;

// ── 3D objects ──
let group = null;
// Nodal particles (collect where waves cancel)
let nodalSystem = null, nodalPos = null, nodalCol = null, nodalSize = null;
const MAX_NODAL = 2000;
// Crystal formations
let crystalMeshes = [];
const MAX_CRYSTALS = 40;
// Wave surface (top layer displacement map)
let waveSurface = null;
const SURFACE_RES = 48;
// Source indicators
let sourceMeshes = [];
// Interference rings
let ringMeshes = [];
const MAX_RINGS = 12;

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 2, -3];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── Nodal particles ──
  const nGeo = new THREE.BufferGeometry();
  nodalPos = new Float32Array(MAX_NODAL * 3);
  nodalCol = new Float32Array(MAX_NODAL * 3);
  nGeo.setAttribute('position', new THREE.BufferAttribute(nodalPos, 3));
  nGeo.setAttribute('color', new THREE.BufferAttribute(nodalCol, 3));
  nodalSystem = new THREE.Points(nGeo, new THREE.PointsMaterial({
    size: 0.04, vertexColors: true, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(nodalSystem);

  // ── Wave displacement surface ──
  const sGeo = new THREE.PlaneGeometry(6, 6, SURFACE_RES - 1, SURFACE_RES - 1);
  waveSurface = new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({
    color: 0x00aaff, transparent: true, opacity: 0.12, wireframe: true,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  }));
  waveSurface.rotation.x = -Math.PI / 2;
  waveSurface.position.y = -1;
  group.add(waveSurface);

  // ── Crystal meshes (emerge at high-energy points) ──
  for (let i = 0; i < MAX_CRYSTALS; i++) {
    const faces = 4 + Math.floor(Math.random() * 5); // 4-8 sided crystals
    const geo = new THREE.ConeGeometry(0.06, 0.3, faces);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xaaffee, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.userData = { energy: 0, age: 0, freq: 0 };
    group.add(mesh);
    crystalMeshes.push(mesh);
  }

  // ── Source indicators (where wave sources are) ──
  for (let i = 0; i < MAX_SOURCES; i++) {
    const geo = new THREE.SphereGeometry(0.06, 8, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffff00, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    group.add(mesh);
    sourceMeshes.push(mesh);
  }

  // ── Interference rings (expanding from sources) ──
  for (let i = 0; i < MAX_RINGS; i++) {
    const geo = new THREE.RingGeometry(0.5, 0.55, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ffaa, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    mesh.userData = { radius: 0, maxRadius: 3, sourceIdx: 0 };
    group.add(mesh);
    ringMeshes.push(mesh);
  }

  KI.register('liquid-symmetry', {
    update, group,
    getSymmetryOrder: () => symmetryOrder,
    getWaveFreq: () => waveFreq,
    getWaveType: () => waveType,
    getCrystalCount: () => crystalMeshes.filter(c => c.visible).length
  });

  KI.emit('liquid-symmetry:ready');
}

// ── Wave functions ──
function waveValue(phase) {
  switch (waveType) {
    case 'square': return Math.sign(Math.sin(phase));
    case 'sawtooth': return 2 * ((phase / TAU) % 1) - 1;
    case 'triangle': return 2 * Math.abs(2 * ((phase / TAU) % 1) - 1) - 1;
    case 'noise': return Math.sin(phase) * Math.sin(phase * 2.37) * Math.sin(phase * 0.73);
    default: return Math.sin(phase); // sine
  }
}

// ── Compute interference value at a point ──
function interferenceAt(x, y, z, sources, t) {
  let sum = 0;
  for (const src of sources) {
    const dx = x - src.x, dy = y - src.y, dz = z - src.z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 0.01;
    const phase = dist * waveFreq * TAU - t * 4 + phaseOffset + src.phase;
    sum += waveValue(phase) * src.amp / (1 + dist * 0.5);
  }
  return sum;
}

function update(dt, t) {
  const v = KI.voice;
  const energy = v.energy || 0;
  const coherence = v.coherence || 0;
  const pitch = v.pn || 0;
  const sounding = v.sounding;
  const pulseRate = v.pulseRate || 1;

  // ── Voice → wave parameters ──
  waveFreq = 1 + pitch * 8;  // 1-9 Hz visual frequency
  phaseOffset += dt * pulseRate * 2;

  // Vowel → wave type
  if (sounding) {
    const vowelWave = { a: 'sine', e: 'square', i: 'triangle', o: 'sawtooth', u: 'noise' };
    waveType = vowelWave[v.vowel || 'a'] || 'sine';
  }

  // Coherence → symmetry order
  symmetryOrder = Math.max(2, Math.round(2 + coherence * 6));

  // ── Generate wave sources in symmetric arrangement ──
  const sources = [];
  const sourceRadius = 2;
  for (let i = 0; i < symmetryOrder && i < MAX_SOURCES; i++) {
    const angle = (i / symmetryOrder) * TAU;
    const src = {
      x: Math.cos(angle) * sourceRadius,
      y: 0,
      z: Math.sin(angle) * sourceRadius,
      amp: 0.5 + energy * 0.5,
      phase: i * TAU / symmetryOrder
    };
    sources.push(src);

    // Update source indicator
    const mesh = sourceMeshes[i];
    mesh.visible = true;
    mesh.position.set(src.x, src.y, src.z);
    mesh.material.opacity = 0.3 + energy * 0.5;
    const pulse = 0.8 + Math.sin(t * 5 + i) * 0.2;
    mesh.scale.setScalar(pulse);
  }
  for (let i = symmetryOrder; i < MAX_SOURCES; i++) sourceMeshes[i].visible = false;

  // ── Update wave surface (displacement map) ──
  const surfPos = waveSurface.geometry.attributes.position.array;
  for (let i = 0; i < SURFACE_RES; i++) {
    for (let j = 0; j < SURFACE_RES; j++) {
      const idx = (i * SURFACE_RES + j) * 3;
      const x = (i / (SURFACE_RES - 1) - 0.5) * 6;
      const z = (j / (SURFACE_RES - 1) - 0.5) * 6;
      const val = interferenceAt(x, 0, z, sources, t);
      surfPos[idx + 1] = val * energy * 0.5; // Y displacement
    }
  }
  waveSurface.geometry.attributes.position.needsUpdate = true;
  waveSurface.material.opacity = 0.06 + energy * 0.1;
  const surfHue = pitch * 0.6 + 0.5;
  const srgb = hslToRgb(surfHue, 0.6, 0.3 + energy * 0.2);
  waveSurface.material.color.setRGB(srgb[0], srgb[1], srgb[2]);

  // ── Nodal particles: collect at interference nodes ──
  let nodalIdx = 0;
  const sampleStep = 6 / FIELD_RES;
  for (let ix = 0; ix < FIELD_RES && nodalIdx < MAX_NODAL; ix++) {
    for (let iz = 0; iz < FIELD_RES && nodalIdx < MAX_NODAL; iz++) {
      for (let iy = 0; iy < FIELD_DEPTH && nodalIdx < MAX_NODAL; iy++) {
        const x = (ix / (FIELD_RES-1) - 0.5) * 6;
        const y = (iy / (FIELD_DEPTH-1) - 0.5) * 3;
        const z = (iz / (FIELD_RES-1) - 0.5) * 6;
        const val = interferenceAt(x, y, z, sources, t);
        const absVal = Math.abs(val);

        // Particles gather at nodal points (near-zero interference)
        if (absVal < 0.15 * (1 + energy)) {
          nodalPos[nodalIdx*3] = x + (Math.random()-0.5) * 0.1;
          nodalPos[nodalIdx*3+1] = y + (Math.random()-0.5) * 0.1;
          nodalPos[nodalIdx*3+2] = z + (Math.random()-0.5) * 0.1;

          // Color by local field gradient
          const hue = (absVal * 5 + pitch * 0.3) % 1;
          const rgb = hslToRgb(hue, 0.7, 0.3 + energy * 0.3);
          nodalCol[nodalIdx*3] = rgb[0]; nodalCol[nodalIdx*3+1] = rgb[1]; nodalCol[nodalIdx*3+2] = rgb[2];
          nodalIdx++;
        }
      }
    }
  }
  // Fade remaining
  for (let i = nodalIdx; i < MAX_NODAL; i++) {
    nodalCol[i*3] *= 0.9; nodalCol[i*3+1] *= 0.9; nodalCol[i*3+2] *= 0.9;
  }
  nodalSystem.geometry.attributes.position.needsUpdate = true;
  nodalSystem.geometry.attributes.color.needsUpdate = true;

  // ── Crystal growth at sustained high-energy nodal points ──
  let crystalIdx = 0;
  if (energy > 0.3 && sounding) {
    for (let i = 0; i < MAX_CRYSTALS; i++) {
      const crystal = crystalMeshes[i];
      if (crystal.visible) {
        crystal.userData.age += dt;
        crystal.userData.energy += energy * dt * 0.5;
        const scale = Math.min(2, 0.5 + crystal.userData.energy * 0.3);
        crystal.scale.setScalar(scale);
        crystal.material.opacity = Math.min(0.6, crystal.userData.energy * 0.15);
        crystal.rotation.y += dt * 0.5;

        // Fade out old crystals
        if (crystal.userData.age > 8) {
          crystal.material.opacity *= 0.95;
          if (crystal.material.opacity < 0.01) { crystal.visible = false; crystal.userData.age = 0; crystal.userData.energy = 0; }
        }
      } else if (crystalIdx < 2 && Math.random() < energy * dt * 2) {
        // Spawn new crystal at a random nodal point
        if (nodalIdx > 0) {
          const pick = Math.floor(Math.random() * nodalIdx) * 3;
          crystal.position.set(nodalPos[pick], nodalPos[pick+1], nodalPos[pick+2]);
          crystal.visible = true;
          crystal.userData.age = 0;
          crystal.userData.energy = 0;
          crystal.userData.freq = waveFreq;
          const cHue = (pitch + i * 0.05) % 1;
          const crgb = hslToRgb(cHue, 0.6, 0.4);
          crystal.material.color.setRGB(crgb[0], crgb[1], crgb[2]);
          crystalIdx++;
        }
      }
    }
  } else {
    // Fade all crystals when voice stops
    for (const crystal of crystalMeshes) {
      if (crystal.visible) {
        crystal.material.opacity *= 0.98;
        if (crystal.material.opacity < 0.01) { crystal.visible = false; crystal.userData.energy = 0; }
      }
    }
  }

  // ── Expanding interference rings ──
  for (let i = 0; i < MAX_RINGS; i++) {
    const ring = ringMeshes[i];
    if (ring.visible) {
      ring.userData.radius += dt * 2;
      if (ring.userData.radius > ring.userData.maxRadius) {
        ring.visible = false;
      } else {
        const r = ring.userData.radius;
        ring.scale.setScalar(r * 2);
        ring.material.opacity = (1 - r / ring.userData.maxRadius) * 0.15 * energy;
        const src = sources[ring.userData.sourceIdx % sources.length];
        if (src) ring.position.set(src.x, src.y, src.z);
      }
    }
  }
  // Spawn new rings
  if (sounding && Math.random() < energy * dt * 3) {
    const idle = ringMeshes.find(r => !r.visible);
    if (idle) {
      idle.visible = true;
      idle.userData.radius = 0;
      idle.userData.maxRadius = 2 + Math.random() * 2;
      idle.userData.sourceIdx = Math.floor(Math.random() * sources.length);
      const rHue = Math.random();
      const rrgb = hslToRgb(rHue, 0.7, 0.4);
      idle.material.color.setRGB(rrgb[0], rrgb[1], rrgb[2]);
    }
  }

  // ── Group rotation ──
  group.rotation.y += dt * 0.04;

  KI.emit('liquid-symmetry:update', {
    symmetryOrder,
    waveFreq: waveFreq.toFixed(1),
    waveType,
    nodalCount: nodalIdx,
    crystalCount: crystalMeshes.filter(c => c.visible).length,
    sourceCount: sources.length
  });
}

function hslToRgb(h, s, l) {
  if (KI.hslToRgb) return KI.hslToRgb(h, s, l);
  let r, g, b;
  if (s === 0) { r = g = b = l; } else {
    const hue2rgb = (p, q, t) => { if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p; };
    const q = l < 0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
    r = hue2rgb(p, q, h+1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h-1/3);
  }
  return [r, g, b];
}
