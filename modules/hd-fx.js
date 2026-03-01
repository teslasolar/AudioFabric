// hd-fx.js — Upgraded FX: volumetric beams, multi-ring shockwaves, branching lightning,
// ground pulse waves, aurora curtains, resonance depth rings
import { KI } from './core.js';

const beams = [];
const shockwaves = [];
const lightning = [];
const speedLines = [];
const groundPulses = [];
const depthRings = [];
let flashDiv = null;
let auroraPlanes = [];

export function init(opts = {}) {
  flashDiv = document.createElement('div');
  flashDiv.style.cssText = 'position:fixed;inset:0;z-index:90;pointer-events:none;opacity:0;transition:opacity 0.05s';
  document.body.appendChild(flashDiv);

  if (opts.aurora !== false) initAurora();

  KI.on('blast:fired', () => spawnSpeedLines());
  KI.on('explosion', data => {
    spawnShockwave(data.position, data.type);
    spawnBeamTrail(data.position, data.type);
  });
  KI.on('hit', data => {
    if (data.dmg > 150) screenFlash('#fff', Math.min(0.6, data.dmg / 1000));
    if (data.dmg > 400) screenFlash('#ff0', 0.4);
    if (data.dmg > 800) spawnGroundPulse(KI.target.mesh?.position);
  });
  KI.on('ko', () => {
    screenFlash('#f00', 0.7);
    spawnGroundPulse(KI.target.mesh?.position);
  });
  KI.on('charge:update', data => {
    if (data.chargeLevel > 0.5 && KI.voice.sounding && Math.random() < 0.2)
      spawnLightning(KI._scene?.aura?.position);
  });
  // resonance depth rings on layer-up
  KI.on('resonance:layerUp', data => {
    spawnDepthRing(KI._scene?.aura?.position, data.layer);
    screenFlash('#' + data.layerData.color.toString(16).padStart(6, '0'), 0.25 + data.layer * 0.1);
  });

  KI.register('hd-fx', { update, screenFlash, spawnShockwave, spawnLightning });
}

export function screenFlash(color, intensity) {
  if (!flashDiv) return;
  flashDiv.style.background = color;
  flashDiv.style.opacity = Math.min(1, intensity);
  setTimeout(() => { flashDiv.style.opacity = 0; }, 100);
}

