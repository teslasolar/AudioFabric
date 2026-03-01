// emoji-system.js — 3D orbiting emotion emojis based on player state
import { KI } from './core.js';

const EMOTIONS = {
  idle:      ['😴', '💤'],
  charging1: ['😤', '💪'],
  charging2: ['😤', '💪', '🔥', '⚡'],
  firing:    ['💥', '🤯', '💀', '☠️', '🌟'],
  combo:     ['🔥', '🔥', '🔥'],
  bigHit:    ['💣', '💥', '✨'],
  spiritBomb:['🌍', '✨', '💫', '🙏'],
  ko:        ['💀', '☠️', '👑', '🏆']
};

const emojiSprites = [];      // { sprite, orbit, life, fadeIn }
const remoteEmojis = new Map(); // peerId -> sprite[]
let currentState = 'idle';
let stateTimer = 0;
const emojiCache = {};

export function init() {
  KI.on('charge:update', onCharge);
  KI.on('blast:fired', () => spawnEmojis('firing', getPlayerPos()));
  KI.on('hit', data => {
    if (data.combo >= 3) spawnEmojis('combo', getTargetPos());
    if (data.dmg > 300) spawnEmojis('bigHit', getTargetPos());
  });
  KI.on('ko', () => spawnEmojis('ko', getTargetPos()));

  KI.register('emoji-system', { update, spawnEmojis });
}

function getPlayerPos() { return KI._scene?.aura?.position || new THREE.Vector3(0, 2.5, 5); }
function getTargetPos() { return KI.target.mesh?.position || new THREE.Vector3(0, 2.5, -8); }

function onCharge(data) {
  const cl = data.chargeLevel;
  let newState;
  if (cl < 0.05) newState = 'idle';
  else if (cl < 0.4) newState = 'charging1';
  else if (data.chargeType === 'spiritbomb' && cl > 0.5) newState = 'spiritBomb';
  else newState = 'charging2';

  if (newState !== currentState) {
    currentState = newState;
    stateTimer += 0.016;
    if (stateTimer > 0.3) {
      stateTimer = 0;
      spawnEmojis(currentState, getPlayerPos());
    }
  }
}

function createEmojiTexture(emoji) {
  if (emojiCache[emoji]) return emojiCache[emoji];
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  // glow behind
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 20;
  ctx.font = '80px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 64);
  ctx.shadowBlur = 0;
  ctx.fillText(emoji, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  emojiCache[emoji] = tex;
  return tex;
}

function spawnEmojis(state, center) {
  const emojis = EMOTIONS[state] || EMOTIONS.idle;
  const scene = KI.scene;
  if (!scene) return;

  emojis.forEach((emoji, idx) => {
    const tex = createEmojiTexture(emoji);
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const sprite = new THREE.Sprite(mat);
    const scale = 0.5 + Math.random() * 0.3;
    sprite.scale.set(scale, scale, 1);

    const angle = (idx / emojis.length) * Math.PI * 2 + Math.random() * 0.5;
    const radius = 1.2 + Math.random() * 1.5;
    const height = (Math.random() - 0.5) * 2;

    sprite.position.set(
      center.x + Math.cos(angle) * radius,
      center.y + height,
      center.z + Math.sin(angle) * radius
    );

    scene.add(sprite);
    emojiSprites.push({
      sprite,
      cx: center.x, cy: center.y, cz: center.z,
      angle, radius, height,
      life: 2.5 + Math.random(),
      fadeIn: 0,
      spinSpeed: 0.3 + Math.random() * 0.5,
      bobSpeed: 1 + Math.random() * 2,
      bobAmp: 0.1 + Math.random() * 0.2
    });
  });
}

function update(dt, t) {
  const scene = KI.scene;
  if (!scene) return;

  for (let i = emojiSprites.length - 1; i >= 0; i--) {
    const e = emojiSprites[i];
    e.life -= dt;
    e.fadeIn = Math.min(1, e.fadeIn + dt * 3);

    // orbit
    e.angle += e.spinSpeed * dt;
    e.sprite.position.x = e.cx + Math.cos(e.angle) * e.radius;
    e.sprite.position.y = e.cy + e.height + Math.sin(t * e.bobSpeed) * e.bobAmp;
    e.sprite.position.z = e.cz + Math.sin(e.angle) * e.radius;

    // fade
    const fadeOut = e.life < 0.5 ? e.life / 0.5 : 1;
    e.sprite.material.opacity = e.fadeIn * fadeOut * 0.8;

    // grow slightly over time
    const s = e.sprite.scale.x * (1 + dt * 0.05);
    e.sprite.scale.set(s, s, 1);

    if (e.life <= 0) {
      scene.remove(e.sprite);
      emojiSprites.splice(i, 1);
    }
  }
}
