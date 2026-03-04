// crystal-orb.js — Faceted crystal sphere with internal light refractions
// A central sphere made of transparent crystal facets with light bouncing inside.
// Features:
// - Icosahedral faceted surface (not smooth) with per-face tinting
// - Internal light rays that bounce between facets
// - Energy → internal light intensity, facet glow
// - Pitch → prismatic color separation (rainbow spread)
// - Coherence → facet alignment (perfect crystal vs fractured)
// - Vowel → crystal form (diamond, quartz, emerald, sapphire, amethyst)
// - Pulse → internal light pulse rhythm
// - Floating mineral dust around the crystal

import { KI } from './core.js';

const TAU = Math.PI * 2;

// ── Config ──
const FACET_DETAIL = 2;      // icosahedron subdivision level
const MAX_RAYS = 20;         // internal light rays
const RAY_SEGMENTS = 12;     // segments per ray (bouncing path)
const MAX_DUST = 300;        // mineral dust particles
const MAX_FLARE = 8;         // surface flare points

let group = null;
let crystalMesh = null, crystalMat = null;
let wireframeMesh = null, wireMat = null;
let facetColors = null;       // per-vertex colors for facets
let origPositions = null;     // original vertex positions
let rayLines = [], rayMats = [];
let dustSystem = null, dustPos = null, dustCol = null;
let dustData = [];
let flareMeshes = [], flareMats = [];
let crystalForm = 'diamond';

