// voxel-wormhole.js — Minecraft voxel terrain with voice-activated wormhole
// A blocky landscape sits in front of you. As voice energy rises, a swirling
// wormhole portal opens at the center — terrain blocks rip loose and spiral
// into a tunnel of cubes extending into deep space. Quiet = peaceful terrain.
// Loud = full wormhole vortex.

import { KI } from './core.js';

const GRID = 20;         // 20×20 terrain grid
const VS = 0.4;          // voxel size (world units)
const MAX_H = 5;         // max terrain height in blocks
const TUNNEL_RINGS = 18; // depth rings in wormhole tunnel
const RING_BLK = 10;     // blocks per tunnel ring
const RIM_N = 14;        // portal rim blocks
const DEBRIS_N = 60;     // orbiting debris cubes

// Block types
const GRASS = 0, DIRT = 1, STONE = 2, RIM_T = 3, TUNNEL_T = 4, DEBRIS_T = 5;

// Minecraft-ish block colors (RGB 0-1)
const BLOCK_RGB = [
  [0.36, 0.55, 0.24],  // grass green
  [0.55, 0.42, 0.29],  // dirt brown
  [0.49, 0.49, 0.49],  // stone gray
  [0.70, 0.15, 0.90],  // rim purple
  [0.00, 0.70, 0.85],  // tunnel cyan
  [1.00, 0.40, 0.10]   // debris orange
];
const WORMHOLE_RGB = [0.55, 0.10, 0.85]; // cosmic purple

const state = {
  group: null,
  time: 0,
  wStr: 0,          // smoothed wormhole strength 0-1
  wTarget: 0,       // target from voice
  voxels: [],       // per-voxel data
  count: 0,
  maxDist: 1,
  mesh: null,       // InstancedMesh
  portalRing: null,  // glowing torus
  horizon: null,     // event horizon disc
  dummy: new THREE.Object3D()
};

// === TERRAIN HEIGHTMAP ===
// Layered sine waves with a crater depression at center
function heightAt(gx, gz) {
  const cx = gx - GRID / 2, cz = gz - GRID / 2;
  let h = Math.sin(cx * 0.25) * Math.cos(cz * 0.25) * 2.5
        + Math.sin(cx * 0.6 + 1) * Math.cos(cz * 0.4 + 2) * 0.8
        + 3;
  // Crater at center — the wormhole forms here
  const d = Math.sqrt(cx * cx + cz * cz);
  if (d < 4) h -= (4 - d) * 1.0;
  return Math.max(0, Math.min(MAX_H, Math.floor(h)));
}

// === GENERATE ALL VOXELS ===
function generate() {
  const voxels = [];
  let maxD = 0;
  const half = GRID / 2;

  // --- Terrain blocks (filled columns) ---
  for (let gx = 0; gx < GRID; gx++) {
    for (let gz = 0; gz < GRID; gz++) {
      const h = heightAt(gx, gz);
      const cx = gx - half, cz = gz - half;
      const d = Math.sqrt(cx * cx + cz * cz);
      maxD = Math.max(maxD, d);
      for (let y = 0; y <= h; y++) {
        voxels.push({
          rx: cx * VS, ry: y * VS, rz: cz * VS,
          wx: 0, wy: 0, wz: 0,
          type: y === h ? GRASS : y >= h - 1 ? DIRT : STONE,
          dist: d, distN: 0,
          orbit: null
        });
      }
    }
  }

  // --- Portal rim blocks (ring around wormhole mouth) ---
  for (let i = 0; i < RIM_N; i++) {
    const a = (i / RIM_N) * Math.PI * 2;
    voxels.push({
      rx: Math.cos(a) * 3.5, ry: -2, rz: Math.sin(a) * 3.5,
      wx: Math.cos(a) * 2.3, wy: Math.sin(a) * 2.3, wz: -0.2,
      type: RIM_T, dist: maxD * 0.3, distN: 0.3,
      orbit: null
    });
  }

  // --- Tunnel ring blocks (the wormhole tunnel) ---
  for (let r = 0; r < TUNNEL_RINGS; r++) {
    const depth = 1.5 + r * 0.9;
    const radius = 2.0 * (1 - r / TUNNEL_RINGS * 0.45);
    for (let i = 0; i < RING_BLK; i++) {
      const a = (i / RING_BLK) * Math.PI * 2 + r * 0.35;
      voxels.push({
        rx: 0, ry: -5, rz: 0,  // hidden below when closed
        wx: Math.cos(a) * radius, wy: Math.sin(a) * radius, wz: -depth,
        type: TUNNEL_T,
        dist: maxD * (0.4 + r / TUNNEL_RINGS * 0.55),
        distN: 0.4 + r / TUNNEL_RINGS * 0.55,
        orbit: null
      });
    }
  }

  // --- Debris cubes (orbit the wormhole mouth) ---
  for (let i = 0; i < DEBRIS_N; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1 + Math.random() * 4;
    voxels.push({
      rx: Math.cos(a) * r * 2, ry: Math.random() * MAX_H * VS, rz: Math.sin(a) * r * 2,
      wx: 0, wy: 0, wz: 0, // computed dynamically
      type: DEBRIS_T,
      dist: maxD * 0.5, distN: 0.5,
      orbit: {
        spd: 0.6 + Math.random() * 2.5,
        ph: Math.random() * Math.PI * 2,
        r: 0.8 + Math.random() * 2.2,
        h: (Math.random() - 0.5) * 3,
        depth: Math.random() * 8
      }
    });
  }

  // --- Compute wormhole target positions for terrain blocks ---
  for (const v of voxels) {
    v.distN = v.dist / maxD;
    if (v.type <= STONE) {
      // Map terrain position → spiral tunnel position
      const depth = v.distN * 14;
      const angle = Math.atan2(v.rz, v.rx) + depth * 0.8; // spiral twist
      const radius = 2.0 * (1 - v.distN * 0.35);
      v.wx = Math.cos(angle) * radius;
      v.wy = Math.sin(angle) * radius;
      v.wz = -depth;
    }
  }

  return { voxels, maxDist: maxD };
}

