// solar-orb.js — Miniature sun with flares, sunspots, and corona
// A central sphere that burns with stellar fire. Features:
// - Churning surface with granulation texture (vertex displacement)
// - Solar flares / prominences arcing off the surface
// - Sunspot regions that darken and shift
// - Coronal glow halo
// - Energy → surface activity, flare intensity
// - Pitch → stellar class (red dwarf → yellow → blue giant)
// - Coherence → surface stability (calm → violent convection)
// - Vowel → solar mode (calm, active, flare, eclipse, supernova)
// - Pulse → coronal mass ejection rhythm

import { KI } from './core.js';

const TAU = Math.PI * 2;

// ── Config ──
const SPHERE_DETAIL = 32;
const MAX_FLARES = 12;       // prominence arcs
const FLARE_SEGMENTS = 20;
const MAX_SPOTS = 8;         // sunspots
const MAX_CME = 500;         // coronal mass ejection particles
const CORONA_RINGS = 4;      // coronal glow rings
const CORONA_SEGMENTS = 48;

let group = null;
let surfaceMesh = null, surfaceMat = null;
let origPositions = null;
let surfaceColors = null;
let flareLines = [], flareMats = [];
let spotMeshes = [], spotMats = [];
let cmeSystem = null, cmePos = null, cmeCol = null;
let cmeData = [];
let coronaLines = [], coronaMats = [];
let solarMode = 'calm';
let cmeIdx = 0;

