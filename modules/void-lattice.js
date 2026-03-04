// void-lattice.js — Infinite grid with voice-driven spacetime distortions
// An endless lattice grid that stretches into infinity. Voice warps spacetime:
// gravity wells, ripples, tears, and dimensional folding.
// Features:
// - Infinite-feeling 3D grid (receding lines with fog)
// - Energy → gravitational distortion (grid bends toward you)
// - Pitch → gravity well position (sweeps across the grid)
// - Coherence → spacetime stability (wobbly vs rigid)
// - Vowel → distortion type (gravity well, ripple, tear, fold, vortex)
// - Pulse → propagation of spacetime waves
// - Grid intersection nodes glow at stress points
// - Distant grid fades into void with depth fog effect

import { KI } from './core.js';

const TAU = Math.PI * 2;

// ── Grid parameters ──
const GRID_SIZE = 24;       // lines per axis
const GRID_SPACING = 0.5;
const GRID_EXTENT = GRID_SIZE * GRID_SPACING / 2;
const SEGMENTS_PER_LINE = 40; // subdivision for smooth bending

// ── Distortion state ──
let distortType = 'gravity';
let gravityPos = new Float32Array([0, 0, 0]); // where the distortion center is
let gravityStrength = 0;
let ripplePhase = 0;
let tearAmount = 0;

// ── 3D objects ──
let group = null;
// Grid lines (X-axis parallel, Z-axis parallel, Y-axis parallel)
let gridLinesX = [];
let gridLinesZ = [];
let gridLinesY = [];
const TOTAL_LINES = GRID_SIZE * 3; // per axis

// Stress node particles (at grid intersections)
let stressSystem = null, stressPos = null, stressCol = null;
const MAX_STRESS = 800;

// Void fog particles (deep field)
let fogSystem = null, fogPos = null, fogCol = null;
const MAX_FOG = 1000;

// Event horizon ring (forms around gravity wells)
let horizonRing = null;

