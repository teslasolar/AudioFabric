// topology-morpher.js — Impossible surface morphing from voice
// Continuously morphs between topological surfaces that shouldn't exist in 3D.
// Voice controls which impossible shape you're looking at and how it warps.
// Features:
// - Klein bottle ↔ Möbius strip ↔ Trefoil knot ↔ Boy's surface ↔ Cross-cap
// - Coherence → morph smoothness (stutter vs fluid transition)
// - Pitch → parametric u sweep (reveals hidden topology)
// - Energy → surface distortion amplitude
// - Vowel → target surface selection
// - Pulse → self-intersection glow pulse
// - 3D mesh with vertex displacement, wireframe overlay, intersection highlights

import { KI } from './core.js';

const TAU = Math.PI * 2;
const PI = Math.PI;

// ── Surface definitions (parametric) ──
// Each returns [x,y,z] from parameters u,v in [0,1]
const SURFACES = {
  klein: (u, v) => {
    const U = u * TAU, V = v * TAU;
    const r = 4 * (1 - Math.cos(U) / 2);
    let x, y, z;
    if (U < PI) {
      x = 6 * Math.cos(U) * (1 + Math.sin(U)) + r * Math.cos(U) * Math.cos(V);
      y = 16 * Math.sin(U) + r * Math.sin(U) * Math.cos(V);
    } else {
      x = 6 * Math.cos(U) * (1 + Math.sin(U)) + r * Math.cos(V + PI);
      y = 16 * Math.sin(U);
    }
    z = r * Math.sin(V);
    return [x * 0.06, y * 0.06, z * 0.06];
  },

  mobius: (u, v) => {
    const U = u * TAU, W = v * 2 - 1;  // v in [-1,1]
    const x = (1 + W / 2 * Math.cos(U / 2)) * Math.cos(U);
    const y = (1 + W / 2 * Math.cos(U / 2)) * Math.sin(U);
    const z = W / 2 * Math.sin(U / 2);
    return [x * 1.2, y * 1.2, z * 1.2];
  },

  trefoil: (u, v) => {
    const U = u * TAU, V = v * TAU;
    const r = 0.4;
    const cx = Math.sin(U) + 2 * Math.sin(2 * U);
    const cy = Math.cos(U) - 2 * Math.cos(2 * U);
    const cz = -Math.sin(3 * U);
    // Frenet frame approximation
    const dx = Math.cos(U) + 4 * Math.cos(2 * U);
    const dy = -Math.sin(U) + 4 * Math.sin(2 * U);
    const dz = -3 * Math.cos(3 * U);
    const len = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
    const tx = dx/len, ty = dy/len, tz = dz/len;
    // Rough normal
    const nx = -ty, ny = tx, nz = 0;
    const bx = ty*0 - tz*ny, by = tz*nx - tx*0, bz = tx*ny - ty*nx;
    const x = cx + r * (Math.cos(V) * nx + Math.sin(V) * bx);
    const y = cy + r * (Math.cos(V) * ny + Math.sin(V) * by);
    const z = cz + r * (Math.cos(V) * nz + Math.sin(V) * bz);
    return [x * 0.5, y * 0.5, z * 0.5];
  },

  boy: (u, v) => {
    // Boy's surface immersion of RP2
    const U = u * PI, V = v * PI;
    const su = Math.sin(U), cu = Math.cos(U);
    const sv = Math.sin(V), cv = Math.cos(V);
    const s2v = Math.sin(2 * V);
    const denom = 2 - Math.sqrt(2) * s2v * Math.sin(3 * U);
    const x = (Math.sqrt(2) * cu * cu * s2v + cu * sv) / denom;
    const y = (Math.sqrt(2) * cu * cu * Math.sin(V - TAU/3) * Math.sin(2*(V - TAU/3)) + cu * Math.sin(V - TAU * 2/3)) / denom;
    const z = (3 * cu * cu) / (2 - Math.sqrt(2) * s2v * Math.sin(3*U));
    return [x * 1.0, y * 1.0, (z - 1.5) * 0.8];
  },

  crosscap: (u, v) => {
    const U = u * PI, V = v * TAU;
    const su = Math.sin(U), cu = Math.cos(U);
    const sv = Math.sin(V), cv = Math.cos(V);
    const x = su * cv;
    const y = su * sv;
    const z = cu * cu * sv * cv;  // self-intersecting
    return [x * 1.5, y * 1.5, z * 1.5];
  }
};

