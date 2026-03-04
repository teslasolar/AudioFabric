// rune-orb.js — Mystical sphere with glowing runic sigils
// A central sphere covered in ancient runes that light up with voice.
// Features:
// - Semi-transparent dark sphere with surface rune patterns (line geometry)
// - Orbiting rune rings that rotate at different speeds
// - Rune energy pulses that ripple across the surface
// - Floating sigil particles that drift around
// - Energy → rune glow intensity, activation count
// - Pitch → rune color (amber → cyan → violet → white)
// - Coherence → rune alignment (ordered sacred geometry vs chaotic scatter)
// - Vowel → rune school (elder, void, celestial, blood, arcane)
// - Pulse → rune activation pulse

import { KI } from './core.js';

const TAU = Math.PI * 2;

// ── Config ──
const RUNE_RING_COUNT = 5;    // orbiting rune rings
const RUNE_RING_SEGS = 48;
const MAX_SIGILS = 24;        // individual rune sigils on surface
const SIGIL_STROKES = 6;      // line segments per sigil
const MAX_MOTES = 350;        // floating mote particles
const MAX_PULSE_RINGS = 6;    // ripple pulse rings
const PULSE_RING_SEGS = 32;

let group = null;
let coreMesh = null, coreMat = null;
let runeRings = [], runeRingMats = [];
let sigils = [];       // { lines[], mats[], theta, phi }
let moteSystem = null, motePos = null, moteCol = null;
let moteData = [];
let pulseRings = [], pulseMats = [], pulseState = [];
let runeSchool = 'elder';
let pulseTimer = 0;

// School color palettes
const SCHOOLS = {
  elder:     { hue: 0.08, sat: 0.7, name: 'ELDER' },      // amber/gold
  void:      { hue: 0.75, sat: 0.6, name: 'VOID' },       // deep purple
  celestial: { hue: 0.55, sat: 0.6, name: 'CELESTIAL' },   // cyan/teal
  blood:     { hue: 0.0, sat: 0.8, name: 'BLOOD' },        // crimson
  arcane:    { hue: 0.85, sat: 0.5, name: 'ARCANE' }       // magenta/pink
};

