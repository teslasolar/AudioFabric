// layer-stack.js — Visual layer compositor with stackable effects
// Template-based layer system: stack multiple visual effects on top of each other.
// Each layer is independently controllable, with voice mixing between them.
// Features:
// - 6 built-in layer types: noise field, waveform, particle grid, ring pulse, plasma, grid warp
// - Voice energy → master opacity/intensity
// - Pitch → layer blend sweep (crossfade between layers)
// - Coherence → layer synchronization (locked vs independent)
// - Vowel → active layer preset combination
// - Each layer has its own color, speed, density parameters
// - Layers can be individually toggled, reordered, blended

import { KI } from './core.js';

const TAU = Math.PI * 2;

// ── Layer definitions ──
const LAYER_TYPES = {
  noise: {
    name: 'Noise Field',
    color: [0.2, 0.8, 0.3],
    build: (group) => {
      const count = 600;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i*3] = (Math.random()-0.5)*6; pos[i*3+1] = (Math.random()-0.5)*5; pos[i*3+2] = (Math.random()-0.5)*4;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({
        size: 0.05, vertexColors: true, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      group.add(pts);
      return { mesh: pts, pos, col, count };
    },
    update: (layer, dt, t, energy, pitch, params) => {
      const { pos, col, count } = layer;
      const speed = 0.5 + energy * 2;
      for (let i = 0; i < count; i++) {
        // Perlin-like noise drift
        pos[i*3]   += Math.sin(t * speed + i * 0.01) * dt * 0.3;
        pos[i*3+1] += Math.cos(t * speed * 0.7 + i * 0.02) * dt * 0.2;
        pos[i*3+2] += Math.sin(t * speed * 0.5 + i * 0.03) * dt * 0.2;
        // Wrap
        for (let c = 0; c < 3; c++) {
          const ext = c === 2 ? 2 : 3;
          if (Math.abs(pos[i*3+c]) > ext) pos[i*3+c] *= -0.8;
        }
        const bright = energy * (0.3 + Math.sin(i * 0.1 + t) * 0.2);
        col[i*3] = params.color[0] * bright; col[i*3+1] = params.color[1] * bright; col[i*3+2] = params.color[2] * bright;
      }
      layer.mesh.geometry.attributes.position.needsUpdate = true;
      layer.mesh.geometry.attributes.color.needsUpdate = true;
    }
  },

  waveform: {
    name: 'Waveform',
    color: [0.3, 0.5, 1.0],
    build: (group) => {
      const segs = 128;
      const lines = [];
      for (let w = 0; w < 5; w++) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array((segs + 1) * 3);
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
          color: 0x4488ff, transparent: true, opacity: 0.2,
          blending: THREE.AdditiveBlending
        }));
        group.add(line);
        lines.push({ line, pos, segs, yOffset: (w - 2) * 0.8 });
      }
      return { lines };
    },
    update: (layer, dt, t, energy, pitch, params) => {
      for (const { line, pos, segs, yOffset } of layer.lines) {
        const freq = 2 + pitch * 10;
        for (let s = 0; s <= segs; s++) {
          const x = (s / segs - 0.5) * 6;
          const wave = Math.sin(x * freq + t * 3) * energy * 0.8 +
                       Math.sin(x * freq * 2.1 + t * 5) * energy * 0.3;
          pos[s*3] = x; pos[s*3+1] = wave + yOffset; pos[s*3+2] = Math.sin(x * 0.5 + t) * 0.3;
        }
        line.geometry.attributes.position.needsUpdate = true;
        line.material.opacity = 0.1 + energy * 0.25;
        const rgb = params.color;
        line.material.color.setRGB(rgb[0], rgb[1], rgb[2]);
      }
    }
  },

  particlegrid: {
    name: 'Particle Grid',
    color: [0.8, 0.3, 0.8],
    build: (group) => {
      const gridSize = 16;
      const count = gridSize * gridSize;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      const basePos = new Float32Array(count * 3);
      for (let x = 0; x < gridSize; x++) {
        for (let z = 0; z < gridSize; z++) {
          const i = x * gridSize + z;
          basePos[i*3] = pos[i*3] = (x / (gridSize-1) - 0.5) * 5;
          basePos[i*3+1] = pos[i*3+1] = 0;
          basePos[i*3+2] = pos[i*3+2] = (z / (gridSize-1) - 0.5) * 5;
        }
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({
        size: 0.08, vertexColors: true, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      group.add(pts);
      return { mesh: pts, pos, col, basePos, count, gridSize };
    },
    update: (layer, dt, t, energy, pitch, params) => {
      const { pos, col, basePos, count, gridSize } = layer;
      for (let i = 0; i < count; i++) {
        const bx = basePos[i*3], bz = basePos[i*3+2];
        const dist = Math.sqrt(bx*bx + bz*bz);
        const wave = Math.sin(dist * 3 - t * 2 + pitch * 5) * energy;
        pos[i*3+1] = wave * 1.5;
        pos[i*3]   = bx + Math.sin(t + i * 0.1) * energy * 0.1;
        pos[i*3+2] = bz + Math.cos(t * 0.7 + i * 0.1) * energy * 0.1;
        const bright = 0.2 + Math.abs(wave) * 0.8;
        col[i*3] = params.color[0] * bright; col[i*3+1] = params.color[1] * bright; col[i*3+2] = params.color[2] * bright;
      }
      layer.mesh.geometry.attributes.position.needsUpdate = true;
      layer.mesh.geometry.attributes.color.needsUpdate = true;
    }
  },

  ringpulse: {
    name: 'Ring Pulse',
    color: [1.0, 0.6, 0.1],
    build: (group) => {
      const rings = [];
      for (let i = 0; i < 8; i++) {
        const geo = new THREE.TorusGeometry(0.5 + i * 0.3, 0.02, 8, 64);
        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
          color: 0xff8800, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false
        }));
        mesh.rotation.x = Math.PI / 2;
        group.add(mesh);
        rings.push(mesh);
      }
      return { rings };
    },
    update: (layer, dt, t, energy, pitch, params) => {
      for (let i = 0; i < layer.rings.length; i++) {
        const ring = layer.rings[i];
        const phase = t * 2 - i * 0.3;
        const pulse = Math.max(0, Math.sin(phase)) * energy;
        ring.scale.setScalar(1 + pulse * 0.5);
        ring.material.opacity = pulse * 0.3;
        ring.rotation.z = t * 0.2 + i * 0.1;
        ring.position.y = Math.sin(t * 0.5 + i * 0.5) * 0.3;
        const rgb = params.color;
        const bright = 0.3 + pulse * 0.7;
        ring.material.color.setRGB(rgb[0] * bright, rgb[1] * bright, rgb[2] * bright);
      }
    }
  },

  plasma: {
    name: 'Plasma',
    color: [0.5, 0.2, 1.0],
    build: (group) => {
      const res = 24;
      const geo = new THREE.PlaneGeometry(6, 5, res, res);
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: 0x8844ff, transparent: true, opacity: 0.1, wireframe: true,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      }));
      group.add(mesh);
      return { mesh, res: res + 1 };
    },
    update: (layer, dt, t, energy, pitch, params) => {
      const pos = layer.mesh.geometry.attributes.position.array;
      const res = layer.res;
      for (let i = 0; i < res; i++) {
        for (let j = 0; j < res; j++) {
          const idx = (i * res + j) * 3;
          const x = pos[idx], y = pos[idx + 1];
          const plasma = Math.sin(x * 2 + t * 2) * Math.cos(y * 3 + t * 1.5) +
                         Math.sin(Math.sqrt(x*x + y*y) * 3 - t * 3) * 0.5;
          pos[idx + 2] = plasma * energy * 0.8;
        }
      }
      layer.mesh.geometry.attributes.position.needsUpdate = true;
      layer.mesh.material.opacity = 0.05 + energy * 0.12;
      const rgb = params.color;
      layer.mesh.material.color.setRGB(rgb[0], rgb[1], rgb[2]);
    }
  },

  gridwarp: {
    name: 'Grid Warp',
    color: [0.2, 1.0, 0.6],
    build: (group) => {
      const lines = [];
      const gridN = 12;
      for (let i = 0; i < gridN; i++) {
        for (let axis = 0; axis < 2; axis++) {
          const geo = new THREE.BufferGeometry();
          const segs = 40;
          const pos = new Float32Array((segs + 1) * 3);
          geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
          const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
            color: 0x22ff88, transparent: true, opacity: 0.1,
            blending: THREE.AdditiveBlending
          }));
          group.add(line);
          lines.push({ line, pos, segs, idx: i, axis, gridN });
        }
      }
      return { lines };
    },
    update: (layer, dt, t, energy, pitch, params) => {
      for (const { line, pos, segs, idx, axis, gridN } of layer.lines) {
        const offset = (idx / (gridN - 1) - 0.5) * 5;
        for (let s = 0; s <= segs; s++) {
          const p = (s / segs - 0.5) * 5;
          const warp = Math.sin(p * 2 + t * 1.5 + idx) * energy * 0.5;
          if (axis === 0) {
            pos[s*3] = p; pos[s*3+1] = warp; pos[s*3+2] = offset + Math.sin(p + t) * energy * 0.2;
          } else {
            pos[s*3] = offset + Math.sin(p + t) * energy * 0.2; pos[s*3+1] = warp; pos[s*3+2] = p;
          }
        }
        line.geometry.attributes.position.needsUpdate = true;
        line.material.opacity = 0.05 + energy * 0.12;
        const rgb = params.color;
        line.material.color.setRGB(rgb[0], rgb[1], rgb[2]);
      }
    }
  }
};

