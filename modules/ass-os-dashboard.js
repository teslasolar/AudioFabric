// ass-os-dashboard.js — 3D Consciousness Dashboard for ASS-OS
// Visualizes all 7 levels as stacked rings, 5 buses as connecting streams,
// PACK-ML state as ambient color, alarms as flashing indicators,
// and the prime recursion spine as the central column.

import { KI } from './core.js';
import { PRIME_SPINE, SPINE_LABELS, STATES, ALARM_PRIORITIES } from './ass-os-engine.js';

const TAU = Math.PI * 2;

// ── Config ──
const LEVEL_SPACING = 0.45;    // vertical distance between levels
const LEVEL_BASE_Y = -0.8;     // bottom of stack
const BUS_PARTICLES = 100;     // particles per bus stream
const MAX_ALARM_INDICATORS = 10;

let group = null;

// Level rings (7 toroidal rings stacked vertically)
let levelRings = [], levelMats = [];
let levelLabels = [];

// Prime spine column (central glowing line)
let spineLine = null, spineMat = null;
let spineNodes = [], spineNodeMats = [];

// Bus streams (5 particle systems connecting levels)
let busStreams = [], busPositions = [], busCols = [], busData = [];
const BUS_COLORS = [
  [0.2, 0.8, 1.0],   // A: Tensor — cyan
  [1.0, 0.5, 0.2],   // B: Gradient — orange
  [0.8, 0.4, 1.0],   // C: Photonic — purple
  [0.2, 1.0, 0.5],   // D: EM Field — green
  [1.0, 1.0, 0.3]    // E: State — yellow
];
const BUS_LABELS = ['TENSOR', 'GRADIENT', 'PHOTONIC', 'EM FIELD', 'STATE'];

// State indicator (background glow sphere)
let stateGlow = null, stateGlowMat = null;

// Alarm indicators
let alarmMeshes = [], alarmMats = [];

// Consciousness depth marker
let depthMarker = null, depthMarkerMat = null;