// Rune glyph patterns (normalized line coords, -1 to 1)
const GLYPHS = [
  [[0,1],[0,-1],[0,0],[-0.5,0.5],[0,0],[0.5,0.5]],           // arrow up
  [[-0.5,-1],[-0.5,1],[0.5,1],[0.5,-1],[-0.5,-1],[-0.5,0]],  // rectangle
  [[0,1],[-0.7,-0.5],[0.7,0],[- 0.7,0],[0.7,-0.5],[0,1]],    // star fragment
  [[-0.5,1],[0,-0.5],[0.5,1],[0,0.3],[-0.3,0],[0.3,0]],      // peak
  [[0,1],[0,-1],[-0.5,0],[0.5,0],[-0.3,0.5],[0.3,-0.5]],     // cross variant
  [[-0.4,1],[0.4,1],[0,-0.3],[0.4,-1],[-0.4,-1],[0,-0.3]],   // diamond
  [[0,1],[-0.5,0],[0,0],[0.5,0],[0,-1],[0,0]],                // plus
  [[-0.5,0.8],[0.5,0.8],[0,0],[-0.5,-0.8],[0.5,-0.8],[0,0]]  // hourglass
];

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 2.5, -3.5];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── Core sphere (dark mystical) ──
  const coreGeo = new THREE.SphereGeometry(0.9, 24, 16);
  coreMat = new THREE.MeshBasicMaterial({
    color: 0x0a0a12, transparent: true, opacity: 0.6,
    blending: THREE.NormalBlending, depthWrite: false
  });
  coreMesh = new THREE.Mesh(coreGeo, coreMat);
  group.add(coreMesh);

  // ── Orbiting rune rings ──
  for (let r = 0; r < RUNE_RING_COUNT; r++) {
    const radius = 1.0 + r * 0.15;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(RUNE_RING_SEGS * 3);
    // Dashed effect: some segments at radius, some pulled in
    for (let s = 0; s < RUNE_RING_SEGS; s++) {
      const angle = (s / RUNE_RING_SEGS) * TAU;
      const dash = (s % 6 < 3) ? radius : radius * 0.95;
      positions[s * 3] = Math.cos(angle) * dash;
      positions[s * 3 + 1] = 0;
      positions[s * 3 + 2] = Math.sin(angle) * dash;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xff8800, transparent: true, opacity: 0.15,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const line = new THREE.LineLoop(geo, mat);
    // Tilt each ring differently
    line.rotation.x = (r * 0.7) - 0.5;
    line.rotation.z = r * 0.4;
    group.add(line);
    runeRings.push(line);
    runeRingMats.push(mat);
  }

  // ── Surface sigils (rune glyphs placed on sphere surface) ──
  for (let i = 0; i < MAX_SIGILS; i++) {
    const theta = Math.acos(2 * Math.random() - 1);
    const phi = TAU * Math.random();
    const glyph = GLYPHS[i % GLYPHS.length];
    const sigilGroup = new THREE.Group();

    // Position on sphere surface
    const r = 0.92;
    sigilGroup.position.set(
      Math.sin(theta) * Math.cos(phi) * r,
      Math.cos(theta) * r,
      Math.sin(theta) * Math.sin(phi) * r
    );
    // Orient to face outward
    sigilGroup.lookAt(0, 0, 0);
    sigilGroup.rotateY(Math.PI);

    const lines = [];
    const mats = [];
    // Draw glyph as connected line pairs
    for (let s = 0; s < glyph.length - 1; s++) {
      const geo = new THREE.BufferGeometry();
      const verts = new Float32Array([
        glyph[s][0] * 0.1, glyph[s][1] * 0.1, 0,
        glyph[s + 1][0] * 0.1, glyph[s + 1][1] * 0.1, 0
      ]);
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      const mat = new THREE.LineBasicMaterial({
        color: 0xff8800, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      const line = new THREE.Line(geo, mat);
      sigilGroup.add(line);
      lines.push(line);
      mats.push(mat);
    }

    group.add(sigilGroup);
    sigils.push({ group: sigilGroup, lines, mats, theta, phi, active: false, glowPhase: Math.random() * TAU });
  }

  // ── Floating motes ──
  const mGeo = new THREE.BufferGeometry();
  motePos = new Float32Array(MAX_MOTES * 3);
  moteCol = new Float32Array(MAX_MOTES * 3);
  for (let i = 0; i < MAX_MOTES; i++) {
    const angle = Math.random() * TAU;
    const r = 0.5 + Math.random() * 1.5;
    const y = (Math.random() - 0.5) * 2.5;
    motePos[i * 3] = Math.cos(angle) * r;
    motePos[i * 3 + 1] = y;
    motePos[i * 3 + 2] = Math.sin(angle) * r;
    moteData.push({ angle, r, y, speed: (Math.random() - 0.5) * 0.8, drift: (Math.random() - 0.5) * 0.3 });
  }
  mGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  mGeo.setAttribute('color', new THREE.BufferAttribute(moteCol, 3));
  moteSystem = new THREE.Points(mGeo, new THREE.PointsMaterial({
    size: 0.03, vertexColors: true, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(moteSystem);

  // ── Pulse rings (ripple outward on pulse beats) ──
  for (let i = 0; i < MAX_PULSE_RINGS; i++) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(PULSE_RING_SEGS * 3);
    for (let s = 0; s < PULSE_RING_SEGS; s++) {
      const angle = (s / PULSE_RING_SEGS) * TAU;
      positions[s * 3] = Math.cos(angle);
      positions[s * 3 + 1] = 0;
      positions[s * 3 + 2] = Math.sin(angle);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xff8800, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const ring = new THREE.LineLoop(geo, mat);
    ring.visible = false;
    group.add(ring);
    pulseRings.push(ring);
    pulseMats.push(mat);
    pulseState.push({ active: false, radius: 0, life: 0 });
  }

  KI.register('rune-orb', { update, group, getSchool: () => runeSchool });
  KI.emit('rune-orb:ready');
}

function update(dt, t) {
  const v = KI.voice;
  const energy = v.energy || 0;
  const coherence = v.coherence || 0;
  const pitch = v.pn || 0;
  const sounding = v.sounding;
  const pulseRate = v.pulseRate || 1;

  // ── Vowel → rune school ──
  if (sounding) {
    const schools = { a: 'elder', e: 'void', i: 'celestial', o: 'blood', u: 'arcane' };
    runeSchool = schools[v.vowel || 'a'] || 'elder';
  }

  const school = SCHOOLS[runeSchool];
  // Pitch shifts hue
  const hue = (school.hue + pitch * 0.1) % 1;

  // ── Core glow ──
  const coreGlow = 0.03 + energy * 0.08;
  const crgb = hslToRgb(hue, school.sat * 0.3, coreGlow);
  coreMat.color.setRGB(crgb[0], crgb[1], crgb[2]);
  coreMat.opacity = 0.5 + energy * 0.15;

  // ── Orbiting rune rings ──
  for (let r = 0; r < RUNE_RING_COUNT; r++) {
    const speed = (r % 2 === 0 ? 1 : -1) * (0.3 + energy * 1.2) * (1 + r * 0.15);
    runeRings[r].rotation.y += dt * speed;

    // Update dashed ring positions with wobble
    const positions = runeRings[r].geometry.attributes.position.array;
    const radius = 1.0 + r * 0.15;
    for (let s = 0; s < RUNE_RING_SEGS; s++) {
      const angle = (s / RUNE_RING_SEGS) * TAU;
      const wobble = coherence < 0.5 ? Math.sin(t * 3 + s * 0.3 + r * 2) * (1 - coherence) * 0.1 : 0;
      const dash = (s % 6 < 3) ? radius : radius * 0.93;
      positions[s * 3] = Math.cos(angle) * (dash + wobble);
      positions[s * 3 + 1] = Math.sin(t * 0.5 + s * 0.2) * wobble;
      positions[s * 3 + 2] = Math.sin(angle) * (dash + wobble);
    }
    runeRings[r].geometry.attributes.position.needsUpdate = true;

    const rrgb = hslToRgb(hue, school.sat, 0.15 + energy * 0.2);
    runeRingMats[r].color.setRGB(rrgb[0], rrgb[1], rrgb[2]);
    runeRingMats[r].opacity = 0.08 + energy * 0.2;
  }

  // ── Surface sigils ──
  const activeSigils = Math.floor(energy * MAX_SIGILS);
  for (let i = 0; i < MAX_SIGILS; i++) {
    const sig = sigils[i];
    sig.active = i < activeSigils;
    const glow = sig.active ? (0.3 + Math.sin(t * 3 + sig.glowPhase) * 0.2 + energy * 0.4) : 0;

    for (let m = 0; m < sig.mats.length; m++) {
      const srgb = hslToRgb((hue + i * 0.01) % 1, school.sat, glow * 0.5);
      sig.mats[m].color.setRGB(srgb[0], srgb[1], srgb[2]);
      sig.mats[m].opacity = glow;
    }

    // Slight rotation of sigil on surface
    sig.group.rotation.z += dt * 0.1 * (sig.active ? 1 : 0);
  }

  // ── Floating motes ──
  for (let i = 0; i < MAX_MOTES; i++) {
    const md = moteData[i];
    md.angle += dt * md.speed * (0.5 + energy);
    md.y += md.drift * dt;
    if (md.y > 1.5) md.drift = -Math.abs(md.drift);
    if (md.y < -1.5) md.drift = Math.abs(md.drift);

    // Coherence pulls motes into orderly patterns
    if (coherence > 0.5) {
      const targetR = 1.2;
      md.r += (targetR - md.r) * coherence * dt;
    }

    motePos[i * 3] = Math.cos(md.angle) * md.r;
    motePos[i * 3 + 1] = md.y;
    motePos[i * 3 + 2] = Math.sin(md.angle) * md.r;

    const mBright = 0.05 + energy * 0.2 * (Math.sin(t * 2 + i * 0.5) * 0.5 + 0.5);
    const mrgb = hslToRgb((hue + md.angle * 0.02) % 1, school.sat * 0.5, mBright);
    moteCol[i * 3] = mrgb[0]; moteCol[i * 3 + 1] = mrgb[1]; moteCol[i * 3 + 2] = mrgb[2];
  }
  moteSystem.geometry.attributes.position.needsUpdate = true;
  moteSystem.geometry.attributes.color.needsUpdate = true;

  // ── Pulse rings ──
  pulseTimer += dt;
  if (pulseTimer > (1 / pulseRate) && energy > 0.1) {
    pulseTimer = 0;
    // Find inactive pulse ring
    for (let i = 0; i < MAX_PULSE_RINGS; i++) {
      if (!pulseState[i].active) {
        pulseState[i].active = true;
        pulseState[i].radius = 0.9;
        pulseState[i].life = 1;
        break;
      }
    }
  }
  for (let i = 0; i < MAX_PULSE_RINGS; i++) {
    const ps = pulseState[i];
    if (ps.active) {
      ps.radius += dt * 1.5;
      ps.life -= dt * 0.8;
      if (ps.life <= 0) {
        ps.active = false;
        pulseRings[i].visible = false;
        continue;
      }
      pulseRings[i].visible = true;
      pulseRings[i].scale.setScalar(ps.radius);
      // Random tilt
      pulseRings[i].rotation.x = Math.sin(i * 2.3) * 0.5;
      pulseRings[i].rotation.z = Math.cos(i * 1.7) * 0.3;

      const prgb = hslToRgb(hue, school.sat, 0.3 * ps.life);
      pulseMats[i].color.setRGB(prgb[0], prgb[1], prgb[2]);
      pulseMats[i].opacity = ps.life * 0.5 * energy;
    }
  }

  group.rotation.y += dt * 0.035;

  KI.emit('rune-orb:update', {
    runeSchool: school.name,
    activeSigils,
    totalSigils: MAX_SIGILS,
    moteCount: MAX_MOTES,
    runeGlow: Math.round(energy * 100)
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
