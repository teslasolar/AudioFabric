// storm-orb.js — Weather sphere with lightning, clouds, tornado vortex
// A central sphere containing a raging storm. Features:
// - Swirling cloud layers (concentric shells with rotation)
// - Lightning bolts that flash between cloud layers
// - Tornado vortex funnel (particle spiral)
// - Rain particle streams falling inside
// - Energy → storm intensity, lightning frequency
// - Pitch → storm color (grey → green/yellow → purple → electric blue)
// - Coherence → storm organization (organized hurricane vs chaotic tempest)
// - Vowel → storm type (thunder, hurricane, tornado, blizzard, monsoon)
// - Pulse → thunder rhythm (lightning flash sync)

import { KI } from './core.js';

const TAU = Math.PI * 2;

// ── Config ──
const CLOUD_LAYERS = 5;
const MAX_BOLTS = 16;          // lightning bolts
const BOLT_SEGMENTS = 12;
const MAX_RAIN = 400;          // rain particle drops
const VORTEX_PARTICLES = 300;  // tornado funnel particles
const MAX_FLASH = 4;           // flash sphere (whole-orb illumination)

let group = null;
let cloudShells = [], cloudMats = [];
let boltLines = [], boltMats = [];
let boltTimers = [];           // countdown per bolt
let rainSystem = null, rainPos = null, rainCol = null, rainData = [];
let vortexSystem = null, vortexPos = null, vortexCol = null, vortexData = [];
let flashMeshes = [], flashMats = [];
let stormType = 'thunder';

