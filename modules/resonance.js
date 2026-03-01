// resonance.js — Layered depth phoneme system
// Instead of filling bars, sustained vowels DEEPEN through layers
// Each layer = deeper tone + harmonic + damage multiplier
//
// Layer 0: just noise (< 0.3s sustain)
// Layer 1: 1x — surface resonance (0.3s)
// Layer 2: 2x — harmonic lock (0.8s)
// Layer 3: 4x — deep resonance (1.5s)
// Layer 4: 8x — overtone cascade (2.5s)
// Layer 5: 16x — SINGULARITY (4s+)

import { KI } from './core.js';

export const LAYERS = [
  { name: 'Surface',    threshold: 0.3,  mult: 1,  color: 0x4488ff, ringRadius: 1.0, octaveShift: 0 },
  { name: 'Harmonic',   threshold: 0.8,  mult: 2,  color: 0x44ffaa, ringRadius: 1.5, octaveShift: -1 },
  { name: 'Deep',       threshold: 1.5,  mult: 4,  color: 0xffaa00, ringRadius: 2.0, octaveShift: -2 },
  { name: 'Overtone',   threshold: 2.5,  mult: 8,  color: 0xff4444, ringRadius: 2.5, octaveShift: -3 },
  { name: 'SINGULARITY',threshold: 4.0,  mult: 16, color: 0xff00ff, ringRadius: 3.2, octaveShift: -4 }
];

const state = {
  currentVowel: '',
  sustainTime: 0,        // how long current vowel held
  activeLayer: -1,       // -1 = no resonance, 0-4 = layer index
  peakLayer: -1,         // highest layer reached this sustain
  layerProgress: 0,      // 0-1 progress toward next layer
  totalLayers: 0,        // lifetime layer accumulation for scoring
  coherenceBonus: 0,     // bonus for pitch stability during sustain
  pitchDriftAccum: 0,    // tracks how much pitch wandered
  vowelLockTime: 0,      // time vowel has been same identity
  releasing: false,      // true during release window after sound stops
  releaseTimer: 0,       // grace period before blast fires
  resonanceScore: 0,     // points from resonance depth this session
  rings: [],             // visual ring meshes
  ringGroup: null,
  depthLabel: null,
  layerFlashTimer: 0
};

export function init() {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => initVisuals()); }
  else initVisuals();

  KI.register('resonance', { update, state, LAYERS, getMultiplier, getActiveLayer });
  KI.emit('resonance:ready');
}

