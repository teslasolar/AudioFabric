// tone-genesis.js — Recursive parameter engine + procedural game from voice tone
// No hardcoded themes. Voice features seed a recursive param tree that generates
// everything: entities, physics, colors, shapes, scoring, world geometry.
// Web LLM narrates what it sees emerging.

import { KI } from './core.js';

// ── Recursive Parameter Tree ──
// Each param is derived from voice features + parent params via deterministic chaos
const P = {
  // Root seeds (set from voice each frame)
  pitch: 0, energy: 0, vowelCode: 0, centroid: 0, pulse: 0, coherence: 0,

  // Derived layer 1 (from root)
  hue: 0, saturation: 0, lightness: 0,
  gravity: 0, friction: 0, bounce: 0,
  spawnRate: 0, entityScale: 0, entitySpeed: 0,
  shapeComplexity: 0, trailLength: 0,

  // Derived layer 2 (from layer 1)
  playerSides: 3, playerRadius: 0.5, playerTrailHue: 0,
  enemySides: 4, enemyRadius: 0.3, enemyBehavior: 0,
  collectSides: 6, collectRadius: 0.15, collectValue: 1,
  bgNoiseScale: 1, bgNoiseSpeed: 0, bgWarp: 0,
  worldRadius: 8, worldSpin: 0, worldPulse: 0,

  // Derived layer 3 (from layer 2, recursive)
  subEntities: 0, fractalDepth: 0, harmonic: 0,
  scoreMultiplier: 1, difficultyRamp: 0, chaosLevel: 0
};

// Golden ratio for irrational seeding
const PHI = 1.618033988749;
const TAU = Math.PI * 2;

// Deterministic pseudo-random from seed
function hash(x) {
  x = ((x >> 16) ^ x) * 0x45d9f3b;
  x = ((x >> 16) ^ x) * 0x45d9f3b;
  x = (x >> 16) ^ x;
  return (x & 0x7fffffff) / 0x7fffffff;
}

function seedHash(a, b) {
  return hash(Math.floor(a * 10000) ^ Math.floor(b * 10000));
}

// Map voice to vowel code (0-5 continuous)
function vowelToCode(v) {
  const map = { 'ah': 0, 'eh': 1, 'ee': 2, 'oh': 3, 'oo': 4, 'mm': 5 };
  return map[v] ?? 2.5;
}

// ── Recursive param update ──
function updateParams(voice, fbState) {
  // Root seeds
  P.pitch = voice.pn || 0;
  P.energy = voice.energy || 0;
  P.vowelCode = vowelToCode(voice.vowel) / 5;
  P.centroid = fbState ? fbState.spectralCentroid / 8000 : 0.3;
  P.pulse = Math.min(1, (voice.pulseRate || 0) / 8);
  P.coherence = voice.coherence || 0;

  // Layer 1: voice → world params
  P.hue = (P.pitch * PHI + P.vowelCode * 0.3 + P.centroid * 0.2) % 1;
  P.saturation = 0.4 + P.energy * 0.5 + P.coherence * 0.1;
  P.lightness = 0.2 + P.pitch * 0.3 + P.energy * 0.2;
  P.gravity = 0.5 + P.pitch * 2 - P.energy * 0.8;
  P.friction = 0.92 + P.coherence * 0.07;
  P.bounce = 0.3 + P.vowelCode * 0.5 + P.energy * 0.3;
  P.spawnRate = 0.5 + P.pulse * 3 + P.energy * 2;
  P.entityScale = 0.3 + P.centroid * 0.8 + seedHash(P.pitch, P.vowelCode) * 0.4;
  P.entitySpeed = 0.5 + P.energy * 3 + P.pulse * 1.5;
  P.shapeComplexity = Math.floor(3 + P.centroid * 8 + P.coherence * 4);
  P.trailLength = Math.floor(5 + P.energy * 30 + P.coherence * 20);

  // Layer 2: param → entity definitions
  P.playerSides = Math.max(3, Math.floor(3 + P.vowelCode * 8));
  P.playerRadius = 0.3 + P.energy * 0.3;
  P.playerTrailHue = (P.hue + 0.5) % 1;
  P.enemySides = Math.max(3, Math.floor(3 + P.centroid * 10));
  P.enemyRadius = 0.15 + seedHash(P.pitch, P.energy) * 0.35;
  P.enemyBehavior = seedHash(P.vowelCode, P.centroid); // 0=orbit, 0.33=chase, 0.66=bounce, 1=spiral
  P.collectSides = Math.max(3, Math.floor(4 + P.coherence * 8));
  P.collectRadius = 0.08 + P.coherence * 0.12;
  P.collectValue = Math.floor(1 + P.energy * 5 + P.coherence * 10);
  P.bgNoiseScale = 0.5 + P.pitch * 2;
  P.bgNoiseSpeed = 0.1 + P.energy * 0.5;
  P.bgWarp = P.vowelCode * 0.5 + P.pulse * 0.3;
  P.worldRadius = 5 + P.centroid * 8;
  P.worldSpin = P.pulse * 0.3 + P.energy * 0.1;
  P.worldPulse = P.energy * 0.15;

  // Layer 3: recursive / emergent
  P.subEntities = Math.floor(P.energy * 3 + P.coherence * 2);
  P.fractalDepth = Math.min(5, Math.floor(1 + P.coherence * 4));
  P.harmonic = (P.pitch * P.vowelCode * PHI) % 1;
  P.scoreMultiplier = 1 + P.coherence * 5 + P.fractalDepth;
  P.difficultyRamp = P.pulse * 0.5 + P.energy * 0.3;
  P.chaosLevel = (1 - P.coherence) * P.energy;
}

