// deep-fractal.js — Recursive fractal geometry driven by voice
// Menger sponge (level 0-3, up to 8000 cubes), Sierpinski tetrahedron (level 0-5),
// Fractal tree (level 0-6). Voice energy controls recursion depth.

import { KI } from './core.js';

const MENGER_MAX = 3;      // 20^3 = 8000 cubes
const SIERPINSKI_MAX = 5;   // 4^5  = 1024 tetrahedra
const TREE_MAX = 6;

const state = {
  group: null,
  time: 0,
  mode: 0,              // 0=menger, 1=sierpinski, 2=tree
  effectiveDepth: 0,
  mengerLevels: [],      // pre-computed [{x,y,z,s}] per level
  sierpinskiLevels: [],  // pre-computed [{cx,cy,cz,s}] per level
  treeLevels: [],        // pre-computed [{x1,y1,z1,x2,y2,z2,depth}] per level
  mengerMesh: null,
  sierpinskiMesh: null,
  treeSegs: null,        // LineSegments
  treePositions: null,
  treeColors: null,
  maxTreeSegs: 0
};

// === MENGER SPONGE ===
// Remove sub-cubes where >= 2 coordinates are at center position
function computeMenger(level) {
  if (level === 0) return [{ x: 0, y: 0, z: 0, s: 1 }];
  const parent = computeMenger(level - 1);
  const result = [];
  for (const p of parent) {
    const cs = p.s / 3;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const zeros = (dx === 0 ? 1 : 0) + (dy === 0 ? 1 : 0) + (dz === 0 ? 1 : 0);
          if (zeros >= 2) continue; // remove cross-interior
          result.push({ x: p.x + dx * cs * 2, y: p.y + dy * cs * 2, z: p.z + dz * cs * 2, s: cs });
        }
      }
    }
  }
  return result;
}

// === SIERPINSKI TETRAHEDRON ===
// Regular tetrahedron subdivided — keep 4 corner sub-tetrahedra, remove center octahedron
function computeSierpinski(level) {
  const base = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
  function subdivide(verts, lev) {
    if (lev === 0) {
      // compute centroid and size
      const cx = (verts[0][0] + verts[1][0] + verts[2][0] + verts[3][0]) / 4;
      const cy = (verts[0][1] + verts[1][1] + verts[2][1] + verts[3][1]) / 4;
      const cz = (verts[0][2] + verts[1][2] + verts[2][2] + verts[3][2]) / 4;
      const dx = verts[1][0] - verts[0][0], dy = verts[1][1] - verts[0][1], dz = verts[1][2] - verts[0][2];
      const s = Math.sqrt(dx * dx + dy * dy + dz * dz) / 2;
      return [{ cx, cy, cz, s }];
    }
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const [a, b, c, d] = verts;
    const ab = mid(a, b), ac = mid(a, c), ad = mid(a, d);
    const bc = mid(b, c), bd = mid(b, d), cd = mid(c, d);
    return [
      ...subdivide([a, ab, ac, ad], lev - 1),
      ...subdivide([ab, b, bc, bd], lev - 1),
      ...subdivide([ac, bc, c, cd], lev - 1),
      ...subdivide([ad, bd, cd, d], lev - 1)
    ];
  }
  return subdivide(base, level);
}

// === FRACTAL TREE ===
function computeTree(maxLevel) {
  const segments = [];
  function branch(x, y, z, len, aX, aZ, depth) {
    if (depth > maxLevel) return;
    const ex = x + Math.sin(aX) * Math.cos(aZ) * len;
    const ey = y + Math.cos(aX) * len;
    const ez = z + Math.sin(aX) * Math.sin(aZ) * len;
    segments.push({ x1: x, y1: y, z1: z, x2: ex, y2: ey, z2: ez, depth });
    const shrink = 0.65;
    const spread = 0.55 + depth * 0.04;
    branch(ex, ey, ez, len * shrink, aX - spread, aZ + 0.4, depth + 1);
    branch(ex, ey, ez, len * shrink, aX + spread, aZ - 0.4, depth + 1);
    if (depth < 3) {
      branch(ex, ey, ez, len * shrink * 0.8, aX, aZ + Math.PI * 0.6, depth + 1);
    }
  }
  branch(0, -1.5, 0, 1.2, 0, 0, 0);
  return segments;
}

export function init(opts = {}) {
  const pos = opts.position || [-3, 4, -2];
  const scale = opts.scale || 1;

  state.group = new THREE.Group();
  state.group.position.set(pos[0], pos[1], pos[2]);
  state.group.scale.setScalar(scale);
  KI.scene.add(state.group);

  // Pre-compute all fractal levels
  for (let l = 0; l <= MENGER_MAX; l++) state.mengerLevels.push(computeMenger(l));
  for (let l = 0; l <= SIERPINSKI_MAX; l++) state.sierpinskiLevels.push(computeSierpinski(l));
  for (let l = 0; l <= TREE_MAX; l++) state.treeLevels.push(computeTree(l));
  state.maxTreeSegs = state.treeLevels[TREE_MAX].length;

  buildMenger();
  buildSierpinski();
  buildTree();
  setMode(0);

  KI.register('deep-fractal', { update, state, setMode, cycleMode });
  KI.emit('deep-fractal:ready');
}

function buildMenger() {
  const maxCount = state.mengerLevels[MENGER_MAX].length;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending
  });
  state.mengerMesh = new THREE.InstancedMesh(geo, mat, maxCount);
  state.mengerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  state.mengerMesh.count = 0;
  state.group.add(state.mengerMesh);
}