function initVisuals() {
  const scene = KI.scene;
  state.ringGroup = new THREE.Group();
  const auraPos = KI._scene?.aura?.position || new THREE.Vector3(0, 2.5, 5);
  state.ringGroup.position.copy(auraPos);
  scene.add(state.ringGroup);

  // create concentric ring meshes (one per layer, all start invisible)
  LAYERS.forEach((layer, i) => {
    const geo = new THREE.TorusGeometry(layer.ringRadius, 0.04 + i * 0.01, 12, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: layer.color, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = Math.PI / 2;
    state.ringGroup.add(ring);
    state.rings.push(ring);

    // inner glow sphere for each layer
    const sg = new THREE.SphereGeometry(layer.ringRadius * 0.6, 16, 16);
    const sm = new THREE.MeshBasicMaterial({
      color: layer.color, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    const sphere = new THREE.Mesh(sg, sm);
    ring.userData.glowSphere = sphere;
    state.ringGroup.add(sphere);
  });
}

function update(dt, t) {
  const v = KI.voice;
  const auraPos = KI._scene?.aura?.position;
  if (auraPos) state.ringGroup.position.copy(auraPos);

  if (v.sounding && v.vowel) {
    // same vowel continuing?
    if (v.vowel === state.currentVowel) {
      state.sustainTime += dt;
      state.vowelLockTime += dt;

      // track pitch stability — less drift = higher coherence bonus
      state.pitchDriftAccum += Math.abs(v.pDelta) * dt;
      const stability = Math.max(0, 1 - state.pitchDriftAccum / (state.sustainTime * 50 + 1));
      state.coherenceBonus += (stability - state.coherenceBonus) * 0.05;
    } else {
      // vowel changed — partial reset (keep some sustain if quick switch)
      state.sustainTime *= 0.3;
      state.vowelLockTime = 0;
      state.pitchDriftAccum *= 0.5;
      state.currentVowel = v.vowel;
    }
    state.releasing = false;

    // compute active layer
    let newLayer = -1;
    for (let i = LAYERS.length - 1; i >= 0; i--) {
      if (state.sustainTime >= LAYERS[i].threshold) { newLayer = i; break; }
    }

    // layer progress toward next
    if (newLayer < LAYERS.length - 1) {
      const nextThreshold = LAYERS[newLayer + 1]?.threshold || 999;
      const prevThreshold = newLayer >= 0 ? LAYERS[newLayer].threshold : 0;
      state.layerProgress = (state.sustainTime - prevThreshold) / (nextThreshold - prevThreshold);
    } else {
      state.layerProgress = 1;
    }

    // layer-up event
    if (newLayer > state.activeLayer) {
      state.activeLayer = newLayer;
      state.peakLayer = Math.max(state.peakLayer, newLayer);
      state.totalLayers++;
      state.layerFlashTimer = 0.4;
      KI.emit('resonance:layerUp', {
        layer: newLayer,
        layerData: LAYERS[newLayer],
        vowel: v.vowel,
        sustainTime: state.sustainTime,
        multiplier: getMultiplier()
      });
    } else {
      state.activeLayer = newLayer;
    }

    // points trickle for sustained resonance
    if (state.activeLayer >= 0) {
      const trickle = (state.activeLayer + 1) * 2 * (1 + state.coherenceBonus) * dt;
      state.resonanceScore += trickle;
      KI.player.score += Math.round(trickle);
    }

  } else {
    // sound stopped
    if (state.sustainTime > 0 && state.activeLayer >= 0 && !state.releasing) {
      state.releasing = true;
      state.releaseTimer = 0.15; // brief grace window
    }
    if (state.releasing) {
      state.releaseTimer -= dt;
      if (state.releaseTimer <= 0) {
        // fire blast with accumulated layer power
        KI.emit('resonance:release', {
          layer: state.peakLayer,
          layerData: LAYERS[state.peakLayer] || LAYERS[0],
          multiplier: getMultiplier(),
          vowel: state.currentVowel,
          sustainTime: state.sustainTime,
          coherenceBonus: state.coherenceBonus
        });
        resetSustain();
      }
    } else {
      // fully idle
      state.sustainTime *= 0.92;
      if (state.sustainTime < 0.05) resetSustain();
      state.activeLayer = -1;
    }
  }

  // === VISUALS ===
  state.layerFlashTimer = Math.max(0, state.layerFlashTimer - dt);

  state.rings.forEach((ring, i) => {
    const active = i <= state.activeLayer;
    const targetOpacity = active ? (0.3 + (i / LAYERS.length) * 0.5) : 0;
    ring.material.opacity += (targetOpacity - ring.material.opacity) * (active ? 0.15 : 0.05);

    if (active) {
      // pulse rings
      const pulse = 1 + Math.sin(t * (2 + i * 0.5)) * 0.08;
      ring.scale.setScalar(pulse);
      ring.rotation.z = t * (0.3 + i * 0.15);

      // flash on new layer
      if (state.layerFlashTimer > 0 && i === state.activeLayer) {
        ring.material.opacity = Math.min(1, ring.material.opacity + state.layerFlashTimer * 2);
      }
    }

    // glow spheres
    const gs = ring.userData.glowSphere;
    if (gs) {
      const gTarget = active ? 0.04 + i * 0.02 : 0;
      gs.material.opacity += (gTarget - gs.material.opacity) * 0.08;
      if (active) gs.scale.setScalar(1 + Math.sin(t * 3 + i) * 0.1);
    }
  });

  // slight vertical float of ring group based on depth
  if (state.activeLayer >= 0) {
    state.ringGroup.position.y += Math.sin(t * 1.5) * 0.005 * (state.activeLayer + 1);
  }

  KI.emit('resonance:update', {
    activeLayer: state.activeLayer,
    peakLayer: state.peakLayer,
    sustainTime: state.sustainTime,
    layerProgress: state.layerProgress,
    multiplier: getMultiplier(),
    vowel: state.currentVowel,
    coherenceBonus: state.coherenceBonus,
    releasing: state.releasing
  });
}

function resetSustain() {
  state.sustainTime = 0;
  state.activeLayer = -1;
  state.peakLayer = -1;
  state.layerProgress = 0;
  state.coherenceBonus = 0;
  state.pitchDriftAccum = 0;
  state.vowelLockTime = 0;
  state.releasing = false;
  state.releaseTimer = 0;
  state.currentVowel = '';
}

export function getMultiplier() {
  if (state.peakLayer < 0) return 1;
  return LAYERS[state.peakLayer].mult * (1 + state.coherenceBonus * 0.5);
}

export function getActiveLayer() {
  return state.activeLayer;
}
