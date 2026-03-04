// dimensional-slicer.js — 4D geometry cross-section visualizer
// Renders 4D polytopes projected/sliced into 3D. Voice rotates in the 4th dimension
// so you see impossible shape-shifting geometry that can't exist in 3D.
// Features:
// - 4D objects: tesseract (8-cell), 16-cell, 24-cell, 120-cell, 600-cell
// - Pitch → rotation angle in XW plane (reveals hidden structure)
// - Energy → rotation in YW plane
// - Coherence → rotation in ZW plane
// - Vowel → polytope selection
// - Pulse → projection distance (perspective vs orthographic)
// - Cross-section plane sweeps through 4D object
// - Vertices, edges, and faces all project differently as you rotate

import { KI } from './core.js';

const TAU = Math.PI * 2;

// ── 4D Polytope definitions ──
// Each vertex is [x, y, z, w]
function makeTesseract() {
  const verts = [];
  for (let i = 0; i < 16; i++) {
    verts.push([
      (i & 1) ? 1 : -1,
      (i & 2) ? 1 : -1,
      (i & 4) ? 1 : -1,
      (i & 8) ? 1 : -1
    ]);
  }
  const edges = [];
  for (let i = 0; i < 16; i++) {
    for (let j = i + 1; j < 16; j++) {
      let diff = 0;
      for (let k = 0; k < 4; k++) if (verts[i][k] !== verts[j][k]) diff++;
      if (diff === 1) edges.push([i, j]);
    }
  }
  return { verts, edges, name: 'Tesseract (8-cell)' };
}

function make16Cell() {
  const verts = [];
  for (let d = 0; d < 4; d++) {
    for (const s of [-1, 1]) {
      const v = [0, 0, 0, 0]; v[d] = s;
      verts.push(v);
    }
  }
  const edges = [];
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      let dot = 0;
      for (let k = 0; k < 4; k++) dot += verts[i][k] * verts[j][k];
      if (Math.abs(dot) < 0.01) edges.push([i, j]); // orthogonal vertices are connected
    }
  }
  return { verts, edges, name: '16-cell' };
}

function make24Cell() {
  const verts = [];
  // Permutations of (±1, ±1, 0, 0)
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      for (const si of [-1, 1]) {
        for (const sj of [-1, 1]) {
          const v = [0, 0, 0, 0]; v[i] = si; v[j] = sj;
          verts.push(v);
        }
      }
    }
  }
  const edges = [];
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      let dist2 = 0;
      for (let k = 0; k < 4; k++) dist2 += (verts[i][k] - verts[j][k]) ** 2;
      if (Math.abs(dist2 - 2) < 0.01) edges.push([i, j]); // edge length sqrt(2)
    }
  }
  return { verts, edges, name: '24-cell' };
}

function make5Cell() {
  // Simplest 4D regular polytope (pentachoron)
  const phi = (1 + Math.sqrt(5)) / 2;
  const verts = [
    [1, 1, 1, -1/Math.sqrt(5)],
    [1, -1, -1, -1/Math.sqrt(5)],
    [-1, 1, -1, -1/Math.sqrt(5)],
    [-1, -1, 1, -1/Math.sqrt(5)],
    [0, 0, 0, Math.sqrt(5) - 1/Math.sqrt(5)]
  ];
  const edges = [];
  for (let i = 0; i < 5; i++) for (let j = i+1; j < 5; j++) edges.push([i, j]);
  return { verts, edges, name: '5-cell' };
}

function makeDual8Cell() {
  // Tesseract + 16-cell dual compound
  const t = makeTesseract();
  const s = make16Cell();
  const verts = [...t.verts, ...s.verts.map(v => v.map(c => c * 1.2))];
  const edges = [...t.edges, ...s.edges.map(e => [e[0] + t.verts.length, e[1] + t.verts.length])];
  // Add connections between duals
  for (let i = 0; i < t.verts.length; i++) {
    for (let j = 0; j < s.verts.length; j++) {
      let dist2 = 0;
      for (let k = 0; k < 4; k++) dist2 += (t.verts[i][k] - s.verts[j][k] * 1.2) ** 2;
      if (dist2 < 3) edges.push([i, j + t.verts.length]);
    }
  }
  return { verts, edges, name: 'Dual Compound' };
}

const POLYTOPES = [makeTesseract(), make16Cell(), make24Cell(), make5Cell(), makeDual8Cell()];