// ── Game State ──
let group = null;
let player = null;
let playerTrail = null, trailPos = null, trailCol = null;
let entities = [];
let collectibles = [];
let bgMesh = null, bgGeo = null, bgPositions = null, bgColors = null;
let score = 0, combo = 0, hp = 100;
let playerX = 0, playerY = 0, playerVX = 0, playerVY = 0;
let spawnAccum = 0;
let gameTime = 0;
const MAX_ENTITIES = 60;
const MAX_COLLECTIBLES = 30;
const MAX_TRAIL = 80;
const BG_RES = 48; // background grid resolution

// LLM state
let llmPipeline = null, llmReady = false;
let lastNarration = 0, narrationCooldown = 8;
let currentNarration = '';

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 2, -1];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── Fractal background plane ──
  const bgW = BG_RES, bgH = BG_RES;
  bgGeo = new THREE.BufferGeometry();
  bgPositions = new Float32Array(bgW * bgH * 3);
  bgColors = new Float32Array(bgW * bgH * 3);
  const indices = [];
  for (let y = 0; y < bgH; y++) {
    for (let x = 0; x < bgW; x++) {
      const i = y * bgW + x;
      const fx = (x / (bgW - 1) - 0.5) * 20;
      const fy = (y / (bgH - 1) - 0.5) * 20;
      bgPositions[i * 3] = fx;
      bgPositions[i * 3 + 1] = fy;
      bgPositions[i * 3 + 2] = -5;
      if (x < bgW - 1 && y < bgH - 1) {
        const a = i, b = i + 1, c = i + bgW, d = i + bgW + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
  }
  bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPositions, 3));
  bgGeo.setAttribute('color', new THREE.BufferAttribute(bgColors, 3));
  bgGeo.setIndex(indices);
  bgMesh = new THREE.Mesh(bgGeo, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.6,
    side: THREE.DoubleSide, depthWrite: false
  }));
  group.add(bgMesh);

  // ── Player ──
  const pGeo = new THREE.BufferGeometry();
  // Will be rebuilt each frame based on P.playerSides
  player = new THREE.Mesh(
    new THREE.CircleGeometry(0.3, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false })
  );
  group.add(player);

  // ── Player trail ──
  const tGeo = new THREE.BufferGeometry();
  trailPos = new Float32Array(MAX_TRAIL * 3);
  trailCol = new Float32Array(MAX_TRAIL * 3);
  tGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  tGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
  playerTrail = new THREE.Points(tGeo, new THREE.PointsMaterial({
    size: 0.1, vertexColors: true, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(playerTrail);

  // ── Init LLM ──
  initLLM();

  KI.register('tone-genesis', {
    update, state: { P, score, combo, hp },
    getParams: () => P, group
  });

  KI.emit('tone-genesis:ready');
}

// ── Simplex-like noise (fast 2D) ──
function noise2D(x, y) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x), yf = y - Math.floor(y);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const aa = hash(X + hash(Y) * 1000);
  const ba = hash(X + 1 + hash(Y) * 1000);
  const ab = hash(X + hash(Y + 1) * 1000);
  const bb = hash(X + 1 + hash(Y + 1) * 1000);
  return aa + u * (ba - aa) + v * (ab - aa) + u * v * (aa - ba - ab + bb);
}