const LAYER_NAMES = Object.keys(LAYER_TYPES);

// ── Presets: different layer combinations ──
const PRESETS = {
  a: ['noise', 'waveform', 'ringpulse'],       // ambient
  e: ['particlegrid', 'plasma', 'gridwarp'],    // electric
  i: ['waveform', 'plasma', 'noise'],           // interference
  o: ['ringpulse', 'particlegrid', 'waveform'], // orbital
  u: ['gridwarp', 'noise', 'ringpulse', 'plasma'] // ultra
};

// ── State ──
let group = null;
let activeLayers = []; // { type, data, opacity, params }
let activePreset = 'a';
let layerGroups = [];

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 2, -3];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // Build initial preset
  buildPreset('a');

  KI.register('layer-stack', {
    update, group,
    getActivePreset: () => activePreset,
    getLayerCount: () => activeLayers.length,
    getLayerNames: () => activeLayers.map(l => l.type),
    setPreset: (p) => { if (PRESETS[p]) buildPreset(p); }
  });

  KI.emit('layer-stack:ready');
}

function buildPreset(preset) {
  activePreset = preset;
  // Clear old layers
  for (const lg of layerGroups) group.remove(lg);
  layerGroups = [];
  activeLayers = [];

  const layerNames = PRESETS[preset] || PRESETS.a;
  for (let i = 0; i < layerNames.length; i++) {
    const typeName = layerNames[i];
    const type = LAYER_TYPES[typeName];
    if (!type) continue;

    const layerGroup = new THREE.Group();
    layerGroup.position.y = (i - layerNames.length / 2) * 0.1; // slight vertical offset per layer
    group.add(layerGroup);
    layerGroups.push(layerGroup);

    const data = type.build(layerGroup);
    activeLayers.push({
      type: typeName,
      data,
      opacity: 1,
      params: { color: [...type.color] }
    });
  }

  KI.emit('layer-stack:preset-change', { preset, layers: layerNames });
}