const STORM_PARAMS = {
  thunder:   { hue: 0.6, sat: 0.2, cloudSpeed: 0.3, boltRate: 0.8, vortexStr: 0 },
  hurricane: { hue: 0.55, sat: 0.3, cloudSpeed: 1.5, boltRate: 0.4, vortexStr: 0.5 },
  tornado:   { hue: 0.2, sat: 0.3, cloudSpeed: 0.8, boltRate: 0.3, vortexStr: 1.5 },
  blizzard:  { hue: 0.58, sat: 0.1, cloudSpeed: 1.0, boltRate: 0.1, vortexStr: 0.3 },
  monsoon:   { hue: 0.5, sat: 0.4, cloudSpeed: 0.6, boltRate: 0.6, vortexStr: 0.2 }
};

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 2.5, -3.5];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── Cloud shells ──
  const radii = [0.5, 0.7, 0.9, 1.05, 1.2];
  for (let i = 0; i < CLOUD_LAYERS; i++) {
    const geo = new THREE.SphereGeometry(radii[i], 20, 14);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x445566, transparent: true, opacity: 0.06,
      blending: THREE.AdditiveBlending, depthWrite: false,
      side: THREE.DoubleSide, wireframe: i % 2 === 0
    });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);
    cloudShells.push(mesh);
    cloudMats.push(mat);
  }

  // ── Lightning bolts ──
  for (let i = 0; i < MAX_BOLTS; i++) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(BOLT_SEGMENTS * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    group.add(line);
    boltLines.push(line);
    boltMats.push(mat);
    boltTimers.push(0);
  }

  // ── Flash spheres (illumination on bolt strike) ──
  for (let i = 0; i < MAX_FLASH; i++) {
    const fGeo = new THREE.SphereGeometry(1.3, 12, 8);
    const fMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide
    });
    const mesh = new THREE.Mesh(fGeo, fMat);
    mesh.visible = false;
    group.add(mesh);
    flashMeshes.push(mesh);
    flashMats.push(fMat);
  }

  // ── Rain particles ──
  const rGeo = new THREE.BufferGeometry();
  rainPos = new Float32Array(MAX_RAIN * 3);
  rainCol = new Float32Array(MAX_RAIN * 3);
  for (let i = 0; i < MAX_RAIN; i++) {
    const angle = Math.random() * TAU;
    const r = Math.random() * 1.0;
    rainPos[i * 3] = Math.cos(angle) * r;
    rainPos[i * 3 + 1] = 1.2 - Math.random() * 2.4;
    rainPos[i * 3 + 2] = Math.sin(angle) * r;
    rainData.push({
      angle, r, fallSpeed: 0.5 + Math.random() * 1.5,
      drift: (Math.random() - 0.5) * 0.3
    });
  }
  rGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  rGeo.setAttribute('color', new THREE.BufferAttribute(rainCol, 3));
  rainSystem = new THREE.Points(rGeo, new THREE.PointsMaterial({
    size: 0.02, vertexColors: true, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(rainSystem);

  // ── Vortex/tornado particles ──
  const vGeo = new THREE.BufferGeometry();
  vortexPos = new Float32Array(VORTEX_PARTICLES * 3);
  vortexCol = new Float32Array(VORTEX_PARTICLES * 3);
  for (let i = 0; i < VORTEX_PARTICLES; i++) {
    const f = i / VORTEX_PARTICLES;
    const y = -1 + f * 2;
    const angle = f * TAU * 5 + Math.random() * 0.5;
    const r = 0.1 + (1 - Math.abs(f - 0.5) * 2) * 0.6;
    vortexPos[i * 3] = Math.cos(angle) * r;
    vortexPos[i * 3 + 1] = y;
    vortexPos[i * 3 + 2] = Math.sin(angle) * r;
    vortexData.push({ f, angle, r, baseR: r, baseAngle: angle });
  }
  vGeo.setAttribute('position', new THREE.BufferAttribute(vortexPos, 3));
  vGeo.setAttribute('color', new THREE.BufferAttribute(vortexCol, 3));
  vortexSystem = new THREE.Points(vGeo, new THREE.PointsMaterial({
    size: 0.035, vertexColors: true, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(vortexSystem);

  KI.register('storm-orb', { update, group, getType: () => stormType });
  KI.emit('storm-orb:ready');
}

function generateBolt(startX, startY, startZ, endX, endY, endZ, jaggedness) {
  const points = [];
  for (let i = 0; i < BOLT_SEGMENTS; i++) {
    const f = i / (BOLT_SEGMENTS - 1);
    let x = startX + (endX - startX) * f;
    let y = startY + (endY - startY) * f;
    let z = startZ + (endZ - startZ) * f;
    const jag = Math.sin(f * Math.PI) * jaggedness;
    x += (Math.random() - 0.5) * jag;
    y += (Math.random() - 0.5) * jag;
    z += (Math.random() - 0.5) * jag;
    points.push(x, y, z);
  }
  return points;
}

let flashTimer = 0;

function update(dt, t) {
  const v = KI.voice;
  const energy = v.energy || 0;
  const coherence = v.coherence || 0;
  const pitch = v.pn || 0;
  const sounding = v.sounding;
  const pulseRate = v.pulseRate || 1;

  // ── Vowel → storm type ──
  if (sounding) {
    const types = { a: 'thunder', e: 'hurricane', i: 'tornado', o: 'blizzard', u: 'monsoon' };
    stormType = types[v.vowel || 'a'] || 'thunder';
  }

  const sp = STORM_PARAMS[stormType];
  const stormHue = sp.hue + pitch * 0.1;

  // ── Cloud shells rotation ──
  for (let i = 0; i < CLOUD_LAYERS; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    const speed = sp.cloudSpeed * dir * (0.5 + energy * 1.5) * (1 + i * 0.2);
    cloudShells[i].rotation.y += dt * speed;
    cloudShells[i].rotation.x += dt * speed * 0.3 * Math.sin(t * 0.5 + i);

    // Hurricane mode: flatten clouds
    if (stormType === 'hurricane') {
      cloudShells[i].scale.y = 0.6 + i * 0.05;
    } else {
      cloudShells[i].scale.y = 1;
    }

    const cHue = (stormHue + i * 0.02) % 1;
    const cBright = 0.1 + energy * 0.12;
    const rgb = hslToRgb(cHue, sp.sat + energy * 0.2, cBright);
    cloudMats[i].color.setRGB(rgb[0], rgb[1], rgb[2]);
    cloudMats[i].opacity = 0.04 + energy * 0.06;
  }

  // ── Lightning bolts ──
  const boltChance = sp.boltRate * energy * dt * 3;
  for (let i = 0; i < MAX_BOLTS; i++) {
    if (boltTimers[i] > 0) {
      boltTimers[i] -= dt;
      boltMats[i].opacity = boltTimers[i] * 4; // rapid fade
      if (boltTimers[i] <= 0) {
        boltLines[i].visible = false;
      }
    } else if (Math.random() < boltChance) {
      // New bolt
      const theta1 = Math.random() * Math.PI;
      const phi1 = Math.random() * TAU;
      const r1 = 0.3 + Math.random() * 0.3;
      const theta2 = theta1 + (Math.random() - 0.5) * 1;
      const phi2 = phi1 + (Math.random() - 0.5) * 1;
      const r2 = 0.7 + Math.random() * 0.4;

      const pts = generateBolt(
        Math.sin(theta1) * Math.cos(phi1) * r1,
        Math.cos(theta1) * r1,
        Math.sin(theta1) * Math.sin(phi1) * r1,
        Math.sin(theta2) * Math.cos(phi2) * r2,
        Math.cos(theta2) * r2,
        Math.sin(theta2) * Math.sin(phi2) * r2,
        0.15 + (1 - coherence) * 0.2
      );
      const positions = boltLines[i].geometry.attributes.position.array;
      for (let j = 0; j < BOLT_SEGMENTS * 3; j++) positions[j] = pts[j];
      boltLines[i].geometry.attributes.position.needsUpdate = true;
      boltLines[i].visible = true;
      boltTimers[i] = 0.15 + Math.random() * 0.1;

      const bHue = (stormHue + 0.1 + pitch * 0.1) % 1;
      const brgb = hslToRgb(bHue, 0.3, 0.7 + energy * 0.3);
      boltMats[i].color.setRGB(brgb[0], brgb[1], brgb[2]);
      boltMats[i].opacity = 1;

      // Trigger flash
      for (let f = 0; f < MAX_FLASH; f++) {
        if (!flashMeshes[f].visible) {
          flashMeshes[f].visible = true;
          flashMats[f].opacity = 0.15 + energy * 0.1;
          flashTimer = 0.1;
          break;
        }
      }
    }
  }

  // Flash fade
  if (flashTimer > 0) {
    flashTimer -= dt;
    for (let f = 0; f < MAX_FLASH; f++) {
      if (flashMeshes[f].visible) {
        flashMats[f].opacity *= 0.85;
        if (flashMats[f].opacity < 0.01) flashMeshes[f].visible = false;
      }
    }
  }

  // ── Rain particles ──
  for (let i = 0; i < MAX_RAIN; i++) {
    const rd = rainData[i];
    const y = rainPos[i * 3 + 1] - dt * rd.fallSpeed * (0.5 + energy * 1.5);
    if (y < -1.2) {
      rainPos[i * 3 + 1] = 1.2;
      rd.angle = Math.random() * TAU;
      rd.r = Math.random() * 1.0;
    } else {
      rainPos[i * 3 + 1] = y;
    }
    // Wind drift
    rd.angle += dt * rd.drift * energy;
    rainPos[i * 3] = Math.cos(rd.angle) * rd.r;
    rainPos[i * 3 + 2] = Math.sin(rd.angle) * rd.r;

    const rBright = 0.08 + energy * 0.1;
    const isBlizzard = stormType === 'blizzard';
    const rrgb = isBlizzard
      ? [rBright * 1.5, rBright * 1.5, rBright * 1.6]
      : hslToRgb(stormHue, 0.15, rBright);
    rainCol[i * 3] = rrgb[0]; rainCol[i * 3 + 1] = rrgb[1]; rainCol[i * 3 + 2] = rrgb[2];
  }
  rainSystem.geometry.attributes.position.needsUpdate = true;
  rainSystem.geometry.attributes.color.needsUpdate = true;
  rainSystem.material.size = stormType === 'blizzard' ? 0.035 : 0.02;

  // ── Vortex/tornado ──
  const vStr = sp.vortexStr * energy;
  for (let i = 0; i < VORTEX_PARTICLES; i++) {
    const vd = vortexData[i];
    vd.angle += dt * (2 + vStr * 5) * (1 + vd.f * 2);
    // Funnel shape: narrow at bottom, wide at top
    const funnel = 0.05 + vd.f * 0.5 * (0.5 + vStr);
    const wobble = Math.sin(t * 3 + vd.f * 10) * 0.05 * (1 - coherence);

    vortexPos[i * 3] = Math.cos(vd.angle) * (funnel + wobble);
    vortexPos[i * 3 + 1] = -1 + vd.f * 2;
    vortexPos[i * 3 + 2] = Math.sin(vd.angle) * (funnel + wobble);

    const vBright = vStr * 0.15 * (1 - vd.f * 0.5);
    const vrgb = hslToRgb(stormHue, sp.sat, vBright);
    vortexCol[i * 3] = vrgb[0]; vortexCol[i * 3 + 1] = vrgb[1]; vortexCol[i * 3 + 2] = vrgb[2];
  }
  vortexSystem.geometry.attributes.position.needsUpdate = true;
  vortexSystem.geometry.attributes.color.needsUpdate = true;
  vortexSystem.visible = vStr > 0.05;

  group.rotation.y += dt * 0.02;

  // Count active bolts
  let activeBolts = 0;
  for (let i = 0; i < MAX_BOLTS; i++) if (boltTimers[i] > 0) activeBolts++;

  KI.emit('storm-orb:update', {
    stormType,
    activeBolts,
    windSpeed: Math.round(sp.cloudSpeed * energy * 100),
    vortexStrength: Math.round(vStr * 100),
    intensity: Math.round(energy * 100)
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