function fbm(x, y, octaves) {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * noise2D(x * freq, y * freq);
    amp *= 0.5;
    freq *= 2.1;
  }
  return val;
}

// ── Build polygon shape ──
function makePolygon(sides, radius) {
  const geo = new THREE.BufferGeometry();
  const verts = new Float32Array((sides + 1) * 3);
  // center
  verts[0] = verts[1] = verts[2] = 0;
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * TAU;
    verts[(i + 1) * 3] = Math.cos(a) * radius;
    verts[(i + 1) * 3 + 1] = Math.sin(a) * radius;
    verts[(i + 1) * 3 + 2] = 0;
  }
  const idx = [];
  for (let i = 0; i < sides; i++) {
    idx.push(0, i + 1, ((i + 1) % sides) + 1);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setIndex(idx);
  return geo;
}

// ── Entity behaviors (all from P, not hardcoded) ──
function entityBehavior(e, dt, t) {
  const b = e.behavior;
  if (b < 0.25) {
    // Orbit: circle around center
    e.angle += dt * e.speed;
    e.x = Math.cos(e.angle) * e.orbitR;
    e.y = Math.sin(e.angle) * e.orbitR;
  } else if (b < 0.5) {
    // Chase: move toward player
    const dx = playerX - e.x, dy = playerY - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    e.vx += (dx / d) * e.speed * dt * 2;
    e.vy += (dy / d) * e.speed * dt * 2;
    e.vx *= 0.98; e.vy *= 0.98;
    e.x += e.vx * dt; e.y += e.vy * dt;
  } else if (b < 0.75) {
    // Bounce: bounce off world boundary
    e.x += e.vx * dt; e.y += e.vy * dt;
    e.vy -= P.gravity * dt * 0.3;
    const r = Math.sqrt(e.x * e.x + e.y * e.y);
    if (r > P.worldRadius * 0.8) {
      e.vx *= -P.bounce; e.vy *= -P.bounce;
      const nx = e.x / r, ny = e.y / r;
      e.x = nx * P.worldRadius * 0.79;
      e.y = ny * P.worldRadius * 0.79;
    }
  } else {
    // Spiral: inward/outward spiral
    e.angle += dt * e.speed * 0.5;
    e.orbitR += Math.sin(t * 0.5 + e.phase) * dt * 1.5;
    e.orbitR = Math.max(1, Math.min(P.worldRadius * 0.8, e.orbitR));
    e.x = Math.cos(e.angle) * e.orbitR;
    e.y = Math.sin(e.angle) * e.orbitR;
  }
}

// ── Spawn entity ──
function spawnEntity() {
  if (entities.length >= MAX_ENTITIES) return;
  const angle = Math.random() * TAU;
  const r = P.worldRadius * (0.4 + Math.random() * 0.5);
  const sides = P.enemySides + Math.floor((Math.random() - 0.5) * 3);
  const radius = P.enemyRadius * (0.7 + Math.random() * 0.6);
  const geo = makePolygon(Math.max(3, sides), radius);
  const hue = (P.hue + Math.random() * 0.3 - 0.15) % 1;
  const rgb = KI.hslToRgb(Math.abs(hue), P.saturation, P.lightness);
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(rgb[0], rgb[1], rgb[2]),
    transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  group.add(mesh);
  const speed = P.entitySpeed * (0.5 + Math.random());
  const behavior = P.enemyBehavior + (Math.random() - 0.5) * 0.15;
  entities.push({
    mesh, x: Math.cos(angle) * r, y: Math.sin(angle) * r,
    vx: (Math.random() - 0.5) * speed, vy: (Math.random() - 0.5) * speed,
    speed, behavior: Math.abs(behavior) % 1, angle: angle, orbitR: r,
    phase: Math.random() * TAU, radius, life: 10 + Math.random() * 20,
    sides: Math.max(3, sides), hue
  });
}

// ── Spawn collectible ──
function spawnCollectible() {
  if (collectibles.length >= MAX_COLLECTIBLES) return;
  const angle = Math.random() * TAU;
  const r = Math.random() * P.worldRadius * 0.7;
  const sides = P.collectSides;
  const radius = P.collectRadius * (0.8 + Math.random() * 0.4);
  const geo = makePolygon(Math.max(3, sides), radius);
  const hue = (P.hue + 0.33 + Math.random() * 0.1) % 1;
  const rgb = KI.hslToRgb(hue, 0.9, 0.6);
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(rgb[0], rgb[1], rgb[2]),
    transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  group.add(mesh);
  collectibles.push({
    mesh, x: Math.cos(angle) * r, y: Math.sin(angle) * r,
    radius, bobPhase: Math.random() * TAU, value: P.collectValue
  });
}

