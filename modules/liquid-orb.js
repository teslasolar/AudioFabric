// liquid-orb.js — Deformable fluid sphere with voice-driven surface waves
// A floating ball of liquid that ripples, stretches, and morphs from voice.
// Features:
// - Sphere mesh with per-vertex displacement (spherical harmonics)
// - Energy → wave amplitude (surface ripple height)
// - Pitch → dominant wave mode (low=slow bulge, high=fine ripples)
// - Coherence → surface tension (smooth vs chaotic)
// - Vowel → liquid type (water/mercury/lava/plasma/oil)
// - Pulse → internal glow throb
// - Drip particles fall from the orb when energy spikes
// - Reflection ring on "ground" below orb
// - Internal caustic light patterns visible through translucent surface

import { KI } from './core.js';

const TAU = Math.PI * 2;

// ── Liquid types with visual properties ──
const LIQUID_TYPES = {
  water:   { hue: 0.55, sat: 0.6, baseOpacity: 0.25, specular: 0.8, viscosity: 0.3 },
  mercury: { hue: 0.0,  sat: 0.0, baseOpacity: 0.6,  specular: 1.0, viscosity: 0.1 },
  lava:    { hue: 0.05, sat: 0.9, baseOpacity: 0.5,  specular: 0.3, viscosity: 0.7 },
  plasma:  { hue: 0.75, sat: 0.8, baseOpacity: 0.2,  specular: 0.5, viscosity: 0.05 },
  oil:     { hue: 0.85, sat: 0.4, baseOpacity: 0.4,  specular: 0.6, viscosity: 0.5 }
};
const LIQUID_NAMES = Object.keys(LIQUID_TYPES);

// ── State ──
let liquidType = 'water';
let wavePhase = 0;
let baseRadius = 1.2;
let prevEnergy = 0;

// ── Spherical harmonic wave state ──
// Store multiple wave modes that combine
const MAX_MODES = 8;
const waveModes = [];
for (let i = 0; i < MAX_MODES; i++) {
  waveModes.push({ l: i + 1, m: i, amp: 0, phase: Math.random() * TAU, freq: 0.5 + i * 0.3 });
}

// ── 3D ──
let group = null;
let orbMesh = null;
let orbWire = null;
let innerGlow = null;
let reflectionRing = null;
let causticMesh = null;

// Drip particles
let dripSystem = null, dripPos = null, dripCol = null, dripVel = null;
const MAX_DRIPS = 200;

// Surface highlight particles
let surfSystem = null, surfPos = null, surfCol = null;
const MAX_SURF = 400;

// Original sphere vertex positions
let origPositions = null;