function buildSierpinski() {
  const maxCount = state.sierpinskiLevels[SIERPINSKI_MAX].length;
  const geo = new THREE.TetrahedronGeometry(1);
  const mat = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0.7, wireframe: true, blending: THREE.AdditiveBlending
  });
  state.sierpinskiMesh = new THREE.InstancedMesh(geo, mat, maxCount);
  state.sierpinskiMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  state.sierpinskiMesh.count = 0;
  state.group.add(state.sierpinskiMesh);
}

function buildTree() {
  // Single LineSegments geometry — pairs of vertices
  const maxVerts = state.maxTreeSegs * 2;
  state.treePositions = new Float32Array(maxVerts * 3);
  state.treeColors = new Float32Array(maxVerts * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(state.treePositions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(state.treeColors, 3));
  geo.setDrawRange(0, 0);
  state.treeSegs = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, blending: THREE.AdditiveBlending
  }));
  state.group.add(state.treeSegs);
}

export function setMode(m) {
  state.mode = m % 3;
  state.mengerMesh.visible = state.mode === 0;
  state.sierpinskiMesh.visible = state.mode === 1;
  state.treeSegs.visible = state.mode === 2;
  const names = ['Menger Sponge', 'Sierpinski Tetrahedron', 'Fractal Tree'];
  KI.emit('deep-fractal:mode', { mode: state.mode, name: names[state.mode] });
}

export function cycleMode() { setMode(state.mode + 1); }

function update(dt, t) {
  state.time = t;

  const fb = KI.get('freq-bands-12');
  const energy = fb ? Array.from({ length: 12 }, (_, i) => fb.getEnergy(i)) : new Array(12).fill(0);
  const total = energy.reduce((a, b) => a + b, 0);

  // Voice energy → recursion depth
  const maxD = state.mode === 0 ? MENGER_MAX : state.mode === 1 ? SIERPINSKI_MAX : TREE_MAX;
  state.effectiveDepth = Math.min(total * maxD * 1.5, maxD);
  const levelInt = Math.min(Math.floor(state.effectiveDepth), maxD);

  // Slow rotation
  state.group.rotation.y = t * 0.07;
  state.group.rotation.x = Math.sin(t * 0.05) * 0.12;

  if (state.mode === 0) updateMenger(t, levelInt, energy);
  else if (state.mode === 1) updateSierpinski(t, levelInt, energy);
  else updateTree(t, levelInt, energy);

  KI.emit('deep-fractal:update', { mode: state.mode, depth: state.effectiveDepth, level: levelInt });
}

function updateMenger(t, level, energy) {
  const cubes = state.mengerLevels[level];
  const count = cubes.length;
  state.mengerMesh.count = count;

  const d = new THREE.Object3D(), c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const cube = cubes[i];
    const band = i % 12;
    const pulse = 1 + energy[band] * 0.3;
    d.position.set(cube.x, cube.y, cube.z);
    d.scale.setScalar(cube.s * 0.95 * pulse);
    d.rotation.set(0, 0, 0);
    d.updateMatrix();
    state.mengerMesh.setMatrixAt(i, d.matrix);

    // Color by recursion depth (smaller cubes = deeper)
    const depth = Math.max(0, Math.round(-Math.log(cube.s) / Math.log(3)));
    const hue = (depth * 0.25 + t * 0.02) % 1;
    c.setHSL(hue, 0.8, 0.25 + energy[band] * 0.55);
    state.mengerMesh.setColorAt(i, c);
  }
  state.mengerMesh.instanceMatrix.needsUpdate = true;
  state.mengerMesh.instanceColor.needsUpdate = true;
}

function updateSierpinski(t, level, energy) {
  const tetras = state.sierpinskiLevels[level];
  const count = tetras.length;
  state.sierpinskiMesh.count = count;

  const d = new THREE.Object3D(), c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const te = tetras[i];
    const band = i % 12;
    d.position.set(te.cx, te.cy, te.cz);
    d.scale.setScalar(te.s * (1 + energy[band] * 0.2));
    d.rotation.set(0, 0, 0);
    d.updateMatrix();
    state.sierpinskiMesh.setMatrixAt(i, d.matrix);

    c.setHSL((level * 0.15 + i * 0.001 + t * 0.01) % 1, 1, 0.35 + energy[band] * 0.45);
    state.sierpinskiMesh.setColorAt(i, c);
  }
  state.sierpinskiMesh.instanceMatrix.needsUpdate = true;
  state.sierpinskiMesh.instanceColor.needsUpdate = true;
}

function updateTree(t, level, energy) {
  const segs = state.treeLevels[level];
  const count = segs.length;
  const pos = state.treePositions;
  const col = state.treeColors;
  const cc = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const seg = segs[i];
    const band = seg.depth % 12;
    const sway = energy[band] * 0.12 * (seg.depth + 1);
    const vi = i * 6;
    pos[vi] = seg.x1;
    pos[vi + 1] = seg.y1;
    pos[vi + 2] = seg.z1;
    pos[vi + 3] = seg.x2 + Math.sin(t * 1.5 + seg.depth) * sway;
    pos[vi + 4] = seg.y2;
    pos[vi + 5] = seg.z2 + Math.cos(t * 1.5 + seg.depth) * sway;

    const hue = (seg.depth * 0.12 + t * 0.01) % 1;
    const lum = 0.35 + energy[band] * 0.55;
    cc.setHSL(hue, 0.9, lum);
    col[vi] = cc.r; col[vi + 1] = cc.g; col[vi + 2] = cc.b;
    col[vi + 3] = cc.r; col[vi + 4] = cc.g; col[vi + 5] = cc.b;
  }

  state.treeSegs.geometry.setDrawRange(0, count * 2);
  state.treeSegs.geometry.attributes.position.needsUpdate = true;
  state.treeSegs.geometry.attributes.color.needsUpdate = true;
}