// ── State ──
let currentPoly = 0;
let rotXW = 0, rotYW = 0, rotZW = 0; // 4D rotation angles
let projDist = 3;  // perspective projection distance

// ── 3D objects ──
let group = null;
let vertexMeshes = [];
let edgeLines = [];
let slicePlane = null;
let trailPoints = null, trailPos = null, trailCol = null;
const MAX_VERTS = 48;
const MAX_EDGES = 200;
const MAX_TRAIL = 600;

// Projected 3D positions cache
let projected3D = [];

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 3, -3];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── Vertex meshes ──
  for (let i = 0; i < MAX_VERTS; i++) {
    const geo = new THREE.OctahedronGeometry(0.08, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    group.add(mesh);
    vertexMeshes.push(mesh);
  }

  // ── Edge lines ──
  for (let i = 0; i < MAX_EDGES; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0x4488ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending
    }));
    line.visible = false;
    group.add(line);
    edgeLines.push(line);
  }

  // ── Slice plane (translucent disc showing where 4D slice occurs) ──
  const planeGeo = new THREE.RingGeometry(0, 3, 64);
  slicePlane = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({
    color: 0xff00ff, transparent: true, opacity: 0.03,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  }));
  group.add(slicePlane);

  // ── Trail particles (vertex afterimages as 4D rotation happens) ──
  const tGeo = new THREE.BufferGeometry();
  trailPos = new Float32Array(MAX_TRAIL * 3);
  trailCol = new Float32Array(MAX_TRAIL * 3);
  tGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  tGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
  trailPoints = new THREE.Points(tGeo, new THREE.PointsMaterial({
    size: 0.04, vertexColors: true, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(trailPoints);

  KI.register('dimensional-slicer', {
    update, group,
    getPolytope: () => POLYTOPES[currentPoly].name,
    getRotation: () => ({ xw: rotXW, yw: rotYW, zw: rotZW }),
    getVertexCount: () => POLYTOPES[currentPoly].verts.length,
    getEdgeCount: () => POLYTOPES[currentPoly].edges.length
  });

  KI.emit('dimensional-slicer:ready');
}

// ── 4D rotation matrices (applied as simple plane rotations) ──
function rotate4D(v, xw, yw, zw) {
  let [x, y, z, w] = v;
  // XW rotation
  let nx = x * Math.cos(xw) - w * Math.sin(xw);
  let nw = x * Math.sin(xw) + w * Math.cos(xw);
  x = nx; w = nw;
  // YW rotation
  let ny = y * Math.cos(yw) - w * Math.sin(yw);
  nw = y * Math.sin(yw) + w * Math.cos(yw);
  y = ny; w = nw;
  // ZW rotation
  let nz = z * Math.cos(zw) - w * Math.sin(zw);
  nw = z * Math.sin(zw) + w * Math.cos(zw);
  z = nz; w = nw;
  return [x, y, z, w];
}

// ── Stereographic projection from 4D to 3D ──
function project4Dto3D(v4, dist) {
  const w = v4[3];
  const scale = dist / (dist - w);
  return [v4[0] * scale, v4[1] * scale, v4[2] * scale, scale]; // scale for sizing
}

function update(dt, t) {
  const v = KI.voice;
  const energy = v.energy || 0;
  const coherence = v.coherence || 0;
  const pitch = v.pn || 0;
  const sounding = v.sounding;
  const pulseRate = v.pulseRate || 1;

  // ── Vowel → polytope ──
  if (sounding) {
    const vowelPoly = { a: 0, e: 1, i: 2, o: 3, u: 4 };
    const target = vowelPoly[v.vowel || 'a'] || 0;
    if (target !== currentPoly) {
      currentPoly = target;
      KI.emit('dimensional-slicer:polytope-change', { name: POLYTOPES[currentPoly].name });
    }
  }

  // ── Voice → 4D rotation ──
  // Pitch sweeps XW, energy sweeps YW, coherence sweeps ZW
  const rotSpeed = 0.5 + energy * 2;
  if (sounding) {
    rotXW += (pitch - 0.5) * dt * rotSpeed * 3;
    rotYW += energy * dt * rotSpeed;
    rotZW += coherence * dt * rotSpeed * 0.7;
  } else {
    // Slow auto-rotation when silent
    rotXW += dt * 0.15;
    rotYW += dt * 0.08;
  }

  // ── Projection distance from pulse ──
  projDist = 2.5 + Math.sin(t * pulseRate) * 0.3 + coherence * 0.5;

  const poly = POLYTOPES[currentPoly];
  projected3D = [];

  // ── Project vertices ──
  let trailIdx = 0;
  for (let i = 0; i < poly.verts.length && i < MAX_VERTS; i++) {
    const v4 = rotate4D(poly.verts[i], rotXW, rotYW, rotZW);
    const p = project4Dto3D(v4, projDist);
    projected3D.push(p);

    const mesh = vertexMeshes[i];
    mesh.visible = true;
    mesh.position.set(p[0], p[1], p[2]);

    // Size based on w-depth (closer in 4D = bigger)
    const size = Math.max(0.3, p[3]) * 0.15;
    mesh.scale.setScalar(size);

    // Color by w-coordinate (4th dimension → hue)
    const wNorm = (v4[3] + 2) / 4; // normalize w to 0-1
    const hue = wNorm * 0.8;
    const rgb = hslToRgb(hue, 0.8, 0.3 + energy * 0.3 + wNorm * 0.2);
    mesh.material.color.setRGB(rgb[0], rgb[1], rgb[2]);
    mesh.material.opacity = 0.3 + p[3] * 0.15 + energy * 0.2;

    // Trail: record position
    if (trailIdx < MAX_TRAIL) {
      trailPos[trailIdx*3] = p[0]; trailPos[trailIdx*3+1] = p[1]; trailPos[trailIdx*3+2] = p[2];
      trailCol[trailIdx*3] = rgb[0] * 0.5; trailCol[trailIdx*3+1] = rgb[1] * 0.5; trailCol[trailIdx*3+2] = rgb[2] * 0.5;
      trailIdx++;
    }
  }
  for (let i = poly.verts.length; i < MAX_VERTS; i++) vertexMeshes[i].visible = false;

  // Fade old trail
  for (let i = trailIdx; i < MAX_TRAIL; i++) {
    trailCol[i*3] *= 0.96; trailCol[i*3+1] *= 0.96; trailCol[i*3+2] *= 0.96;
    // Drift trails outward
    trailPos[i*3]   *= 1 + dt * 0.05;
    trailPos[i*3+1] *= 1 + dt * 0.05;
    trailPos[i*3+2] *= 1 + dt * 0.05;
  }
  trailPoints.geometry.attributes.position.needsUpdate = true;
  trailPoints.geometry.attributes.color.needsUpdate = true;

  // ── Project edges ──
  for (let i = 0; i < poly.edges.length && i < MAX_EDGES; i++) {
    const [a, b] = poly.edges[i];
    const line = edgeLines[i];
    const pA = projected3D[a], pB = projected3D[b];
    if (!pA || !pB) { line.visible = false; continue; }

    line.visible = true;
    const posArr = line.geometry.attributes.position.array;
    posArr[0] = pA[0]; posArr[1] = pA[1]; posArr[2] = pA[2];
    posArr[3] = pB[0]; posArr[4] = pB[1]; posArr[5] = pB[2];
    line.geometry.attributes.position.needsUpdate = true;

    // Edge color: average w-depth of endpoints
    const avgScale = (pA[3] + pB[3]) / 2;
    const edgeHue = (avgScale - 0.5) * 0.5 + 0.5;
    const ergb = hslToRgb(edgeHue, 0.7, 0.2 + energy * 0.2);
    line.material.color.setRGB(ergb[0], ergb[1], ergb[2]);
    line.material.opacity = 0.1 + avgScale * 0.1 + energy * 0.15;
  }
  for (let i = poly.edges.length; i < MAX_EDGES; i++) edgeLines[i].visible = false;

  // ── Slice plane animation ──
  slicePlane.rotation.x = t * 0.1;
  slicePlane.rotation.y = t * 0.07;
  slicePlane.material.opacity = 0.02 + energy * 0.03;

  // ── Group slow rotation (3D, not 4D) ──
  group.rotation.y += dt * 0.04;

  KI.emit('dimensional-slicer:update', {
    polytope: poly.name,
    vertexCount: poly.verts.length,
    edgeCount: poly.edges.length,
    rotXW: rotXW.toFixed(2),
    rotYW: rotYW.toFixed(2),
    rotZW: rotZW.toFixed(2),
    projDist: projDist.toFixed(2)
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
