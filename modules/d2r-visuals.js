// d2r-visuals.js — 3D rune & runeword visualization for Three.js scenes
// Creates floating rune stones, runeword assemblies, particle effects
// Rune tier determines geometry complexity & glow intensity

import { RUNES, RUNE_MAP, ELEMENT_COLORS } from './d2r-runes.js';

const activeRuneStones = [];
const particles = [];
let scene = null;

export function init(threeScene) {
  scene = threeScene;
}

// tier → geometry mapping
function runeGeometry(tier) {
  switch (tier) {
    case 'low':   return new THREE.BoxGeometry(0.8, 1.2, 0.3);
    case 'mid':   return new THREE.CylinderGeometry(0.5, 0.5, 1.2, 6);
    case 'high':  return new THREE.OctahedronGeometry(0.6, 0);
    case 'ultra': return new THREE.IcosahedronGeometry(0.6, 1);
    default:      return new THREE.BoxGeometry(0.8, 1.2, 0.3);
  }
}

// create a single floating rune stone in 3D
export function createRuneStone(rune, position) {
  if (!scene) return null;
  const group = new THREE.Group();

  // main stone
  const geo = runeGeometry(rune.tier);
  const mat = new THREE.MeshBasicMaterial({
    color: rune.color, wireframe: true, transparent: true, opacity: 0.7
  });
  const stone = new THREE.Mesh(geo, mat);
  group.add(stone);

  // inner glow
  const glowGeo = runeGeometry(rune.tier);
  glowGeo.scale(0.7, 0.7, 0.7);
  const glowMat = new THREE.MeshBasicMaterial({
    color: rune.color, transparent: true, opacity: 0.15,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  group.add(new THREE.Mesh(glowGeo, glowMat));

  // rune letter as sprite (canvas texture)
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx2d = canvas.getContext('2d');
  ctx2d.fillStyle = '#' + rune.color.toString(16).padStart(6, '0');
  ctx2d.font = 'bold 64px serif';
  ctx2d.textAlign = 'center';
  ctx2d.textBaseline = 'middle';
  ctx2d.fillText(rune.name, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({
    map: tex, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(1.2, 1.2, 1);
  sprite.position.y = 0;
  group.add(sprite);

  // orbiting particle ring (count by tier)
  const pCount = rune.tier === 'ultra' ? 20 : rune.tier === 'high' ? 12 : rune.tier === 'mid' ? 8 : 4;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    const a = (i / pCount) * Math.PI * 2;
    pPos[i*3] = Math.cos(a) * 1.2;
    pPos[i*3+1] = 0;
    pPos[i*3+2] = Math.sin(a) * 1.2;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    color: rune.color, size: 0.08, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  group.add(new THREE.Points(pGeo, pMat));

  group.position.copy(position);
  scene.add(group);

  const entry = {
    group, stone, rune, pGeo, pCount,
    animate(t) {
      stone.rotation.y = t * 0.5;
      stone.rotation.x = Math.sin(t * 0.3) * 0.2;
      // orbiting particles
      const pos = pGeo.attributes.position;
      for (let i = 0; i < pCount; i++) {
        const a = (i / pCount) * Math.PI * 2 + t * 0.8;
        const r = 1.2 + Math.sin(t * 2 + i) * 0.15;
        pos.setXYZ(i, Math.cos(a) * r, Math.sin(t + i) * 0.3, Math.sin(a) * r);
      }
      pos.needsUpdate = true;
      // hover bob
      group.position.y = position.y + Math.sin(t * 0.7 + position.x) * 0.3;
    },
    remove() {
      scene.remove(group);
    }
  };
  activeRuneStones.push(entry);
  return entry;
}

// create a runeword assembly — rune stones in a row with connecting beams
export function createRunewordAssembly(runeNames, centerPosition, spacing = 1.8) {
  if (!scene) return null;
  const group = new THREE.Group();
  const stones = [];
  const totalWidth = (runeNames.length - 1) * spacing;
  const startX = -totalWidth / 2;

  runeNames.forEach((name, i) => {
    const rune = RUNE_MAP[name];
    if (!rune) return;
    const pos = new THREE.Vector3(startX + i * spacing, 0, 0);
    const stone = createRuneStone(rune, pos);
    if (stone) {
      stone.group.position.add(centerPosition);
      stones.push(stone);
    }
  });

  // connecting beams between runes
  for (let i = 0; i < stones.length - 1; i++) {
    const from = stones[i].group.position;
    const to = stones[i + 1].group.position;
    const pts = [from.clone(), to.clone()];
    const beamGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const beamMat = new THREE.LineBasicMaterial({
      color: 0xffaa44, transparent: true, opacity: 0.2,
      blending: THREE.AdditiveBlending
    });
    const beam = new THREE.Line(beamGeo, beamMat);
    scene.add(beam);
  }

  return {
    stones,
    animate(t) { stones.forEach(s => s.animate(t)); },
    remove() { stones.forEach(s => s.remove()); }
  };
}

// spawn a burst of element-colored particles at a position
export function spawnRuneBurst(rune, position, count = 30) {
  if (!scene) return;
  const color = rune.color;
  for (let i = 0; i < count; i++) {
    const geo = new THREE.SphereGeometry(0.05, 4, 4);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const p = new THREE.Mesh(geo, mat);
    p.position.copy(position);
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 4,
      Math.random() * 3,
      (Math.random() - 0.5) * 4
    );
    scene.add(p);
    particles.push({ mesh: p, vel, life: 1.0 + Math.random() * 0.5 });
  }
}

// update all active visuals (call in animation loop)
export function update(dt, t) {
  activeRuneStones.forEach(s => s.animate(t));

  // update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.vel.y -= 2 * dt; // gravity
    p.mesh.material.opacity = Math.max(0, p.life * 0.5);
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }
}

// clear all visuals
export function clearAll() {
  activeRuneStones.forEach(s => s.remove());
  activeRuneStones.length = 0;
  particles.forEach(p => scene?.remove(p.mesh));
  particles.length = 0;
}
