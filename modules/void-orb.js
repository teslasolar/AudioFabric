// void-orb.js — Black hole sphere with accretion disk and spatial distortion
// A central sphere that devours light. Features:
// - Dark core that absorbs surrounding particles (event horizon)
// - Spinning accretion disk of superheated matter
// - Gravitational lensing ring (photon sphere)
// - Infalling particle streams spiraling inward
// - Energy → accretion rate, disk brightness
// - Pitch → Hawking radiation color (red-shift to blue-shift)
// - Coherence → disk stability (smooth ring vs chaotic spiral)
// - Vowel → void mode (singularity, quasar, wormhole, pulsar, hawking)
// - Pulse → gravitational wave oscillation

import { KI } from './core.js';

const TAU = Math.PI * 2;

// ── Config ──
const DISK_RINGS = 6;
const DISK_SEGMENTS = 80;
const MAX_INFALL = 400;      // infalling particles
const MAX_JET = 300;         // relativistic jet particles
const LENSING_SEGMENTS = 64; // photon ring resolution

let group = null;
let coreMesh = null, coreMat = null;
let diskLines = [], diskMats = [];
let lensingLine = null, lensingMat = null;
let infallSystem = null, infallPos = null, infallCol = null;
let infallData = [];
let jetSystem = null, jetPos = null, jetCol = null;
let jetData = [];
let voidMode = 'singularity';

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 2.5, -3.5];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── Event horizon (pitch-black sphere) ──
  const coreGeo = new THREE.SphereGeometry(0.4, 24, 16);
  coreMat = new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.95
  });
  coreMesh = new THREE.Mesh(coreGeo, coreMat);
  group.add(coreMesh);

  // ── Accretion disk rings ──
  for (let r = 0; r < DISK_RINGS; r++) {
    const radius = 0.7 + r * 0.2;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(DISK_SEGMENTS * 3);
    for (let s = 0; s < DISK_SEGMENTS; s++) {
      const angle = (s / DISK_SEGMENTS) * TAU;
      positions[s * 3] = Math.cos(angle) * radius;
      positions[s * 3 + 1] = 0;
      positions[s * 3 + 2] = Math.sin(angle) * radius;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xff4400, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const line = new THREE.LineLoop(geo, mat);
    line.rotation.x = Math.PI * 0.45; // tilt disk
    group.add(line);
    diskLines.push(line);
    diskMats.push(mat);
  }

  // ── Photon sphere (lensing ring) ──
  const lGeo = new THREE.BufferGeometry();
  const lPos = new Float32Array(LENSING_SEGMENTS * 3);
  for (let s = 0; s < LENSING_SEGMENTS; s++) {
    const angle = (s / LENSING_SEGMENTS) * TAU;
    lPos[s * 3] = Math.cos(angle) * 0.55;
    lPos[s * 3 + 1] = 0;
    lPos[s * 3 + 2] = Math.sin(angle) * 0.55;
  }
  lGeo.setAttribute('position', new THREE.BufferAttribute(lPos, 3));
  lensingMat = new THREE.LineBasicMaterial({
    color: 0xffeedd, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  lensingLine = new THREE.LineLoop(lGeo, lensingMat);
  lensingLine.rotation.x = Math.PI * 0.45;
  group.add(lensingLine);

  // ── Infalling particles ──
  const iGeo = new THREE.BufferGeometry();
  infallPos = new Float32Array(MAX_INFALL * 3);
  infallCol = new Float32Array(MAX_INFALL * 3);
  for (let i = 0; i < MAX_INFALL; i++) {
    const angle = Math.random() * TAU;
    const r = 0.5 + Math.random() * 1.5;
    const y = (Math.random() - 0.5) * 0.6;
    infallPos[i * 3] = Math.cos(angle) * r;
    infallPos[i * 3 + 1] = y;
    infallPos[i * 3 + 2] = Math.sin(angle) * r;
    infallData.push({ angle, r, y, speed: 0.5 + Math.random() * 1.5, orbitSpeed: 1 + Math.random() * 3 });
  }
  iGeo.setAttribute('position', new THREE.BufferAttribute(infallPos, 3));
  iGeo.setAttribute('color', new THREE.BufferAttribute(infallCol, 3));
  infallSystem = new THREE.Points(iGeo, new THREE.PointsMaterial({
    size: 0.035, vertexColors: true, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(infallSystem);

  // ── Relativistic jets (bipolar) ──
  const jGeo = new THREE.BufferGeometry();
  jetPos = new Float32Array(MAX_JET * 3);
  jetCol = new Float32Array(MAX_JET * 3);
  for (let i = 0; i < MAX_JET; i++) {
    const dir = i < MAX_JET / 2 ? 1 : -1;
    const dist = Math.random() * 3;
    const spread = Math.random() * 0.3;
    jetPos[i * 3] = (Math.random() - 0.5) * spread;
    jetPos[i * 3 + 1] = dir * (0.5 + dist);
    jetPos[i * 3 + 2] = (Math.random() - 0.5) * spread;
    jetData.push({ dir, dist, spread, baseSpeed: 1 + Math.random() * 2, angle: Math.random() * TAU });
  }
  jGeo.setAttribute('position', new THREE.BufferAttribute(jetPos, 3));
  jGeo.setAttribute('color', new THREE.BufferAttribute(jetCol, 3));
  jetSystem = new THREE.Points(jGeo, new THREE.PointsMaterial({
    size: 0.03, vertexColors: true, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  // Tilt jets to match disk normal
  jetSystem.rotation.x = -Math.PI * 0.05;
  group.add(jetSystem);

  KI.register('void-orb', { update, group, getMode: () => voidMode });
  KI.emit('void-orb:ready');
}

function update(dt, t) {
  const v = KI.voice;
  const energy = v.energy || 0;
  const coherence = v.coherence || 0;
  const pitch = v.pn || 0;
  const sounding = v.sounding;
  const pulseRate = v.pulseRate || 1;

  // ── Vowel → void mode ──
  if (sounding) {
    const modes = { a: 'singularity', e: 'quasar', i: 'wormhole', o: 'pulsar', u: 'hawking' };
    voidMode = modes[v.vowel || 'a'] || 'singularity';
  }

  // Pitch → color shift (red → orange → white → blue)
  const shiftHue = 0.05 + pitch * 0.55; // red-shifted to blue-shifted

  // ── Core pulse (gravitational waves) ──
  const gravWave = Math.sin(t * pulseRate * 3) * 0.5 + 0.5;
  const coreScale = 0.4 + energy * 0.1 * gravWave;
  coreMesh.scale.setScalar(coreScale / 0.4);

  // ── Accretion disk ──
  const diskTilt = Math.PI * 0.45;
  for (let r = 0; r < DISK_RINGS; r++) {
    const ring = diskLines[r];
    const radius = 0.7 + r * 0.2;
    const positions = ring.geometry.attributes.position.array;
    // Spin speed: inner rings faster (Keplerian)
    const spinSpeed = (1 + energy * 4) / Math.sqrt(radius);
    const chaos = (1 - coherence) * 0.3;

    for (let s = 0; s < DISK_SEGMENTS; s++) {
      const baseAngle = (s / DISK_SEGMENTS) * TAU + t * spinSpeed;
      const wobble = chaos * Math.sin(t * 3 + s * 0.5 + r * 2) * 0.15;
      const rr = radius + wobble;
      positions[s * 3] = Math.cos(baseAngle) * rr;
      positions[s * 3 + 1] = Math.sin(baseAngle + t * 0.5) * chaos * 0.1;
      positions[s * 3 + 2] = Math.sin(baseAngle) * rr;
    }
    ring.geometry.attributes.position.needsUpdate = true;
    ring.rotation.x = diskTilt;

    // Disk ring color — inner rings hotter
    const ringHeat = 1 - r / DISK_RINGS;
    const hue = (shiftHue - ringHeat * 0.15 + 1) % 1;
    const rgb = hslToRgb(hue, 0.7 + energy * 0.2, 0.2 + energy * 0.35 * ringHeat);
    diskMats[r].color.setRGB(rgb[0], rgb[1], rgb[2]);
    diskMats[r].opacity = 0.1 + energy * 0.4 * ringHeat;
  }

  // ── Lensing ring ──
  const lPos = lensingLine.geometry.attributes.position.array;
  const lensRadius = 0.55 + energy * 0.05 + gravWave * 0.03;
  for (let s = 0; s < LENSING_SEGMENTS; s++) {
    const angle = (s / LENSING_SEGMENTS) * TAU;
    const shimmer = Math.sin(t * 8 + s * 0.3) * 0.02;
    lPos[s * 3] = Math.cos(angle) * (lensRadius + shimmer);
    lPos[s * 3 + 1] = 0;
    lPos[s * 3 + 2] = Math.sin(angle) * (lensRadius + shimmer);
  }
  lensingLine.geometry.attributes.position.needsUpdate = true;
  lensingMat.opacity = 0.3 + energy * 0.5;
  const lrgb = hslToRgb(shiftHue, 0.3, 0.5 + energy * 0.4);
  lensingMat.color.setRGB(lrgb[0], lrgb[1], lrgb[2]);

  // ── Infalling particles ──
  for (let i = 0; i < MAX_INFALL; i++) {
    const d = infallData[i];
    // Orbit (faster as they get closer)
    d.angle += dt * d.orbitSpeed * (1 + energy * 3) / Math.max(0.3, d.r);
    // Spiral inward
    d.r -= dt * d.speed * energy * 0.3;
    // Flatten toward disk plane
    d.y *= 0.998;

    if (d.r < 0.3) {
      // Respawn at edge
      d.r = 1.5 + Math.random() * 0.5;
      d.angle = Math.random() * TAU;
      d.y = (Math.random() - 0.5) * 0.6;
    }

    // Apply disk tilt
    const x = Math.cos(d.angle) * d.r;
    const z = Math.sin(d.angle) * d.r;
    const y = d.y;
    // Rotate by disk tilt
    infallPos[i * 3] = x;
    infallPos[i * 3 + 1] = y * Math.cos(diskTilt) - z * Math.sin(diskTilt) * 0.3;
    infallPos[i * 3 + 2] = z;

    // Color: hotter closer to core
    const heat = 1 - (d.r - 0.3) / 1.7;
    const hue = (shiftHue - heat * 0.1 + 1) % 1;
    const bright = 0.1 + energy * 0.4 * heat;
    const rgb = hslToRgb(hue, 0.6, bright);
    infallCol[i * 3] = rgb[0]; infallCol[i * 3 + 1] = rgb[1]; infallCol[i * 3 + 2] = rgb[2];
  }
  infallSystem.geometry.attributes.position.needsUpdate = true;
  infallSystem.geometry.attributes.color.needsUpdate = true;

  // ── Relativistic jets (quasar mode powers them up) ──
  const jetPower = voidMode === 'quasar' ? energy * 1.5 : energy * 0.4;
  for (let i = 0; i < MAX_JET; i++) {
    const jd = jetData[i];
    jd.dist += dt * jd.baseSpeed * (0.5 + jetPower * 2);
    if (jd.dist > 3) { jd.dist = 0; jd.spread = Math.random() * 0.3; jd.angle = Math.random() * TAU; }

    const spreadR = jd.spread * (jd.dist / 3);
    jetPos[i * 3] = Math.cos(jd.angle) * spreadR;
    jetPos[i * 3 + 1] = jd.dir * (0.5 + jd.dist);
    jetPos[i * 3 + 2] = Math.sin(jd.angle) * spreadR;

    const fade = 1 - jd.dist / 3;
    const bright = jetPower * fade * 0.4;
    const hue = (shiftHue + 0.1) % 1;
    const rgb = hslToRgb(hue, 0.5, bright);
    jetCol[i * 3] = rgb[0]; jetCol[i * 3 + 1] = rgb[1]; jetCol[i * 3 + 2] = rgb[2];
  }
  jetSystem.geometry.attributes.position.needsUpdate = true;
  jetSystem.geometry.attributes.color.needsUpdate = true;

  // ── Wormhole mode: pulsing core transparency ──
  if (voidMode === 'wormhole') {
    coreMat.opacity = 0.5 + Math.sin(t * 4) * 0.3;
    coreMat.color.setRGB(0.02, 0.0, 0.04);
  } else if (voidMode === 'hawking') {
    coreMat.opacity = 0.85;
    const hawkBright = energy * 0.05;
    coreMat.color.setRGB(hawkBright, hawkBright * 0.5, hawkBright);
  } else {
    coreMat.opacity = 0.95;
    coreMat.color.setRGB(0, 0, 0);
  }

  group.rotation.y += dt * 0.03;

  KI.emit('void-orb:update', {
    voidMode,
    accretionRate: Math.round(energy * 100),
    jetPower: Math.round(jetPower * 100),
    lensRadius: Math.round(lensRadius * 100),
    gravWave: Math.round(gravWave * 100)
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
