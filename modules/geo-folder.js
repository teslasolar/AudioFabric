// geo-folder.js — Geometric folding visualization
// A shape that progressively morphs through dimensional complexity:
// point → line → triangle → square → pentagon → hexagon →
// cube → octahedron → dodecahedron → icosahedron → tesseract → hypercube
// Driven by freq-bands-12 energy. Each tier adds vertices, edges, and color shifts.

import { KI } from './core.js';

// Geometry definitions: vertices for each tier (3D projections of nD shapes)
const TIERS = [
  { name: 'Point',        dims: 0, verts: 1,  edges: 0,  faces: 0 },
  { name: 'Line',         dims: 1, verts: 2,  edges: 1,  faces: 0 },
  { name: 'Triangle',     dims: 2, verts: 3,  edges: 3,  faces: 1 },
  { name: 'Square',       dims: 2, verts: 4,  edges: 4,  faces: 1 },
  { name: 'Pentagon',     dims: 2, verts: 5,  edges: 5,  faces: 1 },
  { name: 'Hexagon',      dims: 2, verts: 6,  edges: 6,  faces: 1 },
  { name: 'Cube',         dims: 3, verts: 8,  edges: 12, faces: 6 },
  { name: 'Octahedron',   dims: 3, verts: 6,  edges: 12, faces: 8 },
  { name: 'Dodecahedron', dims: 3, verts: 20, edges: 30, faces: 12 },
  { name: 'Icosahedron',  dims: 3, verts: 12, edges: 30, faces: 20 },
  { name: 'Tesseract',    dims: 4, verts: 16, edges: 32, faces: 24 },
  { name: 'Hypercube',    dims: 5, verts: 32, edges: 80, faces: 80 }
];

// Pre-computed vertex positions for each geometry tier
function getVertices(tier, scale) {
  const s = scale || 1;
  switch (tier) {
    case 0: return [[0, 0, 0]]; // point
    case 1: return [[-s, 0, 0], [s, 0, 0]]; // line
    case 2: { // triangle
      const a = [];
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
        a.push([Math.cos(angle) * s, Math.sin(angle) * s, 0]);
      }
      return a;
    }
    case 3: { // square
      return [[-s, -s, 0], [s, -s, 0], [s, s, 0], [-s, s, 0]];
    }
    case 4: { // pentagon
      const a = [];
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
        a.push([Math.cos(angle) * s, Math.sin(angle) * s, 0]);
      }
      return a;
    }
    case 5: { // hexagon
      const a = [];
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        a.push([Math.cos(angle) * s, Math.sin(angle) * s, 0]);
      }
      return a;
    }
    case 6: { // cube
      const v = [];
      for (let i = 0; i < 8; i++) {
        v.push([
          (i & 1 ? s : -s) * 0.7,
          (i & 2 ? s : -s) * 0.7,
          (i & 4 ? s : -s) * 0.7
        ]);
      }
      return v;
    }
    case 7: { // octahedron
      return [[s,0,0],[-s,0,0],[0,s,0],[0,-s,0],[0,0,s],[0,0,-s]];
    }
    case 8: { // dodecahedron (simplified)
      const phi = (1 + Math.sqrt(5)) / 2;
      const a = s * 0.6;
      const v = [];
      for (let i = -1; i <= 1; i += 2)
        for (let j = -1; j <= 1; j += 2)
          for (let k = -1; k <= 1; k += 2)
            v.push([i * a, j * a, k * a]);
      for (let i = -1; i <= 1; i += 2)
        for (let j = -1; j <= 1; j += 2) {
          v.push([0, i * a / phi, j * a * phi]);
          v.push([i * a / phi, j * a * phi, 0]);
          v.push([i * a * phi, 0, j * a / phi]);
        }
      return v;
    }
    case 9: { // icosahedron
      const phi = (1 + Math.sqrt(5)) / 2;
      const a = s * 0.65;
      const v = [];
      for (let i = -1; i <= 1; i += 2)
        for (let j = -1; j <= 1; j += 2) {
          v.push([0, i * a, j * a * phi]);
          v.push([i * a, j * a * phi, 0]);
          v.push([i * a * phi, 0, j * a]);
        }
      return v;
    }
    case 10: { // tesseract (4D → 3D projection)
      const v = [];
      for (let i = 0; i < 16; i++) {
        const w = (i & 8 ? 1 : -1);
        const proj = 1 / (2 - w * 0.3); // perspective divide from 4D
        v.push([
          (i & 1 ? s : -s) * 0.6 * proj,
          (i & 2 ? s : -s) * 0.6 * proj,
          (i & 4 ? s : -s) * 0.6 * proj
        ]);
      }
      return v;
    }
    case 11: { // hypercube (5D → 3D projection)
      const v = [];
      for (let i = 0; i < 32; i++) {
        const w = (i & 8 ? 1 : -1);
        const u = (i & 16 ? 1 : -1);
        const proj = 1 / (3 - w * 0.3 - u * 0.2);
        v.push([
          (i & 1 ? s : -s) * 0.5 * proj,
          (i & 2 ? s : -s) * 0.5 * proj,
          (i & 4 ? s : -s) * 0.5 * proj
        ]);
      }
      return v;
    }
    default: return [[0, 0, 0]];
  }
}

// Get edge pairs for a tier
function getEdges(tier) {
  switch (tier) {
    case 0: return [];
    case 1: return [[0, 1]];
    case 2: return [[0,1],[1,2],[2,0]];
    case 3: return [[0,1],[1,2],[2,3],[3,0]];
    case 4: return [[0,1],[1,2],[2,3],[3,4],[4,0]];
    case 5: return [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]];
    case 6: return [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]]; // cube
    case 7: return [[0,2],[0,3],[0,4],[0,5],[1,2],[1,3],[1,4],[1,5],[2,4],[2,5],[3,4],[3,5]]; // octahedron
    case 8: { // dodecahedron — connect nearby vertices
      const v = getVertices(8, 1);
      const e = [];
      for (let i = 0; i < v.length; i++)
        for (let j = i + 1; j < v.length; j++) {
          const d = Math.sqrt((v[i][0]-v[j][0])**2 + (v[i][1]-v[j][1])**2 + (v[i][2]-v[j][2])**2);
          if (d < 0.85) e.push([i, j]);
        }
      return e;
    }
    case 9: { // icosahedron
      const v = getVertices(9, 1);
      const e = [];
      for (let i = 0; i < v.length; i++)
        for (let j = i + 1; j < v.length; j++) {
          const d = Math.sqrt((v[i][0]-v[j][0])**2 + (v[i][1]-v[j][1])**2 + (v[i][2]-v[j][2])**2);
          if (d < 1.05) e.push([i, j]);
        }
      return e;
    }
    case 10: { // tesseract — connect vertices differing by 1 bit
      const e = [];
      for (let i = 0; i < 16; i++)
        for (let b = 0; b < 4; b++) {
          const j = i ^ (1 << b);
          if (j > i) e.push([i, j]);
        }
      return e;
    }
    case 11: { // hypercube — connect vertices differing by 1 bit
      const e = [];
      for (let i = 0; i < 32; i++)
        for (let b = 0; b < 5; b++) {
          const j = i ^ (1 << b);
          if (j > i) e.push([i, j]);
        }
      return e;
    }
    default: return [];
  }
}

