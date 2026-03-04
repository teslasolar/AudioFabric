// wrapped-geo.js — Rainbow waveform spiral wrapped around a shape-morphing core
// The "red ball" morphs through 8 solid shapes (sphere → torus → knot → ...)
// while rainbow audio spirals wrap around the surface in real-time.

import { KI } from './core.js';

const SPIRAL_POINTS = 512;
const SPIRAL_WRAPS = 8;
const ORBIT_RINGS = 6;
const ORBIT_PTS = 64;

const SHAPES = [
  { name: 'Sphere',       make: () => new THREE.SphereGeometry(1, 32, 24),                baseR: 1.0  },
  { name: 'Icosahedron',  make: () => new THREE.IcosahedronGeometry(1, 1),                baseR: 1.0  },
  { name: 'Torus',        make: () => new THREE.TorusGeometry(0.75, 0.35, 16, 48),       baseR: 1.1  },
  { name: 'Octahedron',   make: () => new THREE.OctahedronGeometry(1.1, 0),               baseR: 1.1  },
  { name: 'Dodecahedron', make: () => new THREE.DodecahedronGeometry(1, 0),               baseR: 1.0  },
  { name: 'Torus Knot',   make: () => new THREE.TorusKnotGeometry(0.65, 0.25, 80, 12),   baseR: 0.95 },
  { name: 'Tetrahedron',  make: () => new THREE.TetrahedronGeometry(1.2, 1),              baseR: 1.1  },
  { name: 'Cone',         make: () => new THREE.ConeGeometry(0.9, 1.8, 24, 1, true),     baseR: 0.95 }
];

const state = {
  group: null,
  time: 0,
  currentShape: 0,
  targetShape: 0,
  morphT: 1,          // 0 = morphing, 1 = settled
  cumulativeEnergy: 0,
  shapeThreshold: 2.5, // energy needed to trigger shape change
  // meshes
  solidMeshes: [],
  wireMeshes: [],
  // spirals
  spiralA: null, spiralAPos: null, spiralACol: null,
  spiralB: null, spiralBPos: null, spiralBCol: null,
  // orbit rings
  orbitRings: [], orbitPositions: [], orbitColors: [],
  // glow
  coreGlow: null,
  outerGlow: null,
  // audio
  analyser: null,
  timeData: null
};

export function init(opts = {}) {
  const pos = opts.position || [0, 3.5, -1];
  const scale = opts.scale || 1.5;

  state.group = new THREE.Group();
  state.group.position.set(pos[0], pos[1], pos[2]);
  state.group.scale.setScalar(scale);
  KI.scene.add(state.group);

  state.timeData = new Float32Array(256);
  if (KI.analyser) state.analyser = KI.analyser;
  else KI.on('audio:ready', () => { state.analyser = KI.analyser; });

  buildShapes();
  buildSpirals();
  buildOrbitRings();
  buildGlow();
  setShape(0);

  KI.register('wrapped-geo', { update, state, setShape, cycleShape, SHAPES });
  KI.emit('wrapped-geo:ready');
}

// === SHAPE MESHES ===
function buildShapes() {
  for (let i = 0; i < SHAPES.length; i++) {
    const geo = SHAPES[i].make();

    // solid inner mesh — warm color
    const solid = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0xff2222, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    }));
    solid.visible = false;
    state.group.add(solid);
    state.solidMeshes.push(solid);

    // wireframe overlay
    const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0xff6644, transparent: true, opacity: 0, wireframe: true,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    wire.visible = false;
    state.group.add(wire);
    state.wireMeshes.push(wire);
  }
}

// === RAINBOW SPIRALS ===
function buildSpiral() {
  const positions = new Float32Array(SPIRAL_POINTS * 3);
  const colors = new Float32Array(SPIRAL_POINTS * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  return { line, positions, colors };
}

function buildSpirals() {
  const a = buildSpiral();
  state.spiralA = a.line; state.spiralAPos = a.positions; state.spiralACol = a.colors;
  state.group.add(state.spiralA);

  const b = buildSpiral();
  state.spiralB = b.line; state.spiralBPos = b.positions; state.spiralBCol = b.colors;
  state.group.add(state.spiralB);
}

// === ORBIT RINGS ===
function buildOrbitRings() {
  for (let r = 0; r < ORBIT_RINGS; r++) {
    const positions = new Float32Array(ORBIT_PTS * 3);
    const colors = new Float32Array(ORBIT_PTS * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // close the loop with LineLoop
    const ring = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    state.group.add(ring);
    state.orbitRings.push(ring);
    state.orbitPositions.push(positions);
    state.orbitColors.push(colors);
  }
}

// === GLOW ===
function buildGlow() {
  // inner core glow
  state.coreGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 16, 16),
    new THREE.MeshBasicMaterial({
      color: 0xff4400, transparent: true, opacity: 0.15,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  state.group.add(state.coreGlow);

  // outer halo
  state.outerGlow = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0xff2200, transparent: true, opacity: 0.03,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    })
  );
  state.group.add(state.outerGlow);
}