const SURFACE_NAMES = Object.keys(SURFACES);

// ── State ──
let currentSurface = 0;
let targetSurface = 0;
let morphT = 0;          // 0 = currentSurface, 1 = targetSurface
let morphSpeed = 0.5;

// ── 3D ──
let group = null;
const RES_U = 60, RES_V = 40;  // mesh resolution
let surfaceMesh = null;
let wireframe = null;
let glowPoints = null, glowPos = null, glowCol = null;
const MAX_GLOW = 400;
let intersectionPoints = null, ixPos = null, ixCol = null;
const MAX_IX = 200;

// ── Trail: ghost afterimages of previous surfaces ──
let ghostMeshes = [];
const GHOST_COUNT = 3;

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 3, -3];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── Main surface mesh ──
  const geo = buildSurfaceGeometry(0, 0, 0);
  surfaceMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0x00ffaa, transparent: true, opacity: 0.25,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  }));
  group.add(surfaceMesh);

  // ── Wireframe overlay ──
  const wireGeo = new THREE.EdgesGeometry(geo, 15);
  wireframe = new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({
    color: 0x00ffff, transparent: true, opacity: 0.15,
    blending: THREE.AdditiveBlending
  }));
  group.add(wireframe);

  // ── Ghost afterimages ──
  for (let g = 0; g < GHOST_COUNT; g++) {
    const gGeo = buildSurfaceGeometry(0, 0, 0);
    const ghost = new THREE.Mesh(gGeo, new THREE.MeshBasicMaterial({
      color: 0x4400ff, transparent: true, opacity: 0.05,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    }));
    group.add(ghost);
    ghostMeshes.push({ mesh: ghost, surfIdx: 0, phase: g * 0.3 });
  }

  // ── Surface glow particles (along surface normals) ──
  const gpGeo = new THREE.BufferGeometry();
  glowPos = new Float32Array(MAX_GLOW * 3);
  glowCol = new Float32Array(MAX_GLOW * 3);
  gpGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
  gpGeo.setAttribute('color', new THREE.BufferAttribute(glowCol, 3));
  glowPoints = new THREE.Points(gpGeo, new THREE.PointsMaterial({
    size: 0.06, vertexColors: true, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(glowPoints);

  // ── Self-intersection highlight points ──
  const ixGeo = new THREE.BufferGeometry();
  ixPos = new Float32Array(MAX_IX * 3);
  ixCol = new Float32Array(MAX_IX * 3);
  ixGeo.setAttribute('position', new THREE.BufferAttribute(ixPos, 3));
  ixGeo.setAttribute('color', new THREE.BufferAttribute(ixCol, 3));
  intersectionPoints = new THREE.Points(ixGeo, new THREE.PointsMaterial({
    size: 0.1, vertexColors: true, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(intersectionPoints);

  KI.register('topology-morpher', {
    update, group,
    getSurface: () => SURFACE_NAMES[currentSurface],
    getTarget: () => SURFACE_NAMES[targetSurface],
    getMorphT: () => morphT,
    setSurface: (name) => {
      const idx = SURFACE_NAMES.indexOf(name);
      if (idx >= 0) { targetSurface = idx; morphT = 0; }
    }
  });

  KI.emit('topology-morpher:ready');
}

function buildSurfaceGeometry(surfA, surfB, blend) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(RES_U * RES_V * 3);
  const indices = [];

  computeSurfacePositions(positions, surfA, surfB, blend, 0, 0);

  for (let i = 0; i < RES_U - 1; i++) {
    for (let j = 0; j < RES_V - 1; j++) {
      const a = i * RES_V + j;
      const b = a + 1;
      const c = (i + 1) * RES_V + j;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  return geo;
}

function computeSurfacePositions(positions, surfA, surfB, blend, distortAmp, t) {
  const fnA = Object.values(SURFACES)[surfA] || SURFACES.klein;
  const fnB = Object.values(SURFACES)[surfB] || SURFACES.klein;

  for (let i = 0; i < RES_U; i++) {
    for (let j = 0; j < RES_V; j++) {
      const u = i / (RES_U - 1);
      const v = j / (RES_V - 1);
      const pA = fnA(u, v);
      const pB = fnB(u, v);
      const idx = (i * RES_V + j) * 3;
      const b = blend;
      positions[idx]     = pA[0] * (1 - b) + pB[0] * b + Math.sin(u * 10 + t * 2) * distortAmp * 0.1;
      positions[idx + 1] = pA[1] * (1 - b) + pB[1] * b + Math.cos(v * 8 + t * 3) * distortAmp * 0.1;
      positions[idx + 2] = pA[2] * (1 - b) + pB[2] * b + Math.sin((u + v) * 6 + t) * distortAmp * 0.05;
    }
  }
}

function update(dt, t) {
  const v = KI.voice;
  const energy = v.energy || 0;
  const coherence = v.coherence || 0;
  const pitch = v.pn || 0;
  const sounding = v.sounding;
  const pulseRate = v.pulseRate || 1;

  // ── Vowel → target surface ──
  if (sounding) {
    const vowelMap = { a: 0, e: 1, i: 2, o: 3, u: 4 };
    const vowel = v.vowel || 'a';
    const newTarget = vowelMap[vowel] !== undefined ? vowelMap[vowel] : 0;
    if (newTarget !== targetSurface) {
      currentSurface = targetSurface;
      targetSurface = newTarget;
      morphT = 0;
      KI.emit('topology-morpher:morph-start', {
        from: SURFACE_NAMES[currentSurface],
        to: SURFACE_NAMES[targetSurface]
      });
    }
  }

  // ── Morph progress: coherence controls speed ──
  morphSpeed = 0.2 + coherence * 1.5;
  if (morphT < 1) {
    morphT = Math.min(1, morphT + dt * morphSpeed);
  }

  // Smooth easing
  const easedMorph = morphT * morphT * (3 - 2 * morphT); // smoothstep

  // ── Update main surface ──
  const positions = surfaceMesh.geometry.attributes.position.array;
  computeSurfacePositions(positions, currentSurface, targetSurface, easedMorph, energy, t);
  surfaceMesh.geometry.attributes.position.needsUpdate = true;
  surfaceMesh.geometry.computeBoundingSphere();

  // Update wireframe
  const wireGeo = new THREE.EdgesGeometry(surfaceMesh.geometry, 15);
  wireframe.geometry.dispose();
  wireframe.geometry = wireGeo;

  // ── Surface color: pitch → hue ──
  const hue = pitch * 0.8;
  const rgb = hslToRgb(hue, 0.6 + energy * 0.3, 0.3 + energy * 0.2);
  surfaceMesh.material.color.setRGB(rgb[0], rgb[1], rgb[2]);
  surfaceMesh.material.opacity = 0.15 + energy * 0.2 + coherence * 0.1;
  wireframe.material.opacity = 0.08 + energy * 0.15;
  const wrgb = hslToRgb((hue + 0.2) % 1, 0.8, 0.4 + energy * 0.3);
  wireframe.material.color.setRGB(wrgb[0], wrgb[1], wrgb[2]);

  // ── Ghost afterimages: lag behind main morph ──
  for (let g = 0; g < GHOST_COUNT; g++) {
    const ghost = ghostMeshes[g];
    const lagMorph = Math.max(0, easedMorph - ghost.phase * 0.4);
    const gPositions = ghost.mesh.geometry.attributes.position.array;
    computeSurfacePositions(gPositions, currentSurface, targetSurface, lagMorph, energy * 0.5, t - ghost.phase);
    ghost.mesh.geometry.attributes.position.needsUpdate = true;
    ghost.mesh.material.opacity = 0.03 + energy * 0.04;
    const gRgb = hslToRgb((hue + 0.5 + g * 0.15) % 1, 0.5, 0.2);
    ghost.mesh.material.color.setRGB(gRgb[0], gRgb[1], gRgb[2]);
    ghost.mesh.rotation.y = t * 0.05 * (g + 1);
  }

  // ── Glow particles: scatter along surface ──
  const activeFn = Object.values(SURFACES)[targetSurface] || SURFACES.klein;
  for (let i = 0; i < MAX_GLOW; i++) {
    const u = (i / MAX_GLOW + t * 0.02) % 1;
    const vp = (Math.sin(i * 1.618) * 0.5 + 0.5 + t * 0.01) % 1;
    const p = activeFn(u, vp);
    const drift = energy * 0.3;
    glowPos[i*3]   += (p[0] + Math.sin(t + i) * drift - glowPos[i*3]) * dt * 3;
    glowPos[i*3+1] += (p[1] + Math.cos(t * 1.3 + i) * drift - glowPos[i*3+1]) * dt * 3;
    glowPos[i*3+2] += (p[2] + Math.sin(t * 0.7 + i * 0.5) * drift - glowPos[i*3+2]) * dt * 3;

    const pHue = (hue + u * 0.3) % 1;
    const pRgb = hslToRgb(pHue, 0.8, 0.3 + energy * 0.4);
    glowCol[i*3] = pRgb[0]; glowCol[i*3+1] = pRgb[1]; glowCol[i*3+2] = pRgb[2];
  }
  glowPoints.geometry.attributes.position.needsUpdate = true;
  glowPoints.geometry.attributes.color.needsUpdate = true;

  // ── Self-intersection highlights: pulse with pulseRate ──
  const ixPulse = 0.5 + Math.sin(t * pulseRate * 3) * 0.5;
  for (let i = 0; i < MAX_IX; i++) {
    // Sample two different points and check proximity (approximate self-intersection)
    const u1 = (i * 0.618) % 1, v1 = (i * 0.381) % 1;
    const u2 = (u1 + 0.5) % 1, v2 = (v1 + 0.3) % 1;
    const p1 = activeFn(u1, v1);
    const p2 = activeFn(u2, v2);
    const dist = Math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2 + (p1[2]-p2[2])**2);
    if (dist < 0.4) {
      ixPos[i*3] = (p1[0]+p2[0])*0.5; ixPos[i*3+1] = (p1[1]+p2[1])*0.5; ixPos[i*3+2] = (p1[2]+p2[2])*0.5;
      ixCol[i*3] = ixPulse; ixCol[i*3+1] = ixPulse * 0.5; ixCol[i*3+2] = ixPulse * 0.8;
    } else {
      ixCol[i*3] *= 0.9; ixCol[i*3+1] *= 0.9; ixCol[i*3+2] *= 0.9;
    }
  }
  intersectionPoints.geometry.attributes.position.needsUpdate = true;
  intersectionPoints.geometry.attributes.color.needsUpdate = true;

  // ── Group rotation ──
  group.rotation.y += dt * 0.12;
  group.rotation.x = Math.sin(t * 0.1) * 0.15;
  group.rotation.z = Math.cos(t * 0.08) * 0.05;

  KI.emit('topology-morpher:update', {
    surface: SURFACE_NAMES[morphT >= 1 ? targetSurface : currentSurface],
    target: SURFACE_NAMES[targetSurface],
    morphProgress: morphT.toFixed(2),
    morphSpeed: morphSpeed.toFixed(2),
    vertexCount: RES_U * RES_V
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
