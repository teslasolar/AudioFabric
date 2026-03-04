// fractal-orb.js — Recursive fractal sphere with self-similar branching
// A central sphere made of recursive tree branches growing from center.
// Features:
// - Fractal tree branches radiating outward from core
// - Branch tips glow and pulse with energy
// - Energy → branch depth/length, tip brightness
// - Pitch → branch color gradient (warm→cool spectrum)
// - Coherence → branch regularity (golden ratio vs chaotic angles)
// - Vowel → fractal type (tree, fern, lightning, coral, crystal)
// - Pulse → growth/retract rhythm
// - Floating spore particles drift off branch tips

import { KI } from './core.js';

const TAU = Math.PI * 2;

// ── Config ──
const MAX_BRANCHES = 600;     // total line segments across all trees
const BRANCH_SEGS = 2;        // points per branch segment (start+end)
const ROOT_COUNT = 12;        // root branches from center
const MAX_DEPTH = 5;          // max recursion depth
const MAX_SPORES = 400;       // floating spore particles
const MAX_GLOW_NODES = 60;    // glowing tip nodes

let group = null;
let branchLines = [], branchMats = [];
let branchIdx = 0;
let sporeSystem = null, sporePos = null, sporeCol = null;
let sporeData = [];
let glowMeshes = [], glowMats = [];
let fractalType = 'tree';
let branchData = [];  // stored branch endpoint data for spore spawning