const SPHERE_DETAIL = 48;

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 3, -3];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── Main orb mesh (high-detail sphere) ──
  const orbGeo = new THREE.SphereGeometry(baseRadius, SPHERE_DETAIL, SPHERE_DETAIL);
  origPositions = new Float32Array(orbGeo.attributes.position.array);
  orbMesh = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({
    color: 0x2288cc, transparent: true, opacity: 0.25,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  }));
  group.add(orbMesh);

  // ── Wireframe overlay (shows deformation clearly) ──
  const wireGeo = new THREE.SphereGeometry(baseRadius, 24, 16);
  orbWire = new THREE.Mesh(wireGeo, new THREE.MeshBasicMaterial({
    color: 0x44aaff, transparent: true, opacity: 0.08, wireframe: true,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(orbWire);

  // ── Inner glow (smaller sphere inside, pulsing) ──
  const glowGeo = new THREE.SphereGeometry(baseRadius * 0.6, 16, 12);
  innerGlow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.1,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(innerGlow);

  // ── Caustic light mesh (flat disc below showing projected patterns) ──
  const causGeo = new THREE.PlaneGeometry(4, 4, 32, 32);
  causticMesh = new THREE.Mesh(causGeo, new THREE.MeshBasicMaterial({
    color: 0x44aaff, transparent: true, opacity: 0.05, wireframe: true,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  }));
  causticMesh.rotation.x = -Math.PI / 2;
  causticMesh.position.y = -2.5;
  group.add(causticMesh);

  // ── Reflection ring ──
  const refGeo = new THREE.RingGeometry(0.8, 1.8, 64);
  reflectionRing = new THREE.Mesh(refGeo, new THREE.MeshBasicMaterial({
    color: 0x2288cc, transparent: true, opacity: 0.04,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  }));
  reflectionRing.rotation.x = -Math.PI / 2;
  reflectionRing.position.y = -2.5;
  group.add(reflectionRing);

  // ── Drip particles ──
  const dGeo = new THREE.BufferGeometry();
  dripPos = new Float32Array(MAX_DRIPS * 3);
  dripCol = new Float32Array(MAX_DRIPS * 3);
  dripVel = new Float32Array(MAX_DRIPS * 3);
  dGeo.setAttribute('position', new THREE.BufferAttribute(dripPos, 3));
  dGeo.setAttribute('color', new THREE.BufferAttribute(dripCol, 3));
  dripSystem = new THREE.Points(dGeo, new THREE.PointsMaterial({
    size: 0.06, vertexColors: true, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(dripSystem);

  // ── Surface highlight particles ──
  const sGeo = new THREE.BufferGeometry();
  surfPos = new Float32Array(MAX_SURF * 3);
  surfCol = new Float32Array(MAX_SURF * 3);
  sGeo.setAttribute('position', new THREE.BufferAttribute(surfPos, 3));
  sGeo.setAttribute('color', new THREE.BufferAttribute(surfCol, 3));
  surfSystem = new THREE.Points(sGeo, new THREE.PointsMaterial({
    size: 0.04, vertexColors: true, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(surfSystem);

  KI.register('liquid-orb', {
    update, group,
    getLiquidType: () => liquidType,
    setLiquidType: (t) => { if (LIQUID_TYPES[t]) liquidType = t; },
    getRadius: () => baseRadius
  });

  KI.emit('liquid-orb:ready');
}

// ── Spherical harmonic Y_l^m approximation ──
function sphericalHarmonic(theta, phi, l, m) {
  // Simplified: use sin/cos combinations for visual effect
  return Math.cos(l * theta) * Math.cos(m * phi) +
         Math.sin((l + 1) * theta) * Math.sin((m + 1) * phi) * 0.5;
}

function update(dt, t) {
  const v = KI.voice;
  const energy = v.energy || 0;
  const coherence = v.coherence || 0;
  const pitch = v.pn || 0;
  const sounding = v.sounding;
  const pulseRate = v.pulseRate || 1;

  // ── Vowel → liquid type ──
  if (sounding) {
    const vowelLiquid = { a: 'water', e: 'mercury', i: 'plasma', o: 'lava', u: 'oil' };
    liquidType = vowelLiquid[v.vowel || 'a'] || 'water';
  }
  const liq = LIQUID_TYPES[liquidType];

  wavePhase += dt * (1 + energy * 3);

  // ── Update wave mode amplitudes from voice ──
  for (let i = 0; i < MAX_MODES; i++) {
    const mode = waveModes[i];
    // Lower modes from energy, higher modes from pitch
    const targetAmp = i < 3
      ? energy * 0.3 * (1 - i * 0.2)
      : pitch * energy * 0.15 * Math.exp(-Math.abs(i - pitch * MAX_MODES) * 0.3);
    // Coherence → damping (high coherence = smooth, low = chaotic)
    const damping = 0.5 + coherence * 2;
    mode.amp += (targetAmp - mode.amp) * dt * damping;
    mode.phase += dt * mode.freq * (1 + energy);
  }

  // ── Deform sphere vertices ──
  const positions = orbMesh.geometry.attributes.position.array;
  const vertCount = positions.length / 3;
  const viscosity = liq.viscosity;

  for (let i = 0; i < vertCount; i++) {
    const ox = origPositions[i * 3];
    const oy = origPositions[i * 3 + 1];
    const oz = origPositions[i * 3 + 2];

    // Convert to spherical coordinates
    const r = Math.sqrt(ox * ox + oy * oy + oz * oz) || 0.01;
    const theta = Math.acos(oy / r);
    const phi = Math.atan2(oz, ox);

    // Sum spherical harmonic displacements
    let displacement = 0;
    for (const mode of waveModes) {
      displacement += mode.amp * sphericalHarmonic(theta + mode.phase, phi + mode.phase * 0.7, mode.l, mode.m);
    }

    // Viscosity dampens rapid changes
    displacement *= (1 - viscosity * 0.5);

    // Breathing base
    const breath = Math.sin(t * pulseRate * 1.5) * 0.03;

    const newR = baseRadius + displacement + breath;
    const scale = newR / r;
    positions[i * 3] = ox * scale;
    positions[i * 3 + 1] = oy * scale;
    positions[i * 3 + 2] = oz * scale;
  }
  orbMesh.geometry.attributes.position.needsUpdate = true;
  orbMesh.geometry.computeVertexNormals();

  // ── Orb color ──
  const rgb = hslToRgb(liq.hue, liq.sat, 0.3 + energy * 0.2);
  orbMesh.material.color.setRGB(rgb[0], rgb[1], rgb[2]);
  orbMesh.material.opacity = liq.baseOpacity + energy * 0.15;

  // ── Wireframe follows deformation (approximate with scale) ──
  orbWire.scale.setScalar(1 + energy * 0.1);
  const wrgb = hslToRgb((liq.hue + 0.1) % 1, liq.sat * 0.8, 0.3 + energy * 0.2);
  orbWire.material.color.setRGB(wrgb[0], wrgb[1], wrgb[2]);
  orbWire.material.opacity = 0.04 + energy * 0.08;

  // ── Inner glow ──
  const glowPulse = 0.5 + Math.sin(t * pulseRate * 3) * 0.3;
  innerGlow.material.opacity = (0.05 + energy * 0.15 + coherence * 0.1) * glowPulse;
  const grgb = hslToRgb(liq.hue, 0.3, 0.5 + energy * 0.3);
  innerGlow.material.color.setRGB(grgb[0], grgb[1], grgb[2]);
  innerGlow.scale.setScalar(0.5 + energy * 0.15 + glowPulse * 0.05);

  // ── Caustic patterns on ground plane ──
  const causPos = causticMesh.geometry.attributes.position.array;
  for (let i = 0; i < causPos.length; i += 3) {
    const cx = causPos[i], cz = causPos[i + 2];
    causPos[i + 1] = Math.sin(cx * 3 + t * 2) * Math.cos(cz * 3 + t * 1.5) * energy * 0.1;
  }
  causticMesh.geometry.attributes.position.needsUpdate = true;
  causticMesh.material.opacity = 0.02 + energy * 0.06;
  causticMesh.material.color.setRGB(rgb[0], rgb[1], rgb[2]);

  // ── Reflection ring ──
  reflectionRing.material.opacity = 0.02 + energy * 0.06;
  reflectionRing.scale.setScalar(1 + energy * 0.3);
  reflectionRing.material.color.setRGB(rgb[0] * 0.5, rgb[1] * 0.5, rgb[2] * 0.5);

  // ── Drip particles (spawn when energy spikes) ──
  const energyDelta = energy - prevEnergy;
  prevEnergy = energy;

  for (let i = 0; i < MAX_DRIPS; i++) {
    // Update existing drips
    dripPos[i * 3] += dripVel[i * 3] * dt;
    dripPos[i * 3 + 1] += dripVel[i * 3 + 1] * dt;
    dripPos[i * 3 + 2] += dripVel[i * 3 + 2] * dt;
    dripVel[i * 3 + 1] -= 3 * dt; // gravity

    // Fade
    dripCol[i * 3] *= 0.98;
    dripCol[i * 3 + 1] *= 0.98;
    dripCol[i * 3 + 2] *= 0.98;

    // Respawn dead drips on energy spike
    if (energyDelta > 0.05 && dripCol[i * 3] + dripCol[i * 3 + 1] + dripCol[i * 3 + 2] < 0.05) {
      const angle = Math.random() * TAU;
      const elev = (Math.random() - 0.5) * Math.PI;
      const sr = baseRadius + 0.1;
      dripPos[i * 3] = Math.cos(angle) * Math.cos(elev) * sr;
      dripPos[i * 3 + 1] = Math.sin(elev) * sr;
      dripPos[i * 3 + 2] = Math.sin(angle) * Math.cos(elev) * sr;
      const speed = energyDelta * 3;
      dripVel[i * 3] = Math.cos(angle) * speed + (Math.random() - 0.5) * 0.5;
      dripVel[i * 3 + 1] = Math.sin(elev) * speed + Math.random() * 1;
      dripVel[i * 3 + 2] = Math.sin(angle) * speed + (Math.random() - 0.5) * 0.5;
      dripCol[i * 3] = rgb[0];
      dripCol[i * 3 + 1] = rgb[1];
      dripCol[i * 3 + 2] = rgb[2];
      if (--energyDelta <= 0) break; // limit spawns per frame
    }
  }
  dripSystem.geometry.attributes.position.needsUpdate = true;
  dripSystem.geometry.attributes.color.needsUpdate = true;

  // ── Surface highlight particles (shimmer along surface) ──
  for (let i = 0; i < MAX_SURF; i++) {
    const theta = (i / MAX_SURF) * Math.PI + t * 0.1;
    const phi = i * 2.399 + t * 0.05; // golden angle
    const sr = baseRadius + Math.sin(theta * 3 + t) * energy * 0.2;
    const tx = Math.sin(theta) * Math.cos(phi) * sr;
    const ty = Math.cos(theta) * sr;
    const tz = Math.sin(theta) * Math.sin(phi) * sr;
    surfPos[i * 3] += (tx - surfPos[i * 3]) * dt * 4;
    surfPos[i * 3 + 1] += (ty - surfPos[i * 3 + 1]) * dt * 4;
    surfPos[i * 3 + 2] += (tz - surfPos[i * 3 + 2]) * dt * 4;

    const specBright = liq.specular * energy * (0.5 + Math.sin(i * 0.1 + t * 3) * 0.5);
    const srgb = hslToRgb((liq.hue + 0.1) % 1, 0.5, specBright * 0.5);
    surfCol[i * 3] = srgb[0]; surfCol[i * 3 + 1] = srgb[1]; surfCol[i * 3 + 2] = srgb[2];
  }
  surfSystem.geometry.attributes.position.needsUpdate = true;
  surfSystem.geometry.attributes.color.needsUpdate = true;

  // ── Group rotation ──
  group.rotation.y += dt * 0.06;

  KI.emit('liquid-orb:update', {
    liquidType,
    waveAmplitude: waveModes.reduce((s, m) => s + Math.abs(m.amp), 0).toFixed(3),
    activeModes: waveModes.filter(m => Math.abs(m.amp) > 0.01).length,
    radius: baseRadius.toFixed(2)
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
