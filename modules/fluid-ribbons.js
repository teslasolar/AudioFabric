// fluid-ribbons.js — Flowing silk ribbon trails through space
// Ribbons of light that flow like liquid silk, shaped by voice.
// Features:
// - Multiple ribbon trails with smooth catmull-rom interpolation
// - Energy → ribbon width and brightness
// - Pitch → ribbon color gradient
// - Coherence → ribbon smoothness (silky vs turbulent)
// - Vowel → flow pattern (helix, figure8, cascade, bloom, veil)
// - Pulse → flow speed
// - Each ribbon has a head that traces the path and a fading tail
// - Shimmer particles along ribbon surfaces
// - Ribbons leave temporary "ink" traces that slowly fade

import { KI } from './core.js';

const TAU = Math.PI * 2;

// ── Ribbon state ──
const MAX_RIBBONS = 8;
const TRAIL_LENGTH = 80;  // points per ribbon trail
const ribbons = [];
let flowPattern = 'helix';

// ── 3D ──
let group = null;
let ribbonMeshes = [];    // triangle strip meshes for each ribbon
let headMeshes = [];      // glowing head at ribbon tip
let shimmerSystem = null, shimmerPos = null, shimmerCol = null;
const MAX_SHIMMER = 500;
// Ink traces (fading afterimage)
let inkSystem = null, inkPos = null, inkCol = null;
const MAX_INK = 800;
let inkIdx = 0;

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 2.5, -3];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── Initialize ribbons ──
  for (let r = 0; r < MAX_RIBBONS; r++) {
    const trail = [];
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      trail.push({ x: 0, y: 0, z: 0 });
    }
    ribbons.push({
      trail,
      hue: r / MAX_RIBBONS,
      width: 0.1,
      active: r < 3,
      phase: r * TAU / MAX_RIBBONS
    });

    // Ribbon mesh: triangle strip (2 verts per trail point)
    const vertCount = TRAIL_LENGTH * 2;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(vertCount * 3);
    const colors = new Float32Array(vertCount * 3);
    const indices = [];
    for (let i = 0; i < TRAIL_LENGTH - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(indices);

    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    }));
    mesh.visible = false;
    group.add(mesh);
    ribbonMeshes.push(mesh);

    // Head glow
    const hGeo = new THREE.SphereGeometry(0.08, 8, 6);
    const head = new THREE.Mesh(hGeo, new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    head.visible = false;
    group.add(head);
    headMeshes.push(head);
  }

  // ── Shimmer particles ──
  const sGeo = new THREE.BufferGeometry();
  shimmerPos = new Float32Array(MAX_SHIMMER * 3);
  shimmerCol = new Float32Array(MAX_SHIMMER * 3);
  sGeo.setAttribute('position', new THREE.BufferAttribute(shimmerPos, 3));
  sGeo.setAttribute('color', new THREE.BufferAttribute(shimmerCol, 3));
  shimmerSystem = new THREE.Points(sGeo, new THREE.PointsMaterial({
    size: 0.04, vertexColors: true, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(shimmerSystem);

  // ── Ink trace particles ──
  const iGeo = new THREE.BufferGeometry();
  inkPos = new Float32Array(MAX_INK * 3);
  inkCol = new Float32Array(MAX_INK * 3);
  iGeo.setAttribute('position', new THREE.BufferAttribute(inkPos, 3));
  iGeo.setAttribute('color', new THREE.BufferAttribute(inkCol, 3));
  inkSystem = new THREE.Points(iGeo, new THREE.PointsMaterial({
    size: 0.03, vertexColors: true, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(inkSystem);

  KI.register('fluid-ribbons', {
    update, group,
    getRibbonCount: () => ribbons.filter(r => r.active).length,
    getPattern: () => flowPattern
  });

  KI.emit('fluid-ribbons:ready');
}

// ── Flow path generators ──
function flowPosition(pattern, t, phase, ribbonIdx, spread) {
  const p = phase + t;
  switch (pattern) {
    case 'figure8': {
      const s = spread * 1.5;
      return [Math.sin(p) * s, Math.sin(p * 2) * s * 0.5, Math.cos(p) * s * 0.3];
    }
    case 'cascade': {
      const wave = Math.sin(p * 0.5 + ribbonIdx);
      return [Math.cos(p) * spread, wave * spread - (t % 4) + 2, Math.sin(p * 0.7) * spread * 0.5];
    }
    case 'bloom': {
      const r = spread * (0.5 + Math.sin(p * 0.3) * 0.5);
      const a = p + ribbonIdx * 0.5;
      return [Math.cos(a) * r, Math.sin(p * 2) * r * 0.3, Math.sin(a) * r];
    }
    case 'veil': {
      const x = Math.sin(p * 0.5 + ribbonIdx * 0.3) * spread;
      const y = Math.cos(p * 0.3) * spread * 0.8;
      return [x, y, Math.sin(p * 0.2 + ribbonIdx) * 0.5];
    }
    default: // helix
      return [
        Math.cos(p * 2) * spread,
        Math.sin(p * 3) * spread * 0.5 + Math.sin(p * 0.5) * 0.5,
        Math.sin(p * 2) * spread
      ];
  }
}

function update(dt, t) {
  const v = KI.voice;
  const energy = v.energy || 0;
  const coherence = v.coherence || 0;
  const pitch = v.pn || 0;
  const sounding = v.sounding;
  const pulseRate = v.pulseRate || 1;

  // ── Vowel → flow pattern ──
  if (sounding) {
    const vowelFlow = { a: 'helix', e: 'figure8', i: 'cascade', o: 'bloom', u: 'veil' };
    flowPattern = vowelFlow[v.vowel || 'a'] || 'helix';
  }

  // ── Active ribbon count ──
  const targetCount = Math.max(1, Math.min(MAX_RIBBONS, Math.floor(1 + energy * 7)));
  for (let i = 0; i < MAX_RIBBONS; i++) ribbons[i].active = i < targetCount;

  const spread = 1.0 + pitch * 1.5;
  const flowSpeed = 0.5 + energy * 2 + pulseRate * 0.5;
  const turbulence = (1 - coherence) * 0.5; // low coherence = turbulent

  let shimmerIdx = 0;

  for (let r = 0; r < MAX_RIBBONS; r++) {
    const ribbon = ribbons[r];
    const mesh = ribbonMeshes[r];
    const head = headMeshes[r];

    if (!ribbon.active) {
      mesh.visible = false;
      head.visible = false;
      continue;
    }

    mesh.visible = true;
    head.visible = true;

    // ── Update trail: shift old points, add new head position ──
    for (let i = TRAIL_LENGTH - 1; i > 0; i--) {
      ribbon.trail[i].x = ribbon.trail[i-1].x;
      ribbon.trail[i].y = ribbon.trail[i-1].y;
      ribbon.trail[i].z = ribbon.trail[i-1].z;
    }

    // New head position from flow pattern
    const [fx, fy, fz] = flowPosition(flowPattern, t * flowSpeed, ribbon.phase, r, spread);
    // Add turbulence
    ribbon.trail[0].x = fx + Math.sin(t * 5 + r) * turbulence;
    ribbon.trail[0].y = fy + Math.cos(t * 4.3 + r * 2) * turbulence;
    ribbon.trail[0].z = fz + Math.sin(t * 3.7 + r * 3) * turbulence * 0.5;

    // ── Update ribbon width ──
    ribbon.width = 0.05 + energy * 0.15;

    // ── Build triangle strip mesh from trail ──
    const positions = mesh.geometry.attributes.position.array;
    const colors = mesh.geometry.attributes.color.array;

    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const pt = ribbon.trail[i];
      const fade = 1 - i / TRAIL_LENGTH;
      const w = ribbon.width * fade;

      // Perpendicular direction for ribbon width
      let nx = 0, ny = 1, nz = 0;
      if (i < TRAIL_LENGTH - 1) {
        const next = ribbon.trail[i + 1];
        const dx = next.x - pt.x, dy = next.y - pt.y, dz = next.z - pt.z;
        const len = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
        // Cross with up vector for perpendicular
        nx = -dz / len; ny = 0; nz = dx / len;
      }

      const idx = i * 2;
      positions[idx*3]     = pt.x + nx * w;
      positions[idx*3+1]   = pt.y + ny * w;
      positions[idx*3+2]   = pt.z + nz * w;
      positions[(idx+1)*3]   = pt.x - nx * w;
      positions[(idx+1)*3+1] = pt.y - ny * w;
      positions[(idx+1)*3+2] = pt.z - nz * w;

      // Color: hue gradient along ribbon
      const hue = (ribbon.hue + i * 0.005 + pitch * 0.3) % 1;
      const rgb = hslToRgb(hue, 0.7 + energy * 0.2, 0.3 * fade + energy * 0.2 * fade);
      colors[idx*3] = rgb[0]; colors[idx*3+1] = rgb[1]; colors[idx*3+2] = rgb[2];
      colors[(idx+1)*3] = rgb[0]; colors[(idx+1)*3+1] = rgb[1]; colors[(idx+1)*3+2] = rgb[2];

      // Shimmer particles along ribbon
      if (shimmerIdx < MAX_SHIMMER && i % 3 === 0 && fade > 0.2) {
        shimmerPos[shimmerIdx*3] = pt.x + (Math.random()-0.5) * w * 2;
        shimmerPos[shimmerIdx*3+1] = pt.y + (Math.random()-0.5) * w * 2;
        shimmerPos[shimmerIdx*3+2] = pt.z + (Math.random()-0.5) * w * 2;
        shimmerCol[shimmerIdx*3] = rgb[0] * 0.5;
        shimmerCol[shimmerIdx*3+1] = rgb[1] * 0.5;
        shimmerCol[shimmerIdx*3+2] = rgb[2] * 0.5;
        shimmerIdx++;
      }
    }

    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.attributes.color.needsUpdate = true;
    mesh.material.opacity = 0.2 + energy * 0.2;

    // Head glow
    head.position.set(ribbon.trail[0].x, ribbon.trail[0].y, ribbon.trail[0].z);
    head.material.opacity = 0.3 + energy * 0.4;
    const hrgb = hslToRgb(ribbon.hue, 0.8, 0.5 + energy * 0.3);
    head.material.color.setRGB(hrgb[0], hrgb[1], hrgb[2]);
    head.scale.setScalar(0.8 + energy * 0.5);

    // ── Ink trace: drop ink from head ──
    if (energy > 0.1) {
      const ii = inkIdx % MAX_INK;
      inkPos[ii*3] = ribbon.trail[0].x;
      inkPos[ii*3+1] = ribbon.trail[0].y;
      inkPos[ii*3+2] = ribbon.trail[0].z;
      const irgb = hslToRgb(ribbon.hue, 0.4, 0.2);
      inkCol[ii*3] = irgb[0]; inkCol[ii*3+1] = irgb[1]; inkCol[ii*3+2] = irgb[2];
      inkIdx++;
    }
  }

  // Fade shimmer
  for (let i = shimmerIdx; i < MAX_SHIMMER; i++) {
    shimmerCol[i*3] *= 0.92; shimmerCol[i*3+1] *= 0.92; shimmerCol[i*3+2] *= 0.92;
  }
  shimmerSystem.geometry.attributes.position.needsUpdate = true;
  shimmerSystem.geometry.attributes.color.needsUpdate = true;

  // Fade ink
  for (let i = 0; i < MAX_INK; i++) {
    inkCol[i*3] *= 0.998; inkCol[i*3+1] *= 0.998; inkCol[i*3+2] *= 0.998;
  }
  inkSystem.geometry.attributes.position.needsUpdate = true;
  inkSystem.geometry.attributes.color.needsUpdate = true;

  group.rotation.y += dt * 0.03;

  KI.emit('fluid-ribbons:update', {
    ribbonCount: ribbons.filter(r => r.active).length,
    pattern: flowPattern,
    trailLength: TRAIL_LENGTH,
    inkDrops: Math.min(inkIdx, MAX_INK)
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