// === INIT ===
export function init(opts = {}) {
  const pos = opts.position || [0, 1.5, -2];
  const scale = opts.scale || 1;

  state.group = new THREE.Group();
  state.group.position.set(pos[0], pos[1], pos[2]);
  state.group.scale.setScalar(scale);
  KI.scene.add(state.group);

  const { voxels, maxDist } = generate();
  state.voxels = voxels;
  state.count = voxels.length;
  state.maxDist = maxDist;

  // InstancedMesh — single draw call for all blocks
  const geo = new THREE.BoxGeometry(VS * 0.92, VS * 0.92, VS * 0.92);
  state.mesh = new THREE.InstancedMesh(geo,
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.92 }),
    state.count);
  state.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  state.mesh.count = state.count;

  // Set initial positions + colors
  const d = state.dummy, c = new THREE.Color();
  for (let i = 0; i < state.count; i++) {
    const v = voxels[i];
    d.position.set(v.rx, v.ry, v.rz);
    d.scale.setScalar(v.type >= TUNNEL_T ? 0.001 : 1); // hide tunnel/debris initially
    d.rotation.set(0, 0, 0);
    d.updateMatrix();
    state.mesh.setMatrixAt(i, d.matrix);
    c.setRGB(BLOCK_RGB[v.type][0], BLOCK_RGB[v.type][1], BLOCK_RGB[v.type][2]);
    state.mesh.setColorAt(i, c);
  }
  state.mesh.instanceMatrix.needsUpdate = true;
  state.mesh.instanceColor.needsUpdate = true;
  state.group.add(state.mesh);

  // Portal ring — glowing torus at wormhole mouth
  state.portalRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.3, 0.15, 8, 32),
    new THREE.MeshBasicMaterial({
      color: 0x8800ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  state.group.add(state.portalRing);

  // Event horizon — glowing disc inside portal
  state.horizon = new THREE.Mesh(
    new THREE.CircleGeometry(2, 32),
    new THREE.MeshBasicMaterial({
      color: 0x4400aa, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    })
  );
  state.horizon.position.z = -0.3;
  state.group.add(state.horizon);

  KI.register('voxel-wormhole', { update, state, setStrength });
  KI.emit('voxel-wormhole:ready');
}

export function setStrength(s) {
  state.wTarget = Math.max(0, Math.min(1, s));
}

// === SMOOTHSTEP ===
function sstep(x) {
  x = Math.max(0, Math.min(1, x));
  return x * x * (3 - 2 * x);
}

// === UPDATE ===
function update(dt, t) {
  state.time = t;

  const fb = KI.get('freq-bands-12');
  const energy = fb ? Array.from({ length: 12 }, (_, i) => fb.getEnergy(i)) : new Array(12).fill(0);
  const total = energy.reduce((a, b) => a + b, 0);

  // Voice energy → wormhole strength
  state.wTarget = Math.min(1, total * 1.6);
  state.wStr += (state.wTarget - state.wStr) * dt * 3;
  state.wStr = Math.max(0, Math.min(1, state.wStr));
  const ws = state.wStr;

  // Animated tunnel rotation (spiral spins as wormhole is open)
  const tunnelRot = t * 0.25 * ws;
  const cosR = Math.cos(tunnelRot), sinR = Math.sin(tunnelRot);

  const d = state.dummy;
  const c = new THREE.Color();

  for (let i = 0; i < state.count; i++) {
    const v = state.voxels[i];

    // Per-voxel transition timing: center blocks first, edges last
    const tStart = v.distN * 0.7;
    const vt = sstep((ws - tStart) / 0.35);

    let px, py, pz, sc;

    if (v.orbit) {
      // === DEBRIS: orbit around wormhole mouth ===
      const o = v.orbit;
      const orbitAngle = t * o.spd + o.ph;
      const debrisX = Math.cos(orbitAngle) * o.r;
      const debrisY = Math.sin(orbitAngle) * o.r * 0.6 + o.h * 0.3;
      const debrisZ = -o.depth * ws;
      px = v.rx * (1 - vt) + debrisX * vt;
      py = v.ry * (1 - vt) + debrisY * vt;
      pz = v.rz * (1 - vt) + debrisZ * vt;
      sc = 0.3 + vt * 0.5;
      d.rotation.set(t * o.spd * 0.5, t * o.spd * 0.3, 0);
    } else if (v.type === TUNNEL_T) {
      // === TUNNEL: materialize from nothing ===
      // Rotate wormhole position around tunnel axis (Z)
      px = v.wx * cosR - v.wy * sinR;
      py = v.wx * sinR + v.wy * cosR;
      pz = v.wz;
      sc = vt; // scale 0→1 as wormhole opens
      d.rotation.set(t * 0.2, t * 0.15, t * 0.1);
    } else if (v.type === RIM_T) {
      // === PORTAL RIM: float into position ===
      const rwx = v.wx * cosR - v.wy * sinR;
      const rwy = v.wx * sinR + v.wy * cosR;
      px = v.rx * (1 - vt) + rwx * vt;
      py = v.ry * (1 - vt) + rwy * vt;
      pz = v.rz * (1 - vt) + v.wz * vt;
      sc = 0.8 + vt * 0.4 + Math.sin(t * 3 + i) * 0.1 * ws;
      d.rotation.set(0, t * 0.5, 0);
    } else {
      // === TERRAIN: rip loose and spiral into tunnel ===
      // Rotate wormhole position around tunnel axis
      const rwx = v.wx * cosR - v.wy * sinR;
      const rwy = v.wx * sinR + v.wy * cosR;
      px = v.rx * (1 - vt) + rwx * vt;
      py = v.ry * (1 - vt) + rwy * vt;
      pz = v.rz * (1 - vt) + v.wz * vt;
      // Slight lift as blocks break free
      py += vt * Math.sin(t * 2 + v.distN * 5) * 0.15;
      sc = 1 - vt * 0.12; // shrink slightly entering tunnel
      // Tumble rotation for transitioning blocks
      if (vt > 0.05) {
        const tumble = vt * t * 0.4;
        d.rotation.set(tumble * 0.3, tumble * 0.5, tumble * 0.2);
      } else {
        d.rotation.set(0, 0, 0);
      }
    }

    d.position.set(px, py, pz);
    d.scale.setScalar(Math.max(0.001, sc));
    d.updateMatrix();
    state.mesh.setMatrixAt(i, d.matrix);

    // Color: lerp from block color → wormhole purple
    const bc = BLOCK_RGB[v.type];
    const cr = bc[0] * (1 - vt) + WORMHOLE_RGB[0] * vt;
    const cg = bc[1] * (1 - vt) + WORMHOLE_RGB[1] * vt;
    const cb = bc[2] * (1 - vt) + WORMHOLE_RGB[2] * vt;
    // Band-energy glow on active blocks
    const glow = vt * energy[i % 12] * 0.3;
    c.setRGB(
      Math.min(1, cr + glow * 0.8),
      Math.min(1, cg + glow * 0.3),
      Math.min(1, cb + glow)
    );
    state.mesh.setColorAt(i, c);
  }

  state.mesh.instanceMatrix.needsUpdate = true;
  state.mesh.instanceColor.needsUpdate = true;

  // Portal ring glow
  state.portalRing.material.opacity = ws * 0.5;
  state.portalRing.rotation.z = t * 0.5;
  state.portalRing.scale.setScalar(0.5 + ws * 0.5 + Math.sin(t * 2) * 0.05 * ws);

  // Event horizon
  state.horizon.material.opacity = ws * 0.3;
  state.horizon.scale.setScalar(ws * 0.9 + Math.sin(t * 1.5) * 0.05 * ws);
  state.horizon.material.color.setHSL((t * 0.04) % 1, 0.8, 0.15 + ws * 0.2);

  // Slight terrain group tilt with voice
  state.group.rotation.x = Math.sin(t * 0.08) * 0.03 + ws * 0.05;
  state.group.rotation.y = t * 0.02;

  KI.emit('voxel-wormhole:update', { strength: ws, energy: total });
}
