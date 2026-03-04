// metaball-swarm.js — Organic blobby shapes that merge and split from voice
// Multiple metaball-like spheres that attract/repel creating smooth organic surfaces.
// Features:
// - N blob sources that move based on voice parameters
// - Energy → blob count and size (more energy = more blobs)
// - Pitch → spatial arrangement (low=clustered, high=spread)
// - Coherence → merge tendency (high=blobs merge into one, low=separate)
// - Vowel → motion pattern (orbit, breathe, swarm, bounce, spiral)
// - Pulse → pulsation sync across all blobs
// - Surface rendered as overlapping translucent spheres with additive blending
// - Tendrils stretch between merging blobs
// - Ambient motes drift around the swarm

import { KI } from './core.js';

const TAU = Math.PI * 2;

// ── Blob state ──
const MAX_BLOBS = 16;
const blobs = [];
let motionPattern = 'orbit';
let mergeThreshold = 1.5;

// ── 3D ──
let group = null;
let blobMeshes = [];     // outer translucent shells
let blobCores = [];      // inner bright cores
let tendrilLines = [];   // stretchy connections between close blobs
const MAX_TENDRILS = 30;
// Ambient motes
let moteSystem = null, motePos = null, moteCol = null;
const MAX_MOTES = 400;
// Merge flash particles
let flashSystem = null, flashPos = null, flashCol = null;
const MAX_FLASH = 200;

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 3, -3];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── Initialize blobs ──
  for (let i = 0; i < MAX_BLOBS; i++) {
    const angle = (i / MAX_BLOBS) * TAU;
    blobs.push({
      x: Math.cos(angle) * 1.5,
      y: Math.sin(angle * 0.7) * 0.8,
      z: Math.sin(angle) * 1.5,
      vx: 0, vy: 0, vz: 0,
      radius: 0.3 + Math.random() * 0.2,
      targetRadius: 0.3,
      active: i < 4,
      hue: i / MAX_BLOBS
    });

    // Outer shell
    const geo = new THREE.SphereGeometry(1, 20, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x44ff88, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    group.add(mesh);
    blobMeshes.push(mesh);

    // Inner core
    const cGeo = new THREE.SphereGeometry(1, 12, 8);
    const cMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const core = new THREE.Mesh(cGeo, cMat);
    core.visible = false;
    group.add(core);
    blobCores.push(core);
  }

  // ── Tendril lines ──
  for (let i = 0; i < MAX_TENDRILS; i++) {
    const geo = new THREE.BufferGeometry();
    const segs = 12;
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((segs + 1) * 3), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0x44ff88, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending
    }));
    line.visible = false;
    line.userData = { segs };
    group.add(line);
    tendrilLines.push(line);
  }

  // ── Ambient motes ──
  const mGeo = new THREE.BufferGeometry();
  motePos = new Float32Array(MAX_MOTES * 3);
  moteCol = new Float32Array(MAX_MOTES * 3);
  for (let i = 0; i < MAX_MOTES; i++) {
    motePos[i*3] = (Math.random()-0.5)*6;
    motePos[i*3+1] = (Math.random()-0.5)*5;
    motePos[i*3+2] = (Math.random()-0.5)*4;
  }
  mGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  mGeo.setAttribute('color', new THREE.BufferAttribute(moteCol, 3));
  moteSystem = new THREE.Points(mGeo, new THREE.PointsMaterial({
    size: 0.03, vertexColors: true, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(moteSystem);

  // ── Flash particles ──
  const fGeo = new THREE.BufferGeometry();
  flashPos = new Float32Array(MAX_FLASH * 3);
  flashCol = new Float32Array(MAX_FLASH * 3);
  fGeo.setAttribute('position', new THREE.BufferAttribute(flashPos, 3));
  fGeo.setAttribute('color', new THREE.BufferAttribute(flashCol, 3));
  flashSystem = new THREE.Points(fGeo, new THREE.PointsMaterial({
    size: 0.08, vertexColors: true, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(flashSystem);

  KI.register('metaball-swarm', {
    update, group,
    getBlobCount: () => blobs.filter(b => b.active).length,
    getPattern: () => motionPattern
  });

  KI.emit('metaball-swarm:ready');
}

function update(dt, t) {
  const v = KI.voice;
  const energy = v.energy || 0;
  const coherence = v.coherence || 0;
  const pitch = v.pn || 0;
  const sounding = v.sounding;
  const pulseRate = v.pulseRate || 1;

  // ── Vowel → motion pattern ──
  if (sounding) {
    const vowelMotion = { a: 'orbit', e: 'breathe', i: 'swarm', o: 'bounce', u: 'spiral' };
    motionPattern = vowelMotion[v.vowel || 'a'] || 'orbit';
  }

  // ── Active blob count from energy ──
  const targetCount = Math.max(2, Math.min(MAX_BLOBS, Math.floor(2 + energy * 12)));
  for (let i = 0; i < MAX_BLOBS; i++) blobs[i].active = i < targetCount;

  // ── Merge threshold from coherence ──
  mergeThreshold = 2.5 - coherence * 1.5; // high coherence = closer merge

  // ── Spread from pitch ──
  const spread = 0.8 + pitch * 2.5;

  // ── Move blobs ──
  for (let i = 0; i < MAX_BLOBS; i++) {
    const blob = blobs[i];
    if (!blob.active) continue;

    const angle = (i / targetCount) * TAU;
    let tx, ty, tz;

    switch (motionPattern) {
      case 'orbit':
        tx = Math.cos(angle + t * 0.5) * spread;
        ty = Math.sin(angle * 0.7 + t * 0.3) * spread * 0.5;
        tz = Math.sin(angle + t * 0.5) * spread;
        break;
      case 'breathe': {
        const breathScale = 1 + Math.sin(t * pulseRate * 2) * 0.4;
        tx = Math.cos(angle) * spread * breathScale;
        ty = Math.sin(angle) * spread * 0.5 * breathScale;
        tz = Math.sin(angle * 1.3) * spread * breathScale;
        break;
      }
      case 'swarm':
        tx = Math.cos(angle + t * 2 + Math.sin(t * 3 + i)) * spread;
        ty = Math.sin(t * 1.5 + i * 0.7) * spread * 0.6;
        tz = Math.sin(angle + t * 2 + Math.cos(t * 2.5 + i)) * spread;
        break;
      case 'bounce':
        tx = Math.cos(angle) * spread;
        ty = Math.abs(Math.sin(t * 3 + i * 0.5)) * spread - spread * 0.5;
        tz = Math.sin(angle) * spread;
        break;
      case 'spiral':
        tx = Math.cos(angle + t * 0.8 + i * 0.2) * (spread * (1 - i * 0.03));
        ty = (i / targetCount - 0.5) * spread * 2 + Math.sin(t + i) * 0.3;
        tz = Math.sin(angle + t * 0.8 + i * 0.2) * (spread * (1 - i * 0.03));
        break;
      default:
        tx = blob.x; ty = blob.y; tz = blob.z;
    }

    // Smooth movement
    const speed = 2 + energy * 3;
    blob.x += (tx - blob.x) * dt * speed;
    blob.y += (ty - blob.y) * dt * speed;
    blob.z += (tz - blob.z) * dt * speed;

    // Radius pulses with voice
    blob.targetRadius = 0.25 + energy * 0.3 + Math.sin(t * pulseRate * 3 + i) * energy * 0.1;
    blob.radius += (blob.targetRadius - blob.radius) * dt * 4;
  }

  // ── Render blobs ──
  let activeCount = 0;
  for (let i = 0; i < MAX_BLOBS; i++) {
    const blob = blobs[i];
    const mesh = blobMeshes[i];
    const core = blobCores[i];

    if (blob.active) {
      mesh.visible = true;
      core.visible = true;
      mesh.position.set(blob.x, blob.y, blob.z);
      mesh.scale.setScalar(blob.radius);
      core.position.set(blob.x, blob.y, blob.z);
      core.scale.setScalar(blob.radius * 0.4);

      const rgb = hslToRgb(blob.hue, 0.6 + energy * 0.3, 0.3 + energy * 0.2);
      mesh.material.color.setRGB(rgb[0], rgb[1], rgb[2]);
      mesh.material.opacity = 0.12 + energy * 0.15;
      core.material.color.setRGB(rgb[0] * 1.5, rgb[1] * 1.5, rgb[2] * 1.5);
      core.material.opacity = 0.1 + energy * 0.2;
      activeCount++;
    } else {
      mesh.visible = false;
      core.visible = false;
    }
  }

  // ── Tendrils between close blobs ──
  let tendrilIdx = 0;
  for (let i = 0; i < MAX_BLOBS && tendrilIdx < MAX_TENDRILS; i++) {
    if (!blobs[i].active) continue;
    for (let j = i + 1; j < MAX_BLOBS && tendrilIdx < MAX_TENDRILS; j++) {
      if (!blobs[j].active) continue;
      const dx = blobs[j].x - blobs[i].x;
      const dy = blobs[j].y - blobs[i].y;
      const dz = blobs[j].z - blobs[i].z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

      if (dist < mergeThreshold) {
        const line = tendrilLines[tendrilIdx];
        line.visible = true;
        const segs = line.userData.segs;
        const posArr = line.geometry.attributes.position.array;

        for (let s = 0; s <= segs; s++) {
          const p = s / segs;
          // Catenary curve between blobs
          const sag = Math.sin(p * Math.PI) * (1 - dist / mergeThreshold) * 0.5;
          posArr[s*3]   = blobs[i].x + dx * p + Math.sin(t * 3 + s) * sag * 0.3;
          posArr[s*3+1] = blobs[i].y + dy * p - sag;
          posArr[s*3+2] = blobs[i].z + dz * p + Math.cos(t * 2 + s) * sag * 0.3;
        }
        line.geometry.attributes.position.needsUpdate = true;

        const closeness = 1 - dist / mergeThreshold;
        line.material.opacity = closeness * 0.3 * energy;
        const trgb = hslToRgb((blobs[i].hue + blobs[j].hue) / 2, 0.7, 0.3 + closeness * 0.3);
        line.material.color.setRGB(trgb[0], trgb[1], trgb[2]);
        tendrilIdx++;
      }
    }
  }
  for (let i = tendrilIdx; i < MAX_TENDRILS; i++) tendrilLines[i].visible = false;

  // ── Ambient motes ──
  for (let i = 0; i < MAX_MOTES; i++) {
    motePos[i*3]   += (Math.random()-0.5) * dt * 0.2;
    motePos[i*3+1] += (Math.random()-0.5) * dt * 0.15;
    motePos[i*3+2] += (Math.random()-0.5) * dt * 0.2;
    // Attract toward nearest blob
    if (energy > 0.1 && i % 4 === 0) {
      const bi = i % targetCount;
      if (blobs[bi].active) {
        motePos[i*3]   += (blobs[bi].x - motePos[i*3]) * dt * 0.3;
        motePos[i*3+1] += (blobs[bi].y - motePos[i*3+1]) * dt * 0.3;
        motePos[i*3+2] += (blobs[bi].z - motePos[i*3+2]) * dt * 0.3;
      }
    }
    for (let c = 0; c < 3; c++) {
      const ext = c === 2 ? 2 : 3;
      if (Math.abs(motePos[i*3+c]) > ext) motePos[i*3+c] *= -0.8;
    }
    const bright = energy * 0.3;
    const mHue = (t * 0.02 + i * 0.005) % 1;
    const mrgb = hslToRgb(mHue, 0.5, bright);
    moteCol[i*3] = mrgb[0]; moteCol[i*3+1] = mrgb[1]; moteCol[i*3+2] = mrgb[2];
  }
  moteSystem.geometry.attributes.position.needsUpdate = true;
  moteSystem.geometry.attributes.color.needsUpdate = true;

  // ── Flash particles (on merge events) ──
  for (let i = 0; i < MAX_FLASH; i++) {
    flashCol[i*3] *= 0.94; flashCol[i*3+1] *= 0.94; flashCol[i*3+2] *= 0.94;
    flashPos[i*3] += (Math.random()-0.5) * dt * 2;
    flashPos[i*3+1] += (Math.random()-0.5) * dt * 2;
    flashPos[i*3+2] += (Math.random()-0.5) * dt * 2;
  }
  flashSystem.geometry.attributes.position.needsUpdate = true;
  flashSystem.geometry.attributes.color.needsUpdate = true;

  group.rotation.y += dt * 0.04;

  KI.emit('metaball-swarm:update', {
    blobCount: activeCount,
    pattern: motionPattern,
    mergeThreshold: mergeThreshold.toFixed(2),
    tendrilCount: tendrilIdx
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