// ── Update background ──
function updateBackground(t) {
  const sc = P.bgNoiseScale;
  const sp = P.bgNoiseSpeed;
  const warp = P.bgWarp;
  const depth = Math.max(2, P.fractalDepth);

  for (let y = 0; y < BG_RES; y++) {
    for (let x = 0; x < BG_RES; x++) {
      const i = y * BG_RES + x;
      const fx = (x / (BG_RES - 1) - 0.5) * 10;
      const fy = (y / (BG_RES - 1) - 0.5) * 10;
      // Warped noise
      const wx = fx + Math.sin(fy * warp + t * sp) * warp;
      const wy = fy + Math.cos(fx * warp + t * sp * 0.7) * warp;
      const n = fbm(wx * sc * 0.3, wy * sc * 0.3 + t * sp * 0.1, depth);
      // Height displacement
      bgPositions[i * 3 + 2] = -5 + n * 2 + P.worldPulse * Math.sin(t * 2);
      // Color from params
      const h = (P.hue + n * 0.3 + P.harmonic * 0.2) % 1;
      const s = P.saturation * 0.6;
      const l = 0.05 + n * P.lightness * 0.4;
      const rgb = KI.hslToRgb(Math.abs(h), Math.min(1, s), Math.min(1, l));
      bgColors[i * 3] = rgb[0];
      bgColors[i * 3 + 1] = rgb[1];
      bgColors[i * 3 + 2] = rgb[2];
    }
  }
  bgGeo.attributes.position.needsUpdate = true;
  bgGeo.attributes.color.needsUpdate = true;
}

// ── LLM ──
function initLLM() {
  if (typeof window !== 'undefined' && window.transformers) {
    loadLLM();
  }
}

async function loadLLM() {
  try {
    const { pipeline } = window.transformers;
    llmPipeline = await pipeline('text-generation', 'Qwen/Qwen2.5-0.5B', {
      device: 'webgpu', dtype: 'q4'
    });
    llmReady = true;
    KI.emit('tone-genesis:llm-ready');
  } catch (e) {
    console.warn('LLM unavailable:', e.message);
  }
}

async function generateNarration(t) {
  if (!llmReady || !llmPipeline) return;
  if (t - lastNarration < narrationCooldown) return;
  lastNarration = t;

  const prompt = `You are narrating a procedural video game being generated from voice. Describe what you see in 1 short poetic sentence.
State: pitch=${P.pitch.toFixed(2)}, energy=${P.energy.toFixed(2)}, shapes=${P.playerSides}/${P.enemySides}sides, hue=${P.hue.toFixed(2)}, chaos=${P.chaosLevel.toFixed(2)}, depth=${P.fractalDepth}, score=${score}, entities=${entities.length}
Narration:`;

  try {
    const result = await llmPipeline(prompt, { max_new_tokens: 30, temperature: 0.8, do_sample: true });
    const text = result[0].generated_text.split('Narration:').pop().trim().split('\n')[0].trim();
    if (text.length > 3) {
      currentNarration = text.slice(0, 80);
      KI.emit('tone-genesis:narration', { text: currentNarration });
    }
  } catch (e) { /* ignore */ }
}