// Crystal form properties
const FORMS = {
  diamond:  { hue: 0.0, sat: 0.0, stretch: [1, 1, 1], facetShift: 0 },       // clear/white
  quartz:   { hue: 0.0, sat: 0.05, stretch: [0.8, 1.3, 0.8], facetShift: 0.02 },  // slightly warm elongated
  emerald:  { hue: 0.38, sat: 0.7, stretch: [1, 1.1, 1], facetShift: 0.05 },  // green
  sapphire: { hue: 0.6, sat: 0.7, stretch: [1, 0.9, 1], facetShift: 0.03 },   // blue
  amethyst: { hue: 0.78, sat: 0.6, stretch: [1, 1.2, 1], facetShift: 0.04 }   // purple
};

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 2.5, -3.5];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── Crystal body (flat-shaded icosahedron) ──
  const geo = new THREE.IcosahedronGeometry(1.2, FACET_DETAIL);
  // Make it flat-shaded by ensuring non-indexed
  const nonIndexed = geo.toNonIndexed();
  nonIndexed.computeVertexNormals();

  // Store original positions
  origPositions = new Float32Array(nonIndexed.attributes.position.array);

  // Add vertex colors
  const vertCount = nonIndexed.attributes.position.count;
  const colors = new Float32Array(vertCount * 3);
  for (let i = 0; i < vertCount; i++) {
    colors[i * 3] = 0.2; colors[i * 3 + 1] = 0.2; colors[i * 3 + 2] = 0.25;
  }
  nonIndexed.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  facetColors = colors;

  crystalMat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.25,
    blending: THREE.AdditiveBlending, depthWrite: false,
    side: THREE.DoubleSide
  });
  crystalMesh = new THREE.Mesh(nonIndexed, crystalMat);
  group.add(crystalMesh);

  // ── Wireframe overlay (facet edges) ──
  const wireGeo = new THREE.IcosahedronGeometry(1.21, FACET_DETAIL);
  wireMat = new THREE.MeshBasicMaterial({
    color: 0x445566, transparent: true, opacity: 0.15,
    wireframe: true, blending: THREE.AdditiveBlending, depthWrite: false
  });
  wireframeMesh = new THREE.Mesh(wireGeo, wireMat);
  group.add(wireframeMesh);

  // ── Internal light rays ──
  for (let i = 0; i < MAX_RAYS; i++) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(RAY_SEGMENTS * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const line = new THREE.Line(geo, mat);
    group.add(line);
    rayLines.push(line);
    rayMats.push(mat);
  }

  // ── Mineral dust ──
  const dGeo = new THREE.BufferGeometry();
  dustPos = new Float32Array(MAX_DUST * 3);
  dustCol = new Float32Array(MAX_DUST * 3);
  for (let i = 0; i < MAX_DUST; i++) {
    const angle = Math.random() * TAU;
    const r = 1.5 + Math.random() * 1.0;
    const y = (Math.random() - 0.5) * 2;
    dustPos[i * 3] = Math.cos(angle) * r;
    dustPos[i * 3 + 1] = y;
    dustPos[i * 3 + 2] = Math.sin(angle) * r;
    dustData.push({
      angle, r, y, orbitSpeed: (Math.random() - 0.5) * 0.5,
      drift: (Math.random() - 0.5) * 0.05
    });
  }
  dGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dGeo.setAttribute('color', new THREE.BufferAttribute(dustCol, 3));
  dustSystem = new THREE.Points(dGeo, new THREE.PointsMaterial({
    size: 0.025, vertexColors: true, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(dustSystem);

  // ── Surface flares (bright spots on facets) ──
  for (let i = 0; i < MAX_FLARE; i++) {
    const fGeo = new THREE.SphereGeometry(0.06, 6, 4);
    const fMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const flare = new THREE.Mesh(fGeo, fMat);
    flare.visible = false;
    group.add(flare);
    flareMeshes.push(flare);
    flareMats.push(fMat);
  }

  KI.register('crystal-orb', { update, group, getForm: () => crystalForm });
  KI.emit('crystal-orb:ready');
}

function generateBounceRay(t, idx, form) {
  // Generate a ray that bounces inside the crystal
  const points = [];
  let x = 0, y = 0, z = 0;
  let dx = Math.sin(t * 2 + idx * 1.7) * 0.3;
  let dy = Math.cos(t * 1.5 + idx * 2.3) * 0.3;
  let dz = Math.sin(t * 1.8 + idx * 3.1) * 0.3;

  for (let i = 0; i < RAY_SEGMENTS; i++) {
    points.push(x, y, z);
    x += dx; y += dy; z += dz;
    // Bounce off crystal boundary (sphere of radius ~1.1)
    const dist = Math.sqrt(x * x + y * y + z * z);
    if (dist > 1.1) {
      // Reflect direction
      const nx = x / dist, ny = y / dist, nz = z / dist;
      const dot = dx * nx + dy * ny + dz * nz;
      dx -= 2 * dot * nx;
      dy -= 2 * dot * ny;
      dz -= 2 * dot * nz;
      // Pull back inside
      x = nx * 1.05; y = ny * 1.05; z = nz * 1.05;
    }
  }
  return points;
}

function update(dt, t) {
  const v = KI.voice;
  const energy = v.energy || 0;
  const coherence = v.coherence || 0;
  const pitch = v.pn || 0;
  const sounding = v.sounding;
  const pulseRate = v.pulseRate || 1;

  // ── Vowel → crystal form ──
  if (sounding) {
    const forms = { a: 'diamond', e: 'quartz', i: 'emerald', o: 'sapphire', u: 'amethyst' };
    crystalForm = forms[v.vowel || 'a'] || 'diamond';
  }

  const form = FORMS[crystalForm];
  const prismaticSpread = pitch * 0.3; // how much rainbow separation

  // ── Deform crystal vertices (coherence = alignment) ──
  const positions = crystalMesh.geometry.attributes.position.array;
  const vertCount = positions.length / 3;
  const fracture = (1 - coherence) * 0.15;

  for (let i = 0; i < vertCount; i++) {
    const ox = origPositions[i * 3];
    const oy = origPositions[i * 3 + 1];
    const oz = origPositions[i * 3 + 2];
    // Apply form stretch
    let x = ox * form.stretch[0];
    let y = oy * form.stretch[1];
    let z = oz * form.stretch[2];
    // Add fracture displacement
    if (fracture > 0.01) {
      const seed = i * 7.31 + t * 0.5;
      x += Math.sin(seed) * fracture;
      y += Math.cos(seed * 1.3) * fracture;
      z += Math.sin(seed * 0.7) * fracture;
    }
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // ── Per-facet coloring (every 3 vertices = 1 face) ──
    const faceIdx = Math.floor(i / 3);
    const facePhase = faceIdx * 0.1 + t * 0.5;
    const hue = (form.hue + faceIdx * form.facetShift + prismaticSpread * Math.sin(facePhase)) % 1;
    const bright = 0.1 + energy * 0.25 * (Math.sin(facePhase * 2) * 0.5 + 0.5);
    const rgb = hslToRgb(hue < 0 ? hue + 1 : hue, form.sat + energy * 0.2, bright);
    facetColors[i * 3] = rgb[0]; facetColors[i * 3 + 1] = rgb[1]; facetColors[i * 3 + 2] = rgb[2];
  }
  crystalMesh.geometry.attributes.position.needsUpdate = true;
  crystalMesh.geometry.attributes.color.needsUpdate = true;
  crystalMat.opacity = 0.15 + energy * 0.2;

  // Wireframe matches crystal shape
  wireMat.opacity = 0.08 + energy * 0.12;
  const wrgb = hslToRgb(form.hue, 0.3, 0.3 + energy * 0.2);
  wireMat.color.setRGB(wrgb[0], wrgb[1], wrgb[2]);

  // ── Internal light rays ──
  const pulsePhase = Math.sin(t * pulseRate * 3) * 0.5 + 0.5;
  const activeRays = Math.max(0, Math.min(MAX_RAYS, Math.floor(energy * MAX_RAYS * pulsePhase)));

  for (let i = 0; i < MAX_RAYS; i++) {
    if (i < activeRays) {
      const pts = generateBounceRay(t, i, form);
      const positions = rayLines[i].geometry.attributes.position.array;
      for (let j = 0; j < RAY_SEGMENTS * 3; j++) positions[j] = pts[j];
      rayLines[i].geometry.attributes.position.needsUpdate = true;
      rayLines[i].visible = true;

      // Prismatic color per ray
      const rayHue = (form.hue + i * prismaticSpread * 0.1 + 0.5) % 1;
      const rrgb = hslToRgb(rayHue < 0 ? rayHue + 1 : rayHue, 0.6 + energy * 0.3, 0.5 + energy * 0.4);
      rayMats[i].color.setRGB(rrgb[0], rrgb[1], rrgb[2]);
      rayMats[i].opacity = 0.2 + energy * 0.4;
    } else {
      rayLines[i].visible = false;
    }
  }

  // ── Mineral dust ──
  for (let i = 0; i < MAX_DUST; i++) {
    const dd = dustData[i];
    dd.angle += dt * dd.orbitSpeed;
    dd.y += dd.drift * dt;
    if (dd.y > 1.5) dd.drift = -Math.abs(dd.drift);
    if (dd.y < -1.5) dd.drift = Math.abs(dd.drift);

    dustPos[i * 3] = Math.cos(dd.angle) * dd.r;
    dustPos[i * 3 + 1] = dd.y;
    dustPos[i * 3 + 2] = Math.sin(dd.angle) * dd.r;

    const dHue = (form.hue + dd.angle * 0.05) % 1;
    const dBright = 0.05 + energy * 0.15 * (Math.sin(t * 2 + i) * 0.5 + 0.5);
    const drgb = hslToRgb(dHue < 0 ? dHue + 1 : dHue, form.sat * 0.5, dBright);
    dustCol[i * 3] = drgb[0]; dustCol[i * 3 + 1] = drgb[1]; dustCol[i * 3 + 2] = drgb[2];
  }
  dustSystem.geometry.attributes.position.needsUpdate = true;
  dustSystem.geometry.attributes.color.needsUpdate = true;

  // ── Surface flares ──
  for (let i = 0; i < MAX_FLARE; i++) {
    if (energy > 0.2 && Math.sin(t * 3 + i * 2.5) > 0.5) {
      flareMeshes[i].visible = true;
      const angle = t * 0.5 + i * TAU / MAX_FLARE;
      const elev = Math.sin(t * 0.7 + i * 1.3) * 0.8;
      const r = 1.22;
      flareMeshes[i].position.set(
        Math.cos(angle) * Math.cos(elev) * r,
        Math.sin(elev) * r,
        Math.sin(angle) * Math.cos(elev) * r
      );
      const fHue = (form.hue + i * prismaticSpread * 0.15) % 1;
      const frgb = hslToRgb(fHue < 0 ? fHue + 1 : fHue, 0.5, 0.5 + energy * 0.4);
      flareMats[i].color.setRGB(frgb[0], frgb[1], frgb[2]);
      flareMats[i].opacity = 0.3 + energy * 0.5;
      flareMeshes[i].scale.setScalar(0.5 + energy * 1.5);
    } else {
      flareMeshes[i].visible = false;
    }
  }

  // Slow rotation
  group.rotation.y += dt * 0.06;
  group.rotation.x = Math.sin(t * 0.2) * 0.1;

  KI.emit('crystal-orb:update', {
    crystalForm,
    activeRays,
    prismaticSpread: Math.round(prismaticSpread * 100),
    facetCount: Math.floor(vertCount / 3),
    coherence: Math.round(coherence * 100)
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
