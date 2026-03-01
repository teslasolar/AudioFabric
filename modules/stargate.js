// stargate.js — Stargate portal visual effect
// Creates a concentric ring portal that reacts to voice/frequency energy
// 12 chevron segments (one per frequency band), inner event horizon with warp effect,
// rotating glyphs, energy tendrils connecting to the geo-folder ball

import { KI } from './core.js';

let gateGroup = null;
let rings = [];          // concentric torus rings
let chevrons = [];       // 12 chevron indicators
let eventHorizon = null; // inner swirl disc
let tendrils = [];       // energy lines to geo-folder
let glyphSprites = [];   // floating glyph particles
const RING_COUNT = 5;
const CHEVRON_COUNT = 12;
const TENDRIL_COUNT = 8;
const GLYPH_COUNT = 24;

const GLYPHS = '⟐⟑⟒⟓⟔⟕⟖⟗⌬⌭⌮⌯⍟⍣⍤⍥☉☊☋☌✦✧✨✩'.split('');

const state = {
  activation: 0,       // 0-1 how open the gate is
  spinSpeed: 0,
  chevronLit: new Array(12).fill(0),
  warpPhase: 0,
  tendrilPhase: 0,
  locked: false         // fully activated
};

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 3, -8];
  const radius = opts.radius || 4;

  gateGroup = new THREE.Group();
  gateGroup.position.set(pos[0], pos[1], pos[2]);
  scene.add(gateGroup);

  // === CONCENTRIC RINGS ===
  for (let i = 0; i < RING_COUNT; i++) {
    const r = radius - i * 0.4;
    const thickness = 0.06 + i * 0.02;
    const geo = new THREE.TorusGeometry(r, thickness, 8, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: ringColor(i),
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = Math.PI / 2; // face camera
    ring.userData = { baseRadius: r, index: i, speed: (i % 2 === 0 ? 1 : -1) * (0.3 + i * 0.1) };
    gateGroup.add(ring);
    rings.push(ring);
  }

  // === CHEVRONS (12 segments around outer ring) ===
  for (let i = 0; i < CHEVRON_COUNT; i++) {
    const angle = (i / CHEVRON_COUNT) * Math.PI * 2;
    const cr = radius + 0.3;

    // chevron body — small arrow/triangle
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.3);
    shape.lineTo(0.15, 0);
    shape.lineTo(-0.15, 0);
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x333344,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const chev = new THREE.Mesh(geo, mat);
    chev.position.set(Math.cos(angle) * cr, Math.sin(angle) * cr, 0);
    chev.rotation.z = angle - Math.PI / 2;
    chev.userData = { index: i, baseColor: new THREE.Color(0x333344) };
    gateGroup.add(chev);
    chevrons.push(chev);
  }

  // === EVENT HORIZON (inner swirling disc) ===
  const ehGeo = new THREE.CircleGeometry(radius - RING_COUNT * 0.4 - 0.3, 48);
  const ehMat = new THREE.MeshBasicMaterial({
    color: 0x112244,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  eventHorizon = new THREE.Mesh(ehGeo, ehMat);
  gateGroup.add(eventHorizon);

  // === ENERGY TENDRILS ===
  for (let i = 0; i < TENDRIL_COUNT; i++) {
    const points = [];
    for (let j = 0; j < 10; j++) {
      points.push(new THREE.Vector3(0, 0, j * 0.5));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    gateGroup.add(line);
    tendrils.push({ line, angle: (i / TENDRIL_COUNT) * Math.PI * 2 });
  }

  // === GLYPH PARTICLES ===
  const glyphCanvas = document.createElement('canvas');
  glyphCanvas.width = 64; glyphCanvas.height = 64;
  const gCtx = glyphCanvas.getContext('2d');
  gCtx.fillStyle = '#4488ff';
  gCtx.font = '48px serif';
  gCtx.textAlign = 'center';
  gCtx.textBaseline = 'middle';
  gCtx.fillText('⟐', 32, 32);
  const glyphTex = new THREE.CanvasTexture(glyphCanvas);

  for (let i = 0; i < GLYPH_COUNT; i++) {
    const mat = new THREE.SpriteMaterial({
      map: glyphTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.3, 0.3, 1);
    const angle = Math.random() * Math.PI * 2;
    const r2 = radius * (0.5 + Math.random() * 0.6);
    sprite.position.set(Math.cos(angle) * r2, Math.sin(angle) * r2, (Math.random() - 0.5) * 0.5);
    sprite.userData = { angle, radius: r2, speed: 0.1 + Math.random() * 0.3, phase: Math.random() * Math.PI * 2 };
    gateGroup.add(sprite);
    glyphSprites.push(sprite);
  }

  KI.register('stargate', {
    update, state, gateGroup,
    setActivation, isLocked: () => state.locked
  });

  KI.emit('stargate:ready');
}

function ringColor(i) {
  const colors = [0x4488ff, 0x44aaff, 0x22ccff, 0x44ddcc, 0x44ffaa];
  return colors[i % colors.length];
}

function update(dt, t) {
  const fb = KI.get('freq-bands-12');
  const fbState = fb?.state;
  const v = KI.voice;

  // drive activation from total energy
  const targetActivation = fbState
    ? Math.min(1, fbState.totalEnergy * 0.4 + (v.sounding ? 0.3 : 0))
    : (v.sounding ? 0.4 : 0);

  state.activation += (targetActivation - state.activation) * 0.05;
  state.warpPhase += dt * (1 + state.activation * 3);
  state.tendrilPhase += dt;
  state.locked = state.activation > 0.85;

  // === RINGS ===
  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    ring.rotation.z += ring.userData.speed * dt * (1 + state.activation * 2);

    // pulse ring with corresponding freq band energy
    const bandIdx = Math.floor((i / RING_COUNT) * 12);
    const bandEnergy = fbState ? fbState.energy[bandIdx] || 0 : 0;

    const pulse = 1 + bandEnergy * 0.15 + Math.sin(t * 2 + i) * 0.02;
    ring.scale.set(pulse, pulse, 1);
    ring.material.opacity = 0.15 + state.activation * 0.4 + bandEnergy * 0.3;

    // color shift based on dominant band
    if (fbState && fbState.dominant >= 0) {
      const hex = fb.BANDS[fbState.dominant].hex;
      ring.material.color.lerp(new THREE.Color(hex), 0.02);
    }
  }

  // === CHEVRONS ===
  for (let i = 0; i < CHEVRON_COUNT; i++) {
    const chev = chevrons[i];
    const bandEnergy = fbState ? fbState.energy[i] || 0 : 0;

    // light up chevron based on its frequency band
    state.chevronLit[i] += ((bandEnergy > 0.15 ? 1 : 0) - state.chevronLit[i]) * 0.1;

    const lit = state.chevronLit[i];
    if (lit > 0.1) {
      const bandColor = fbState ? fb.BANDS[i].hex : 0x4488ff;
      chev.material.color.lerp(new THREE.Color(bandColor), 0.1);
      chev.material.opacity = 0.3 + lit * 0.7;
      chev.scale.setScalar(1 + lit * 0.3);
    } else {
      chev.material.color.lerp(chev.userData.baseColor, 0.05);
      chev.material.opacity = 0.2;
      chev.scale.setScalar(1);
    }
  }

  // === EVENT HORIZON ===
  eventHorizon.material.opacity = state.activation * 0.15;
  eventHorizon.rotation.z = state.warpPhase * 0.3;

  // warp vertex distortion
  const ehPos = eventHorizon.geometry.attributes.position;
  for (let i = 0; i < ehPos.count; i++) {
    const x = ehPos.getX(i), y = ehPos.getY(i);
    const dist = Math.sqrt(x * x + y * y);
    const angle = Math.atan2(y, x);
    const warp = Math.sin(state.warpPhase * 2 + angle * 3 + dist * 4) * 0.1 * state.activation;
    ehPos.setZ(i, warp);
  }
  ehPos.needsUpdate = true;

  // color the horizon based on frequency blend
  if (fbState) {
    eventHorizon.material.color.setRGB(
      0.1 + fbState.colorBlend[0] * 0.3,
      0.1 + fbState.colorBlend[1] * 0.3,
      0.2 + fbState.colorBlend[2] * 0.4
    );
  }

  // === TENDRILS — connect gate to geo-folder ===
  const geoFolder = KI.get('geo-folder');
  const geoGroup = geoFolder?.group;

  for (let i = 0; i < TENDRIL_COUNT; i++) {
    const { line, angle } = tendrils[i];
    const active = state.activation > 0.3;
    line.visible = active;

    if (active && geoGroup) {
      const pos = line.geometry.attributes.position;
      const startR = 2.5;
      // start on gate ring
      const sx = Math.cos(angle + state.tendrilPhase * 0.5) * startR;
      const sy = Math.sin(angle + state.tendrilPhase * 0.5) * startR;

      // end at geo-folder position (relative)
      const geoWorldPos = new THREE.Vector3();
      geoGroup.getWorldPosition(geoWorldPos);
      const gateWorldPos = new THREE.Vector3();
      gateGroup.getWorldPosition(gateWorldPos);
      const diff = geoWorldPos.sub(gateWorldPos);

      for (let j = 0; j < 10; j++) {
        const frac = j / 9;
        const wobble = Math.sin(state.tendrilPhase * 3 + i * 2 + j * 0.5) * 0.3 * (1 - frac);
        pos.setXYZ(j,
          sx * (1 - frac) + diff.x * frac + wobble,
          sy * (1 - frac) + diff.y * frac + wobble * 0.5,
          frac * diff.z
        );
      }
      pos.needsUpdate = true;

      const bandIdx = (i * 1.5) | 0;
      const bandEnergy = fbState ? fbState.energy[bandIdx % 12] || 0 : 0;
      line.material.opacity = 0.1 + state.activation * 0.3 + bandEnergy * 0.3;

      if (fbState && fbState.dominant >= 0) {
        line.material.color.lerp(new THREE.Color(fb.BANDS[fbState.dominant].hex), 0.05);
      }
    }
  }

  // === GLYPHS ===
  for (let i = 0; i < glyphSprites.length; i++) {
    const sp = glyphSprites[i];
    const ud = sp.userData;
    ud.angle += ud.speed * dt * (1 + state.activation);
    sp.position.set(
      Math.cos(ud.angle) * ud.radius,
      Math.sin(ud.angle) * ud.radius,
      Math.sin(ud.phase + t * 0.5) * 0.3
    );
    sp.material.opacity = state.activation * 0.3 * (0.3 + Math.sin(t + i) * 0.3);
    sp.material.rotation = ud.angle;
  }

  KI.emit('stargate:update', {
    activation: state.activation,
    locked: state.locked,
    chevronLit: state.chevronLit
  });
}

export function setActivation(level) {
  state.activation = Math.max(0, Math.min(1, level));
}
