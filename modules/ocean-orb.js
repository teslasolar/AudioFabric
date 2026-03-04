// ocean-orb.js — Underwater sphere with waves, currents, bioluminescence
// A central sphere that looks like a contained ocean. Features:
// - Undulating surface mesh simulating ocean waves
// - Internal current particle streams
// - Bioluminescent creatures (glowing dots that pulse)
// - Bubble particles rising inside
// - Energy → wave height, current speed, bioluminescence
// - Pitch → water color (tropical turquoise → deep blue → abyss black)
// - Coherence → wave regularity (calm sea vs stormy chop)
// - Vowel → ocean zone (surface, reef, deep, abyss, maelstrom)
// - Pulse → tide rhythm

import { KI } from './core.js';

const TAU = Math.PI * 2;

// ── Config ──
const SPHERE_DETAIL = 28;
const MAX_CURRENTS = 8;       // current stream lines
const CURRENT_SEGS = 30;
const MAX_BIOLUM = 120;       // bioluminescent creatures
const MAX_BUBBLES = 300;      // bubble particles
const MAX_CAUSTICS = 200;     // caustic light dots on surface

let group = null;
let surfaceMesh = null, surfaceMat = null;
let origPositions = null;
let surfaceColors = null;
let currentLines = [], currentMats = [];
let bioMeshes = [], bioMats = [], bioData = [];
let bubbleSystem = null, bubblePos = null, bubbleCol = null, bubbleData = [];
let causticSystem = null, causticPos = null, causticCol = null;
let oceanZone = 'surface';

