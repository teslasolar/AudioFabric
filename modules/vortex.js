// vortex.js — Vortex particle system
import { KI } from './core.js';

let vortexGroup, vortexPositions, vortexColors;

export function init(opts = {}) {
  const count = opts.count || 600;
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  vortexGroup = new THREE.Group();
  scene.add(vortexGroup);

  const geo = new THREE.BufferGeometry();
  vortexPositions = new Float32Array(count * 3);
  vortexColors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const a = i * 0.15, r = 3 + i * 0.025;
    vortexPositions[i*3] = Math.cos(a) * r;
    vortexPositions[i*3+1] = (i / count - 0.5) * 6;
    vortexPositions[i*3+2] = Math.sin(a) * r;
    vortexColors[i*3] = 0.2; vortexColors[i*3+1] = 0.4; vortexColors[i*3+2] = 0.8;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(vortexPositions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(vortexColors, 3));
  vortexGroup.add(new THREE.Points(geo, new THREE.PointsMaterial({
    size: opts.particleSize || 0.15,
    vertexColors: true, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false
  })));
  vortexGroup.position.set(0, 2.5, -1.5);

  KI.register('vortex', {
    update(dt, t) {
      const v = KI.voice;
      vortexGroup.rotation.y += 0.008 + v.energy * 0.03;
      for (let i = 0; i < count; i++) {
        const baseA = i * 0.15 + t * 0.5;
        let baseR = 3 + i * 0.025 - v.energy * 1.5;
        if (baseR < 0.5) baseR = 0.5;
        vortexPositions[i*3] = Math.cos(baseA) * baseR;
        vortexPositions[i*3+1] = (i / count - 0.5) * 6 + Math.sin(t*2 + i*0.05) * v.energy * 0.5;
        vortexPositions[i*3+2] = Math.sin(baseA) * baseR;
        const hue = (v.pn * 360 + i * 0.5) % 360;
        const rgb = KI.hslToRgb(hue / 360, 0.8, 0.4 + v.energy * 0.3);
        vortexColors[i*3] = rgb[0]; vortexColors[i*3+1] = rgb[1]; vortexColors[i*3+2] = rgb[2];
      }
      vortexGroup.children[0].geometry.attributes.position.needsUpdate = true;
      vortexGroup.children[0].geometry.attributes.color.needsUpdate = true;
      vortexGroup.children[0].material.opacity = 0.2 + v.energy * 0.5;
    }
  });
}