// === SHAPE CONTROL ===
export function setShape(idx) {
  state.targetShape = idx % SHAPES.length;
  if (state.targetShape !== state.currentShape) {
    state.morphT = 0;
  }
  KI.emit('wrapped-geo:shape', { index: state.targetShape, name: SHAPES[state.targetShape].name });
}

export function cycleShape() { setShape(state.currentShape + 1); }

function update(dt, t) {
  state.time = t;

  // audio data
  if (state.analyser) {
    state.analyser.getFloatTimeDomainData(state.timeData);
  }

  const fb = KI.get('freq-bands-12');
  const energy = fb ? Array.from({ length: 12 }, (_, i) => fb.getEnergy(i)) : new Array(12).fill(0);
  const total = energy.reduce((a, b) => a + b, 0);

  // Accumulate energy for shape transitions
  state.cumulativeEnergy += total * dt;
  if (state.cumulativeEnergy > state.shapeThreshold && state.morphT >= 1) {
    state.cumulativeEnergy = 0;
    setShape(state.currentShape + 1);
  }

  // Morph progress
  if (state.morphT < 1) {
    state.morphT = Math.min(1, state.morphT + dt * 1.5);
    if (state.morphT >= 1) {
      state.currentShape = state.targetShape;
    }
  }

  updateShapeMeshes(t, total);
  updateSpirals(t, total, energy);
  updateOrbitRings(t, total, energy);
  updateGlow(t, total);

  // slow tumble
  state.group.rotation.y = t * 0.08;
  state.group.rotation.x = Math.sin(t * 0.06) * 0.12;

  // bob
  const baseY = state.group.userData.baseY || state.group.position.y;
  if (!state.group.userData.baseY) state.group.userData.baseY = baseY;
  state.group.position.y = baseY + Math.sin(t * 0.5) * 0.15 + total * 0.2;
}

function updateShapeMeshes(t, energy) {
  const fadeOut = state.morphT < 1 ? state.currentShape : -1;
  const fadeIn = state.targetShape;
  const mp = state.morphT;

  for (let i = 0; i < SHAPES.length; i++) {
    const solid = state.solidMeshes[i];
    const wire = state.wireMeshes[i];

    if (i === fadeIn) {
      solid.visible = true; wire.visible = true;
      const opacity = mp;
      solid.material.opacity = opacity * (0.15 + energy * 0.25);
      wire.material.opacity = opacity * (0.3 + energy * 0.4);

      // color shifts with energy
      const hue = (t * 0.03 + energy * 0.1) % 1;
      const r = 0.8 + Math.sin(t) * 0.2;
      const g = 0.15 + energy * 0.3;
      const b = 0.1 + energy * 0.15;
      solid.material.color.setRGB(Math.min(1, r), g, b);
      wire.material.color.setHSL(hue, 0.8, 0.4 + energy * 0.3);

      // pulse scale
      const pulse = 1 + Math.sin(t * 2.5) * 0.04 * (1 + energy * 3);
      solid.scale.setScalar(pulse);
      wire.scale.setScalar(pulse * 1.01);
      solid.rotation.y = t * 0.3;
      wire.rotation.y = t * 0.3;
    } else if (i === fadeOut && state.morphT < 1) {
      solid.visible = true; wire.visible = true;
      solid.material.opacity = (1 - mp) * 0.15;
      wire.material.opacity = (1 - mp) * 0.3;
      solid.rotation.y = t * 0.3;
      wire.rotation.y = t * 0.3;
    } else {
      solid.visible = false; wire.visible = false;
    }
  }
}