// Stellar class by pitch
function stellarColor(pitch) {
  // 0=red dwarf, 0.3=orange, 0.5=yellow(sun), 0.7=white, 1.0=blue giant
  if (pitch < 0.3) return { hue: 0.03, sat: 0.8, lBase: 0.25 };
  if (pitch < 0.5) return { hue: 0.08, sat: 0.7, lBase: 0.35 };
  if (pitch < 0.7) return { hue: 0.12, sat: 0.6, lBase: 0.45 };
  if (pitch < 0.85) return { hue: 0.15, sat: 0.3, lBase: 0.55 };
  return { hue: 0.6, sat: 0.5, lBase: 0.5 };
}

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 2.5, -3.5];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── Solar surface (displaced sphere) ──
  const geo = new THREE.SphereGeometry(1.0, SPHERE_DETAIL, SPHERE_DETAIL / 2);
  const nonIndexed = geo.toNonIndexed();
  origPositions = new Float32Array(nonIndexed.attributes.position.array);
  const vertCount = nonIndexed.attributes.position.count;
  const colors = new Float32Array(vertCount * 3);
  nonIndexed.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  surfaceColors = colors;

  surfaceMat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  surfaceMesh = new THREE.Mesh(nonIndexed, surfaceMat);
  group.add(surfaceMesh);

  // ── Solar flares (prominence arcs) ──
  for (let i = 0; i < MAX_FLARES; i++) {
    const fGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(FLARE_SEGMENTS * 3);
    fGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xff6600, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const line = new THREE.Line(fGeo, mat);
    line.visible = false;
    group.add(line);
    flareLines.push(line);
    flareMats.push(mat);
  }

  // ── Sunspots ──
  for (let i = 0; i < MAX_SPOTS; i++) {
    const sGeo = new THREE.CircleGeometry(0.08 + Math.random() * 0.06, 8);
    const sMat = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0,
      blending: THREE.NormalBlending, depthWrite: false, side: THREE.DoubleSide
    });
    const spot = new THREE.Mesh(sGeo, sMat);
    spot.visible = false;
    group.add(spot);
    spotMeshes.push(spot);
    spotMats.push(sMat);
  }

  // ── Coronal mass ejection particles ──
  const cGeo = new THREE.BufferGeometry();
  cmePos = new Float32Array(MAX_CME * 3);
  cmeCol = new Float32Array(MAX_CME * 3);
  cGeo.setAttribute('position', new THREE.BufferAttribute(cmePos, 3));
  cGeo.setAttribute('color', new THREE.BufferAttribute(cmeCol, 3));
  cmeSystem = new THREE.Points(cGeo, new THREE.PointsMaterial({
    size: 0.04, vertexColors: true, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(cmeSystem);

  // ── Corona glow rings ──
  for (let r = 0; r < CORONA_RINGS; r++) {
    const radius = 1.15 + r * 0.15;
    const crGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(CORONA_SEGMENTS * 3);
    for (let s = 0; s < CORONA_SEGMENTS; s++) {
      const angle = (s / CORONA_SEGMENTS) * TAU;
      positions[s * 3] = Math.cos(angle) * radius;
      positions[s * 3 + 1] = 0;
      positions[s * 3 + 2] = Math.sin(angle) * radius;
    }
    crGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xff8800, transparent: true, opacity: 0.1,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const line = new THREE.LineLoop(crGeo, mat);
    group.add(line);
    coronaLines.push(line);
    coronaMats.push(mat);
  }

  KI.register('solar-orb', { update, group, getMode: () => solarMode });
  KI.emit('solar-orb:ready');
}

// Simple 3D noise approximation
function noise3(x, y, z) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 45.164) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

function update(dt, t) {
  const v = KI.voice;
  const energy = v.energy || 0;
  const coherence = v.coherence || 0;
  const pitch = v.pn || 0;
  const sounding = v.sounding;
  const pulseRate = v.pulseRate || 1;

  // ── Vowel → solar mode ──
  if (sounding) {
    const modes = { a: 'calm', e: 'active', i: 'flare', o: 'eclipse', u: 'supernova' };
    solarMode = modes[v.vowel || 'a'] || 'calm';
  }

  const sc = stellarColor(pitch);
  const turbulence = (1 - coherence) * 0.15 + energy * 0.1;
  const isSupernova = solarMode === 'supernova';
  const blowout = isSupernova ? 1 + energy * 0.5 : 1;

  // ── Surface granulation (vertex displacement + coloring) ──
  const positions = surfaceMesh.geometry.attributes.position.array;
  const vertCount = positions.length / 3;
  for (let i = 0; i < vertCount; i++) {
    const ox = origPositions[i * 3];
    const oy = origPositions[i * 3 + 1];
    const oz = origPositions[i * 3 + 2];
    // Normalize to get direction
    const dist = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
    const nx = ox / dist, ny = oy / dist, nz = oz / dist;
    // Granulation displacement
    const n = noise3(nx * 3 + t * 0.5, ny * 3 + t * 0.3, nz * 3 + t * 0.4);
    const displacement = 1 + n * turbulence * blowout;
    positions[i * 3] = nx * displacement;
    positions[i * 3 + 1] = ny * displacement;
    positions[i * 3 + 2] = nz * displacement;

    // Color: base stellar color with granulation variation
    const granBright = sc.lBase + n * 0.15 + energy * 0.15;
    const hue = (sc.hue + n * 0.03) % 1;
    const rgb = hslToRgb(hue < 0 ? hue + 1 : hue, sc.sat, Math.max(0.05, granBright));
    surfaceColors[i * 3] = rgb[0]; surfaceColors[i * 3 + 1] = rgb[1]; surfaceColors[i * 3 + 2] = rgb[2];
  }
  surfaceMesh.geometry.attributes.position.needsUpdate = true;
  surfaceMesh.geometry.attributes.color.needsUpdate = true;

  // ── Eclipse mode: darken front half ──
  if (solarMode === 'eclipse') {
    surfaceMat.opacity = 0.5 + energy * 0.2;
  } else {
    surfaceMat.opacity = 0.8 + energy * 0.15;
  }

  // ── Solar flares ──
  const flareActivity = solarMode === 'flare' ? energy * 1.5 : (solarMode === 'supernova' ? energy * 2 : energy * 0.6);
  const activeFlares = Math.min(MAX_FLARES, Math.floor(flareActivity * MAX_FLARES));

  for (let i = 0; i < MAX_FLARES; i++) {
    if (i < activeFlares) {
      flareLines[i].visible = true;
      const fPos = flareLines[i].geometry.attributes.position.array;
      // Arc from surface point over and back
      const baseAngle = (i / MAX_FLARES) * TAU + t * 0.3;
      const elev = Math.sin(i * 2.7 + t * 0.5) * 0.6;
      const arcHeight = 0.3 + energy * 0.8 + Math.sin(t * 2 + i) * 0.2;

      for (let s = 0; s < FLARE_SEGMENTS; s++) {
        const f = s / (FLARE_SEGMENTS - 1);
        const arcF = Math.sin(f * Math.PI);
        const angle = baseAngle + (f - 0.5) * 0.6;
        const r = 1.0 + arcF * arcHeight;
        fPos[s * 3] = Math.cos(angle) * Math.cos(elev) * r;
        fPos[s * 3 + 1] = Math.sin(elev) * r + arcF * arcHeight * 0.5;
        fPos[s * 3 + 2] = Math.sin(angle) * Math.cos(elev) * r;
      }
      flareLines[i].geometry.attributes.position.needsUpdate = true;

      const fHue = (sc.hue - 0.02) % 1;
      const frgb = hslToRgb(fHue < 0 ? fHue + 1 : fHue, sc.sat + 0.1, 0.3 + energy * 0.4);
      flareMats[i].color.setRGB(frgb[0], frgb[1], frgb[2]);
      flareMats[i].opacity = 0.3 + energy * 0.4 + Math.random() * 0.1;
    } else {
      flareLines[i].visible = false;
    }
  }

  // ── Sunspots ──
  const spotActivity = solarMode === 'active' || solarMode === 'flare' ? 0.5 + energy * 0.5 : energy * 0.3;
  for (let i = 0; i < MAX_SPOTS; i++) {
    if (i < Math.floor(spotActivity * MAX_SPOTS)) {
      spotMeshes[i].visible = true;
      const angle = t * 0.1 + i * TAU / MAX_SPOTS;
      const elev = Math.sin(i * 3.1) * 0.6;
      const r = 1.02;
      spotMeshes[i].position.set(
        Math.cos(angle) * Math.cos(elev) * r,
        Math.sin(elev) * r,
        Math.sin(angle) * Math.cos(elev) * r
      );
      spotMeshes[i].lookAt(0, 0, 0);
      spotMats[i].opacity = 0.3 + energy * 0.3;
    } else {
      spotMeshes[i].visible = false;
    }
  }

  // ── CME particles ──
  // Spawn CME on pulse beats
  const pulseBeat = Math.sin(t * pulseRate * 4) > 0.8;
  if (pulseBeat && energy > 0.15) {
    for (let burst = 0; burst < 5; burst++) {
      const ci = cmeIdx % MAX_CME;
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = TAU * Math.random();
      cmePos[ci * 3] = Math.sin(theta) * Math.cos(phi) * 1.05;
      cmePos[ci * 3 + 1] = Math.cos(theta) * 1.05;
      cmePos[ci * 3 + 2] = Math.sin(theta) * Math.sin(phi) * 1.05;
      const rgb = hslToRgb(sc.hue, sc.sat, 0.3 + energy * 0.4);
      cmeCol[ci * 3] = rgb[0]; cmeCol[ci * 3 + 1] = rgb[1]; cmeCol[ci * 3 + 2] = rgb[2];
      if (!cmeData[ci]) cmeData[ci] = { vx: 0, vy: 0, vz: 0 };
      cmeData[ci].vx = Math.sin(theta) * Math.cos(phi) * (0.5 + energy);
      cmeData[ci].vy = Math.cos(theta) * (0.5 + energy);
      cmeData[ci].vz = Math.sin(theta) * Math.sin(phi) * (0.5 + energy);
      cmeIdx++;
    }
  }
  // Move existing CME particles
  for (let i = 0; i < MAX_CME; i++) {
    if (cmeData[i]) {
      cmePos[i * 3] += cmeData[i].vx * dt;
      cmePos[i * 3 + 1] += cmeData[i].vy * dt;
      cmePos[i * 3 + 2] += cmeData[i].vz * dt;
      // Fade
      cmeCol[i * 3] *= 0.995; cmeCol[i * 3 + 1] *= 0.995; cmeCol[i * 3 + 2] *= 0.995;
    }
  }
  cmeSystem.geometry.attributes.position.needsUpdate = true;
  cmeSystem.geometry.attributes.color.needsUpdate = true;

  // ── Corona glow rings ──
  for (let r = 0; r < CORONA_RINGS; r++) {
    const radius = 1.15 + r * 0.15 + Math.sin(t + r) * 0.05;
    const positions = coronaLines[r].geometry.attributes.position.array;
    for (let s = 0; s < CORONA_SEGMENTS; s++) {
      const angle = (s / CORONA_SEGMENTS) * TAU;
      const wobble = Math.sin(t * 2 + s * 0.5 + r * 3) * 0.03 * (1 - coherence);
      positions[s * 3] = Math.cos(angle) * (radius + wobble);
      positions[s * 3 + 1] = Math.sin(angle + t * 0.2) * wobble;
      positions[s * 3 + 2] = Math.sin(angle) * (radius + wobble);
    }
    coronaLines[r].geometry.attributes.position.needsUpdate = true;
    // Tilt each corona ring slightly differently
    coronaLines[r].rotation.x = Math.sin(t * 0.1 + r) * 0.3;
    coronaLines[r].rotation.z = Math.cos(t * 0.1 + r * 2) * 0.2;

    const cHue = (sc.hue + 0.02 * r) % 1;
    const crgb = hslToRgb(cHue, sc.sat * 0.6, 0.15 + energy * 0.2);
    coronaMats[r].color.setRGB(crgb[0], crgb[1], crgb[2]);
    coronaMats[r].opacity = 0.05 + energy * 0.15;
  }

  group.rotation.y += dt * 0.04;

  KI.emit('solar-orb:update', {
    solarMode,
    stellarClass: pitch < 0.3 ? 'M' : pitch < 0.5 ? 'K' : pitch < 0.7 ? 'G' : pitch < 0.85 ? 'F' : 'O',
    flareCount: activeFlares,
    spotCount: Math.floor(spotActivity * MAX_SPOTS),
    surfaceTemp: Math.round((sc.lBase + energy * 0.2) * 100),
    coronaGlow: Math.round(energy * 100)
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