// Fractal parameters per type
const FRACTAL_PARAMS = {
  tree:      { angleSpread: 0.6, lengthDecay: 0.7, branches: 2, twist: 0.1 },
  fern:      { angleSpread: 0.25, lengthDecay: 0.85, branches: 2, twist: 0.4 },
  lightning: { angleSpread: 0.8, lengthDecay: 0.6, branches: 3, twist: 0.0 },
  coral:     { angleSpread: 0.4, lengthDecay: 0.75, branches: 3, twist: 0.3 },
  crystal:   { angleSpread: 0.52, lengthDecay: 0.65, branches: 2, twist: 0.0 }  // ~pi/6 hexagonal
};

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 2.5, -3.5];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── Branch line segments ──
  for (let i = 0; i < MAX_BRANCHES; i++) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(BRANCH_SEGS * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0x88ff44, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    group.add(line);
    branchLines.push(line);
    branchMats.push(mat);
  }

  // ── Glow nodes (branch tips) ──
  for (let i = 0; i < MAX_GLOW_NODES; i++) {
    const gGeo = new THREE.SphereGeometry(0.03, 4, 3);
    const gMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(gGeo, gMat);
    mesh.visible = false;
    group.add(mesh);
    glowMeshes.push(mesh);
    glowMats.push(gMat);
  }

  // ── Spore particles ──
  const sGeo = new THREE.BufferGeometry();
  sporePos = new Float32Array(MAX_SPORES * 3);
  sporeCol = new Float32Array(MAX_SPORES * 3);
  for (let i = 0; i < MAX_SPORES; i++) {
    sporeData.push({
      x: 0, y: 0, z: 0,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      vz: (Math.random() - 0.5) * 0.3,
      life: 0
    });
  }
  sGeo.setAttribute('position', new THREE.BufferAttribute(sporePos, 3));
  sGeo.setAttribute('color', new THREE.BufferAttribute(sporeCol, 3));
  sporeSystem = new THREE.Points(sGeo, new THREE.PointsMaterial({
    size: 0.03, vertexColors: true, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(sporeSystem);

  KI.register('fractal-orb', { update, group, getType: () => fractalType });
  KI.emit('fractal-orb:ready');
}

function generateFractalBranches(params, energy, coherence, t) {
  branchIdx = 0;
  branchData = [];
  let glowIdx = 0;
  const maxDepth = Math.min(MAX_DEPTH, 2 + Math.floor(energy * 3));

  // Golden ratio angle for coherent mode
  const goldenAngle = 2.399963;

  for (let r = 0; r < ROOT_COUNT; r++) {
    // Distribute roots on sphere surface
    const theta = Math.acos(2 * (r + 0.5) / ROOT_COUNT - 1);
    const phi = goldenAngle * r;
    const dirX = Math.sin(theta) * Math.cos(phi);
    const dirY = Math.cos(theta);
    const dirZ = Math.sin(theta) * Math.sin(phi);

    growBranch(0, 0, 0, dirX, dirY, dirZ, 0.4 + energy * 0.3, 0, maxDepth, params, coherence, t, r);
  }

  // Hide unused branches
  for (let i = branchIdx; i < MAX_BRANCHES; i++) {
    branchLines[i].visible = false;
  }
  // Hide unused glow nodes
  for (let i = branchData.length; i < MAX_GLOW_NODES; i++) {
    glowMeshes[i].visible = false;
  }

  function growBranch(x, y, z, dx, dy, dz, length, depth, maxD, p, coh, time, seed) {
    if (depth >= maxD || branchIdx >= MAX_BRANCHES) return;

    const endX = x + dx * length;
    const endY = y + dy * length;
    const endZ = z + dz * length;

    // Set branch line
    const positions = branchLines[branchIdx].geometry.attributes.position.array;
    positions[0] = x; positions[1] = y; positions[2] = z;
    positions[3] = endX; positions[4] = endY; positions[5] = endZ;
    branchLines[branchIdx].geometry.attributes.position.needsUpdate = true;
    branchLines[branchIdx].visible = true;
    branchIdx++;

    // At tip, store for glow/spore
    if (depth === maxD - 1 && branchData.length < MAX_GLOW_NODES) {
      branchData.push({ x: endX, y: endY, z: endZ, depth });
    }

    // Recurse children
    const childLen = length * p.lengthDecay;
    for (let c = 0; c < p.branches; c++) {
      if (branchIdx >= MAX_BRANCHES) return;

      let spreadAngle = p.angleSpread;
      // Coherence: high = regular golden-ratio spacing, low = random
      let childAngle;
      if (coh > 0.5) {
        childAngle = (c / p.branches) * TAU + depth * goldenAngle;
      } else {
        childAngle = Math.random() * TAU;
        spreadAngle += (1 - coh) * 0.3;
      }

      // Rotate direction by spread
      const twist = p.twist * (time * 0.5 + seed * 0.3);
      const cosS = Math.cos(spreadAngle);
      const sinS = Math.sin(spreadAngle);
      const cosA = Math.cos(childAngle + twist);
      const sinA = Math.sin(childAngle + twist);

      // Simple rotation: spread from parent direction
      // Find perpendicular axes
      let perpX, perpY, perpZ;
      if (Math.abs(dy) < 0.9) {
        perpX = dz; perpY = 0; perpZ = -dx;
      } else {
        perpX = 0; perpY = -dz; perpZ = dy;
      }
      const pLen = Math.sqrt(perpX * perpX + perpY * perpY + perpZ * perpZ) || 1;
      perpX /= pLen; perpY /= pLen; perpZ /= pLen;

      // Second perp via cross product
      const p2x = dy * perpZ - dz * perpY;
      const p2y = dz * perpX - dx * perpZ;
      const p2z = dx * perpY - dy * perpX;

      const newDx = dx * cosS + (perpX * cosA + p2x * sinA) * sinS;
      const newDy = dy * cosS + (perpY * cosA + p2y * sinA) * sinS;
      const newDz = dz * cosS + (perpZ * cosA + p2z * sinA) * sinS;

      // Normalize
      const nLen = Math.sqrt(newDx * newDx + newDy * newDy + newDz * newDz) || 1;

      growBranch(endX, endY, endZ, newDx / nLen, newDy / nLen, newDz / nLen, childLen, depth + 1, maxD, p, coh, time, seed * 3 + c);
    }
  }
}

let sporeIdx = 0;

function update(dt, t) {
  const v = KI.voice;
  const energy = v.energy || 0;
  const coherence = v.coherence || 0;
  const pitch = v.pn || 0;
  const sounding = v.sounding;
  const pulseRate = v.pulseRate || 1;

  // ── Vowel → fractal type ──
  if (sounding) {
    const types = { a: 'tree', e: 'fern', i: 'lightning', o: 'coral', u: 'crystal' };
    fractalType = types[v.vowel || 'a'] || 'tree';
  }

  const params = FRACTAL_PARAMS[fractalType];
  const baseHue = 0.3 - pitch * 0.4; // green→warm or green→cool

  // ── Generate fractal structure ──
  const pulseFactor = 0.7 + Math.sin(t * pulseRate * 3) * 0.3;
  generateFractalBranches(params, energy * pulseFactor, coherence, t);

  // ── Color branches by depth ──
  for (let i = 0; i < branchIdx; i++) {
    const depthRatio = i / Math.max(1, branchIdx);
    const hue = ((baseHue + depthRatio * 0.2) % 1 + 1) % 1;
    const bright = 0.15 + energy * 0.3 * (1 - depthRatio * 0.5);
    const lineWidth = 1 - depthRatio * 0.5;
    const rgb = hslToRgb(hue, 0.5 + energy * 0.3, bright);
    branchMats[i].color.setRGB(rgb[0], rgb[1], rgb[2]);
    branchMats[i].opacity = 0.2 + energy * 0.5 * (1 - depthRatio * 0.3);
  }

  // ── Glow tips ──
  for (let i = 0; i < branchData.length && i < MAX_GLOW_NODES; i++) {
    const bd = branchData[i];
    glowMeshes[i].visible = true;
    glowMeshes[i].position.set(bd.x, bd.y, bd.z);
    const glow = 0.3 + Math.sin(t * 4 + i * 1.5) * 0.2 + energy * 0.4;
    const hue = ((baseHue + 0.1) % 1 + 1) % 1;
    const rgb = hslToRgb(hue, 0.4, glow);
    glowMats[i].color.setRGB(rgb[0], rgb[1], rgb[2]);
    glowMats[i].opacity = glow;
    glowMeshes[i].scale.setScalar(0.5 + energy * 2);

    // Spawn spores from tips
    if (Math.random() < energy * 0.15) {
      const si = sporeIdx % MAX_SPORES;
      const sd = sporeData[si];
      sd.x = bd.x; sd.y = bd.y; sd.z = bd.z;
      sd.vx = (Math.random() - 0.5) * 0.3;
      sd.vy = (Math.random() - 0.5) * 0.3;
      sd.vz = (Math.random() - 0.5) * 0.3;
      sd.life = 1;
      sporeIdx++;
    }
  }

  // ── Update spores ──
  for (let i = 0; i < MAX_SPORES; i++) {
    const sd = sporeData[i];
    if (sd.life > 0) {
      sd.x += sd.vx * dt;
      sd.y += sd.vy * dt;
      sd.z += sd.vz * dt;
      sd.life -= dt * 0.4;
    }
    sporePos[i * 3] = sd.x;
    sporePos[i * 3 + 1] = sd.y;
    sporePos[i * 3 + 2] = sd.z;

    const bright = Math.max(0, sd.life) * energy * 0.3;
    const hue = ((baseHue + 0.05) % 1 + 1) % 1;
    const rgb = hslToRgb(hue, 0.4, bright);
    sporeCol[i * 3] = rgb[0]; sporeCol[i * 3 + 1] = rgb[1]; sporeCol[i * 3 + 2] = rgb[2];
  }
  sporeSystem.geometry.attributes.position.needsUpdate = true;
  sporeSystem.geometry.attributes.color.needsUpdate = true;

  group.rotation.y += dt * 0.04;

  KI.emit('fractal-orb:update', {
    fractalType,
    branchCount: branchIdx,
    tipCount: branchData.length,
    maxDepth: Math.min(MAX_DEPTH, 2 + Math.floor(energy * 3)),
    growthPulse: Math.round(pulseFactor * 100)
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