// State
const geoState = {
  currentTier: 0,
  targetTier: 0,
  morphProgress: 0,      // 0-1 between current and target shape
  rotAngle: [0, 0, 0, 0], // rotation angles for 4D
  pulsePhase: 0,
  vertices: [],            // interpolated vertices
  edges: [],
  scale: 1.5,
  glow: 0,
  innerGlow: 0
};

let group = null;
let edgeMeshes = [];
let vertexPoints = null;
let glowSphere = null;
let innerSphere = null;
const MAX_EDGES = 80;     // hypercube has 80 edges
const MAX_VERTS = 32;     // hypercube has 32 verts

// === SUB-LAYER CONSTANTS ===
const PRIME_ORB_N = 100;
const SL_RING_COUNT = 6;
const SL_RING_CUBES = 8;
const WAVE_WRAP_N = 3;
const WAVE_WRAP_PTS = 150;
const BURST_N = 100;
const BAND_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37];

// Sub-layer state
let primeOrbit = null, primeOrbitPos = null, primeOrbitCol = null, primeSet = null;
let wormholeRings = null;
let waveWraps = [], waveWrapPos = [], waveWrapCol = [];
let burstLayer = null, burstPos = null, burstCol = null, burstDir = null;
let slBurstForce = 0;
let slTimeData = null;

// === NEW SUB-LAYERS ===
const TENDRIL_COUNT = 12;       // one per freq band, from vertices
const TENDRIL_SEGMENTS = 40;
const SHELL_SUBDIVISIONS = 2;   // icosahedron detail
const WEB_POINTS = 80;          // constellation points
const WEB_MAX_LINES = 120;      // constellation connections
const STREAM_COUNT = 200;       // flowing particles
const AURA_RING_COUNT = 5;      // ring planes
const ECHO_COUNT = 6;           // fractal echo copies