// ── Main Update ──
function update(dt, t) {
  gameTime = t;
  const fb = KI.get('freq-bands-12');
  const fbState = fb?.state;
  const v = KI.voice;

  // Update recursive params from voice
  updateParams(v, fbState);

  // Player movement driven by voice
  if (v.sounding) {
    // Pitch = vertical, vowel = horizontal
    const targetX = (P.vowelCode - 0.5) * P.worldRadius * 1.2;
    const targetY = (P.pitch - 0.5) * P.worldRadius * 1.2;
    playerVX += (targetX - playerX) * 3 * dt;
    playerVY += (targetY - playerY) * 3 * dt;
  }
  // Apply physics
  playerVX *= P.friction;
  playerVY *= P.friction;
  playerX += playerVX * dt;
  playerY += playerVY * dt;
  // Boundary
  const pr = Math.sqrt(playerX * playerX + playerY * playerY);
  if (pr > P.worldRadius) {
    playerX *= P.worldRadius / pr;
    playerY *= P.worldRadius / pr;
    playerVX *= -0.5; playerVY *= -0.5;
  }

  // Update player mesh
  player.position.set(playerX, playerY, 0);
  const pRgb = KI.hslToRgb(P.playerTrailHue, 0.9, 0.5 + P.energy * 0.3);
  player.material.color.setRGB(pRgb[0], pRgb[1], pRgb[2]);
  player.material.opacity = 0.7 + P.energy * 0.3;
  // Rebuild player shape if sides changed
  const newGeo = makePolygon(P.playerSides, P.playerRadius);
  player.geometry.dispose();
  player.geometry = newGeo;
  player.rotation.z += dt * (1 + P.energy * 3);

  // Update trail
  for (let i = MAX_TRAIL - 1; i > 0; i--) {
    trailPos[i * 3] = trailPos[(i - 1) * 3];
    trailPos[i * 3 + 1] = trailPos[(i - 1) * 3 + 1];
    trailPos[i * 3 + 2] = trailPos[(i - 1) * 3 + 2];
    trailCol[i * 3] = trailCol[(i - 1) * 3] * 0.97;
    trailCol[i * 3 + 1] = trailCol[(i - 1) * 3 + 1] * 0.97;
    trailCol[i * 3 + 2] = trailCol[(i - 1) * 3 + 2] * 0.97;
  }
  trailPos[0] = playerX; trailPos[1] = playerY; trailPos[2] = 0;
  trailCol[0] = pRgb[0]; trailCol[1] = pRgb[1]; trailCol[2] = pRgb[2];
  playerTrail.geometry.attributes.position.needsUpdate = true;
  playerTrail.geometry.attributes.color.needsUpdate = true;
  playerTrail.geometry.setDrawRange(0, Math.min(MAX_TRAIL, P.trailLength));
  playerTrail.material.size = 0.06 + P.energy * 0.08;

  // Spawn entities
  spawnAccum += P.spawnRate * dt;
  while (spawnAccum >= 1) {
    spawnAccum -= 1;
    if (Math.random() < 0.65) spawnEntity();
    else spawnCollectible();
  }

  // Update entities
  for (let i = entities.length - 1; i >= 0; i--) {
    const e = entities[i];
    entityBehavior(e, dt, t);
    e.mesh.position.set(e.x, e.y, 0);
    e.mesh.rotation.z += dt * (0.5 + e.speed * 0.2);
    e.life -= dt;

    // Collision with player
    const dx = e.x - playerX, dy = e.y - playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < e.radius + P.playerRadius) {
      // Hit! Damage based on chaos
      hp -= 5 + P.chaosLevel * 10;
      combo = 0;
      KI.emit('tone-genesis:hit', { damage: 5 + P.chaosLevel * 10 });
      // Destroy entity
      group.remove(e.mesh);
      e.mesh.geometry.dispose();
      e.mesh.material.dispose();
      entities.splice(i, 1);
      continue;
    }

    // Age out
    if (e.life <= 0) {
      group.remove(e.mesh);
      e.mesh.geometry.dispose();
      e.mesh.material.dispose();
      entities.splice(i, 1);
    }
  }

  // Update collectibles
  for (let i = collectibles.length - 1; i >= 0; i--) {
    const c = collectibles[i];
    c.mesh.position.set(c.x, c.y + Math.sin(t * 3 + c.bobPhase) * 0.1, 0);
    c.mesh.rotation.z += dt;

    const dx = c.x - playerX, dy = c.y - playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < c.radius + P.playerRadius) {
      // Collect!
      combo++;
      const pts = Math.floor(c.value * P.scoreMultiplier * (1 + combo * 0.1));
      score += pts;
      KI.emit('tone-genesis:collect', { points: pts, combo });
      group.remove(c.mesh);
      c.mesh.geometry.dispose();
      c.mesh.material.dispose();
      collectibles.splice(i, 1);
    }
  }

  // HP regen when singing coherently
  if (P.coherence > 0.3) hp = Math.min(100, hp + dt * 5 * P.coherence);

  // Update background
  updateBackground(t);

  // World spin
  group.rotation.z += P.worldSpin * dt;

  // LLM narration
  generateNarration(t);

  // Emit state
  KI.emit('tone-genesis:update', {
    score, combo, hp, params: P,
    entityCount: entities.length,
    collectibleCount: collectibles.length,
    narration: currentNarration
  });
}
