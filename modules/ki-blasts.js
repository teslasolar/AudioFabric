// ki-blasts.js — Ki blast firing, damage, charge system, explosions
import { KI } from './core.js';

export const BLAST_TYPES = {
  kiball:     { color: 0x44ffaa, name: '土 Earth Ball',   dmgMul: 1,   speed: 0.8,  size: 0.25, vowel: 'mm' },
  kamehameha: { color: 0xff4444, name: '火 KAMEHAMEHA',   dmgMul: 3,   speed: 0.5,  size: 0.4,  vowel: 'ah' },
  finalflash: { color: 0xffdd00, name: '雷 FINAL FLASH',  dmgMul: 2.5, speed: 0.6,  size: 0.35, vowel: 'ee' },
  spiritbomb: { color: 0xffffff, name: '気 SPIRIT BOMB',   dmgMul: 5,   speed: 0.2,  size: 0.8,  vowel: 'oh' },
  galickgun:  { color: 0xaa44ff, name: '水 GALICK GUN',    dmgMul: 2,   speed: 0.55, size: 0.35, vowel: 'oo' },
  barrage:    { color: 0xff8844, name: '風 KI BARRAGE',    dmgMul: 0.4, speed: 1.2,  size: 0.15, vowel: 'eh' }
};

const blasts = [];
const explosions = [];
const chargeParticles = [];
const kanjiSprites = [];
let prevSounding = false, chargeType = 'kiball';

export function init() {
  KI.register('ki-blasts', { update, fireBlast, BLAST_TYPES, blasts, explosions });
  KI.on('voice:analyzed', updateCharge);
}