function updateSpirals(t, total, energy) {
  const baseR = SHAPES[state.currentShape].baseR;
  const cA = new THREE.Color(), cB = new THREE.Color();

  for (let i = 0; i < SPIRAL_POINTS; i++) {
    const u = i / (SPIRAL_POINTS - 1);

    // audio sample for displacement
    const audioIdx = Math.floor(u * 255);
    const sample = state.timeData[audioIdx] || 0;
    const displacement = sample * 0.35 * (1 + total);

    // Spiral A: north→south, clockwise
    const latA = u * Math.PI;
    const lonA = u * SPIRAL_WRAPS * Math.PI * 2 + t * 0.6;
    const rA = baseR + displacement;
    state.spiralAPos[i * 3]     = rA * Math.sin(latA) * Math.cos(lonA);
    state.spiralAPos[i * 3 + 1] = rA * Math.cos(latA);
    state.spiralAPos[i * 3 + 2] = rA * Math.sin(latA) * Math.sin(lonA);

    cA.setHSL(u, 1, 0.45 + Math.abs(sample) * 0.4 + total * 0.1);
    state.spiralACol[i * 3] = cA.r; state.spiralACol[i * 3 + 1] = cA.g; state.spiralACol[i * 3 + 2] = cA.b;

    // Spiral B: south→north, counter-clockwise, offset phase
    const latB = (1 - u) * Math.PI;
    const lonB = -u * SPIRAL_WRAPS * Math.PI * 2 + t * 0.4 + Math.PI;
    const audioIdxB = Math.floor((1 - u) * 255);
    const sampleB = state.timeData[audioIdxB] || 0;
    const rB = baseR + sampleB * 0.3 * (1 + total);
    state.spiralBPos[i * 3]     = rB * Math.sin(latB) * Math.cos(lonB);
    state.spiralBPos[i * 3 + 1] = rB * Math.cos(latB);
    state.spiralBPos[i * 3 + 2] = rB * Math.sin(latB) * Math.sin(lonB);

    cB.setHSL((u + 0.5) % 1, 1, 0.45 + Math.abs(sampleB) * 0.4 + total * 0.1);
    state.spiralBCol[i * 3] = cB.r; state.spiralBCol[i * 3 + 1] = cB.g; state.spiralBCol[i * 3 + 2] = cB.b;
  }

  state.spiralA.geometry.attributes.position.needsUpdate = true;
  state.spiralA.geometry.attributes.color.needsUpdate = true;
  state.spiralB.geometry.attributes.position.needsUpdate = true;
  state.spiralB.geometry.attributes.color.needsUpdate = true;
}

function updateOrbitRings(t, total, energy) {
  const baseR = SHAPES[state.currentShape].baseR;
  const c = new THREE.Color();

  for (let r = 0; r < ORBIT_RINGS; r++) {
    const pos = state.orbitPositions[r];
    const col = state.orbitColors[r];

    // each ring orbits at a different tilt
    const tiltX = (r / ORBIT_RINGS) * Math.PI; // spread from 0 to PI
    const tiltZ = r * 0.4;
    const ringSpeed = 0.3 + r * 0.08;
    const band = (r * 2) % 12;

    for (let i = 0; i < ORBIT_PTS; i++) {
      const u = i / ORBIT_PTS;
      const theta = u * Math.PI * 2 + t * ringSpeed;

      // audio displacement for this ring
      const audioIdx = Math.floor(u * 255);
      const sample = state.timeData[audioIdx] || 0;
      const disp = sample * 0.2 * (1 + energy[band] * 2);

      const ringR = baseR * 1.15 + disp;

      // ring in XZ plane, then tilted
      let x = ringR * Math.cos(theta);
      let y = 0;
      let z = ringR * Math.sin(theta);

      // tilt around X
      const cosT = Math.cos(tiltX), sinT = Math.sin(tiltX);
      const ny = y * cosT - z * sinT;
      const nz = y * sinT + z * cosT;
      y = ny; z = nz;

      // tilt around Z
      const cosZ = Math.cos(tiltZ), sinZ = Math.sin(tiltZ);
      const nx = x * cosZ - y * sinZ;
      const ny2 = x * sinZ + y * cosZ;
      x = nx; y = ny2;

      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;

      const hue = (r / ORBIT_RINGS + u * 0.5 + t * 0.02) % 1;
      c.setHSL(hue, 0.9, 0.35 + energy[band] * 0.5);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }

    state.orbitRings[r].geometry.attributes.position.needsUpdate = true;
    state.orbitRings[r].geometry.attributes.color.needsUpdate = true;
    state.orbitRings[r].material.opacity = 0.3 + energy[band] * 0.5;
  }
}

function updateGlow(t, energy) {
  const pulse = 1 + Math.sin(t * 2) * 0.08 * (1 + energy * 3);

  state.coreGlow.scale.setScalar(pulse * (0.6 + energy * 0.8));
  state.coreGlow.material.opacity = 0.1 + energy * 0.4;
  state.coreGlow.material.color.setHSL((t * 0.02) % 1, 0.9, 0.4 + energy * 0.3);

  state.outerGlow.scale.setScalar(1 + energy * 0.5);
  state.outerGlow.material.opacity = 0.02 + energy * 0.06;
  state.outerGlow.material.color.setHSL((t * 0.015 + 0.05) % 1, 0.7, 0.3);
}
