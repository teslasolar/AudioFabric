// story-world.js — Procedural narrative world shaped by voice
// Voice creates terrain, weather, creatures, structures.
// Web LLM generates story text, character dialogue, and world lore.
// pitch → altitude/sky, energy → weather intensity, vowel → biome,
// coherence → story coherence, pulse → creature spawning

import { KI } from './core.js';

const TAU = Math.PI * 2;
const GRID = 32; // terrain grid
const MAX_CREATURES = 40;
const MAX_STRUCTURES = 20;
const MAX_PARTICLES = 500;

// Biomes derived from vowel
const BIOMES = [
  { name: 'Ember Plains', ground: [0.6, 0.3, 0.1], sky: [0.15, 0.02, 0.0], particle: [1, 0.5, 0.2] },
  { name: 'Crystal Tundra', ground: [0.7, 0.75, 0.85], sky: [0.05, 0.05, 0.15], particle: [0.6, 0.8, 1] },
  { name: 'Luminous Jungle', ground: [0.1, 0.5, 0.15], sky: [0.0, 0.08, 0.02], particle: [0.3, 1, 0.4] },
  { name: 'Void Desert', ground: [0.3, 0.2, 0.35], sky: [0.02, 0.0, 0.05], particle: [0.7, 0.3, 1] },
  { name: 'Abyssal Ocean', ground: [0.05, 0.15, 0.4], sky: [0.0, 0.02, 0.08], particle: [0.2, 0.5, 1] },
  { name: 'Harmonic Meadow', ground: [0.3, 0.5, 0.2], sky: [0.05, 0.03, 0.08], particle: [0.8, 0.9, 0.4] }
];

let group = null;
let terrain = null, terrainGeo = null, terrainPos = null, terrainCol = null;
let skyDome = null;
let creatures = [];
let structures = [];
let weatherParticles = null, wpPos = null, wpCol = null;
let storyTextMesh = null;

// World state
let currentBiome = 0;
let worldAge = 0;
let storyChapter = 0;
let weatherType = 'clear'; // clear, rain, storm, snow, aurora, ash
let dayNightCycle = 0;
let creatureSpawnAccum = 0;

// Story state
let storyLog = [];
let currentStory = '';
let characterName = '';
let worldName = '';

// LLM
let llmPipeline = null, llmReady = false;
let lastStoryTime = 0;