function updateCharge() {
  const v = KI.voice;
  const scene = KI.scene;
  const aura = KI._scene?.aura;
  if (!aura || !scene) return;

  const kanji = KI.get('kanji');
  const kanjiTextures = kanji?.kanjiTextures || {};
  const kanjiGlowTextures = kanji?.kanjiGlowTextures || {};

  if (v.sounding) {
    v.chargeLevel = Math.min(1, v.chargeLevel + v.rms * 0.08);
    if (v.pulseRate > 3) chargeType = 'barrage';
    else if (v.vowel === 'ah' && v.pn < 0.4) chargeType = 'kamehameha';
    else if (v.vowel === 'ee' && v.pn > 0.6) chargeType = 'finalflash';
    else if (v.vowel === 'oh') chargeType = 'spiritbomb';
    else if (v.vowel === 'oo') chargeType = 'galickgun';
    else if (!v.vowel) chargeType = 'kiball';
    if (chargeType === 'barrage' && v.chargeLevel > 0.15 && Math.random() < 0.3)
      fireBlast('barrage', v.chargeLevel * 0.3, aura.position);
  } else {
    if (prevSounding && v.chargeLevel > 0.2 && chargeType !== 'barrage')
      fireBlast(chargeType, v.chargeLevel, aura.position);
    v.chargeLevel *= 0.95;
    if (v.chargeLevel < 0.01) v.chargeLevel = 0;
  }
  prevSounding = v.sounding;

  const cl = v.chargeLevel;
  const bt = BLAST_TYPES[chargeType] || BLAST_TYPES.kiball;
  aura.material.color.setHex(bt.color);
  aura.material.opacity = cl * 0.25;
  aura.scale.setScalar(1 + cl * 2);
  KI._scene.auraGlow.material.opacity = cl * 0.12;

  // charge particles
  if (cl > 0.1 && v.sounding) {
    const pp = aura.position;
    for (let i = 0; i < Math.floor(cl * 4); i++) {
      const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 3;
      const pg = new THREE.SphereGeometry(0.06, 4, 4);
      const pm = new THREE.MeshBasicMaterial({ color: bt.color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
      const p = new THREE.Mesh(pg, pm);
      p.position.set(pp.x + Math.cos(a)*r, pp.y + (Math.random()-0.5)*2, pp.z + Math.sin(a)*r);
      p.userData = { tx: pp.x, ty: pp.y, tz: pp.z, life: 1, speed: 0.06 + Math.random()*0.04, angle: a };
      scene.add(p); chargeParticles.push(p);
    }
    if (cl > 0.3 && v.vowel && Math.random() < 0.12 && kanjiGlowTextures[v.vowel]) {
      const sm = new THREE.SpriteMaterial({ map: kanjiGlowTextures[v.vowel], blending: THREE.AdditiveBlending, transparent: true, opacity: 0.6, depthWrite: false });
      const sp = new THREE.Sprite(sm);
      sp.scale.set(0.5 + cl*0.5, 0.5 + cl*0.5, 1);
      const ka = Math.random() * Math.PI * 2, kr = 1.5 + Math.random()*2;
      sp.position.set(pp.x + Math.cos(ka)*kr, pp.y + (Math.random()-0.5)*2, pp.z + Math.sin(ka)*kr);
      sp.userData = { tx: pp.x, ty: pp.y, tz: pp.z, life: 1.5, speed: 0.03, angle: ka, isKanji: true };
      scene.add(sp); kanjiSprites.push(sp);
    }
  }

  KI.emit('charge:update', { chargeLevel: cl, chargeType, blastType: bt });
}

export function fireBlast(type, power, origin) {
  const scene = KI.scene;
  if (!scene) return;
  const bt = BLAST_TYPES[type], sz = bt.size * (0.5 + power);
  const geo = new THREE.SphereGeometry(sz, 12, 12);
  const mat = new THREE.MeshBasicMaterial({ color: bt.color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(origin);

  const hg = new THREE.SphereGeometry(sz * 2.5, 8, 8);
  const hm = new THREE.MeshBasicMaterial({ color: bt.color, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false });
  mesh.add(new THREE.Mesh(hg, hm));

  const kanji = KI.get('kanji');
  const kanjiTextures = kanji?.kanjiTextures || {};
  const vowelKey = bt.vowel || 'mm';
  if (kanjiTextures[vowelKey]) {
    const km = new THREE.SpriteMaterial({ map: kanjiTextures[vowelKey], blending: THREE.AdditiveBlending, transparent: true, opacity: 0.8, depthWrite: false });
    const ks = new THREE.Sprite(km); ks.scale.set(sz*3, sz*3, 1); mesh.add(ks);
  }

  const trg = new THREE.TorusGeometry(sz * 1.5, 0.03, 6, 24);
  const trm = new THREE.MeshBasicMaterial({ color: bt.color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const trail = new THREE.Mesh(trg, trm); trail.rotation.x = Math.PI / 2; mesh.add(trail);
  scene.add(mesh);

  const isLocal = origin.z > 0;
  const dmg = isLocal ? KI.voice.energy * 100 * bt.dmgMul * (1 + KI.voice.coherence * 0.5) : 0;
  blasts.push({ mesh, vz: -bt.speed, type, dmg, power, life: 1, trail, local: isLocal });

  if (isLocal) {
    KI.voice.chargeLevel = 0;
    KI.emit('blast:fired', { type, power });
    KI.emit('broadcast', { type: 'blast', name: KI.player.name, blastType: type, power });
  }
}

function update(dt, t) {
  const scene = KI.scene;
  const target = KI.target.mesh;
  if (!scene || !target) return;

  // update charge particles
  for (let i = chargeParticles.length - 1; i >= 0; i--) {
    const p = chargeParticles[i], u = p.userData;
    const dx = u.tx - p.position.x, dy = u.ty - p.position.y, dz = u.tz - p.position.z;
    const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (d > 0.3) {
      u.angle += 0.15;
      p.position.x += dx/d * u.speed + Math.cos(u.angle) * u.speed * 0.5;
      p.position.y += dy/d * u.speed;
      p.position.z += dz/d * u.speed + Math.sin(u.angle) * u.speed * 0.5;
    }
    u.life -= 0.02; p.material.opacity = u.life * 0.7;
    if (u.life <= 0 || d < 0.3) { scene.remove(p); chargeParticles.splice(i, 1); }
  }

  // update kanji sprites
  for (let i = kanjiSprites.length - 1; i >= 0; i--) {
    const s = kanjiSprites[i], u = s.userData;
    const dx = u.tx - s.position.x, dy = u.ty - s.position.y, dz = u.tz - s.position.z;
    const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
    u.angle += 0.08;
    if (d > 0.5) {
      s.position.x += dx/d * u.speed + Math.cos(u.angle) * 0.02;
      s.position.y += dy/d * u.speed + 0.01;
      s.position.z += dz/d * u.speed + Math.sin(u.angle) * 0.02;
    }
    u.life -= 0.015; s.material.opacity = Math.max(0, u.life * 0.6);
    if (u.life <= 0 || d < 0.5) { scene.remove(s); kanjiSprites.splice(i, 1); }
  }

  // update blasts
  for (let i = blasts.length - 1; i >= 0; i--) {
    const b = blasts[i]; b.mesh.position.z += b.vz; b.life -= 0.005;
    b.mesh.rotation.y += 0.12; b.mesh.rotation.x += 0.06;
    if (b.trail) b.trail.rotation.z += 0.2;

    // trail particles
    if (Math.random() < 0.4) {
      const tg = new THREE.SphereGeometry(0.04, 3, 3);
      const tm = new THREE.MeshBasicMaterial({ color: BLAST_TYPES[b.type].color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
      const tp = new THREE.Mesh(tg, tm);
      tp.position.copy(b.mesh.position);
      tp.position.x += (Math.random()-0.5) * 0.3;
      tp.position.y += (Math.random()-0.5) * 0.3;
      tp.userData = { life: 0.5 }; scene.add(tp); explosions.push(tp);
    }

    const dz = b.mesh.position.z - target.position.z;
    if (Math.abs(dz) < 1.5) {
      if (b.local) hitTarget(b);
      spawnExplosion(target.position, b.type);
      scene.remove(b.mesh); blasts.splice(i, 1); continue;
    }
    if (b.life <= 0 || b.mesh.position.z < -20) { scene.remove(b.mesh); blasts.splice(i, 1); }
  }

  // update explosions
  for (let i = explosions.length - 1; i >= 0; i--) {
    const e = explosions[i], u = e.userData;
    if (u.vx !== undefined) { e.position.x += u.vx; e.position.y += u.vy; e.position.z += u.vz; if (u.vy > -0.1) u.vy -= 0.002; }
    u.life -= 0.025; e.material.opacity = Math.max(0, u.life);
    if (e.isSprite) e.scale.multiplyScalar(1.02); else e.scale.setScalar(1 + (1-u.life)*2);
    if (u.life <= 0) { scene.remove(e); explosions.splice(i, 1); }
  }
}

function hitTarget(blast) {
  const v = KI.voice, p = KI.player;
  let dmg = blast.dmg * (0.8 + blast.power * 0.5);
  const now = performance.now();
  if (now - p.lastHitTime < 2000) p.combo++; else p.combo = 1;
  p.lastHitTime = now;
  dmg *= 1 + Math.min(p.combo, 20) * 0.1;
  KI.target.hp = Math.max(0, KI.target.hp - dmg);
  p.score += Math.round(dmg);

  if (KI._scene) KI._scene.screenShake = Math.max(KI._scene.screenShake, dmg * 0.02);

  KI.emit('hit', { dmg, type: blast.type, combo: p.combo, score: p.score });

  if (KI.target.hp <= 0) {
    KI.target.hp = KI.target.maxHP;
    KI.target.maxHP = Math.round(KI.target.maxHP * 1.3);
    if (p.score > p.highScore) p.highScore = p.score;
    KI.emit('ko', { score: p.score });
  }

  const hp = KI.target.hp / KI.target.maxHP;
  const target = KI.target.mesh;
  if (target) {
    target.hpRing.material.color.setHSL(hp * 0.33, 1, 0.5);
    target.material.opacity = 0.3 + hp * 0.5;
  }

  KI.emit('broadcast', { type: 'score', name: p.name, score: p.score });
}

function spawnExplosion(pos, type) {
  const scene = KI.scene;
  if (!scene) return;
  const bt = BLAST_TYPES[type] || BLAST_TYPES.kiball;
  for (let i = 0; i < 16; i++) {
    const eg = new THREE.SphereGeometry(0.08 + Math.random()*0.15, 4, 4);
    const em = new THREE.MeshBasicMaterial({ color: bt.color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    const e = new THREE.Mesh(eg, em);
    e.position.copy(pos);
    const a = Math.random() * Math.PI * 2, el = Math.random() * Math.PI - Math.PI / 2, sp = 0.1 + Math.random() * 0.25;
    e.userData = { vx: Math.cos(a)*Math.cos(el)*sp, vy: Math.sin(el)*sp + 0.05, vz: Math.sin(a)*Math.cos(el)*sp, life: 1 };
    scene.add(e); explosions.push(e);
  }

  const kanji = KI.get('kanji');
  const kanjiTextures = kanji?.kanjiTextures || {};
  const vk = bt.vowel || 'mm';
  if (kanjiTextures[vk]) {
    const km = new THREE.SpriteMaterial({ map: kanjiTextures[vk], blending: THREE.AdditiveBlending, transparent: true, opacity: 0.9, depthWrite: false });
    const ks = new THREE.Sprite(km); ks.scale.set(0.5, 0.5, 1); ks.position.copy(pos);
    ks.userData = { life: 1.5, vx: 0, vy: 0.02, vz: 0 }; scene.add(ks); explosions.push(ks);
  }

  KI.emit('explosion', { position: pos, type });
}