let tendrils = [], tendrilPos = [], tendrilCol = [];
let harmonicShell = null, shellBasePos = null;
let webPoints = null, webPos = null, webCol = null;
let webLines = null, webLinePos = null, webLineCol = null;
let streams = null, streamPos = null, streamCol = null, streamVel = null;
let auraRings = [];
let fractalEchoes = [];

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 3, -2];
  geoState.scale = opts.scale || 1.5;

  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  group.userData.baseY = pos[1];
  scene.add(group);

  // create edge line pool
  for (let i = 0; i < MAX_EDGES; i++) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(6); // 2 vertices * 3
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, linewidth: 2
    });
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    group.add(line);
    edgeMeshes.push(line);
  }

  // vertex point cloud
  const vGeo = new THREE.BufferGeometry();
  const vPos = new Float32Array(MAX_VERTS * 3);
  const vCol = new Float32Array(MAX_VERTS * 3);
  vGeo.setAttribute('position', new THREE.BufferAttribute(vPos, 3));
  vGeo.setAttribute('color', new THREE.BufferAttribute(vCol, 3));
  vertexPoints = new THREE.Points(vGeo, new THREE.PointsMaterial({
    size: 0.12, vertexColors: true, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(vertexPoints);

  // glow sphere (outer aura of the shape)
  const glowGeo = new THREE.SphereGeometry(2, 24, 24);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x4488ff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  glowSphere = new THREE.Mesh(glowGeo, glowMat);
  group.add(glowSphere);

  // inner glow sphere
  const innerGeo = new THREE.SphereGeometry(0.5, 16, 16);
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  innerSphere = new THREE.Mesh(innerGeo, innerMat);
  group.add(innerSphere);

  buildSubLayers();

  KI.register('geo-folder', {
    update, state: geoState, TIERS,
    getCurrentTier, getVertices: () => geoState.vertices, group
  });

  KI.emit('geo-folder:ready');
}

function update(dt, t) {
  const fb = KI.get('freq-bands-12');
  const fbState = fb?.state;

  // determine target tier from frequency analysis
  if (fbState) {
    geoState.targetTier = Math.round(Math.min(11, Math.max(0, fbState.geoLevel)));
  }

  // morph toward target tier
  if (geoState.currentTier !== geoState.targetTier) {
    geoState.morphProgress += dt * 1.2; // morph speed
    if (geoState.morphProgress >= 1) {
      geoState.currentTier = geoState.targetTier;
      geoState.morphProgress = 0;
      KI.emit('geo-folder:tier-change', { tier: geoState.currentTier, name: TIERS[geoState.currentTier].name });
    }
  }

  // 4D rotation angles
  geoState.rotAngle[0] += dt * 0.5;  // XY
  geoState.rotAngle[1] += dt * 0.3;  // XZ
  geoState.rotAngle[2] += dt * 0.2;  // YZ
  geoState.rotAngle[3] += dt * 0.15; // XW (for 4D+)

  geoState.pulsePhase += dt * 2;

  // voice-reactive pulse
  const energy = fbState ? fbState.totalEnergy : 0;
  const pulseScale = 1 + Math.sin(geoState.pulsePhase) * 0.08 * (1 + energy * 2);
  const baseScale = geoState.scale * pulseScale;

  // compute current vertices
  const tier = geoState.currentTier;
  const nextTier = geoState.targetTier;
  const rawVerts = getVertices(tier, baseScale);
  const nextVerts = getVertices(nextTier, baseScale);
  const edges = getEdges(tier);
  const nextEdges = getEdges(nextTier);
  const mp = geoState.morphProgress;

  // interpolate vertices: pad shorter array with center
  const maxV = Math.max(rawVerts.length, nextVerts.length);
  geoState.vertices = [];
  for (let i = 0; i < maxV; i++) {
    const a = rawVerts[i % rawVerts.length];
    const b = nextVerts[i % nextVerts.length];
    if (mp > 0 && tier !== nextTier) {
      geoState.vertices.push([
        a[0] + (b[0] - a[0]) * mp,
        a[1] + (b[1] - a[1]) * mp,
        a[2] + (b[2] - a[2]) * mp
      ]);
    } else {
      geoState.vertices.push([...a]);
    }
  }

  // apply 3D rotation
  const cos0 = Math.cos(geoState.rotAngle[0]), sin0 = Math.sin(geoState.rotAngle[0]);
  const cos1 = Math.cos(geoState.rotAngle[1]), sin1 = Math.sin(geoState.rotAngle[1]);
  const cos2 = Math.cos(geoState.rotAngle[2]), sin2 = Math.sin(geoState.rotAngle[2]);

  for (let i = 0; i < geoState.vertices.length; i++) {
    let [x, y, z] = geoState.vertices[i];
    // rotate XY
    let nx = x * cos0 - y * sin0, ny = x * sin0 + y * cos0;
    x = nx; y = ny;
    // rotate XZ
    nx = x * cos1 - z * sin1;
    let nz = x * sin1 + z * cos1;
    x = nx; z = nz;
    // rotate YZ
    ny = y * cos2 - z * sin2;
    nz = y * sin2 + z * cos2;
    y = ny; z = nz;
    geoState.vertices[i] = [x, y, z];
  }

  // get color from freq bands
  const colorR = fbState ? fbState.colorBlend[0] : 0.3;
  const colorG = fbState ? fbState.colorBlend[1] : 0.5;
  const colorB = fbState ? fbState.colorBlend[2] : 1.0;
  const tierColor = tier >= 0 && tier < 12 ? BANDS_COLORS[tier] : [0.3, 0.5, 1.0];

  // update vertex points
  const vPos = vertexPoints.geometry.attributes.position.array;
  const vCol = vertexPoints.geometry.attributes.color.array;
  for (let i = 0; i < MAX_VERTS; i++) {
    if (i < geoState.vertices.length) {
      vPos[i*3]   = geoState.vertices[i][0];
      vPos[i*3+1] = geoState.vertices[i][1];
      vPos[i*3+2] = geoState.vertices[i][2];
      // color cycles through spectrum based on vertex index + time
      const hue = (i / geoState.vertices.length + t * 0.1) % 1;
      const rgb = KI.hslToRgb(hue, 0.9, 0.5 + energy * 0.3);
      vCol[i*3]   = rgb[0];
      vCol[i*3+1] = rgb[1];
      vCol[i*3+2] = rgb[2];
    } else {
      vPos[i*3] = vPos[i*3+1] = vPos[i*3+2] = 0;
      vCol[i*3] = vCol[i*3+1] = vCol[i*3+2] = 0;
    }
  }
  vertexPoints.geometry.attributes.position.needsUpdate = true;
  vertexPoints.geometry.attributes.color.needsUpdate = true;
  vertexPoints.geometry.setDrawRange(0, geoState.vertices.length);
  vertexPoints.material.size = 0.08 + energy * 0.15 + (tier > 8 ? 0.05 : 0);

  // update edges
  const currentEdges = (mp > 0 && tier !== nextTier)
    ? blendEdges(edges, nextEdges, mp, rawVerts.length, nextVerts.length)
    : edges;

  for (let i = 0; i < MAX_EDGES; i++) {
    const line = edgeMeshes[i];
    if (i < currentEdges.length) {
      const [a, b] = currentEdges[i];
      const va = geoState.vertices[a % geoState.vertices.length];
      const vb = geoState.vertices[b % geoState.vertices.length];
      const pos = line.geometry.attributes.position.array;
      pos[0] = va[0]; pos[1] = va[1]; pos[2] = va[2];
      pos[3] = vb[0]; pos[4] = vb[1]; pos[5] = vb[2];
      line.geometry.attributes.position.needsUpdate = true;

      // color edges based on tier + energy
      const hue = (tier / 12 + t * 0.05 + i * 0.02) % 1;
      const rgb = KI.hslToRgb(hue, 0.8, 0.4 + energy * 0.4);
      line.material.color.setRGB(rgb[0], rgb[1], rgb[2]);
      line.material.opacity = 0.3 + energy * 0.5 + (mp > 0 ? 0.2 : 0);
      line.visible = true;
    } else {
      line.visible = false;
    }
  }

  // glow sphere
  const glowScale = 0.8 + tier * 0.15 + energy * 0.5;
  glowSphere.scale.setScalar(glowScale);
  glowSphere.material.opacity = 0.02 + energy * 0.08;
  glowSphere.material.color.setRGB(
    Math.min(1, colorR * 0.5 + tierColor[0] * 0.5),
    Math.min(1, colorG * 0.5 + tierColor[1] * 0.5),
    Math.min(1, colorB * 0.5 + tierColor[2] * 0.5)
  );

  // inner core
  const innerScale = 0.2 + energy * 0.3 + Math.sin(t * 3) * 0.05;
  innerSphere.scale.setScalar(innerScale);
  innerSphere.material.opacity = 0.1 + energy * 0.4;
  innerSphere.material.color.setRGB(
    Math.min(1, colorR + 0.3),
    Math.min(1, colorG + 0.3),
    Math.min(1, colorB + 0.3)
  );

  // whole group subtle bob
  const baseY = group.userData.baseY || 3;
  group.position.y = baseY + Math.sin(t * 0.7) * 0.15 + energy * 0.3;

  // Sub-layer updates — driven by band energy + tier
  const bandEnergy = fbState
    ? Array.from({ length: 12 }, (_, i) => fb.getEnergy(i))
    : new Array(12).fill(0);
  updateSubLayers(t, bandEnergy, energy);
}

// helper: blend edge sets during morph
function blendEdges(e1, e2, progress, v1count, v2count) {
  if (progress < 0.5) return e1;
  return e2;
}

// Tier colors (RGB 0-1) matching the BANDS
const BANDS_COLORS = [
  [0.13, 0.0, 0.27],  // sub-rumble
  [0.4, 0.0, 0.8],    // deep-bass
  [1.0, 0.13, 0.27],  // bass
  [1.0, 0.4, 0.0],    // low-mid
  [1.0, 0.67, 0.0],   // mid
  [1.0, 0.87, 0.0],   // upper-mid
  [0.27, 1.0, 0.27],  // presence
  [0.0, 0.87, 0.67],  // brilliance
  [0.0, 0.53, 1.0],   // high
  [0.27, 0.27, 1.0],  // ultra-high
  [0.67, 0.27, 1.0],  // air
  [1.0, 0.27, 1.0]    // shimmer
];

export function getCurrentTier() {
  return {
    index: geoState.currentTier,
    tier: TIERS[geoState.currentTier],
    morphProgress: geoState.morphProgress,
    targetIndex: geoState.targetTier
  };
}

// ================================================================
// === SUB-LAYERS — Prime Orbits, Wormhole Rings, Wave Wraps, Burst
// ================================================================

function isPrime(n) {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6)
    if (n % i === 0 || n % (i + 2) === 0) return false;
  return true;
}

function getBoundingRadius() {
  const verts = geoState.vertices;
  if (!verts || verts.length === 0) return 1;
  let maxR = 0;
  for (const v of verts) {
    const r = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (r > maxR) maxR = r;
  }
  return Math.max(0.3, maxR);
}

function buildSubLayers() {
  // --- Prime sieve ---
  primeSet = new Set();
  for (let i = 2; i <= PRIME_ORB_N; i++) if (isPrime(i)) primeSet.add(i);

  // --- 1. Prime Orbit Points (Sacks spiral on sphere surface) ---
  const poGeo = new THREE.BufferGeometry();
  primeOrbitPos = new Float32Array(PRIME_ORB_N * 3);
  primeOrbitCol = new Float32Array(PRIME_ORB_N * 3);
  poGeo.setAttribute('position', new THREE.BufferAttribute(primeOrbitPos, 3));
  poGeo.setAttribute('color', new THREE.BufferAttribute(primeOrbitCol, 3));
  primeOrbit = new THREE.Points(poGeo, new THREE.PointsMaterial({
    size: 0.06, vertexColors: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(primeOrbit);

  // --- 2. Wormhole Rings (InstancedMesh cubes in orbital rings) ---
  const cubeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
  const cubeMat = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const totalCubes = SL_RING_COUNT * SL_RING_CUBES;
  wormholeRings = new THREE.InstancedMesh(cubeGeo, cubeMat, totalCubes);
  wormholeRings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  wormholeRings.count = totalCubes;
  // init hidden
  const d = new THREE.Object3D();
  d.scale.setScalar(0.001);
  d.updateMatrix();
  for (let i = 0; i < totalCubes; i++) wormholeRings.setMatrixAt(i, d.matrix);
  wormholeRings.instanceMatrix.needsUpdate = true;
  group.add(wormholeRings);

  // --- 3. Wave Wraps (3 rainbow lines spiraling around shape) ---
  for (let w = 0; w < WAVE_WRAP_N; w++) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(WAVE_WRAP_PTS * 3);
    const col = new Float32Array(WAVE_WRAP_PTS * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, linewidth: 1.5
    }));
    group.add(line);
    waveWraps.push(line);
    waveWrapPos.push(pos);
    waveWrapCol.push(col);
  }

  // --- 4. Burst Particles (sphere surface, energy spikes push outward) ---
  const bGeo = new THREE.BufferGeometry();
  burstPos = new Float32Array(BURST_N * 3);
  burstCol = new Float32Array(BURST_N * 3);
  burstDir = new Float32Array(BURST_N * 3); // pre-computed outward directions
  bGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3));
  bGeo.setAttribute('color', new THREE.BufferAttribute(burstCol, 3));
  // distribute on sphere via golden angle
  for (let i = 0; i < BURST_N; i++) {
    const y = 1 - (i / (BURST_N - 1)) * 2;
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = i * 2.399963; // golden angle
    burstDir[i * 3]     = Math.cos(theta) * radiusAtY;
    burstDir[i * 3 + 1] = y;
    burstDir[i * 3 + 2] = Math.sin(theta) * radiusAtY;
  }
  burstLayer = new THREE.Points(bGeo, new THREE.PointsMaterial({
    size: 0.05, vertexColors: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(burstLayer);

  // time-domain buffer for waveform displacement
  slTimeData = new Float32Array(256);

  // --- 5. Energy Tendrils (lines from vertices outward, voice-reactive) ---
  for (let i = 0; i < TENDRIL_COUNT; i++) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(TENDRIL_SEGMENTS * 3);
    const col = new Float32Array(TENDRIL_SEGMENTS * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending
    }));
    group.add(line);
    tendrils.push(line);
    tendrilPos.push(pos);
    tendrilCol.push(col);
  }

  // --- 6. Harmonic Shell (outer wireframe icosahedron) ---
  const shellGeo = new THREE.IcosahedronGeometry(2, SHELL_SUBDIVISIONS);
  shellBasePos = shellGeo.attributes.position.array.slice(); // save base positions
  harmonicShell = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({
    color: 0x8844ff, wireframe: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(harmonicShell);

  // --- 7. Constellation Web (points + connecting lines) ---
  const cwGeo = new THREE.BufferGeometry();
  webPos = new Float32Array(WEB_POINTS * 3);
  webCol = new Float32Array(WEB_POINTS * 3);
  // Distribute on sphere via Fibonacci lattice
  for (let i = 0; i < WEB_POINTS; i++) {
    const y = 1 - (i / (WEB_POINTS - 1)) * 2;
    const rAtY = Math.sqrt(1 - y * y);
    const theta = i * 2.399963;
    webPos[i*3] = Math.cos(theta) * rAtY * 3;
    webPos[i*3+1] = y * 3;
    webPos[i*3+2] = Math.sin(theta) * rAtY * 3;
  }
  cwGeo.setAttribute('position', new THREE.BufferAttribute(webPos, 3));
  cwGeo.setAttribute('color', new THREE.BufferAttribute(webCol, 3));
  webPoints = new THREE.Points(cwGeo, new THREE.PointsMaterial({
    size: 0.05, vertexColors: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(webPoints);

  // Web connecting lines
  const wlGeo = new THREE.BufferGeometry();
  webLinePos = new Float32Array(WEB_MAX_LINES * 2 * 3);
  webLineCol = new Float32Array(WEB_MAX_LINES * 2 * 3);
  wlGeo.setAttribute('position', new THREE.BufferAttribute(webLinePos, 3));
  wlGeo.setAttribute('color', new THREE.BufferAttribute(webLineCol, 3));
  webLines = new THREE.LineSegments(wlGeo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending
  }));
  group.add(webLines);

  // --- 8. Particle Streams (flowing outward from center) ---
  const psGeo = new THREE.BufferGeometry();
  streamPos = new Float32Array(STREAM_COUNT * 3);
  streamCol = new Float32Array(STREAM_COUNT * 3);
  streamVel = new Float32Array(STREAM_COUNT * 4); // vx,vy,vz,life
  for (let i = 0; i < STREAM_COUNT; i++) {
    resetStreamParticle(i);
  }
  psGeo.setAttribute('position', new THREE.BufferAttribute(streamPos, 3));
  psGeo.setAttribute('color', new THREE.BufferAttribute(streamCol, 3));
  streams = new THREE.Points(psGeo, new THREE.PointsMaterial({
    size: 0.04, vertexColors: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(streams);

  // --- 9. Aura Planes (rotating ring planes at different angles) ---
  for (let i = 0; i < AURA_RING_COUNT; i++) {
    const inner = 2.5 + i * 0.4;
    const outer = inner + 0.08;
    const geo = new THREE.RingGeometry(inner, outer, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    // Tilt each ring differently
    mesh.rotation.x = (i / AURA_RING_COUNT) * Math.PI;
    mesh.rotation.z = i * 0.6;
    group.add(mesh);
    auraRings.push(mesh);
  }

  // --- 10. Fractal Echoes (mini copies orbiting) ---
  for (let i = 0; i < ECHO_COUNT; i++) {
    const eGeo = new THREE.BufferGeometry();
    const ePos = new Float32Array(MAX_VERTS * 3);
    const eCol = new Float32Array(MAX_VERTS * 3);
    eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
    eGeo.setAttribute('color', new THREE.BufferAttribute(eCol, 3));
    const ePts = new THREE.Points(eGeo, new THREE.PointsMaterial({
      size: 0.06, vertexColors: true, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    group.add(ePts);
    // Edge lines for echo
    const elGeo = new THREE.BufferGeometry();
    const elPos = new Float32Array(MAX_EDGES * 6);
    const elCol = new Float32Array(MAX_EDGES * 6);
    elGeo.setAttribute('position', new THREE.BufferAttribute(elPos, 3));
    elGeo.setAttribute('color', new THREE.BufferAttribute(elCol, 3));
    const eLines = new THREE.LineSegments(elGeo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending
    }));
    group.add(eLines);
    fractalEchoes.push({
      points: ePts, lines: eLines,
      pointPos: ePos, pointCol: eCol,
      linePos: elPos, lineCol: elCol,
      angle: (i / ECHO_COUNT) * Math.PI * 2,
      tilt: Math.random() * Math.PI,
      speed: 0.2 + Math.random() * 0.3,
      scale: 0.2 + Math.random() * 0.15,
      orbitR: 3.5 + i * 0.6
    });
  }
}

function resetStreamParticle(i) {
  // Random direction on sphere
  const y = (Math.random() - 0.5) * 2;
  const rAtY = Math.sqrt(1 - y * y);
  const theta = Math.random() * Math.PI * 2;
  const speed = 0.5 + Math.random() * 1.5;
  streamVel[i*4] = Math.cos(theta) * rAtY * speed;
  streamVel[i*4+1] = y * speed;
  streamVel[i*4+2] = Math.sin(theta) * rAtY * speed;
  streamVel[i*4+3] = Math.random() * 3; // life
  streamPos[i*3] = streamPos[i*3+1] = streamPos[i*3+2] = 0;
}

// === Master sub-layer updater ===
function updateSubLayers(t, bandEnergy, totalEnergy) {
  const tier = geoState.currentTier;
  const R = getBoundingRadius();

  updatePrimeOrbit(t, bandEnergy, totalEnergy, tier, R);
  updateWormholeRings(t, bandEnergy, totalEnergy, tier, R);
  updateWaveWraps(t, bandEnergy, totalEnergy, tier, R);
  updateBurstLayer(t, bandEnergy, totalEnergy, tier, R);
  updateTendrils(t, bandEnergy, totalEnergy, tier, R);
  updateHarmonicShell(t, bandEnergy, totalEnergy, tier, R);
  updateConstellationWeb(t, bandEnergy, totalEnergy, tier, R);
  updateStreams(t, bandEnergy, totalEnergy, tier, R);
  updateAuraRings(t, bandEnergy, totalEnergy, tier, R);
  updateFractalEchoes(t, bandEnergy, totalEnergy, tier, R);
}

// --- 1. PRIME ORBITS ---
function updatePrimeOrbit(t, bandEnergy, totalEnergy, tier, R) {
  const fade = Math.min(1, Math.max(0, (tier - 1.5) * 0.5)); // visible tier >= 2
  primeOrbit.material.opacity = fade * (0.4 + totalEnergy * 0.5);
  if (fade < 0.01) return;

  const orbR = R * 1.3;
  const pos = primeOrbitPos, col = primeOrbitCol;

  for (let i = 0; i < PRIME_ORB_N; i++) {
    const n = i + 1;
    // Sacks spiral mapped onto sphere
    const sqrtN = Math.sqrt(n);
    const angle = sqrtN * Math.PI * 2;
    const phi = (sqrtN / Math.sqrt(PRIME_ORB_N)) * Math.PI; // latitude
    const theta = angle + t * 0.3;

    const sinPhi = Math.sin(phi), cosPhi = Math.cos(phi);
    pos[i * 3]     = Math.cos(theta) * sinPhi * orbR;
    pos[i * 3 + 1] = cosPhi * orbR;
    pos[i * 3 + 2] = Math.sin(theta) * sinPhi * orbR;

    // Primes glow with their band energy, composites dim
    const isPr = primeSet.has(n);
    const bIdx = n % 12;
    const glow = isPr ? 0.5 + bandEnergy[bIdx] * 1.5 : 0.15;
    const hue = (bIdx / 12 + t * 0.02) % 1;
    const rgb = KI.hslToRgb(hue, isPr ? 0.9 : 0.3, Math.min(1, glow));
    col[i * 3]     = rgb[0];
    col[i * 3 + 1] = rgb[1];
    col[i * 3 + 2] = rgb[2];
  }

  primeOrbit.geometry.attributes.position.needsUpdate = true;
  primeOrbit.geometry.attributes.color.needsUpdate = true;
  primeOrbit.material.size = 0.04 + totalEnergy * 0.08 + (tier > 6 ? 0.03 : 0);
}

// --- 2. WORMHOLE RINGS ---
function updateWormholeRings(t, bandEnergy, totalEnergy, tier, R) {
  const fade = Math.min(1, Math.max(0, (tier - 4.5) * 0.4)); // visible tier >= 5
  wormholeRings.material.opacity = fade * (0.3 + totalEnergy * 0.6);
  if (fade < 0.01) { wormholeRings.visible = false; return; }
  wormholeRings.visible = true;

  const ringR = R * 1.5;
  const d = new THREE.Object3D();
  const c = new THREE.Color();
  let idx = 0;

  for (let r = 0; r < SL_RING_COUNT; r++) {
    // Each ring tilted at different angles
    const tiltX = (r / SL_RING_COUNT) * Math.PI + Math.sin(t * 0.2 + r) * 0.1;
    const tiltZ = r * 0.5 + Math.cos(t * 0.15 + r * 2) * 0.1;
    const ringSpeed = 0.5 + r * 0.15 + totalEnergy * 0.8;
    const rScale = ringR * (0.8 + r * 0.15);

    for (let i = 0; i < SL_RING_CUBES; i++) {
      const angle = (i / SL_RING_CUBES) * Math.PI * 2 + t * ringSpeed;
      // Position on ring
      let px = Math.cos(angle) * rScale;
      let py = Math.sin(angle) * rScale;
      let pz = 0;
      // Apply ring tilt
      const cosX = Math.cos(tiltX), sinX = Math.sin(tiltX);
      const cosZ = Math.cos(tiltZ), sinZ = Math.sin(tiltZ);
      const y1 = py * cosX - pz * sinX, z1 = py * sinX + pz * cosX;
      py = y1; pz = z1;
      const x2 = px * cosZ - py * sinZ, y2 = px * sinZ + py * cosZ;
      px = x2; py = y2;

      d.position.set(px, py, pz);
      const cubeScale = (0.6 + bandEnergy[r % 12] * 2) * fade;
      d.scale.setScalar(cubeScale);
      d.rotation.set(t * 0.5 + r, t * 0.3 + i, t * 0.2);
      d.updateMatrix();
      wormholeRings.setMatrixAt(idx, d.matrix);

      // Color: cosmic purple → cyan gradient with band glow
      const hue = (0.75 + r * 0.04 + bandEnergy[(r + i) % 12] * 0.1) % 1;
      c.setHSL(hue, 0.8, 0.3 + bandEnergy[(r + i) % 12] * 0.5);
      wormholeRings.setColorAt(idx, c);
      idx++;
    }
  }

  wormholeRings.instanceMatrix.needsUpdate = true;
  if (wormholeRings.instanceColor) wormholeRings.instanceColor.needsUpdate = true;
}

// --- 3. WAVE WRAPS ---
function updateWaveWraps(t, bandEnergy, totalEnergy, tier, R) {
  const fade = Math.min(1, Math.max(0, (tier - 2.5) * 0.5)); // visible tier >= 3
  if (fade < 0.01) {
    for (const w of waveWraps) w.material.opacity = 0;
    return;
  }

  // Get time-domain data for waveform displacement
  const ve = KI.get('voice-engine');
  if (ve && ve.analyser) {
    ve.analyser.getFloatTimeDomainData(slTimeData);
  }

  const wrapR = R * 1.1;

  for (let w = 0; w < WAVE_WRAP_N; w++) {
    waveWraps[w].material.opacity = fade * (0.3 + totalEnergy * 0.5);
    const pos = waveWrapPos[w];
    const col = waveWrapCol[w];
    const phaseOffset = (w / WAVE_WRAP_N) * Math.PI * 2;

    for (let i = 0; i < WAVE_WRAP_PTS; i++) {
      const frac = i / (WAVE_WRAP_PTS - 1);
      // Latitude: pole to pole
      const phi = frac * Math.PI;
      // Longitude: 3 full spirals + rotation
      const theta = frac * Math.PI * 6 + phaseOffset + t * 0.4;

      // Audio waveform displacement
      const sampleIdx = Math.floor(frac * (slTimeData.length - 1));
      const waveDisp = slTimeData[sampleIdx] * 0.3 * totalEnergy;
      const r = wrapR + waveDisp;

      const sinPhi = Math.sin(phi);
      pos[i * 3]     = Math.cos(theta) * sinPhi * r;
      pos[i * 3 + 1] = Math.cos(phi) * r;
      pos[i * 3 + 2] = Math.sin(theta) * sinPhi * r;

      // Rainbow color based on position + time
      const hue = (frac + w * 0.33 + t * 0.05) % 1;
      const lum = 0.35 + bandEnergy[Math.floor(frac * 11.99)] * 0.5;
      const rgb = KI.hslToRgb(hue, 0.95, Math.min(1, lum));
      col[i * 3]     = rgb[0];
      col[i * 3 + 1] = rgb[1];
      col[i * 3 + 2] = rgb[2];
    }

    waveWraps[w].geometry.attributes.position.needsUpdate = true;
    waveWraps[w].geometry.attributes.color.needsUpdate = true;
  }
}

// --- 4. BURST PARTICLES ---
function updateBurstLayer(t, bandEnergy, totalEnergy, tier, R) {
  const tierFade = Math.min(1, tier / 4); // scales with tier/4
  burstLayer.material.opacity = tierFade * (0.3 + totalEnergy * 0.6);
  if (tierFade < 0.01) return;

  // Energy spike detection → burst force
  if (totalEnergy > 0.6) slBurstForce = Math.max(slBurstForce, totalEnergy * 1.5);
  slBurstForce *= 0.96; // decay

  const baseR = R * 1.05;
  const burstR = baseR + slBurstForce * R * 0.8;
  const pos = burstPos, col = burstCol;

  for (let i = 0; i < BURST_N; i++) {
    const dx = burstDir[i * 3], dy = burstDir[i * 3 + 1], dz = burstDir[i * 3 + 2];
    // Breathing + burst
    const breath = 1 + Math.sin(t * 2 + i * 0.5) * 0.08;
    const r = burstR * breath;
    pos[i * 3]     = dx * r;
    pos[i * 3 + 1] = dy * r;
    pos[i * 3 + 2] = dz * r;

    // Color: warm glow, primes in their band color
    const bIdx = i % 12;
    const isPr = primeSet.has(i + 1);
    const hue = isPr ? (bIdx / 12) : (0.05 + t * 0.02) % 1;
    const sat = isPr ? 0.9 : 0.6;
    const lum = 0.3 + bandEnergy[bIdx] * 0.5 + slBurstForce * 0.2;
    const rgb = KI.hslToRgb(hue, sat, Math.min(1, lum));
    col[i * 3]     = rgb[0];
    col[i * 3 + 1] = rgb[1];
    col[i * 3 + 2] = rgb[2];
  }

  burstLayer.geometry.attributes.position.needsUpdate = true;
  burstLayer.geometry.attributes.color.needsUpdate = true;
  burstLayer.material.size = 0.04 + slBurstForce * 0.08 + totalEnergy * 0.04;
}

// --- 5. ENERGY TENDRILS ---
function updateTendrils(t, bandEnergy, totalEnergy, tier, R) {
  const fade = Math.min(1, Math.max(0, (tier - 2.5) * 0.4));
  if (fade < 0.01) {
    for (const td of tendrils) td.material.opacity = 0;
    return;
  }

  const verts = geoState.vertices;
  const vCount = verts.length;

  for (let i = 0; i < TENDRIL_COUNT; i++) {
    tendrils[i].material.opacity = fade * (0.25 + bandEnergy[i] * 0.6);
    const pos = tendrilPos[i];
    const col = tendrilCol[i];

    // Start from a vertex of the shape
    const vi = i % vCount;
    const vx = verts[vi][0], vy = verts[vi][1], vz = verts[vi][2];
    // Direction outward from center
    const len = Math.sqrt(vx*vx + vy*vy + vz*vz) || 0.1;
    const dx = vx/len, dy = vy/len, dz = vz/len;

    // Tendril length driven by band energy
    const tendrilLen = R * (0.5 + bandEnergy[i] * 3 + totalEnergy);

    for (let s = 0; s < TENDRIL_SEGMENTS; s++) {
      const frac = s / (TENDRIL_SEGMENTS - 1);
      const dist = frac * tendrilLen;
      // Curl/wave along tendril
      const wave = Math.sin(frac * Math.PI * 3 + t * 3 + i * 0.5) * 0.3 * bandEnergy[i];
      const wave2 = Math.cos(frac * Math.PI * 2 + t * 2 + i * 1.1) * 0.2 * totalEnergy;
      // Perpendicular axes for wave displacement
      const px = -dz, pz = dx; // one perp axis in XZ
      const py2 = 1; // vertical perp

      pos[s*3]   = vx + dx * dist + px * wave + wave2 * 0.1;
      pos[s*3+1] = vy + dy * dist + py2 * wave2;
      pos[s*3+2] = vz + dz * dist + pz * wave;

      // Color: band color, fading toward tip
      const hue = (i / 12 + t * 0.03) % 1;
      const bright = (1 - frac * 0.7) * (0.4 + bandEnergy[i]);
      const rgb = KI.hslToRgb(hue, 0.85, Math.min(1, bright));
      col[s*3] = rgb[0]; col[s*3+1] = rgb[1]; col[s*3+2] = rgb[2];
    }

    tendrils[i].geometry.attributes.position.needsUpdate = true;
    tendrils[i].geometry.attributes.color.needsUpdate = true;
  }
}

// --- 6. HARMONIC SHELL ---
function updateHarmonicShell(t, bandEnergy, totalEnergy, tier, R) {
  const fade = Math.min(1, Math.max(0, (tier - 3.5) * 0.4));
  harmonicShell.material.opacity = fade * (0.08 + totalEnergy * 0.2);
  if (fade < 0.01) return;

  const coherence = KI.voice.coherence || 0;
  const shellScale = R * (1.4 + totalEnergy * 0.3 + Math.sin(t * 0.8) * 0.1);
  harmonicShell.scale.setScalar(shellScale / 2); // geometry has radius 2

  // Vertex displacement by frequency bands
  const positions = harmonicShell.geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const bx = shellBasePos[i*3], by = shellBasePos[i*3+1], bz = shellBasePos[i*3+2];
    const len = Math.sqrt(bx*bx + by*by + bz*bz) || 1;
    const nx = bx/len, ny = by/len, nz = bz/len;
    // Frequency-driven displacement
    const bIdx = i % 12;
    const disp = bandEnergy[bIdx] * 0.15 + Math.sin(t * 2 + i * 0.3) * 0.03 * totalEnergy;
    positions.setXYZ(i, bx + nx * disp, by + ny * disp, bz + nz * disp);
  }
  positions.needsUpdate = true;

  // Color from coherence: purple when chaotic, gold when coherent
  const hue = coherence > 0.5 ? 0.12 : 0.75;
  const rgb = KI.hslToRgb(hue, 0.7, 0.3 + totalEnergy * 0.3);
  harmonicShell.material.color.setRGB(rgb[0], rgb[1], rgb[2]);

  harmonicShell.rotation.y += 0.02 * (1 + totalEnergy);
  harmonicShell.rotation.x += 0.01;
}

// --- 7. CONSTELLATION WEB ---
function updateConstellationWeb(t, bandEnergy, totalEnergy, tier, R) {
  const fade = Math.min(1, Math.max(0, (tier - 5.5) * 0.4));
  webPoints.material.opacity = fade * (0.3 + totalEnergy * 0.5);
  webLines.material.opacity = fade * (0.15 + totalEnergy * 0.3);
  if (fade < 0.01) return;

  const webR = R * (2.0 + totalEnergy * 0.5);
  let lineIdx = 0;

  for (let i = 0; i < WEB_POINTS; i++) {
    const y = 1 - (i / (WEB_POINTS - 1)) * 2;
    const rAtY = Math.sqrt(1 - y * y);
    const theta = i * 2.399963 + t * 0.1;
    // Frequency modulation
    const bIdx = i % 12;
    const mod = 1 + bandEnergy[bIdx] * 0.3 + Math.sin(t + i * 0.2) * 0.05 * totalEnergy;

    webPos[i*3]   = Math.cos(theta) * rAtY * webR * mod;
    webPos[i*3+1] = y * webR * mod;
    webPos[i*3+2] = Math.sin(theta) * rAtY * webR * mod;

    // Color: shimmer
    const hue = (i / WEB_POINTS + t * 0.02) % 1;
    const bright = 0.3 + bandEnergy[bIdx] * 0.6;
    const rgb = KI.hslToRgb(hue, 0.6, Math.min(1, bright));
    webCol[i*3] = rgb[0]; webCol[i*3+1] = rgb[1]; webCol[i*3+2] = rgb[2];

    // Connect to nearby points
    if (lineIdx < WEB_MAX_LINES) {
      for (let j = i + 1; j < Math.min(i + 6, WEB_POINTS); j++) {
        if (lineIdx >= WEB_MAX_LINES) break;
        const dx = webPos[i*3] - webPos[j*3];
        const dy = webPos[i*3+1] - webPos[j*3+1];
        const dz = webPos[i*3+2] - webPos[j*3+2];
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (dist < webR * 0.6) {
          const li = lineIdx * 6;
          webLinePos[li] = webPos[i*3]; webLinePos[li+1] = webPos[i*3+1]; webLinePos[li+2] = webPos[i*3+2];
          webLinePos[li+3] = webPos[j*3]; webLinePos[li+4] = webPos[j*3+1]; webLinePos[li+5] = webPos[j*3+2];
          const lBright = (1 - dist / (webR * 0.6)) * 0.5;
          webLineCol[li] = rgb[0]*lBright; webLineCol[li+1] = rgb[1]*lBright; webLineCol[li+2] = rgb[2]*lBright;
          webLineCol[li+3] = rgb[0]*lBright; webLineCol[li+4] = rgb[1]*lBright; webLineCol[li+5] = rgb[2]*lBright;
          lineIdx++;
        }
      }
    }
  }

  webPoints.geometry.attributes.position.needsUpdate = true;
  webPoints.geometry.attributes.color.needsUpdate = true;
  webPoints.material.size = 0.04 + totalEnergy * 0.06;
  webLines.geometry.attributes.position.needsUpdate = true;
  webLines.geometry.attributes.color.needsUpdate = true;
  webLines.geometry.setDrawRange(0, lineIdx * 2);
}

// --- 8. PARTICLE STREAMS ---
function updateStreams(t, bandEnergy, totalEnergy, tier, R) {
  const fade = Math.min(1, Math.max(0, tier * 0.2));
  streams.material.opacity = fade * (0.3 + totalEnergy * 0.5);
  if (fade < 0.01) return;

  const dt = 0.016; // approximate frame dt

  for (let i = 0; i < STREAM_COUNT; i++) {
    // Update position
    streamPos[i*3]   += streamVel[i*4]   * dt;
    streamPos[i*3+1] += streamVel[i*4+1] * dt;
    streamPos[i*3+2] += streamVel[i*4+2] * dt;

    // Decrease life
    streamVel[i*4+3] -= dt;

    // Spiral force
    const px = streamPos[i*3], py = streamPos[i*3+1], pz = streamPos[i*3+2];
    const pr = Math.sqrt(px*px + py*py + pz*pz) || 0.1;
    // Add tangential velocity for spiral
    streamVel[i*4]   += (-pz / pr) * totalEnergy * 0.3 * dt;
    streamVel[i*4+2] += (px / pr) * totalEnergy * 0.3 * dt;

    // Respawn when dead or too far
    if (streamVel[i*4+3] <= 0 || pr > R * 4) {
      resetStreamParticle(i);
      // Speed based on energy
      const speed = 0.5 + totalEnergy * 2;
      streamVel[i*4] *= speed;
      streamVel[i*4+1] *= speed;
      streamVel[i*4+2] *= speed;
    }

    // Color based on distance and band
    const bIdx = i % 12;
    const life = Math.max(0, streamVel[i*4+3] / 3);
    const hue = (bIdx / 12 + t * 0.05) % 1;
    const bright = life * (0.3 + bandEnergy[bIdx] * 0.7);
    const rgb = KI.hslToRgb(hue, 0.7, Math.min(1, bright));
    streamCol[i*3] = rgb[0]; streamCol[i*3+1] = rgb[1]; streamCol[i*3+2] = rgb[2];
  }

  streams.geometry.attributes.position.needsUpdate = true;
  streams.geometry.attributes.color.needsUpdate = true;
  streams.material.size = 0.03 + totalEnergy * 0.05;
}

// --- 9. AURA RINGS ---
function updateAuraRings(t, bandEnergy, totalEnergy, tier, R) {
  const fade = Math.min(1, Math.max(0, (tier - 6.5) * 0.35));
  if (fade < 0.01) {
    for (const ring of auraRings) ring.material.opacity = 0;
    return;
  }

  for (let i = 0; i < AURA_RING_COUNT; i++) {
    const ring = auraRings[i];
    const bIdx = (i * 2 + 1) % 12;
    const energy = bandEnergy[bIdx];

    ring.material.opacity = fade * (0.05 + energy * 0.25);
    // Rotate
    ring.rotation.x += (0.1 + energy * 0.3) * 0.016 * (i % 2 === 0 ? 1 : -1);
    ring.rotation.z += 0.05 * 0.016;
    // Scale pulse
    const pulse = 1 + Math.sin(t * 2 + i * 1.2) * 0.08 + energy * 0.15;
    ring.scale.setScalar(pulse * (R / 2));

    // Color
    const hue = (i / AURA_RING_COUNT + t * 0.03) % 1;
    const rgb = KI.hslToRgb(hue, 0.6, 0.3 + energy * 0.4);
    ring.material.color.setRGB(rgb[0], rgb[1], rgb[2]);
  }
}

// --- 10. FRACTAL ECHOES ---
function updateFractalEchoes(t, bandEnergy, totalEnergy, tier, R) {
  const fade = Math.min(1, Math.max(0, (tier - 7.5) * 0.35));
  if (fade < 0.01) {
    for (const echo of fractalEchoes) {
      echo.points.material.opacity = 0;
      echo.lines.material.opacity = 0;
    }
    return;
  }

  const verts = geoState.vertices;
  const edges = getEdges(geoState.currentTier);
  const vCount = verts.length;

  for (let e = 0; e < ECHO_COUNT; e++) {
    const echo = fractalEchoes[e];
    const bIdx = e * 2 % 12;
    const energy = bandEnergy[bIdx];

    echo.points.material.opacity = fade * (0.3 + energy * 0.5);
    echo.lines.material.opacity = fade * (0.2 + energy * 0.4);

    // Orbit around main shape
    echo.angle += echo.speed * 0.016 * (1 + totalEnergy);
    const orbitR = echo.orbitR + Math.sin(t * 0.3 + e) * 0.3;
    const cx = Math.cos(echo.angle) * orbitR;
    const cy = Math.sin(echo.tilt + t * 0.1) * orbitR * 0.3;
    const cz = Math.sin(echo.angle) * orbitR;

    // Copy main shape vertices, scaled down and offset
    const sc = echo.scale * (0.8 + energy * 0.4);
    const pPos = echo.pointPos;
    const pCol = echo.pointCol;
    for (let i = 0; i < MAX_VERTS; i++) {
      if (i < vCount) {
        pPos[i*3]   = verts[i][0] * sc + cx;
        pPos[i*3+1] = verts[i][1] * sc + cy;
        pPos[i*3+2] = verts[i][2] * sc + cz;
        const hue = (e / ECHO_COUNT + i / vCount * 0.3 + t * 0.04) % 1;
        const rgb = KI.hslToRgb(hue, 0.8, 0.3 + energy * 0.5);
        pCol[i*3] = rgb[0]; pCol[i*3+1] = rgb[1]; pCol[i*3+2] = rgb[2];
      } else {
        pPos[i*3] = pPos[i*3+1] = pPos[i*3+2] = 0;
        pCol[i*3] = pCol[i*3+1] = pCol[i*3+2] = 0;
      }
    }
    echo.points.geometry.attributes.position.needsUpdate = true;
    echo.points.geometry.attributes.color.needsUpdate = true;
    echo.points.geometry.setDrawRange(0, vCount);
    echo.points.material.size = 0.04 + energy * 0.06;

    // Copy edges
    const lPos = echo.linePos;
    const lCol = echo.lineCol;
    const edgeCount = Math.min(edges.length, MAX_EDGES);
    for (let i = 0; i < MAX_EDGES; i++) {
      if (i < edgeCount) {
        const [a, b] = edges[i];
        const va = a % vCount, vb = b % vCount;
        lPos[i*6]   = verts[va][0] * sc + cx;
        lPos[i*6+1] = verts[va][1] * sc + cy;
        lPos[i*6+2] = verts[va][2] * sc + cz;
        lPos[i*6+3] = verts[vb][0] * sc + cx;
        lPos[i*6+4] = verts[vb][1] * sc + cy;
        lPos[i*6+5] = verts[vb][2] * sc + cz;
        const hue = (e / ECHO_COUNT + t * 0.03 + i * 0.01) % 1;
        const rgb = KI.hslToRgb(hue, 0.7, 0.25 + energy * 0.4);
        lCol[i*6] = lCol[i*6+3] = rgb[0];
        lCol[i*6+1] = lCol[i*6+4] = rgb[1];
        lCol[i*6+2] = lCol[i*6+5] = rgb[2];
      } else {
        for (let j = 0; j < 6; j++) { lPos[i*6+j] = 0; lCol[i*6+j] = 0; }
      }
    }
    echo.lines.geometry.attributes.position.needsUpdate = true;
    echo.lines.geometry.attributes.color.needsUpdate = true;
    echo.lines.geometry.setDrawRange(0, edgeCount * 2);
  }
}
