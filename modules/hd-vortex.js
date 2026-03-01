// hd-vortex.js — 3000+ particle vortex with color harmonics & resonance depth response
import { KI } from './core.js';

let vortexGroup, positions, colors, sizes;
let count = 0;

export function init(opts = {}) {
  count = opts.count || 3000;
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  vortexGroup = new THREE.Group();
  scene.add(vortexGroup);

  positions = new Float32Array(count * 3);
  colors = new Float32Array(count * 3);
  sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const a = i * 0.12, r = 2 + i * 0.02;
    positions[i*3] = Math.cos(a) * r;
    positions[i*3+1] = (i / count - 0.5) * 8;
    positions[i*3+2] = Math.sin(a) * r;
    colors[i*3] = 0.15; colors[i*3+1] = 0.3; colors[i*3+2] = 0.7;
    sizes[i] = 0.1 + Math.random() * 0.15;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  // custom shader for soft glow particles
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.3 }
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      uniform float uTime;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = color;
        vAlpha = 0.5 + 0.3 * sin(uTime + position.x * 2.0 + position.y);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (180.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float a = (1.0 - d * d) * vAlpha * uOpacity;
        gl_FragColor = vec4(vColor, a);
      }
    `,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });

  vortexGroup.add(new THREE.Points(geo, mat));
  vortexGroup.position.set(0, 2.5, -1);

  KI.register('hd-vortex', {
    update(dt, t) {
      const v = KI.voice;
      const res = KI.get('resonance');
      const layer = res ? res.state.activeLayer : -1;
      const layerMult = layer >= 0 ? 1 + layer * 0.3 : 1;

      mat.uniforms.uTime.value = t;

      // rotation speed responds to energy + resonance depth
      const rotSpeed = 0.006 + v.energy * 0.025 * layerMult;
      vortexGroup.rotation.y += rotSpeed;

      for (let i = 0; i < count; i++) {
        const baseA = i * 0.12 + t * 0.4;
        // vortex tightens with energy, loosens at deeper resonance layers
        let baseR = 3 + i * 0.02 - v.energy * 1.8;
        if (layer >= 0) baseR += layer * 0.3; // layers expand the vortex
        if (baseR < 0.4) baseR = 0.4;

        positions[i*3] = Math.cos(baseA) * baseR;
        positions[i*3+1] = (i / count - 0.5) * (8 + layer * 1.5) +
          Math.sin(t * 1.5 + i * 0.04) * v.energy * 0.6;
        positions[i*3+2] = Math.sin(baseA) * baseR;

        // color shifts through harmonic series based on layer depth
        let hue;
        if (layer < 0) {
          hue = (v.pn * 0.8 + i * 0.0003) % 1;
        } else {
          // each layer shifts the harmonic palette
          const layerHueBase = [0.6, 0.45, 0.1, 0.0, 0.85][layer];
          hue = (layerHueBase + i * 0.0002 + Math.sin(t * 0.5 + i * 0.01) * 0.05) % 1;
        }
        const sat = 0.7 + v.energy * 0.3;
        const lum = 0.3 + v.energy * 0.35 + (layer >= 0 ? layer * 0.05 : 0);
        const rgb = KI.hslToRgb(hue, sat, Math.min(0.8, lum));
        colors[i*3] = rgb[0]; colors[i*3+1] = rgb[1]; colors[i*3+2] = rgb[2];

        // sizes pulse at deeper layers
        sizes[i] = (0.1 + Math.random() * 0.05) * (1 + (layer >= 0 ? layer * 0.15 : 0));
      }

      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.attributes.size.needsUpdate = true;
      mat.uniforms.uOpacity.value = 0.15 + v.energy * 0.5 + (layer >= 0 ? 0.1 : 0);
    }
  });
}