const ZONES = {
  surface:   { hue: 0.5, sat: 0.6, depth: 0.4, waveAmp: 1.0 },
  reef:      { hue: 0.45, sat: 0.7, depth: 0.3, waveAmp: 0.5 },
  deep:      { hue: 0.6, sat: 0.5, depth: 0.15, waveAmp: 0.3 },
  abyss:     { hue: 0.65, sat: 0.3, depth: 0.05, waveAmp: 0.1 },
  maelstrom: { hue: 0.55, sat: 0.6, depth: 0.25, waveAmp: 1.5 }
};

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 2.5, -3.5];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── Ocean surface sphere ──
  const geo = new THREE.SphereGeometry(1.1, SPHERE_DETAIL, SPHERE_DETAIL / 2);
  const nonIndexed = geo.toNonIndexed();
  origPositions = new Float32Array(nonIndexed.attributes.position.array);
  const vertCount = nonIndexed.attributes.position.count;
  const colors = new Float32Array(vertCount * 3);
  nonIndexed.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  surfaceColors = colors;

  surfaceMat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  surfaceMesh = new THREE.Mesh(nonIndexed, surfaceMat);
  group.add(surfaceMesh);

  // ── Current streams ──
  for (let i = 0; i < MAX_CURRENTS; i++) {
    const cGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(CURRENT_SEGS * 3);
    cGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0x44ccff, transparent: true, opacity: 0.2,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const line = new THREE.Line(cGeo, mat);
    group.add(line);
    currentLines.push(line);
    currentMats.push(mat);
  }

  // ── Bioluminescent creatures ──
  for (let i = 0; i < MAX_BIOLUM; i++) {
    const bGeo = new THREE.SphereGeometry(0.02 + Math.random() * 0.02, 4, 3);
    const bMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(bGeo, bMat);
    mesh.visible = false;
    group.add(mesh);
    bioMeshes.push(mesh);
    bioMats.push(bMat);
    const theta = Math.acos(2 * Math.random() - 1);
    const phi = TAU * Math.random();
    const r = 0.3 + Math.random() * 0.7;
    bioData.push({
      theta, phi, r,
      pulsePhase: Math.random() * TAU,
      pulseSpeed: 1 + Math.random() * 4,
      swimSpeed: (Math.random() - 0.5) * 0.5,
      hueShift: Math.random() * 0.1
    });
  }

  // ── Bubble particles ──
  const bGeo = new THREE.BufferGeometry();
  bubblePos = new Float32Array(MAX_BUBBLES * 3);
  bubbleCol = new Float32Array(MAX_BUBBLES * 3);
  for (let i = 0; i < MAX_BUBBLES; i++) {
    const angle = Math.random() * TAU;
    const r = Math.random() * 0.8;
    bubblePos[i * 3] = Math.cos(angle) * r;
    bubblePos[i * 3 + 1] = -1 + Math.random() * 2;
    bubblePos[i * 3 + 2] = Math.sin(angle) * r;
    bubbleData.push({
      angle, r, y: bubblePos[i * 3 + 1],
      riseSpeed: 0.1 + Math.random() * 0.4,
      wobblePhase: Math.random() * TAU
    });
  }
  bGeo.setAttribute('position', new THREE.BufferAttribute(bubblePos, 3));
  bGeo.setAttribute('color', new THREE.BufferAttribute(bubbleCol, 3));
  bubbleSystem = new THREE.Points(bGeo, new THREE.PointsMaterial({
    size: 0.025, vertexColors: true, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(bubbleSystem);

  // ── Caustic light dots ──
  const caGeo = new THREE.BufferGeometry();
  causticPos = new Float32Array(MAX_CAUSTICS * 3);
  causticCol = new Float32Array(MAX_CAUSTICS * 3);
  caGeo.setAttribute('position', new THREE.BufferAttribute(causticPos, 3));
  caGeo.setAttribute('color', new THREE.BufferAttribute(causticCol, 3));
  causticSystem = new THREE.Points(caGeo, new THREE.PointsMaterial({
    size: 0.06, vertexColors: true, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(causticSystem);

  KI.register('ocean-orb', { update, group, getZone: () => oceanZone });
  KI.emit('ocean-orb:ready');
}

function update(dt, t) {
  const v = KI.voice;
  const energy = v.energy || 0;
  const coherence = v.coherence || 0;
  const pitch = v.pn || 0;
  const sounding = v.sounding;
  const pulseRate = v.pulseRate || 1;

  // ── Vowel → ocean zone ──
  if (sounding) {
    const zones = { a: 'surface', e: 'reef', i: 'deep', o: 'abyss', u: 'maelstrom' };
    oceanZone = zones[v.vowel || 'a'] || 'surface';
  }

  const zone = ZONES[oceanZone];
  const baseHue = zone.hue + pitch * 0.08;

  // ── Wave surface ──
  const positions = surfaceMesh.geometry.attributes.position.array;
  const vertCount = positions.length / 3;
  const waveH = zone.waveAmp * (0.02 + energy * 0.12);
  const chop = (1 - coherence) * 0.08;
  const tidePhase = Math.sin(t * pulseRate) * 0.03;

  for (let i = 0; i < vertCount; i++) {
    const ox = origPositions[i * 3];
    const oy = origPositions[i * 3 + 1];
    const oz = origPositions[i * 3 + 2];
    const dist = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
    const nx = ox / dist, ny = oy / dist, nz = oz / dist;

    // Wave displacement
    const wave1 = Math.sin(nx * 5 + t * 2) * Math.cos(nz * 4 + t * 1.5) * waveH;
    const wave2 = Math.sin(ny * 7 + t * 3.2) * chop;
    const tide = tidePhase;
    const displacement = 1 + wave1 + wave2 + tide;

    positions[i * 3] = nx * displacement;
    positions[i * 3 + 1] = ny * displacement;
    positions[i * 3 + 2] = nz * displacement;

    // Color: depth gradient
    const depthFactor = (ny + 1) * 0.5; // 0=bottom, 1=top
    const hue = (baseHue + depthFactor * 0.05) % 1;
    const bright = zone.depth + energy * 0.15 + depthFactor * 0.1;
    const rgb = hslToRgb(hue, zone.sat, bright);
    surfaceColors[i * 3] = rgb[0]; surfaceColors[i * 3 + 1] = rgb[1]; surfaceColors[i * 3 + 2] = rgb[2];
  }
  surfaceMesh.geometry.attributes.position.needsUpdate = true;
  surfaceMesh.geometry.attributes.color.needsUpdate = true;
  surfaceMat.opacity = 0.2 + energy * 0.2;

  // ── Current streams ──
  const currentSpeed = 0.5 + energy * 2;
  for (let c = 0; c < MAX_CURRENTS; c++) {
    const cPos = currentLines[c].geometry.attributes.position.array;
    const baseTheta = (c / MAX_CURRENTS) * Math.PI;
    const basePhi = t * currentSpeed * 0.3 + c * 1.5;

    for (let s = 0; s < CURRENT_SEGS; s++) {
      const f = s / (CURRENT_SEGS - 1);
      const theta = baseTheta + Math.sin(f * 3 + t) * 0.3;
      const phi = basePhi + f * 2;
      const r = 0.5 + f * 0.4 + Math.sin(t + s * 0.3) * 0.1;
      cPos[s * 3] = Math.sin(theta) * Math.cos(phi) * r;
      cPos[s * 3 + 1] = Math.cos(theta) * r;
      cPos[s * 3 + 2] = Math.sin(theta) * Math.sin(phi) * r;
    }
    currentLines[c].geometry.attributes.position.needsUpdate = true;

    const crgb = hslToRgb((baseHue + 0.03 * c) % 1, zone.sat * 0.8, 0.2 + energy * 0.2);
    currentMats[c].color.setRGB(crgb[0], crgb[1], crgb[2]);
    currentMats[c].opacity = 0.1 + energy * 0.2;
  }

  // ── Bioluminescent creatures ──
  const bioCount = Math.floor(energy * MAX_BIOLUM);
  for (let i = 0; i < MAX_BIOLUM; i++) {
    if (i < bioCount) {
      const bd = bioData[i];
      bd.phi += dt * bd.swimSpeed;
      bd.theta += dt * 0.05 * Math.sin(t + i);

      const x = Math.sin(bd.theta) * Math.cos(bd.phi) * bd.r;
      const y = Math.cos(bd.theta) * bd.r;
      const z = Math.sin(bd.theta) * Math.sin(bd.phi) * bd.r;

      bioMeshes[i].visible = true;
      bioMeshes[i].position.set(x, y, z);

      const pulse = Math.sin(t * bd.pulseSpeed + bd.pulsePhase) * 0.5 + 0.5;
      const glow = pulse * energy * 0.6;
      const bHue = (baseHue - 0.1 + bd.hueShift) % 1;
      const brgb = hslToRgb((bHue + 1) % 1, 0.7, glow);
      bioMats[i].color.setRGB(brgb[0], brgb[1], brgb[2]);
      bioMats[i].opacity = glow;
      bioMeshes[i].scale.setScalar(0.5 + pulse * 2);
    } else {
      bioMeshes[i].visible = false;
    }
  }

  // ── Bubbles ──
  for (let i = 0; i < MAX_BUBBLES; i++) {
    const bd = bubbleData[i];
    bd.y += dt * bd.riseSpeed * (0.3 + energy * 0.7);
    if (bd.y > 1.1) { bd.y = -1; bd.angle = Math.random() * TAU; bd.r = Math.random() * 0.8; }

    const wobble = Math.sin(t * 3 + bd.wobblePhase) * 0.05;
    bubblePos[i * 3] = Math.cos(bd.angle + wobble) * bd.r;
    bubblePos[i * 3 + 1] = bd.y;
    bubblePos[i * 3 + 2] = Math.sin(bd.angle + wobble) * bd.r;

    const bright = 0.1 + energy * 0.15;
    const brgb = hslToRgb(baseHue, 0.2, bright);
    bubbleCol[i * 3] = brgb[0]; bubbleCol[i * 3 + 1] = brgb[1]; bubbleCol[i * 3 + 2] = brgb[2];
  }
  bubbleSystem.geometry.attributes.position.needsUpdate = true;
  bubbleSystem.geometry.attributes.color.needsUpdate = true;

  // ── Caustic light patterns ──
  for (let i = 0; i < MAX_CAUSTICS; i++) {
    const f = i / MAX_CAUSTICS;
    const theta = Math.acos(2 * f - 1);
    const phi = f * TAU * 7 + t * 0.5;
    const r = 1.12;
    causticPos[i * 3] = Math.sin(theta) * Math.cos(phi) * r;
    causticPos[i * 3 + 1] = Math.cos(theta) * r;
    causticPos[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * r;

    const flicker = Math.sin(t * 5 + i * 3) * 0.5 + 0.5;
    const bright = flicker * energy * 0.15 * zone.depth * 3;
    const crgb = hslToRgb((baseHue + 0.05) % 1, 0.3, bright);
    causticCol[i * 3] = crgb[0]; causticCol[i * 3 + 1] = crgb[1]; causticCol[i * 3 + 2] = crgb[2];
  }
  causticSystem.geometry.attributes.position.needsUpdate = true;
  causticSystem.geometry.attributes.color.needsUpdate = true;

  group.rotation.y += dt * 0.03;

  KI.emit('ocean-orb:update', {
    oceanZone,
    waveHeight: Math.round(waveH * 1000),
    bioCount,
    currentSpeed: Math.round(currentSpeed * 100),
    tidePhase: Math.round((Math.sin(t * pulseRate) * 0.5 + 0.5) * 100)
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