function update(dt, t) {
  const v = KI.voice;
  const energy = v.energy || 0;
  const coherence = v.coherence || 0;
  const pitch = v.pn || 0;
  const sounding = v.sounding;

  // ── Vowel → preset ──
  if (sounding) {
    const vowel = v.vowel || 'a';
    if (PRESETS[vowel] && vowel !== activePreset) {
      buildPreset(vowel);
    }
  }

  // ── Update each layer ──
  for (let i = 0; i < activeLayers.length; i++) {
    const layer = activeLayers[i];
    const type = LAYER_TYPES[layer.type];
    if (!type) continue;

    // Pitch → layer crossfade (emphasize different layers at different pitches)
    const layerCenter = i / Math.max(1, activeLayers.length - 1);
    const pitchDist = Math.abs(pitch - layerCenter);
    layer.opacity = 0.5 + (1 - pitchDist) * 0.5;

    // Coherence → color shift between layers (synchronized = same hue, desync = varied)
    const hueShift = coherence < 0.5 ? i * 0.15 : 0;
    layer.params.color = [
      type.color[0] * Math.cos(hueShift) - type.color[2] * Math.sin(hueShift) * 0.3 + 0.3,
      type.color[1],
      type.color[2] * Math.cos(hueShift) + type.color[0] * Math.sin(hueShift) * 0.3 + 0.3
    ].map(c => Math.max(0, Math.min(1, c)));

    type.update(layer.data, dt, t, energy * layer.opacity, pitch, layer.params);
  }

  // ── Group rotation ──
  group.rotation.y += dt * 0.03;

  KI.emit('layer-stack:update', {
    preset: activePreset,
    layerCount: activeLayers.length,
    layers: activeLayers.map(l => ({ type: l.type, opacity: l.opacity.toFixed(2) }))
  });
}