// Tear effect (line segments showing dimensional rip)
let tearLines = [];
const MAX_TEARS = 20;

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 0, 0];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── Build grid lines ──
  const lineMat = () => new THREE.LineBasicMaterial({
    color: 0x114422, transparent: true, opacity: 0.2,
    blending: THREE.AdditiveBlending
  });

  // X-parallel lines (along X, positioned at different Z and Y)
  for (let z = 0; z < GRID_SIZE; z++) {
    for (let y = 0; y < 3; y++) { // 3 Y-layers
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array((SEGMENTS_PER_LINE + 1) * 3);
      for (let s = 0; s <= SEGMENTS_PER_LINE; s++) {
        const x = (s / SEGMENTS_PER_LINE - 0.5) * GRID_SIZE * GRID_SPACING;
        const zp = (z / (GRID_SIZE-1) - 0.5) * GRID_SIZE * GRID_SPACING;
        const yp = (y - 1) * GRID_SPACING * 4;
        positions[s*3] = x; positions[s*3+1] = yp; positions[s*3+2] = zp;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const line = new THREE.Line(geo, lineMat());
      group.add(line);
      gridLinesX.push(line);
    }
  }

  // Z-parallel lines
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < 3; y++) {
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array((SEGMENTS_PER_LINE + 1) * 3);
      for (let s = 0; s <= SEGMENTS_PER_LINE; s++) {
        const zp = (s / SEGMENTS_PER_LINE - 0.5) * GRID_SIZE * GRID_SPACING;
        const xp = (x / (GRID_SIZE-1) - 0.5) * GRID_SIZE * GRID_SPACING;
        const yp = (y - 1) * GRID_SPACING * 4;
        positions[s*3] = xp; positions[s*3+1] = yp; positions[s*3+2] = zp;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const line = new THREE.Line(geo, lineMat());
      group.add(line);
      gridLinesZ.push(line);
    }
  }

  // Y-parallel lines (vertical pillars at intersections)
  for (let x = 0; x < GRID_SIZE; x += 3) {
    for (let z = 0; z < GRID_SIZE; z += 3) {
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array((SEGMENTS_PER_LINE + 1) * 3);
      const xp = (x / (GRID_SIZE-1) - 0.5) * GRID_SIZE * GRID_SPACING;
      const zp = (z / (GRID_SIZE-1) - 0.5) * GRID_SIZE * GRID_SPACING;
      for (let s = 0; s <= SEGMENTS_PER_LINE; s++) {
        const yp = (s / SEGMENTS_PER_LINE - 0.5) * 6;
        positions[s*3] = xp; positions[s*3+1] = yp; positions[s*3+2] = zp;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const line = new THREE.Line(geo, lineMat());
      group.add(line);
      gridLinesY.push(line);
    }
  }

  // ── Stress node particles ──
  const sGeo = new THREE.BufferGeometry();
  stressPos = new Float32Array(MAX_STRESS * 3);
  stressCol = new Float32Array(MAX_STRESS * 3);
  // Initialize at grid intersections
  let si = 0;
  for (let x = 0; x < GRID_SIZE && si < MAX_STRESS; x += 2) {
    for (let z = 0; z < GRID_SIZE && si < MAX_STRESS; z += 2) {
      for (let y = 0; y < 3 && si < MAX_STRESS; y++) {
        stressPos[si*3] = (x/(GRID_SIZE-1) - 0.5) * GRID_SIZE * GRID_SPACING;
        stressPos[si*3+1] = (y - 1) * GRID_SPACING * 4;
        stressPos[si*3+2] = (z/(GRID_SIZE-1) - 0.5) * GRID_SIZE * GRID_SPACING;
        si++;
      }
    }
  }
  sGeo.setAttribute('position', new THREE.BufferAttribute(stressPos, 3));
  sGeo.setAttribute('color', new THREE.BufferAttribute(stressCol, 3));
  stressSystem = new THREE.Points(sGeo, new THREE.PointsMaterial({
    size: 0.05, vertexColors: true, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(stressSystem);

  // ── Void fog (deep field ambience) ──
  const fGeo = new THREE.BufferGeometry();
  fogPos = new Float32Array(MAX_FOG * 3);
  fogCol = new Float32Array(MAX_FOG * 3);
  for (let i = 0; i < MAX_FOG; i++) {
    fogPos[i*3]   = (Math.random()-0.5) * 20;
    fogPos[i*3+1] = (Math.random()-0.5) * 10;
    fogPos[i*3+2] = (Math.random()-0.5) * 20;
    fogCol[i*3] = 0.02; fogCol[i*3+1] = 0.06; fogCol[i*3+2] = 0.04;
  }
  fGeo.setAttribute('position', new THREE.BufferAttribute(fogPos, 3));
  fGeo.setAttribute('color', new THREE.BufferAttribute(fogCol, 3));
  fogSystem = new THREE.Points(fGeo, new THREE.PointsMaterial({
    size: 0.15, vertexColors: true, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(fogSystem);

  // ── Event horizon ring ──
  const hGeo = new THREE.TorusGeometry(1, 0.02, 8, 64);
  horizonRing = new THREE.Mesh(hGeo, new THREE.MeshBasicMaterial({
    color: 0xff4400, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  horizonRing.rotation.x = Math.PI / 2;
  group.add(horizonRing);

  // ── Tear lines ──
  for (let i = 0; i < MAX_TEARS; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0xff00ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending
    }));
    line.visible = false;
    group.add(line);
    tearLines.push(line);
  }

  KI.register('void-lattice', {
    update, group,
    getDistortType: () => distortType,
    getGravityStrength: () => gravityStrength,
    getGridSize: () => GRID_SIZE
  });

  KI.emit('void-lattice:ready');
}

// ── Distortion functions ──
function distort(px, py, pz, gx, gy, gz, strength, type, t) {
  const dx = px - gx, dy = py - gy, dz = pz - gz;
  const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 0.01;
  let ox = 0, oy = 0, oz = 0;

  switch (type) {
    case 'gravity': {
      // Pull toward gravity center, strength falls off with distance
      const pull = strength / (dist * dist + 0.5);
      ox = -dx * pull * 0.3;
      oy = -dy * pull * 0.3 - pull * 0.5; // extra downward pull
      oz = -dz * pull * 0.3;
      break;
    }
    case 'ripple': {
      // Concentric wave ripples from center
      const wave = Math.sin(dist * 6 - t * 4) * strength / (1 + dist * 0.3);
      ox = dx / dist * wave * 0.1;
      oy = wave * 0.3;
      oz = dz / dist * wave * 0.1;
      break;
    }
    case 'tear': {
      // Space rips apart: points on either side of center move in opposite directions
      const side = dx > 0 ? 1 : -1;
      const tearStr = strength * Math.exp(-dist * 0.5);
      ox = side * tearStr * 0.5;
      oy = Math.sin(py * 3 + t) * tearStr * 0.2;
      oz = Math.cos(pz * 2 + t * 0.7) * tearStr * 0.1;
      break;
    }
    case 'fold': {
      // Dimensional folding: grid folds over itself
      const foldAngle = strength * Math.exp(-Math.abs(dx) * 0.5);
      oy = Math.abs(dx) < 2 ? -py * foldAngle * 0.5 + Math.abs(dx) * foldAngle * 0.3 : 0;
      ox = Math.abs(dx) < 2 ? (2 - Math.abs(dx)) * Math.sign(dx) * foldAngle * -0.3 : 0;
      break;
    }
    case 'vortex': {
      // Spiral distortion
      const angle = Math.atan2(dz, dx) + strength * 0.5 / (1 + dist * 0.3);
      const r = dist;
      const targetX = gx + Math.cos(angle) * r;
      const targetZ = gz + Math.sin(angle) * r;
      ox = (targetX - px) * 0.3;
      oz = (targetZ - pz) * 0.3;
      oy = -strength * 0.3 / (1 + dist);
      break;
    }
  }
  return [px + ox, py + oy, pz + oz];
}

function update(dt, t) {
  const v = KI.voice;
  const energy = v.energy || 0;
  const coherence = v.coherence || 0;
  const pitch = v.pn || 0;
  const sounding = v.sounding;
  const pulseRate = v.pulseRate || 1;

  // ── Voice → distortion parameters ──
  gravityStrength = energy * 3;

  // Pitch → gravity position (sweeps X)
  gravityPos[0] = (pitch - 0.5) * GRID_SIZE * GRID_SPACING * 0.8;
  gravityPos[1] = 0;
  gravityPos[2] = Math.sin(t * 0.3) * 2;

  // Vowel → distortion type
  if (sounding) {
    const vowelDist = { a: 'gravity', e: 'ripple', i: 'tear', o: 'fold', u: 'vortex' };
    distortType = vowelDist[v.vowel || 'a'] || 'gravity';
  }

  ripplePhase += dt * pulseRate * 2;
  const gx = gravityPos[0], gy = gravityPos[1], gz = gravityPos[2];

  // ── Distort X-parallel grid lines ──
  let lineIdx = 0;
  for (let z = 0; z < GRID_SIZE; z++) {
    for (let y = 0; y < 3; y++) {
      const line = gridLinesX[lineIdx++];
      if (!line) continue;
      const posArr = line.geometry.attributes.position.array;
      const zBase = (z / (GRID_SIZE-1) - 0.5) * GRID_SIZE * GRID_SPACING;
      const yBase = (y - 1) * GRID_SPACING * 4;
      for (let s = 0; s <= SEGMENTS_PER_LINE; s++) {
        const xBase = (s / SEGMENTS_PER_LINE - 0.5) * GRID_SIZE * GRID_SPACING;
        const [nx, ny, nz] = distort(xBase, yBase, zBase, gx, gy, gz, gravityStrength, distortType, t);
        posArr[s*3] = nx; posArr[s*3+1] = ny; posArr[s*3+2] = nz;
      }
      line.geometry.attributes.position.needsUpdate = true;

      // Opacity: fade with distance from center
      const centerDist = Math.abs(zBase) + Math.abs(yBase) * 0.5;
      line.material.opacity = Math.max(0.03, 0.2 - centerDist * 0.02 + energy * 0.1);
      const lrgb = hslToRgb(0.35 + energy * 0.1, 0.5, 0.15 + energy * 0.1);
      line.material.color.setRGB(lrgb[0], lrgb[1], lrgb[2]);
    }
  }

  // ── Distort Z-parallel grid lines ──
  lineIdx = 0;
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < 3; y++) {
      const line = gridLinesZ[lineIdx++];
      if (!line) continue;
      const posArr = line.geometry.attributes.position.array;
      const xBase = (x / (GRID_SIZE-1) - 0.5) * GRID_SIZE * GRID_SPACING;
      const yBase = (y - 1) * GRID_SPACING * 4;
      for (let s = 0; s <= SEGMENTS_PER_LINE; s++) {
        const zBase = (s / SEGMENTS_PER_LINE - 0.5) * GRID_SIZE * GRID_SPACING;
        const [nx, ny, nz] = distort(xBase, yBase, zBase, gx, gy, gz, gravityStrength, distortType, t);
        posArr[s*3] = nx; posArr[s*3+1] = ny; posArr[s*3+2] = nz;
      }
      line.geometry.attributes.position.needsUpdate = true;
      const centerDist = Math.abs(xBase) + Math.abs(yBase) * 0.5;
      line.material.opacity = Math.max(0.03, 0.2 - centerDist * 0.02 + energy * 0.1);
      const lrgb = hslToRgb(0.35 + energy * 0.1, 0.5, 0.15 + energy * 0.1);
      line.material.color.setRGB(lrgb[0], lrgb[1], lrgb[2]);
    }
  }

  // ── Distort Y-parallel (vertical) lines ──
  for (let i = 0; i < gridLinesY.length; i++) {
    const line = gridLinesY[i];
    const posArr = line.geometry.attributes.position.array;
    const xBase = posArr[0], zBase = posArr[2]; // fixed X,Z
    for (let s = 0; s <= SEGMENTS_PER_LINE; s++) {
      const yBase = (s / SEGMENTS_PER_LINE - 0.5) * 6;
      const [nx, ny, nz] = distort(xBase, yBase, zBase, gx, gy, gz, gravityStrength, distortType, t);
      posArr[s*3] = nx; posArr[s*3+1] = ny; posArr[s*3+2] = nz;
    }
    line.geometry.attributes.position.needsUpdate = true;
    line.material.opacity = 0.08 + energy * 0.1;
  }

  // ── Stress nodes: glow based on local distortion magnitude ──
  for (let i = 0; i < MAX_STRESS; i++) {
    const px = stressPos[i*3], py = stressPos[i*3+1], pz = stressPos[i*3+2];
    const dx = px - gx, dy = py - gy, dz = pz - gz;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
    const stress = gravityStrength / (dist * dist + 1);

    const hue = 0.3 - stress * 0.3; // green → red with stress
    const bright = Math.min(1, stress * 0.5 + energy * 0.1);
    const rgb = hslToRgb(Math.max(0, hue), 0.8, bright * 0.4);
    stressCol[i*3] = rgb[0]; stressCol[i*3+1] = rgb[1]; stressCol[i*3+2] = rgb[2];
  }
  stressSystem.geometry.attributes.color.needsUpdate = true;

  // ── Event horizon ring ──
  horizonRing.position.set(gx, gy, gz);
  horizonRing.material.opacity = Math.min(0.5, gravityStrength * 0.15);
  horizonRing.scale.setScalar(0.5 + gravityStrength * 0.3);
  horizonRing.rotation.z = t * 0.5;
  const hrgb = hslToRgb(0.05 + energy * 0.05, 0.9, 0.4 + energy * 0.2);
  horizonRing.material.color.setRGB(hrgb[0], hrgb[1], hrgb[2]);

  // ── Tear effect lines ──
  if (distortType === 'tear' && energy > 0.2) {
    for (let i = 0; i < MAX_TEARS; i++) {
      const line = tearLines[i];
      if (Math.random() < energy * dt * 5) {
        line.visible = true;
        const posArr = line.geometry.attributes.position.array;
        const ty = (Math.random()-0.5) * 4;
        const tz = gz + (Math.random()-0.5) * 3;
        posArr[0] = gx - 0.1; posArr[1] = ty; posArr[2] = tz;
        posArr[3] = gx + 0.1; posArr[4] = ty + (Math.random()-0.5) * 0.5; posArr[5] = tz;
        line.geometry.attributes.position.needsUpdate = true;
        line.material.opacity = 0.5 + Math.random() * 0.5;
      } else if (line.visible) {
        line.material.opacity *= 0.95;
        if (line.material.opacity < 0.02) line.visible = false;
      }
    }
  } else {
    for (const line of tearLines) {
      if (line.visible) {
        line.material.opacity *= 0.92;
        if (line.material.opacity < 0.02) line.visible = false;
      }
    }
  }

  // ── Fog drift ──
  for (let i = 0; i < MAX_FOG; i++) {
    fogPos[i*3]   += (Math.random()-0.5) * dt * 0.1;
    fogPos[i*3+1] += (Math.random()-0.5) * dt * 0.05;
    fogPos[i*3+2] += (Math.random()-0.5) * dt * 0.1;
    // Wrap around
    for (let c = 0; c < 3; c++) {
      const ext = c === 1 ? 5 : 10;
      if (Math.abs(fogPos[i*3+c]) > ext) fogPos[i*3+c] *= -0.9;
    }
    const bright = 0.02 + energy * 0.04;
    fogCol[i*3] = bright * 0.3; fogCol[i*3+1] = bright * 0.8; fogCol[i*3+2] = bright * 0.5;
  }
  fogSystem.geometry.attributes.position.needsUpdate = true;
  fogSystem.geometry.attributes.color.needsUpdate = true;

  KI.emit('void-lattice:update', {
    distortType,
    gravityStrength: gravityStrength.toFixed(2),
    gravityPos: [gx.toFixed(1), gy.toFixed(1), gz.toFixed(1)],
    gridLines: gridLinesX.length + gridLinesZ.length + gridLinesY.length,
    stressNodes: MAX_STRESS
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
