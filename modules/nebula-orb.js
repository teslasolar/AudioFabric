// nebula-orb.js — Gaseous nebula sphere with swirling volumetric layers
// A central sphere that looks like a miniature gas giant / nebula.
// Features:
// - Multiple concentric translucent shells with different rotation speeds
// - Particle clouds that swirl in opposing vortex bands
// - Energy → cloud density and brightness
// - Pitch → dominant nebula color (red/orange/teal/blue/purple)
// - Coherence → band definition (crisp bands vs diffuse chaos)
// - Vowel → nebula type (spiral, banded, storm, ring, emission)
// - Pulse → rotation throb
// - Star seeds embedded in the gas that twinkle

import { KI } from './core.js';

const TAU = Math.PI * 2;

// ── Config ──
const SHELL_COUNT = 5;       // concentric shells
const MAX_CLOUD = 600;       // cloud particles
const MAX_STARS = 200;       // embedded star-seeds
const MAX_WISPS = 16;        // wisp trails (line segments)
const WISP_SEGMENTS = 24;

let group = null;
let shells = [];          // { mesh, mat, speed, axis }
let cloudSystem = null, cloudPos = null, cloudCol = null;
let starSystem = null, starPos = null, starCol = null;
let wispLines = [], wispMats = [];
let nebulaType = 'spiral';
let cloudData = [];       // per-particle velocity/orbit data
let starData = [];        // per-star twinkle data

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 2.5, -3.5];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── Concentric shells (translucent spheres at different sizes) ──
  const shellRadii = [0.4, 0.65, 0.9, 1.1, 1.3];
  const shellOpacities = [0.15, 0.1, 0.08, 0.06, 0.04];
  for (let i = 0; i < SHELL_COUNT; i++) {
    const geo = new THREE.SphereGeometry(shellRadii[i], 24, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff4400, transparent: true, opacity: shellOpacities[i],
      blending: THREE.AdditiveBlending, depthWrite: false,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    // Each shell rotates on a slightly different axis
    const axis = new THREE.Vector3(
      Math.sin(i * 1.2) * 0.3,
      1,
      Math.cos(i * 1.2) * 0.3
    ).normalize();
    shells.push({ mesh, mat, speed: (i % 2 === 0 ? 1 : -1) * (0.2 + i * 0.08), axis });
    group.add(mesh);
  }

  // ── Cloud particles ──
  const cGeo = new THREE.BufferGeometry();
  cloudPos = new Float32Array(MAX_CLOUD * 3);
  cloudCol = new Float32Array(MAX_CLOUD * 3);
  for (let i = 0; i < MAX_CLOUD; i++) {
    const theta = Math.acos(2 * Math.random() - 1);
    const phi = TAU * Math.random();
    const r = 0.3 + Math.random() * 1.1;
    cloudPos[i * 3] = Math.sin(theta) * Math.cos(phi) * r;
    cloudPos[i * 3 + 1] = Math.cos(theta) * r;
    cloudPos[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * r;
    cloudData.push({
      r, theta, phi,
      band: Math.floor(Math.random() * 5),  // which latitude band
      orbitSpeed: (Math.random() - 0.5) * 2,
      drift: (Math.random() - 0.5) * 0.1
    });
  }
  cGeo.setAttribute('position', new THREE.BufferAttribute(cloudPos, 3));
  cGeo.setAttribute('color', new THREE.BufferAttribute(cloudCol, 3));
  cloudSystem = new THREE.Points(cGeo, new THREE.PointsMaterial({
    size: 0.05, vertexColors: true, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(cloudSystem);

  // ── Embedded star-seeds ──
  const sGeo = new THREE.BufferGeometry();
  starPos = new Float32Array(MAX_STARS * 3);
  starCol = new Float32Array(MAX_STARS * 3);
  for (let i = 0; i < MAX_STARS; i++) {
    const theta = Math.acos(2 * Math.random() - 1);
    const phi = TAU * Math.random();
    const r = 0.2 + Math.random() * 1.2;
    starPos[i * 3] = Math.sin(theta) * Math.cos(phi) * r;
    starPos[i * 3 + 1] = Math.cos(theta) * r;
    starPos[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * r;
    starData.push({ theta, phi, r, twinklePhase: Math.random() * TAU, twinkleSpeed: 2 + Math.random() * 5 });
  }
  sGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  sGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
  starSystem = new THREE.Points(sGeo, new THREE.PointsMaterial({
    size: 0.03, vertexColors: true, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(starSystem);

  // ── Wisp trails (curving gas filaments) ──
  for (let i = 0; i < MAX_WISPS; i++) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(WISP_SEGMENTS * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xff8844, transparent: true, opacity: 0.15,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const line = new THREE.Line(geo, mat);
    group.add(line);
    wispLines.push(line);
    wispMats.push(mat);
  }

  KI.register('nebula-orb', { update, group, getType: () => nebulaType });
  KI.emit('nebula-orb:ready');
}

// ── Nebula color palettes ──
const PALETTES = {
  spiral:   [0.05, 0.08, 0.02, 0.6, 0.55],  // warm reds/oranges
  banded:   [0.55, 0.6, 0.5, 0.45, 0.65],    // cool teals/blues
  storm:    [0.75, 0.8, 0.7, 0.85, 0.65],     // purples/violets
  ring:     [0.1, 0.15, 0.08, 0.12, 0.2],     // golden/amber
  emission: [0.0, 0.95, 0.33, 0.55, 0.12]     // mixed neon
};

function update(dt, t) {
  const v = KI.voice;
  const energy = v.energy || 0;
  const coherence = v.coherence || 0;
  const pitch = v.pn || 0;
  const sounding = v.sounding;
  const pulseRate = v.pulseRate || 1;

  // ── Vowel → nebula type ──
  if (sounding) {
    const types = { a: 'spiral', e: 'banded', i: 'storm', o: 'ring', u: 'emission' };
    nebulaType = types[v.vowel || 'a'] || 'spiral';
  }

  const palette = PALETTES[nebulaType] || PALETTES.spiral;
  const baseHue = palette[0] + pitch * 0.1;

  // ── Rotate shells ──
  for (let i = 0; i < SHELL_COUNT; i++) {
    const sh = shells[i];
    const speed = sh.speed * (0.5 + energy * 1.5) * (1 + Math.sin(t * pulseRate) * 0.2);
    sh.mesh.rotateOnAxis(sh.axis, dt * speed);
    // Shell color
    const hue = (palette[i] + pitch * 0.1) % 1;
    const rgb = hslToRgb(hue, 0.6 + energy * 0.2, 0.2 + energy * 0.2);
    sh.mat.color.setRGB(rgb[0], rgb[1], rgb[2]);
    sh.mat.opacity = (0.04 + i * 0.02) + energy * 0.08;
  }

  // ── Update cloud particles ──
  const bandDef = coherence; // high coherence = crisp bands
  for (let i = 0; i < MAX_CLOUD; i++) {
    const cd = cloudData[i];
    // Orbit
    cd.phi += dt * cd.orbitSpeed * (0.3 + energy * 1.5);
    // Band behavior
    let targetTheta;
    if (nebulaType === 'banded') {
      targetTheta = (cd.band / 5) * Math.PI;
      cd.theta += (targetTheta - cd.theta) * bandDef * dt * 2;
    } else if (nebulaType === 'spiral') {
      cd.theta += dt * 0.05 * Math.sin(cd.phi * 2);
    } else if (nebulaType === 'storm') {
      cd.theta += dt * (Math.random() - 0.5) * (1 - coherence) * 2;
    }
    // Drift in/out
    cd.r += cd.drift * dt;
    if (cd.r < 0.2) cd.drift = Math.abs(cd.drift);
    if (cd.r > 1.4) cd.drift = -Math.abs(cd.drift);

    cloudPos[i * 3] = Math.sin(cd.theta) * Math.cos(cd.phi) * cd.r;
    cloudPos[i * 3 + 1] = Math.cos(cd.theta) * cd.r;
    cloudPos[i * 3 + 2] = Math.sin(cd.theta) * Math.sin(cd.phi) * cd.r;

    const hue = (palette[cd.band] + pitch * 0.1 + cd.phi * 0.02) % 1;
    const bright = 0.1 + energy * 0.3;
    const rgb = hslToRgb(hue, 0.5 + energy * 0.3, bright);
    cloudCol[i * 3] = rgb[0]; cloudCol[i * 3 + 1] = rgb[1]; cloudCol[i * 3 + 2] = rgb[2];
  }
  cloudSystem.geometry.attributes.position.needsUpdate = true;
  cloudSystem.geometry.attributes.color.needsUpdate = true;
  cloudSystem.material.opacity = 0.3 + energy * 0.4;

  // ── Update star-seeds (twinkle) ──
  for (let i = 0; i < MAX_STARS; i++) {
    const sd = starData[i];
    sd.phi += dt * 0.1;
    starPos[i * 3] = Math.sin(sd.theta) * Math.cos(sd.phi) * sd.r;
    starPos[i * 3 + 1] = Math.cos(sd.theta) * sd.r;
    starPos[i * 3 + 2] = Math.sin(sd.theta) * Math.sin(sd.phi) * sd.r;

    const twinkle = Math.sin(t * sd.twinkleSpeed + sd.twinklePhase) * 0.5 + 0.5;
    const bright = twinkle * (0.2 + energy * 0.6);
    starCol[i * 3] = bright; starCol[i * 3 + 1] = bright * 0.95; starCol[i * 3 + 2] = bright * 0.8;
  }
  starSystem.geometry.attributes.position.needsUpdate = true;
  starSystem.geometry.attributes.color.needsUpdate = true;

  // ── Update wisps ──
  for (let w = 0; w < MAX_WISPS; w++) {
    const positions = wispLines[w].geometry.attributes.position.array;
    const baseAngle = (w / MAX_WISPS) * TAU + t * 0.2;
    const baseR = 0.5 + (w % 3) * 0.3;
    const yOff = Math.sin(w * 2.3) * 0.6;

    for (let s = 0; s < WISP_SEGMENTS; s++) {
      const f = s / (WISP_SEGMENTS - 1);
      const angle = baseAngle + f * 1.5 + Math.sin(t + w) * 0.3;
      const r = baseR + f * 0.4 + Math.sin(t * 0.5 + w + f * 3) * 0.15;
      positions[s * 3] = Math.cos(angle) * r;
      positions[s * 3 + 1] = yOff + Math.sin(f * Math.PI + t * 0.3) * 0.3;
      positions[s * 3 + 2] = Math.sin(angle) * r;
    }
    wispLines[w].geometry.attributes.position.needsUpdate = true;

    const wHue = (palette[w % 5] + pitch * 0.1) % 1;
    const wrgb = hslToRgb(wHue, 0.5, 0.3 + energy * 0.2);
    wispMats[w].color.setRGB(wrgb[0], wrgb[1], wrgb[2]);
    wispMats[w].opacity = 0.05 + energy * 0.15;
  }

  group.rotation.y += dt * 0.04;

  KI.emit('nebula-orb:update', {
    nebulaType,
    shellCount: SHELL_COUNT,
    cloudDensity: Math.round(energy * 100),
    starCount: MAX_STARS,
    wispCount: MAX_WISPS
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
