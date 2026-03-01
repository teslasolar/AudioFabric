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
