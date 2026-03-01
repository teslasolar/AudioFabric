// fx.js — Screen flash, lightning bolts, shockwave rings, beam trails, speed lines, aurora, ground cracks
import { KI } from './core.js';

const beams = [];
const shockwaves = [];
const lightning = [];
const speedLines = [];
const groundCracks = [];
let flashDiv = null;
let auroraPlanes = [];

export function init(opts = {}) {
  // screen flash overlay
  flashDiv = document.createElement('div');
  flashDiv.style.cssText = 'position:fixed;inset:0;z-index:90;pointer-events:none;opacity:0;transition:opacity 0.05s';
  document.body.appendChild(flashDiv);

  // aurora background
  if (opts.aurora !== false) initAurora();

  KI.on('blast:fired', data => spawnSpeedLines());
  KI.on('explosion', data => {
    spawnShockwave(data.position, data.type);
    spawnBeamTrail(data.position, data.type);
  });
  KI.on('hit', data => {
    if (data.dmg > 200) screenFlash('#fff', 0.3);
    if (data.dmg > 500) screenFlash('#ff0', 0.5);
  });
  KI.on('ko', () => {
    screenFlash('#f00', 0.6);
    spawnGroundCracks(KI.target.mesh?.position);
  });
  KI.on('charge:update', data => {
    if (data.chargeLevel > 0.6 && KI.voice.sounding && Math.random() < 0.15) {
      spawnLightning(KI._scene?.aura?.position);
    }
  });

  KI.register('fx', { update, screenFlash, spawnShockwave, spawnLightning });
}

export function screenFlash(color, intensity) {
  if (!flashDiv) return;
  flashDiv.style.background = color;
  flashDiv.style.opacity = intensity;
  setTimeout(() => { flashDiv.style.opacity = 0; }, 80);
}

function spawnBeamTrail(endPos, type) {
  const scene = KI.scene;
  if (!scene) return;
  const blastMod = KI.get('ki-blasts');
  const bt = blastMod?.BLAST_TYPES?.[type] || { color: 0xffffff };
  const startPos = KI._scene?.aura?.position || new THREE.Vector3(0, 2.5, 5);

  const dir = new THREE.Vector3().subVectors(endPos, startPos);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(0.08, 0.08, len, 6, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: bt.color, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const cyl = new THREE.Mesh(geo, mat);
  const mid = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
  cyl.position.copy(mid);
  cyl.lookAt(endPos);
  cyl.rotateX(Math.PI / 2);
  scene.add(cyl);
  beams.push({ mesh: cyl, life: 0.8 });
}

function spawnShockwave(pos, type) {
  const scene = KI.scene;
  if (!scene) return;
  const blastMod = KI.get('ki-blasts');
  const bt = blastMod?.BLAST_TYPES?.[type] || { color: 0xffffff };

  const geo = new THREE.TorusGeometry(0.3, 0.05, 8, 32);
  const mat = new THREE.MeshBasicMaterial({
    color: bt.color, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.position.copy(pos);
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);
  shockwaves.push({ mesh: ring, life: 1, expandSpeed: 8 });
}

function spawnLightning(center) {
  const scene = KI.scene;
  if (!scene || !center) return;

  const pts = [];
  const segments = 6 + Math.floor(Math.random() * 6);
  let x = center.x, y = center.y, z = center.z;

  for (let i = 0; i <= segments; i++) {
    pts.push(new THREE.Vector3(
      x + (Math.random()-0.5) * 0.4,
      y + (Math.random()-0.5) * 3,
      z + (Math.random()-0.5) * 0.4
    ));
    x += (Math.random()-0.5) * 1.5;
    y += (Math.random()-0.5) * 1;
    z += (Math.random()-0.5) * 1.5;
  }

  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({
    color: 0xaaddff, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending
  });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  lightning.push({ mesh: line, life: 0.15 + Math.random() * 0.1 });
}

function spawnSpeedLines() {
  const scene = KI.scene;
  if (!scene) return;

  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 15;
    const pts = [
      new THREE.Vector3(Math.cos(angle)*r, 2.5 + (Math.random()-0.5)*4, Math.sin(angle)*r),
      new THREE.Vector3(Math.cos(angle)*2, 2.5 + (Math.random()-0.5)*2, Math.sin(angle)*2)
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending
    });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    speedLines.push({ mesh: line, life: 0.2 + Math.random() * 0.1 });
  }
}