// Phi meter (integration ring)
let phiRing = null, phiMat = null;

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 2.2, -3.5];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── State glow (large background sphere) ──
  const sgGeo = new THREE.SphereGeometry(2.5, 16, 12);
  stateGlowMat = new THREE.MeshBasicMaterial({
    color: 0x44ff88, transparent: true, opacity: 0.03,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide
  });
  stateGlow = new THREE.Mesh(sgGeo, stateGlowMat);
  group.add(stateGlow);

  // ── Level rings (L0 at bottom, L6 at top) ──
  for (let i = 0; i < 7; i++) {
    const radius = 0.6 + (i === 6 ? 0.3 : i * 0.08); // L6 slightly smaller (the observer)
    const tubeRadius = 0.04 + (6 - i) * 0.005; // Lower levels thicker
    const geo = new THREE.TorusGeometry(radius, tubeRadius, 8, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x224488, transparent: true, opacity: 0.1,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = LEVEL_BASE_Y + i * LEVEL_SPACING;
    mesh.rotation.x = Math.PI / 2;
    group.add(mesh);
    levelRings.push(mesh);
    levelMats.push(mat);
  }

  // ── Prime spine (vertical line through center) ──
  const spineGeo = new THREE.BufferGeometry();
  const spineVerts = new Float32Array([
    0, LEVEL_BASE_Y - 0.3, 0,
    0, LEVEL_BASE_Y + 6 * LEVEL_SPACING + 0.3, 0
  ]);
  spineGeo.setAttribute('position', new THREE.BufferAttribute(spineVerts, 3));
  spineMat = new THREE.LineBasicMaterial({
    color: 0x4488ff, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  spineLine = new THREE.Line(spineGeo, spineMat);
  group.add(spineLine);

  // ── Spine nodes (one per level on the spine) ──
  for (let i = 0; i < 7; i++) {
    const nGeo = new THREE.SphereGeometry(0.05, 6, 4);
    const nMat = new THREE.MeshBasicMaterial({
      color: 0x4488ff, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const node = new THREE.Mesh(nGeo, nMat);
    node.position.y = LEVEL_BASE_Y + i * LEVEL_SPACING;
    group.add(node);
    spineNodes.push(node);
    spineNodeMats.push(nMat);
  }

  // ── Bus streams (5 particle systems spiraling around the spine) ──
  for (let b = 0; b < 5; b++) {
    const pGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(BUS_PARTICLES * 3);
    const col = new Float32Array(BUS_PARTICLES * 3);
    const data = [];

    for (let i = 0; i < BUS_PARTICLES; i++) {
      const f = i / BUS_PARTICLES;
      const y = LEVEL_BASE_Y + f * (6 * LEVEL_SPACING);
      const angle = f * TAU * 3 + (b / 5) * TAU; // spiral
      const r = 0.15 + b * 0.06;
      pos[i * 3] = Math.cos(angle) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(angle) * r;
      data.push({ f, angle, r, speed: 0.5 + b * 0.2 });
    }

    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const stream = new THREE.Points(pGeo, new THREE.PointsMaterial({
      size: 0.025, vertexColors: true, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    group.add(stream);
    busStreams.push(stream);
    busPositions.push(pos);
    busCols.push(col);
    busData.push(data);
  }

  // ── Depth marker (horizontal disc showing current consciousness depth) ──
  const dmGeo = new THREE.RingGeometry(0.0, 0.8, 32);
  depthMarkerMat = new THREE.MeshBasicMaterial({
    color: 0x44ffaa, transparent: true, opacity: 0.1,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  depthMarker = new THREE.Mesh(dmGeo, depthMarkerMat);
  depthMarker.rotation.x = Math.PI / 2;
  group.add(depthMarker);

  // ── Phi integration ring ──
  const prGeo = new THREE.TorusGeometry(1.5, 0.015, 6, 48);
  phiMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.05,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  phiRing = new THREE.Mesh(prGeo, phiMat);
  phiRing.rotation.x = Math.PI / 2;
  phiRing.position.y = LEVEL_BASE_Y + 3 * LEVEL_SPACING; // at L3 midpoint
  group.add(phiRing);

  // ── Alarm indicators ──
  for (let i = 0; i < MAX_ALARM_INDICATORS; i++) {
    const aGeo = new THREE.SphereGeometry(0.06, 6, 4);
    const aMat = new THREE.MeshBasicMaterial({
      color: 0xff2222, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const alarm = new THREE.Mesh(aGeo, aMat);
    alarm.visible = false;
    group.add(alarm);
    alarmMeshes.push(alarm);
    alarmMats.push(aMat);
  }

  KI.register('ass-os-dashboard', { update, group });
  KI.emit('ass-os-dashboard:ready');
}

function update(dt, t) {
  // Listen for engine data
  const data = KI.lastEvent?.['ass-os:update'];
  if (!data) return;

  const { levels, buses, busHealth, state, stateInfo, depth, phi,
          selfModelCoherence, alarms, alarmCount, consciousness } = data;

  // ── State glow color ──
  if (stateInfo) {
    const sc = new THREE.Color(stateInfo.color);
    stateGlowMat.color.lerp(sc, dt * 2);
    stateGlowMat.opacity = 0.02 + (buses ? buses.reduce((a, b) => a + b, 0) / 5 * 0.04 : 0);
  }

  // ── Level rings ──
  if (levels) {
    for (let i = 0; i < 7; i++) {
      const activation = levels[i] || 0;

      // Size pulse
      const scale = 0.8 + activation * 0.4;
      levelRings[i].scale.setScalar(scale);

      // Color by activation
      const hue = (i / 7) * 0.7; // spread across spectrum
      const bright = 0.1 + activation * 0.4;
      const rgb = hslToRgb(hue, 0.6, bright);
      levelMats[i].color.setRGB(rgb[0], rgb[1], rgb[2]);
      levelMats[i].opacity = 0.05 + activation * 0.3;

      // Rotation speed proportional to activation
      levelRings[i].rotation.z += dt * (0.1 + activation * 2) * (i % 2 === 0 ? 1 : -1);

      // Spine nodes glow with level
      spineNodeMats[i].opacity = 0.1 + activation * 0.6;
      spineNodeMats[i].color.setRGB(rgb[0], rgb[1], rgb[2]);
      spineNodes[i].scale.setScalar(0.5 + activation * 2);
    }
  }

  // ── Bus streams ──
  if (buses) {
    for (let b = 0; b < 5; b++) {
      const activity = buses[b] || 0;
      const pos = busPositions[b];
      const col = busCols[b];
      const bd = busData[b];
      const bc = BUS_COLORS[b];

      for (let i = 0; i < BUS_PARTICLES; i++) {
        const d = bd[i];
        d.angle += dt * d.speed * (0.5 + activity * 3);
        const r = d.r * (0.5 + activity);

        pos[i * 3] = Math.cos(d.angle) * r;
        pos[i * 3 + 2] = Math.sin(d.angle) * r;
        // Y position stays fixed (vertical column)

        const bright = activity * 0.8;
        col[i * 3] = bc[0] * bright;
        col[i * 3 + 1] = bc[1] * bright;
        col[i * 3 + 2] = bc[2] * bright;
      }
      busStreams[b].geometry.attributes.position.needsUpdate = true;
      busStreams[b].geometry.attributes.color.needsUpdate = true;
      busStreams[b].material.opacity = 0.2 + activity * 0.5;
    }
  }

  // ── Depth marker ──
  if (depth !== undefined) {
    const targetY = LEVEL_BASE_Y + Math.min(6, depth) * LEVEL_SPACING;
    depthMarker.position.y += (targetY - depthMarker.position.y) * dt * 3;
    depthMarkerMat.opacity = 0.05 + Math.min(1, depth / 7) * 0.15;
    const dHue = Math.min(1, depth / 7) * 0.7;
    const drgb = hslToRgb(dHue, 0.6, 0.3);
    depthMarkerMat.color.setRGB(drgb[0], drgb[1], drgb[2]);
  }

  // ── Phi ring ──
  if (phi !== undefined) {
    phiRing.scale.setScalar(0.5 + phi * 0.5);
    phiMat.opacity = 0.02 + phi * 0.12;
    phiRing.rotation.z += dt * phi * 0.5;
  }

  // ── Spine glow ──
  const spineIntensity = levels ? levels.reduce((a, b) => a + b, 0) / 7 : 0;
  spineMat.opacity = 0.1 + spineIntensity * 0.4;

  // ── Alarm indicators ──
  if (alarms) {
    for (let i = 0; i < MAX_ALARM_INDICATORS; i++) {
      if (i < alarms.length) {
        const a = alarms[i];
        const ap = ALARM_PRIORITIES[a.priority];
        alarmMeshes[i].visible = true;
        // Position near the source level
        const ly = a.sourceLevel >= 0 ? LEVEL_BASE_Y + a.sourceLevel * LEVEL_SPACING : LEVEL_BASE_Y + 3 * LEVEL_SPACING;
        const angle = t * 3 + i * TAU / Math.max(1, alarms.length);
        alarmMeshes[i].position.set(Math.cos(angle) * 1.3, ly, Math.sin(angle) * 1.3);
        alarmMats[i].color.set(ap?.color || '#ff2222');
        alarmMats[i].opacity = 0.3 + Math.sin(t * 8 + i) * 0.2; // flash
        alarmMeshes[i].scale.setScalar(1 + Math.sin(t * 6) * 0.3);
      } else {
        alarmMeshes[i].visible = false;
      }
    }
  }

  // ── Slow rotation ──
  group.rotation.y += dt * 0.03;
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) { r = g = b = l; } else {
    const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q-p)*6*t; if (t < 1/2) return q; if (t < 2/3) return p + (q-p)*(2/3-t)*6; return p; };
    const q = l < 0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
    r = hue2rgb(p, q, h+1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h-1/3);
  }
  return [r, g, b];
}