// Noise functions
function hash(x) {
  x = ((x >> 16) ^ x) * 0x45d9f3b;
  x = ((x >> 16) ^ x) * 0x45d9f3b;
  return ((x >> 16) ^ x) & 0x7fffffff;
}
function noise2D(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const h = (a, b) => (hash(a * 374761 + b * 668265) & 0xffff) / 0xffff;
  return h(ix, iy) * (1-u) * (1-v) + h(ix+1, iy) * u * (1-v) +
         h(ix, iy+1) * (1-u) * v + h(ix+1, iy+1) * u * v;
}
function fbm(x, y, oct) {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += a * noise2D(x*f, y*f); a *= 0.5; f *= 2.1; }
  return v;
}

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 0, 0];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // Generate world name
  const syllables = ['Ael','Tho','Mir','Vel','Kaz','Ori','Zan','Lum','Pha','Xen'];
  worldName = syllables[Math.floor(Math.random()*syllables.length)] +
              syllables[Math.floor(Math.random()*syllables.length)].toLowerCase();
  characterName = 'The Voice';

  // ── Terrain mesh ──
  terrainGeo = new THREE.BufferGeometry();
  terrainPos = new Float32Array(GRID * GRID * 3);
  terrainCol = new Float32Array(GRID * GRID * 3);
  const idx = [];
  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      const i = z * GRID + x;
      terrainPos[i*3] = (x - GRID/2) * 0.5;
      terrainPos[i*3+1] = 0;
      terrainPos[i*3+2] = (z - GRID/2) * 0.5 - 4;
      if (x < GRID-1 && z < GRID-1) {
        const a = i, b = i+1, c = i+GRID, d = i+GRID+1;
        idx.push(a,b,c, b,d,c);
      }
    }
  }
  terrainGeo.setAttribute('position', new THREE.BufferAttribute(terrainPos, 3));
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(terrainCol, 3));
  terrainGeo.setIndex(idx);
  terrain = new THREE.Mesh(terrainGeo, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.8,
    side: THREE.DoubleSide, depthWrite: false
  }));
  group.add(terrain);

  // ── Sky dome ──
  const skyGeo = new THREE.SphereGeometry(20, 32, 16, 0, TAU, 0, Math.PI/2);
  skyDome = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({
    color: 0x000820, transparent: true, opacity: 0.4,
    side: THREE.BackSide, depthWrite: false
  }));
  skyDome.position.y = -2;
  group.add(skyDome);

  // ── Weather particles ──
  const wGeo = new THREE.BufferGeometry();
  wpPos = new Float32Array(MAX_PARTICLES * 3);
  wpCol = new Float32Array(MAX_PARTICLES * 3);
  for (let i = 0; i < MAX_PARTICLES; i++) {
    wpPos[i*3] = (Math.random()-0.5) * 16;
    wpPos[i*3+1] = Math.random() * 10;
    wpPos[i*3+2] = (Math.random()-0.5) * 16 - 4;
  }
  wGeo.setAttribute('position', new THREE.BufferAttribute(wpPos, 3));
  wGeo.setAttribute('color', new THREE.BufferAttribute(wpCol, 3));
  weatherParticles = new THREE.Points(wGeo, new THREE.PointsMaterial({
    size: 0.06, vertexColors: true, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(weatherParticles);

  // ── LLM ──
  initLLM();

  KI.register('story-world', {
    update, group,
    state: { worldName, biome: '', story: '', chapter: 0 },
    getWorldName: () => worldName
  });

  KI.emit('story-world:ready');
}

// Creature types generated from params
function spawnCreature(biome, energy, pitch) {
  if (creatures.length >= MAX_CREATURES) return;
  const b = BIOMES[biome];
  const sides = 3 + Math.floor(pitch * 8);
  const size = 0.1 + energy * 0.3;
  const speed = 0.5 + energy * 2;
  const geo = new THREE.BufferGeometry();
  const verts = new Float32Array((sides + 1) * 3);
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * TAU;
    verts[(i+1)*3] = Math.cos(a) * size;
    verts[(i+1)*3+1] = Math.sin(a) * size;
  }
  const idxArr = [];
  for (let i = 0; i < sides; i++) idxArr.push(0, i+1, ((i+1)%sides)+1);
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setIndex(idxArr);
  const hue = (biome / 6 + pitch * 0.3) % 1;
  const rgb = KI.hslToRgb(hue, 0.8, 0.5);
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(rgb[0], rgb[1], rgb[2]),
    transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  const x = (Math.random() - 0.5) * 12;
  const z = (Math.random() - 0.5) * 12 - 4;
  mesh.position.set(x, 0.5, z);
  group.add(mesh);
  creatures.push({
    mesh, x, z, speed, phase: Math.random() * TAU,
    behavior: Math.random(), life: 8 + Math.random() * 15,
    sides, name: generateCreatureName(sides, biome)
  });
}

function generateCreatureName(sides, biome) {
  const prefixes = ['Tri','Quad','Pent','Hex','Sept','Oct','Non','Dec','Und','Dodec'];
  const suffixes = ['phant','lisk','worm','sprite','shade','golem','wisp','drake'];
  return (prefixes[sides-3] || 'Poly') + suffixes[biome % suffixes.length];
}

function spawnStructure(biome, coherence, pitch) {
  if (structures.length >= MAX_STRUCTURES) return;
  const height = 0.5 + coherence * 3 + pitch * 2;
  const width = 0.2 + Math.random() * 0.4;
  const geo = new THREE.BoxGeometry(width, height, width);
  const b = BIOMES[biome];
  const rgb = [b.ground[0] * 1.5, b.ground[1] * 1.5, b.ground[2] * 1.5];
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(Math.min(1,rgb[0]), Math.min(1,rgb[1]), Math.min(1,rgb[2])),
    transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  const x = (Math.random() - 0.5) * 10;
  const z = (Math.random() - 0.5) * 10 - 4;
  mesh.position.set(x, height/2, z);
  group.add(mesh);
  structures.push({ mesh, age: 0, maxAge: 20 + Math.random() * 30 });
}

// ── LLM ──
function initLLM() {
  if (typeof window !== 'undefined' && window.transformers) loadLLM();
}

async function loadLLM() {
  try {
    const { pipeline } = window.transformers;
    llmPipeline = await pipeline('text-generation', 'Qwen/Qwen2.5-0.5B', {
      device: 'webgpu', dtype: 'q4'
    });
    llmReady = true;
    KI.emit('story-world:llm-ready');
  } catch (e) { console.warn('Story LLM unavailable:', e.message); }
}

async function generateStory(t) {
  if (!llmReady || t - lastStoryTime < 10) return;
  lastStoryTime = t;
  const biome = BIOMES[currentBiome];
  const prompt = `You are narrating an adventure in ${worldName}, a ${biome.name}. ${characterName} speaks and the world reshapes. Creatures: ${creatures.length}. Weather: ${weatherType}. Chapter ${storyChapter + 1}.
Write 1 short, evocative sentence continuing the story.
Story:`;
  try {
    const result = await llmPipeline(prompt, { max_new_tokens: 35, temperature: 0.85, do_sample: true });
    const text = result[0].generated_text.split('Story:').pop().trim().split('\n')[0].trim();
    if (text.length > 5) {
      currentStory = text.slice(0, 100);
      storyLog.push(currentStory);
      if (storyLog.length > 20) storyLog.shift();
      KI.emit('story-world:narration', { text: currentStory, chapter: storyChapter });
    }
  } catch (e) { /* ignore */ }
}

function update(dt, t) {
  const v = KI.voice;
  const fb = KI.get('freq-bands-12');
  const fbState = fb?.state;
  worldAge += dt;

  // ── Voice → world params ──
  const energy = v.energy || 0;
  const pitch = v.pn || 0;
  const coherence = v.coherence || 0;
  const pulse = Math.min(1, (v.pulseRate || 0) / 8);

  // Vowel → biome
  const vowelBiome = { 'ah': 0, 'eh': 1, 'ee': 2, 'oh': 3, 'oo': 4, 'mm': 5 };
  const targetBiome = vowelBiome[v.vowel] ?? currentBiome;
  if (targetBiome !== currentBiome && energy > 0.15) {
    currentBiome = targetBiome;
    storyChapter++;
    KI.emit('story-world:biome-change', {
      biome: BIOMES[currentBiome].name, chapter: storyChapter
    });
  }
  const biome = BIOMES[currentBiome];

  // Energy → weather
  if (energy > 0.6) weatherType = 'storm';
  else if (energy > 0.4) weatherType = 'rain';
  else if (pitch > 0.7) weatherType = 'aurora';
  else if (coherence > 0.6) weatherType = 'snow';
  else if (currentBiome === 0) weatherType = 'ash';
  else weatherType = 'clear';

  // Day/night from pitch
  dayNightCycle = pitch;

  // ── Update terrain ──
  const terrainSeed = currentBiome * 100 + Math.floor(worldAge * 0.01);
  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      const i = z * GRID + x;
      const fx = x / GRID, fz = z / GRID;
      // Height from fbm + voice
      const h = fbm(fx * 3 + terrainSeed * 0.001, fz * 3, 4) * 3 * (0.5 + pitch);
      const voiceH = v.sounding ? Math.sin(fx * TAU * 2 + t * 2) * energy * 0.5 : 0;
      terrainPos[i*3+1] = h + voiceH - 1;
      // Color: blend biome ground with height
      const bright = 0.3 + h * 0.2 + energy * 0.2;
      terrainCol[i*3] = biome.ground[0] * bright;
      terrainCol[i*3+1] = biome.ground[1] * bright;
      terrainCol[i*3+2] = biome.ground[2] * bright;
    }
  }
  terrainGeo.attributes.position.needsUpdate = true;
  terrainGeo.attributes.color.needsUpdate = true;
  terrainGeo.computeVertexNormals();

  // ── Sky color ──
  const skyR = biome.sky[0] + dayNightCycle * 0.1 + energy * 0.05;
  const skyG = biome.sky[1] + dayNightCycle * 0.08;
  const skyB = biome.sky[2] + dayNightCycle * 0.15 + coherence * 0.05;
  skyDome.material.color.setRGB(
    Math.min(1, skyR), Math.min(1, skyG), Math.min(1, skyB)
  );
  skyDome.material.opacity = 0.3 + energy * 0.2;

  // ── Spawn creatures on pulse ──
  creatureSpawnAccum += pulse * dt * 2 + energy * dt;
  if (creatureSpawnAccum >= 1 && v.sounding) {
    creatureSpawnAccum -= 1;
    spawnCreature(currentBiome, energy, pitch);
    KI.emit('story-world:creature-spawn', {
      name: creatures[creatures.length - 1]?.name,
      count: creatures.length
    });
  }

  // Spawn structures from coherence
  if (coherence > 0.5 && Math.random() < coherence * dt * 0.3) {
    spawnStructure(currentBiome, coherence, pitch);
  }

  // ── Update creatures ──
  for (let i = creatures.length - 1; i >= 0; i--) {
    const c = creatures[i];
    c.life -= dt;
    c.phase += dt;
    // Behavior
    if (c.behavior < 0.33) {
      // Wander
      c.x += Math.sin(c.phase * c.speed) * dt;
      c.z += Math.cos(c.phase * c.speed * 0.7) * dt;
    } else if (c.behavior < 0.66) {
      // Circle
      c.x = Math.cos(c.phase * 0.5) * 4;
      c.z = Math.sin(c.phase * 0.5) * 4 - 4;
    } else {
      // Drift up
      c.mesh.position.y += dt * 0.3;
    }
    c.mesh.position.x = c.x;
    c.mesh.position.z = c.z;
    c.mesh.rotation.z += dt;
    // Voice reaction
    if (v.sounding) {
      c.mesh.scale.setScalar(1 + energy * 0.5);
      c.mesh.material.opacity = 0.5 + energy * 0.4;
    } else {
      c.mesh.scale.setScalar(1);
      c.mesh.material.opacity = 0.4;
    }
    // Age out
    if (c.life <= 0 || c.mesh.position.y > 8) {
      group.remove(c.mesh);
      c.mesh.geometry.dispose();
      c.mesh.material.dispose();
      creatures.splice(i, 1);
    }
  }

  // ── Update structures ──
  for (let i = structures.length - 1; i >= 0; i--) {
    const s = structures[i];
    s.age += dt;
    // Pulse with voice
    if (v.sounding) {
      s.mesh.scale.y = 1 + energy * 0.3 * Math.sin(t * 3 + i);
    }
    if (s.age > s.maxAge) {
      group.remove(s.mesh);
      s.mesh.geometry.dispose();
      s.mesh.material.dispose();
      structures.splice(i, 1);
    }
  }

  // ── Weather particles ──
  const wp = biome.particle;
  for (let i = 0; i < MAX_PARTICLES; i++) {
    let active = false;
    if (weatherType === 'rain') {
      wpPos[i*3+1] -= dt * 8;
      if (wpPos[i*3+1] < -1) wpPos[i*3+1] = 10;
      wpCol[i*3] = 0.3; wpCol[i*3+1] = 0.5; wpCol[i*3+2] = 1;
      active = true;
    } else if (weatherType === 'snow') {
      wpPos[i*3+1] -= dt * 1.5;
      wpPos[i*3] += Math.sin(t + i * 0.1) * dt * 0.5;
      if (wpPos[i*3+1] < -1) wpPos[i*3+1] = 10;
      wpCol[i*3] = 0.9; wpCol[i*3+1] = 0.95; wpCol[i*3+2] = 1;
      active = true;
    } else if (weatherType === 'storm') {
      wpPos[i*3+1] -= dt * 12;
      wpPos[i*3] += (Math.random()-0.5) * dt * 3;
      if (wpPos[i*3+1] < -1) { wpPos[i*3+1] = 10; wpPos[i*3] = (Math.random()-0.5)*16; }
      wpCol[i*3] = 0.8; wpCol[i*3+1] = 0.8; wpCol[i*3+2] = 1;
      active = true;
    } else if (weatherType === 'aurora') {
      wpPos[i*3] += Math.sin(t * 0.5 + i * 0.05) * dt * 0.8;
      wpPos[i*3+1] = 5 + Math.sin(t * 0.3 + i * 0.1) * 3;
      const h = (i / MAX_PARTICLES + t * 0.1) % 1;
      const rgb = KI.hslToRgb(h, 0.9, 0.5);
      wpCol[i*3] = rgb[0]; wpCol[i*3+1] = rgb[1]; wpCol[i*3+2] = rgb[2];
      active = true;
    } else if (weatherType === 'ash') {
      wpPos[i*3+1] -= dt * 0.8;
      wpPos[i*3] += Math.sin(t * 0.3 + i) * dt * 0.3;
      if (wpPos[i*3+1] < -1) wpPos[i*3+1] = 10;
      wpCol[i*3] = 0.5; wpCol[i*3+1] = 0.3; wpCol[i*3+2] = 0.2;
      active = true;
    }
    if (!active) {
      wpCol[i*3] = wpCol[i*3+1] = wpCol[i*3+2] = 0;
    }
  }
  weatherParticles.geometry.attributes.position.needsUpdate = true;
  weatherParticles.geometry.attributes.color.needsUpdate = true;
  weatherParticles.material.opacity = weatherType === 'clear' ? 0 : 0.5 + energy * 0.3;
  weatherParticles.material.size = weatherType === 'snow' ? 0.1 : weatherType === 'aurora' ? 0.15 : 0.04;

  // ── LLM story generation ──
  generateStory(t);

  // ── Group gentle rotation ──
  group.rotation.y += dt * 0.02 * (1 + energy * 0.5);

  // ── Emit state ──
  KI.emit('story-world:update', {
    worldName,
    biome: biome.name,
    weather: weatherType,
    chapter: storyChapter,
    creatures: creatures.length,
    structures: structures.length,
    story: currentStory,
    dayNight: dayNightCycle.toFixed(2),
    worldAge: Math.floor(worldAge)
  });
}