function spawnGroundCracks(pos) {
  const scene = KI.scene;
  if (!scene || !pos) return;

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
    const len = 2 + Math.random() * 4;
    const pts = [new THREE.Vector3(pos.x, 0.05, pos.z)];
    let cx = pos.x, cz = pos.z;
    for (let j = 0; j < 5; j++) {
      cx += Math.cos(angle) * (len / 5) + (Math.random()-0.5) * 0.5;
      cz += Math.sin(angle) * (len / 5) + (Math.random()-0.5) * 0.5;
      pts.push(new THREE.Vector3(cx, 0.05, cz));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: 0xff4400, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    groundCracks.push({ mesh: line, life: 3 });
  }
}

function initAurora() {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => initAurora()); return; }

  for (let i = 0; i < 3; i++) {
    const geo = new THREE.PlaneGeometry(60, 8, 30, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: [0x0044ff, 0x00ff88, 0xff00ff][i],
      transparent: true, opacity: 0.04,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    const plane = new THREE.Mesh(geo, mat);
    plane.position.set(0, 12 + i * 3, -30);
    plane.rotation.x = -0.3;
    scene.add(plane);
    auroraPlanes.push(plane);
  }
}

function update(dt, t) {
  const scene = KI.scene;
  if (!scene) return;

  // beams
  for (let i = beams.length - 1; i >= 0; i--) {
    beams[i].life -= dt * 2;
    beams[i].mesh.material.opacity = beams[i].life;
    if (beams[i].life <= 0) { scene.remove(beams[i].mesh); beams.splice(i, 1); }
  }

  // shockwaves
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    sw.life -= dt * 1.5;
    sw.mesh.scale.multiplyScalar(1 + sw.expandSpeed * dt);
    sw.mesh.material.opacity = sw.life;
    if (sw.life <= 0) { scene.remove(sw.mesh); shockwaves.splice(i, 1); }
  }

  // lightning
  for (let i = lightning.length - 1; i >= 0; i--) {
    lightning[i].life -= dt;
    lightning[i].mesh.material.opacity = lightning[i].life / 0.2;
    if (lightning[i].life <= 0) { scene.remove(lightning[i].mesh); lightning.splice(i, 1); }
  }

  // speed lines
  for (let i = speedLines.length - 1; i >= 0; i--) {
    speedLines[i].life -= dt;
    speedLines[i].mesh.material.opacity = speedLines[i].life / 0.3;
    if (speedLines[i].life <= 0) { scene.remove(speedLines[i].mesh); speedLines.splice(i, 1); }
  }

  // ground cracks
  for (let i = groundCracks.length - 1; i >= 0; i--) {
    groundCracks[i].life -= dt;
    groundCracks[i].mesh.material.opacity = Math.min(0.9, groundCracks[i].life / 2);
    if (groundCracks[i].life <= 0) { scene.remove(groundCracks[i].mesh); groundCracks.splice(i, 1); }
  }

  // aurora undulation
  auroraPlanes.forEach((plane, i) => {
    const pos = plane.geometry.attributes.position;
    for (let j = 0; j < pos.count; j++) {
      const x = pos.getX(j), z = pos.getZ(j);
      pos.setY(j, Math.sin(t * 0.3 + x * 0.1 + i * 2) * 2 + Math.cos(t * 0.2 + z * 0.15) * 1.5);
    }
    pos.needsUpdate = true;
    plane.material.opacity = 0.03 + Math.sin(t * 0.5 + i) * 0.015;
  });
}