function spawnDepthRing(center, layerIdx) {
  const scene = KI.scene;
  if (!scene || !center) return;
  const res = KI.get('resonance');
  const LAYERS = res?.LAYERS;
  if (!LAYERS || !LAYERS[layerIdx]) return;
  const ld = LAYERS[layerIdx];

  // outer expanding ring
  const rg = new THREE.TorusGeometry(0.5, 0.06 + layerIdx * 0.02, 12, 64);
  const rm = new THREE.MeshBasicMaterial({
    color: ld.color, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const ring = new THREE.Mesh(rg, rm);
  ring.position.copy(center);
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);

  // inner burst sphere
  const sg = new THREE.SphereGeometry(0.3 + layerIdx * 0.2, 16, 16);
  const sm = new THREE.MeshBasicMaterial({
    color: ld.color, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const sphere = new THREE.Mesh(sg, sm);
  sphere.position.copy(center);
  scene.add(sphere);

  depthRings.push({
    ring, sphere, life: 1.2 + layerIdx * 0.3,
    expandSpeed: 4 + layerIdx * 2, layerIdx
  });
}

function spawnBeamTrail(endPos, type) {
  const scene = KI.scene;
  if (!scene) return;
  const blastMod = KI.get('ki-blasts');
  const bt = blastMod?.BLAST_TYPES?.[type] || { color: 0xffffff };
  const startPos = KI._scene?.aura?.position || new THREE.Vector3(0, 2.5, 5);

  const dir = new THREE.Vector3().subVectors(endPos, startPos);
  const len = dir.length();

  // multi-cylinder volumetric beam
  [0.1, 0.25, 0.5].forEach((radius, i) => {
    const geo = new THREE.CylinderGeometry(radius, radius * 0.8, len, 8, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: bt.color, transparent: true, opacity: [0.6, 0.2, 0.06][i],
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const cyl = new THREE.Mesh(geo, mat);
    const mid = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
    cyl.position.copy(mid);
    cyl.lookAt(endPos);
    cyl.rotateX(Math.PI / 2);
    scene.add(cyl);
    beams.push({ mesh: cyl, life: 0.6 + i * 0.15 });
  });
}

function spawnShockwave(pos, type) {
  const scene = KI.scene;
  if (!scene) return;
  const blastMod = KI.get('ki-blasts');
  const bt = blastMod?.BLAST_TYPES?.[type] || { color: 0xffffff };

  // double ring
  [0.3, 0.6].forEach((r, i) => {
    const geo = new THREE.TorusGeometry(r, 0.04 - i * 0.01, 10, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: bt.color, transparent: true, opacity: 0.8 - i * 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.copy(pos);
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);
    shockwaves.push({ mesh: ring, life: 1, expandSpeed: 6 + i * 3 });
  });
}

function spawnLightning(center) {
  const scene = KI.scene;
  if (!scene || !center) return;

  // main bolt + 1-2 branches
  const boltCount = 1 + Math.floor(Math.random() * 2);
  for (let b = 0; b < boltCount; b++) {
    const pts = [];
    const segments = 8 + Math.floor(Math.random() * 8);
    let x = center.x, y = center.y, z = center.z;
    for (let i = 0; i <= segments; i++) {
      pts.push(new THREE.Vector3(
        x + (Math.random()-0.5) * (b === 0 ? 0.3 : 0.5),
        y + (Math.random()-0.5) * 3,
        z + (Math.random()-0.5) * (b === 0 ? 0.3 : 0.5)
      ));
      x += (Math.random()-0.5) * (b === 0 ? 1.8 : 2.5);
      y += (Math.random()-0.5) * 1.2;
      z += (Math.random()-0.5) * (b === 0 ? 1.8 : 2.5);
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: b === 0 ? 0xccddff : 0x8899dd,
      transparent: true, opacity: b === 0 ? 0.9 : 0.5,
      blending: THREE.AdditiveBlending
    });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    lightning.push({ mesh: line, life: 0.1 + Math.random() * 0.1 });
  }
}

function spawnSpeedLines() {
  const scene = KI.scene;
  if (!scene) return;
  for (let i = 0; i < 18; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 18;
    const pts = [
      new THREE.Vector3(Math.cos(angle)*r, 2.5 + (Math.random()-0.5)*5, Math.sin(angle)*r),
      new THREE.Vector3(Math.cos(angle)*1.5, 2.5 + (Math.random()-0.5)*2, Math.sin(angle)*1.5)
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    speedLines.push({ mesh: line, life: 0.15 + Math.random() * 0.12 });
  }
}

function spawnGroundPulse(pos) {
  const scene = KI.scene;
  if (!scene || !pos) return;
  // expanding ring on the ground
  const geo = new THREE.TorusGeometry(0.5, 0.08, 8, 64);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff4400, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.position.set(pos.x, 0.1, pos.z);
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);
  groundPulses.push({ mesh: ring, life: 2, expandSpeed: 8 });
}

function initAurora() {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => initAurora()); return; }
  for (let i = 0; i < 4; i++) {
    const geo = new THREE.PlaneGeometry(80, 10, 40, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: [0x0044ff, 0x00ff88, 0xff00ff, 0x00ffff][i],
      transparent: true, opacity: 0.035,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    const plane = new THREE.Mesh(geo, mat);
    plane.position.set(0, 14 + i * 3, -40);
    plane.rotation.x = -0.25;
    scene.add(plane);
    auroraPlanes.push(plane);
  }
}

function update(dt, t) {
  const scene = KI.scene;
  if (!scene) return;

  for (let i = beams.length - 1; i >= 0; i--) {
    beams[i].life -= dt * 2;
    beams[i].mesh.material.opacity = Math.max(0, beams[i].life);
    if (beams[i].life <= 0) { scene.remove(beams[i].mesh); beams.splice(i, 1); }
  }
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i]; sw.life -= dt * 1.5;
    sw.mesh.scale.multiplyScalar(1 + sw.expandSpeed * dt);
    sw.mesh.material.opacity = Math.max(0, sw.life);
    if (sw.life <= 0) { scene.remove(sw.mesh); shockwaves.splice(i, 1); }
  }
  for (let i = lightning.length - 1; i >= 0; i--) {
    lightning[i].life -= dt;
    lightning[i].mesh.material.opacity = Math.max(0, lightning[i].life / 0.15);
    if (lightning[i].life <= 0) { scene.remove(lightning[i].mesh); lightning.splice(i, 1); }
  }
  for (let i = speedLines.length - 1; i >= 0; i--) {
    speedLines[i].life -= dt;
    speedLines[i].mesh.material.opacity = Math.max(0, speedLines[i].life / 0.25);
    if (speedLines[i].life <= 0) { scene.remove(speedLines[i].mesh); speedLines.splice(i, 1); }
  }
  for (let i = groundPulses.length - 1; i >= 0; i--) {
    const gp = groundPulses[i]; gp.life -= dt;
    gp.mesh.scale.multiplyScalar(1 + gp.expandSpeed * dt);
    gp.mesh.material.opacity = Math.max(0, gp.life / 2 * 0.6);
    if (gp.life <= 0) { scene.remove(gp.mesh); groundPulses.splice(i, 1); }
  }
  // depth rings
  for (let i = depthRings.length - 1; i >= 0; i--) {
    const dr = depthRings[i]; dr.life -= dt;
    dr.ring.scale.multiplyScalar(1 + dr.expandSpeed * dt);
    dr.ring.material.opacity = Math.max(0, dr.life / 1.5);
    dr.sphere.scale.multiplyScalar(1 + dt * 3);
    dr.sphere.material.opacity = Math.max(0, dr.life / 2 * 0.4);
    if (dr.life <= 0) {
      scene.remove(dr.ring); scene.remove(dr.sphere);
      depthRings.splice(i, 1);
    }
  }
  // aurora
  auroraPlanes.forEach((plane, i) => {
    const pos = plane.geometry.attributes.position;
    for (let j = 0; j < pos.count; j++) {
      const x = pos.getX(j);
      pos.setY(j, Math.sin(t * 0.25 + x * 0.08 + i * 1.8) * 2.5 + Math.cos(t * 0.15 + x * 0.12) * 1.8);
    }
    pos.needsUpdate = true;
    plane.material.opacity = 0.03 + Math.sin(t * 0.4 + i) * 0.012;
  });
}
