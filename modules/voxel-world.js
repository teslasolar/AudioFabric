// voxel-world.js — Voice-controlled Minecraft + Web LLM
// Speak to build, destroy, terraform, and explore a voxel world.
// Voice pitch → build height, vowels → block types, volume → blast radius
// Web LLM interprets natural language commands: "build a tower", "dig a hole", "make it rain"

import { KI } from './core.js';

// ── World Constants ──
const CHUNK_W = 32, CHUNK_D = 32, MAX_H = 24;
const BLOCK_SIZE = 0.4;
const MAX_BLOCKS = CHUNK_W * CHUNK_D * MAX_H;
const HALF_W = (CHUNK_W * BLOCK_SIZE) / 2;
const HALF_D = (CHUNK_D * BLOCK_SIZE) / 2;

// Block types with colors (HSL)
const BLOCK_TYPES = {
  air:       { id: 0, h: 0,    s: 0,   l: 0 },
  dirt:      { id: 1, h: 0.08, s: 0.6, l: 0.25 },
  grass:     { id: 2, h: 0.33, s: 0.7, l: 0.35 },
  stone:     { id: 3, h: 0.0,  s: 0.0, l: 0.4 },
  sand:      { id: 4, h: 0.13, s: 0.8, l: 0.6 },
  water:     { id: 5, h: 0.58, s: 0.9, l: 0.45 },
  lava:      { id: 6, h: 0.05, s: 1.0, l: 0.5 },
  wood:      { id: 7, h: 0.08, s: 0.5, l: 0.3 },
  leaf:      { id: 8, h: 0.35, s: 0.8, l: 0.4 },
  crystal:   { id: 9, h: 0.75, s: 1.0, l: 0.6 },
  gold:      { id: 10, h: 0.14, s: 1.0, l: 0.55 },
  obsidian:  { id: 11, h: 0.75, s: 0.3, l: 0.15 },
};
const BLOCK_LIST = Object.keys(BLOCK_TYPES);

// Vowel → block type mapping
const VOWEL_BLOCKS = {
  'ah': 'stone',
  'ee': 'crystal',
  'oh': 'water',
  'oo': 'obsidian',
  'eh': 'sand',
  'mm': 'gold'
};

// ── State ──
let group = null;
let blockData = null;         // Uint8Array [CHUNK_W × CHUNK_D × MAX_H]
let instanceMesh = null;
let dummy = null;
let blockColor = null;
let visibleCount = 0;
let needsRebuild = false;

// Cursor / build state
let cursorX = 16, cursorZ = 16, cursorY = 4;
let buildMode = 'place';      // 'place', 'destroy', 'terraform'
let selectedBlock = 'grass';
let cursorMesh = null;

// Voice command state
let voiceCmd = '';
let cmdCooldown = 0;
let lastVowel = '';
let vowelHoldTime = 0;
let pitchAccum = 0;
let pitchSamples = 0;

// LLM state
let llmPipeline = null;
let llmLoading = false;
let llmReady = false;
let llmQueue = [];
let pendingTranscript = '';
let transcriptTimer = 0;

// Weather / effects
let weatherParticles = null;
let weatherType = 'none'; // 'none', 'rain', 'snow', 'lava-rain'
let weatherPos = null, weatherVel = null, weatherCol = null;
const WEATHER_N = 500;

// Day/night cycle
let dayPhase = 0;

// Action history for undo
let actionHistory = [];

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 1, -3];

  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  dummy = new THREE.Object3D();

  // ── Initialize block data with terrain ──
  blockData = new Uint8Array(CHUNK_W * CHUNK_D * MAX_H);
  generateTerrain();

  // ── InstancedMesh for blocks ──
  const boxGeo = new THREE.BoxGeometry(BLOCK_SIZE * 0.95, BLOCK_SIZE * 0.95, BLOCK_SIZE * 0.95);
  const boxMat = new THREE.MeshBasicMaterial({
    vertexColors: false,
    transparent: true,
    opacity: 0.92
  });
  instanceMesh = new THREE.InstancedMesh(boxGeo, boxMat, MAX_BLOCKS);
  instanceMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  instanceMesh.count = 0;
  group.add(instanceMesh);

  // ── Cursor indicator ──
  const curGeo = new THREE.BoxGeometry(BLOCK_SIZE * 1.05, BLOCK_SIZE * 1.05, BLOCK_SIZE * 1.05);
  const curMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true
  });
  cursorMesh = new THREE.Mesh(curGeo, curMat);
  group.add(cursorMesh);

  // ── Weather particles ──
  const wGeo = new THREE.BufferGeometry();
  weatherPos = new Float32Array(WEATHER_N * 3);
  weatherVel = new Float32Array(WEATHER_N * 3);
  weatherCol = new Float32Array(WEATHER_N * 3);
  wGeo.setAttribute('position', new THREE.BufferAttribute(weatherPos, 3));
  wGeo.setAttribute('color', new THREE.BufferAttribute(weatherCol, 3));
  weatherParticles = new THREE.Points(wGeo, new THREE.PointsMaterial({
    size: 0.04, vertexColors: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  // Init weather positions above the world
  for (let i = 0; i < WEATHER_N; i++) {
    weatherPos[i * 3]     = (Math.random() - 0.5) * CHUNK_W * BLOCK_SIZE;
    weatherPos[i * 3 + 1] = Math.random() * MAX_H * BLOCK_SIZE;
    weatherPos[i * 3 + 2] = (Math.random() - 0.5) * CHUNK_D * BLOCK_SIZE;
    weatherVel[i * 3]     = 0;
    weatherVel[i * 3 + 1] = -2;
    weatherVel[i * 3 + 2] = 0;
  }
  group.add(weatherParticles);

  // Build initial mesh
  rebuildMesh();

  // ── Try loading Web LLM ──
  initLLM();

  KI.register('voxel-world', {
    update, state: { blockData, cursorX, cursorZ, cursorY, buildMode, selectedBlock },
    placeBlock, destroyBlock, executeCommand, setWeather, group
  });

  KI.emit('voxel-world:ready');
}

// ── Terrain Generation ──
function generateTerrain() {
  for (let x = 0; x < CHUNK_W; x++) {
    for (let z = 0; z < CHUNK_D; z++) {
      // Simple layered terrain with hills
      const nx = x / CHUNK_W, nz = z / CHUNK_D;
      const height = Math.floor(
        3 +
        Math.sin(nx * Math.PI * 2) * 2 +
        Math.cos(nz * Math.PI * 3) * 1.5 +
        Math.sin((nx + nz) * Math.PI * 4) * 1 +
        Math.sin(nx * 7) * Math.cos(nz * 5) * 1.5
      );
      const h = Math.max(1, Math.min(MAX_H - 1, height));

      for (let y = 0; y < h; y++) {
        const idx = blockIndex(x, y, z);
        if (y === 0) blockData[idx] = BLOCK_TYPES.stone.id;
        else if (y < h - 3) blockData[idx] = BLOCK_TYPES.stone.id;
        else if (y < h - 1) blockData[idx] = BLOCK_TYPES.dirt.id;
        else blockData[idx] = BLOCK_TYPES.grass.id;
      }

      // Water in low areas
      if (h < 3) {
        for (let y = h; y <= 3; y++) {
          blockData[blockIndex(x, y, z)] = BLOCK_TYPES.water.id;
        }
      }
    }
  }

  // Add a few trees
  const treePositions = [[8, 12], [22, 8], [15, 25], [5, 20], [26, 18]];
  for (const [tx, tz] of treePositions) {
    const groundH = getHeight(tx, tz);
    if (groundH > 3) buildTree(tx, groundH, tz);
  }
}

function buildTree(x, baseY, z) {
  // Trunk
  for (let y = 0; y < 4; y++) {
    if (baseY + y < MAX_H) setBlock(x, baseY + y, z, BLOCK_TYPES.wood.id);
  }
  // Canopy
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dy = 3; dy <= 5; dy++) {
        const dist = Math.abs(dx) + Math.abs(dz);
        if (dist <= 3 - (dy - 3) && inBounds(x + dx, baseY + dy, z + dz)) {
          if (blockData[blockIndex(x + dx, baseY + dy, z + dz)] === 0) {
            setBlock(x + dx, baseY + dy, z + dz, BLOCK_TYPES.leaf.id);
          }
        }
      }
    }
  }
}

// ── Helpers ──
function blockIndex(x, y, z) { return (y * CHUNK_W * CHUNK_D) + (z * CHUNK_W) + x; }
function inBounds(x, y, z) { return x >= 0 && x < CHUNK_W && y >= 0 && y < MAX_H && z >= 0 && z < CHUNK_D; }
function getBlock(x, y, z) { return inBounds(x, y, z) ? blockData[blockIndex(x, y, z)] : 0; }
function setBlock(x, y, z, id) {
  if (inBounds(x, y, z)) {
    blockData[blockIndex(x, y, z)] = id;
    needsRebuild = true;
  }
}

function getHeight(x, z) {
  for (let y = MAX_H - 1; y >= 0; y--) {
    if (getBlock(x, y, z) !== 0) return y + 1;
  }
  return 0;
}

function getBlockTypeById(id) {
  for (const name of BLOCK_LIST) {
    if (BLOCK_TYPES[name].id === id) return { name, ...BLOCK_TYPES[name] };
  }
  return null;
}

// ── Rebuild the InstancedMesh ──
function rebuildMesh() {
  let count = 0;
  const c = new THREE.Color();

  for (let x = 0; x < CHUNK_W; x++) {
    for (let z = 0; z < CHUNK_D; z++) {
      for (let y = 0; y < MAX_H; y++) {
        const id = blockData[blockIndex(x, y, z)];
        if (id === 0) continue;

        // Only render surface blocks (at least one air neighbor)
        const exposed =
          !inBounds(x-1,y,z) || getBlock(x-1,y,z) === 0 ||
          !inBounds(x+1,y,z) || getBlock(x+1,y,z) === 0 ||
          !inBounds(x,y-1,z) || getBlock(x,y-1,z) === 0 ||
          !inBounds(x,y+1,z) || getBlock(x,y+1,z) === 0 ||
          !inBounds(x,y,z-1) || getBlock(x,y,z-1) === 0 ||
          !inBounds(x,y,z+1) || getBlock(x,y,z+1) === 0;

        if (!exposed) continue;
        if (count >= MAX_BLOCKS) break;

        dummy.position.set(
          x * BLOCK_SIZE - HALF_W,
          y * BLOCK_SIZE,
          z * BLOCK_SIZE - HALF_D
        );
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        instanceMesh.setMatrixAt(count, dummy.matrix);

        const bt = getBlockTypeById(id);
        if (bt) {
          // Slight variation per block for natural look
          const lVar = (Math.sin(x * 13.7 + y * 7.3 + z * 11.1) * 0.5 + 0.5) * 0.1;
          c.setHSL(bt.h, bt.s, bt.l + lVar);
        } else {
          c.setHSL(0, 0, 0.5);
        }
        instanceMesh.setColorAt(count, c);
        count++;
      }
    }
  }

  instanceMesh.count = count;
  visibleCount = count;
  instanceMesh.instanceMatrix.needsUpdate = true;
  if (instanceMesh.instanceColor) instanceMesh.instanceColor.needsUpdate = true;
  needsRebuild = false;
}

// ── Block Operations ──
function placeBlock(x, y, z, typeName) {
  const bt = BLOCK_TYPES[typeName || selectedBlock];
  if (!bt || !inBounds(x, y, z)) return false;
  actionHistory.push({ action: 'place', x, y, z, prev: getBlock(x, y, z), next: bt.id });
  setBlock(x, y, z, bt.id);
  KI.emit('voxel-world:place', { x, y, z, type: typeName || selectedBlock });
  return true;
}

function destroyBlock(x, y, z) {
  if (!inBounds(x, y, z)) return false;
  const prev = getBlock(x, y, z);
  if (prev === 0) return false;
  actionHistory.push({ action: 'destroy', x, y, z, prev, next: 0 });
  setBlock(x, y, z, 0);
  KI.emit('voxel-world:destroy', { x, y, z });
  return true;
}

function undoLast() {
  if (actionHistory.length === 0) return;
  const act = actionHistory.pop();
  setBlock(act.x, act.y, act.z, act.prev);
}

// ── Voice Command Processing ──
function processVoice(dt, t) {
  const v = KI.voice;
  if (!v) return;

  cmdCooldown = Math.max(0, cmdCooldown - dt);

  // Track vowel holds for block type selection
  if (v.vowel && v.sounding) {
    if (v.vowel === lastVowel) {
      vowelHoldTime += dt;
    } else {
      lastVowel = v.vowel;
      vowelHoldTime = dt;
    }
    // Hold vowel 0.3s → select that block type
    if (vowelHoldTime > 0.3 && VOWEL_BLOCKS[v.vowel]) {
      selectedBlock = VOWEL_BLOCKS[v.vowel];
    }
  } else {
    vowelHoldTime = 0;
  }

  // Pitch controls cursor height
  if (v.sounding && v.f0 > 0) {
    pitchAccum += v.pn;
    pitchSamples++;
    const avgPitch = pitchAccum / pitchSamples;
    cursorY = Math.floor(avgPitch * (MAX_H - 1));
    cursorY = Math.max(0, Math.min(MAX_H - 1, cursorY));
  } else if (!v.sounding) {
    pitchAccum = 0;
    pitchSamples = 0;
  }

  // Energy-based actions
  if (v.sounding && cmdCooldown <= 0) {
    const energy = v.energy || v.rms;

    // Loud burst → place or destroy
    if (energy > 0.4 && v.sustain > 0.15) {
      if (buildMode === 'place') {
        placeBlock(cursorX, cursorY, cursorZ, selectedBlock);
      } else if (buildMode === 'destroy') {
        destroyBlock(cursorX, cursorY, cursorZ);
      } else if (buildMode === 'terraform') {
        // Terraform: raise or lower based on pitch
        const h = getHeight(cursorX, cursorZ);
        if (v.pn > 0.5) {
          placeBlock(cursorX, h, cursorZ, selectedBlock);
        } else {
          destroyBlock(cursorX, h - 1, cursorZ);
        }
      }
      cmdCooldown = 0.2;
    }

    // Pulse rate (staccato) → move cursor
    if (v.pulseRate > 3) {
      moveCursor(dt, t);
    }
  }
}

function moveCursor(dt, t) {
  // Move cursor based on pitch direction
  const v = KI.voice;
  if (!v) return;

  const dir = v.pDelta || 0;
  if (Math.abs(dir) > 5) {
    if (dir > 0) cursorX = (cursorX + 1) % CHUNK_W;
    else cursorZ = (cursorZ + 1) % CHUNK_D;
  }
}

// ── Command Execution (from LLM or direct) ──
function executeCommand(cmd) {
  const c = cmd.toLowerCase().trim();
  KI.emit('voxel-world:command', { command: c });

  // Build commands
  if (c.includes('build') && c.includes('tower')) {
    buildTower(cursorX, cursorZ, 8 + Math.floor(Math.random() * 6));
    return 'Building a tower!';
  }
  if (c.includes('build') && c.includes('house')) {
    buildHouse(cursorX, cursorZ);
    return 'Building a house!';
  }
  if (c.includes('build') && c.includes('wall')) {
    buildWall(cursorX, cursorZ, 10, 5);
    return 'Building a wall!';
  }
  if (c.includes('build') && c.includes('pyramid')) {
    buildPyramid(cursorX, cursorZ, 8);
    return 'Building a pyramid!';
  }
  if (c.includes('build') && c.includes('bridge')) {
    buildBridge(cursorX, cursorZ, 12);
    return 'Building a bridge!';
  }
  if (c.includes('build') && c.includes('tree')) {
    const h = getHeight(cursorX, cursorZ);
    buildTree(cursorX, h, cursorZ);
    return 'Planting a tree!';
  }
  if (c.includes('build') && c.includes('arch')) {
    buildArch(cursorX, cursorZ);
    return 'Building an arch!';
  }

  // Destroy commands
  if (c.includes('dig') || c.includes('mine') || c.includes('destroy')) {
    const radius = c.includes('big') ? 4 : c.includes('huge') ? 6 : 2;
    digHole(cursorX, cursorZ, radius, radius + 2);
    return `Digging a ${radius > 3 ? 'big ' : ''}hole!`;
  }
  if (c.includes('clear') || c.includes('flatten')) {
    flattenArea(cursorX, cursorZ, 6);
    return 'Flattening the area!';
  }
  if (c.includes('undo')) {
    undoLast();
    return 'Undone!';
  }
  if (c.includes('reset')) {
    blockData.fill(0);
    generateTerrain();
    needsRebuild = true;
    return 'World reset!';
  }

  // Terraform
  if (c.includes('raise') || c.includes('mountain')) {
    raiseTerrain(cursorX, cursorZ, 5, 6);
    return 'Raising terrain!';
  }
  if (c.includes('lake') || c.includes('pool')) {
    digHole(cursorX, cursorZ, 5, 3);
    fillWater(cursorX, cursorZ, 5);
    return 'Creating a lake!';
  }
  if (c.includes('lava') && c.includes('pool')) {
    digHole(cursorX, cursorZ, 4, 3);
    fillLava(cursorX, cursorZ, 4);
    return 'Creating a lava pool!';
  }

  // Weather
  if (c.includes('rain')) { setWeather('rain'); return 'Let it rain!'; }
  if (c.includes('snow')) { setWeather('snow'); return 'Let it snow!'; }
  if (c.includes('lava rain') || c.includes('fire rain')) { setWeather('lava-rain'); return 'Lava rain!'; }
  if (c.includes('clear sky') || c.includes('stop rain') || c.includes('stop snow')) {
    setWeather('none'); return 'Skies cleared!';
  }

  // Mode switching
  if (c.includes('place') || c.includes('build mode')) { buildMode = 'place'; return 'Build mode!'; }
  if (c.includes('destroy mode') || c.includes('break mode')) { buildMode = 'destroy'; return 'Destroy mode!'; }
  if (c.includes('terraform')) { buildMode = 'terraform'; return 'Terraform mode!'; }

  // Block type
  for (const name of BLOCK_LIST) {
    if (name !== 'air' && c.includes(name)) {
      selectedBlock = name;
      return `Selected ${name}!`;
    }
  }

  // Move cursor
  if (c.includes('go') || c.includes('move')) {
    if (c.includes('north') || c.includes('forward')) cursorZ = Math.max(0, cursorZ - 3);
    if (c.includes('south') || c.includes('back')) cursorZ = Math.min(CHUNK_D - 1, cursorZ + 3);
    if (c.includes('east') || c.includes('right')) cursorX = Math.min(CHUNK_W - 1, cursorX + 3);
    if (c.includes('west') || c.includes('left')) cursorX = Math.max(0, cursorX - 3);
    return 'Moving cursor!';
  }

  return null; // Unknown command
}

// ── Structure Builders ──
function buildTower(cx, cz, height) {
  const baseY = getHeight(cx, cz);
  for (let y = 0; y < height; y++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const isWall = Math.abs(dx) === 1 || Math.abs(dz) === 1;
        const isInner = dx === 0 && dz === 0;
        if (y < height - 1) {
          if (isWall) placeBlock(cx + dx, baseY + y, cz + dz, 'stone');
        } else {
          // Crenellations on top
          if (isWall) placeBlock(cx + dx, baseY + y, cz + dz, 'stone');
          if (isWall) placeBlock(cx + dx, baseY + y + 1, cz + dz, 'stone');
        }
        // Crystal light on top center
        if (isInner && y === height - 1) placeBlock(cx, baseY + y, cz, 'crystal');
      }
    }
  }
}

function buildHouse(cx, cz) {
  const baseY = getHeight(cx, cz);
  const w = 4, d = 4, h = 3;
  // Floor
  for (let dx = -w; dx <= w; dx++)
    for (let dz = -d; dz <= d; dz++)
      placeBlock(cx + dx, baseY, cz + dz, 'wood');
  // Walls
  for (let y = 1; y <= h; y++)
    for (let dx = -w; dx <= w; dx++)
      for (let dz = -d; dz <= d; dz++) {
        const isEdge = Math.abs(dx) === w || Math.abs(dz) === d;
        if (isEdge) placeBlock(cx + dx, baseY + y, cz + dz, 'wood');
      }
  // Roof (pyramid)
  for (let r = 0; r <= Math.min(w, d); r++) {
    const ry = baseY + h + 1 + r;
    const rw = w - r, rd = d - r;
    if (rw < 0 || rd < 0) break;
    for (let dx = -rw; dx <= rw; dx++)
      for (let dz = -rd; dz <= rd; dz++)
        placeBlock(cx + dx, ry, cz + dz, 'leaf');
  }
  // Door (clear front center)
  for (let y = 1; y <= 2; y++) {
    destroyBlock(cx, baseY + y, cz + d);
  }
}

function buildWall(cx, cz, length, height) {
  const baseY = getHeight(cx, cz);
  for (let i = 0; i < length; i++) {
    for (let y = 0; y < height; y++) {
      placeBlock(cx + i - Math.floor(length / 2), baseY + y, cz, 'stone');
    }
  }
}

function buildPyramid(cx, cz, size) {
  const baseY = getHeight(cx, cz);
  for (let layer = 0; layer < size; layer++) {
    const r = size - layer;
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++)
        placeBlock(cx + dx, baseY + layer, cz + dz, 'sand');
  }
  placeBlock(cx, baseY + size, cz, 'gold');
}

function buildBridge(cx, cz, length) {
  const baseY = Math.max(4, getHeight(cx, cz));
  for (let i = 0; i < length; i++) {
    placeBlock(cx + i - Math.floor(length / 2), baseY, cz, 'stone');
    placeBlock(cx + i - Math.floor(length / 2), baseY, cz - 1, 'stone');
    placeBlock(cx + i - Math.floor(length / 2), baseY, cz + 1, 'stone');
    // Rails
    if (i % 3 === 0) {
      placeBlock(cx + i - Math.floor(length / 2), baseY + 1, cz - 1, 'wood');
      placeBlock(cx + i - Math.floor(length / 2), baseY + 1, cz + 1, 'wood');
    }
  }
}

function buildArch(cx, cz) {
  const baseY = getHeight(cx, cz);
  const h = 6, w = 4;
  // Two pillars
  for (let y = 0; y < h; y++) {
    placeBlock(cx - w, baseY + y, cz, 'stone');
    placeBlock(cx + w, baseY + y, cz, 'stone');
  }
  // Arch curve
  for (let dx = -w; dx <= w; dx++) {
    const ay = Math.floor(Math.sqrt(w * w - dx * dx) * (h - 2) / w);
    placeBlock(cx + dx, baseY + h - 1 + Math.floor(ay / 2), cz, 'stone');
  }
}

function digHole(cx, cz, radius, depth) {
  const baseY = getHeight(cx, cz);
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      if (dx * dx + dz * dz <= radius * radius) {
        for (let y = 0; y < depth; y++) {
          destroyBlock(cx + dx, baseY - y - 1, cz + dz);
        }
      }
    }
  }
}

function flattenArea(cx, cz, radius) {
  const targetH = getHeight(cx, cz);
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      if (dx * dx + dz * dz > radius * radius) continue;
      const h = getHeight(cx + dx, cz + dz);
      if (h > targetH) {
        for (let y = h - 1; y >= targetH; y--) destroyBlock(cx + dx, y, cz + dz);
      } else if (h < targetH) {
        for (let y = h; y < targetH; y++) placeBlock(cx + dx, y, cz + dz, 'dirt');
      }
    }
  }
}

function raiseTerrain(cx, cz, radius, amount) {
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > radius) continue;
      const lift = Math.floor(amount * (1 - dist / radius));
      const h = getHeight(cx + dx, cz + dz);
      for (let y = 0; y < lift; y++) {
        placeBlock(cx + dx, h + y, cz + dz, y === lift - 1 ? 'grass' : 'stone');
      }
    }
  }
}

function fillWater(cx, cz, radius) {
  const baseY = getHeight(cx, cz);
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      if (dx * dx + dz * dz > radius * radius) continue;
      const h = getHeight(cx + dx, cz + dz);
      for (let y = h; y <= baseY + 1; y++) {
        placeBlock(cx + dx, y, cz + dz, 'water');
      }
    }
  }
}

function fillLava(cx, cz, radius) {
  const baseY = getHeight(cx, cz);
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      if (dx * dx + dz * dz > radius * radius) continue;
      const h = getHeight(cx + dx, cz + dz);
      for (let y = h; y <= baseY + 1; y++) {
        placeBlock(cx + dx, y, cz + dz, 'lava');
      }
    }
  }
}

// ── Weather System ──
function setWeather(type) {
  weatherType = type;
  KI.emit('voxel-world:weather', { type });
}

function updateWeather(dt, t, energy) {
  if (weatherType === 'none') {
    weatherParticles.material.opacity *= 0.95;
    return;
  }

  weatherParticles.material.opacity = 0.5 + energy * 0.3;
  const halfW = HALF_W, halfD = HALF_D, maxY = MAX_H * BLOCK_SIZE;

  for (let i = 0; i < WEATHER_N; i++) {
    const i3 = i * 3;
    // Update velocity based on type
    switch (weatherType) {
      case 'rain':
        weatherVel[i3] = Math.sin(t + i) * 0.3;
        weatherVel[i3 + 1] = -3 - Math.random();
        weatherVel[i3 + 2] = Math.cos(t + i) * 0.3;
        weatherCol[i3] = 0.3; weatherCol[i3 + 1] = 0.5; weatherCol[i3 + 2] = 1.0;
        break;
      case 'snow':
        weatherVel[i3] = Math.sin(t * 0.5 + i * 0.1) * 0.5;
        weatherVel[i3 + 1] = -0.5 - Math.random() * 0.3;
        weatherVel[i3 + 2] = Math.cos(t * 0.3 + i * 0.1) * 0.5;
        weatherCol[i3] = 0.9; weatherCol[i3 + 1] = 0.95; weatherCol[i3 + 2] = 1.0;
        break;
      case 'lava-rain':
        weatherVel[i3] = Math.sin(t + i) * 0.5;
        weatherVel[i3 + 1] = -2 - Math.random() * 2;
        weatherVel[i3 + 2] = Math.cos(t + i) * 0.5;
        const flicker = 0.7 + Math.sin(t * 5 + i) * 0.3;
        weatherCol[i3] = 1.0 * flicker; weatherCol[i3 + 1] = 0.3 * flicker; weatherCol[i3 + 2] = 0.05;
        break;
    }

    // Move particles
    weatherPos[i3]     += weatherVel[i3] * dt;
    weatherPos[i3 + 1] += weatherVel[i3 + 1] * dt;
    weatherPos[i3 + 2] += weatherVel[i3 + 2] * dt;

    // Respawn if below ground or out of bounds
    if (weatherPos[i3 + 1] < 0 || weatherPos[i3] < -halfW || weatherPos[i3] > halfW ||
        weatherPos[i3 + 2] < -halfD || weatherPos[i3 + 2] > halfD) {
      weatherPos[i3]     = (Math.random() - 0.5) * CHUNK_W * BLOCK_SIZE;
      weatherPos[i3 + 1] = maxY + Math.random() * 2;
      weatherPos[i3 + 2] = (Math.random() - 0.5) * CHUNK_D * BLOCK_SIZE;
    }
  }

  weatherParticles.geometry.attributes.position.needsUpdate = true;
  weatherParticles.geometry.attributes.color.needsUpdate = true;
}

// ── Web LLM Integration ──
function initLLM() {
  // Use the transformers.js pipeline if available (Qwen2.5-0.5B or similar small model)
  // Falls back to keyword-based command parsing
  if (typeof window !== 'undefined' && window.transformers) {
    llmLoading = true;
    loadLLMPipeline();
  }
  // Also listen for speech recognition if available
  initSpeechRecognition();
}

async function loadLLMPipeline() {
  try {
    const { pipeline } = window.transformers;
    llmPipeline = await pipeline('text-generation', 'Qwen/Qwen2.5-0.5B', {
      device: 'webgpu',
      dtype: 'q4'
    });
    llmReady = true;
    llmLoading = false;
    KI.emit('voxel-world:llm-ready');
  } catch (e) {
    console.warn('WebLLM not available, using keyword commands:', e.message);
    llmLoading = false;
  }
}

async function processLLMCommand(text) {
  if (!llmReady || !llmPipeline) {
    // Fallback: direct keyword parsing
    return executeCommand(text);
  }

  try {
    const prompt = `You are a Minecraft build assistant. Convert this voice command into one of these actions:
BUILD_TOWER, BUILD_HOUSE, BUILD_WALL, BUILD_PYRAMID, BUILD_BRIDGE, BUILD_TREE, BUILD_ARCH,
DIG_HOLE, DIG_BIG_HOLE, FLATTEN, RAISE_TERRAIN, MAKE_LAKE, MAKE_LAVA_POOL,
SET_RAIN, SET_SNOW, SET_LAVA_RAIN, CLEAR_WEATHER,
SELECT_STONE, SELECT_CRYSTAL, SELECT_WATER, SELECT_SAND, SELECT_GOLD, SELECT_WOOD,
MOVE_NORTH, MOVE_SOUTH, MOVE_EAST, MOVE_WEST, UNDO, RESET,
PLACE_MODE, DESTROY_MODE, TERRAFORM_MODE

User says: "${text}"
Action:`;

    const result = await llmPipeline(prompt, {
      max_new_tokens: 20,
      temperature: 0.1,
      do_sample: false
    });

    const action = result[0].generated_text.split('Action:').pop().trim().split('\n')[0].trim();
    return executeLLMAction(action);
  } catch (e) {
    console.warn('LLM error:', e);
    return executeCommand(text);
  }
}

function executeLLMAction(action) {
  const map = {
    'BUILD_TOWER': () => { buildTower(cursorX, cursorZ, 8); return 'Tower built!'; },
    'BUILD_HOUSE': () => { buildHouse(cursorX, cursorZ); return 'House built!'; },
    'BUILD_WALL': () => { buildWall(cursorX, cursorZ, 10, 5); return 'Wall built!'; },
    'BUILD_PYRAMID': () => { buildPyramid(cursorX, cursorZ, 8); return 'Pyramid built!'; },
    'BUILD_BRIDGE': () => { buildBridge(cursorX, cursorZ, 12); return 'Bridge built!'; },
    'BUILD_TREE': () => { buildTree(cursorX, getHeight(cursorX, cursorZ), cursorZ); return 'Tree planted!'; },
    'BUILD_ARCH': () => { buildArch(cursorX, cursorZ); return 'Arch built!'; },
    'DIG_HOLE': () => { digHole(cursorX, cursorZ, 2, 4); return 'Hole dug!'; },
    'DIG_BIG_HOLE': () => { digHole(cursorX, cursorZ, 5, 8); return 'Big hole dug!'; },
    'FLATTEN': () => { flattenArea(cursorX, cursorZ, 6); return 'Flattened!'; },
    'RAISE_TERRAIN': () => { raiseTerrain(cursorX, cursorZ, 5, 6); return 'Mountain raised!'; },
    'MAKE_LAKE': () => { digHole(cursorX, cursorZ, 5, 3); fillWater(cursorX, cursorZ, 5); return 'Lake created!'; },
    'MAKE_LAVA_POOL': () => { digHole(cursorX, cursorZ, 4, 3); fillLava(cursorX, cursorZ, 4); return 'Lava pool!'; },
    'SET_RAIN': () => { setWeather('rain'); return 'Rain!'; },
    'SET_SNOW': () => { setWeather('snow'); return 'Snow!'; },
    'SET_LAVA_RAIN': () => { setWeather('lava-rain'); return 'Lava rain!'; },
    'CLEAR_WEATHER': () => { setWeather('none'); return 'Clear skies!'; },
    'MOVE_NORTH': () => { cursorZ = Math.max(0, cursorZ - 3); return 'Moving north'; },
    'MOVE_SOUTH': () => { cursorZ = Math.min(CHUNK_D - 1, cursorZ + 3); return 'Moving south'; },
    'MOVE_EAST': () => { cursorX = Math.min(CHUNK_W - 1, cursorX + 3); return 'Moving east'; },
    'MOVE_WEST': () => { cursorX = Math.max(0, cursorX - 3); return 'Moving west'; },
    'UNDO': () => { undoLast(); return 'Undone!'; },
    'RESET': () => { blockData.fill(0); generateTerrain(); needsRebuild = true; return 'Reset!'; },
    'PLACE_MODE': () => { buildMode = 'place'; return 'Build mode!'; },
    'DESTROY_MODE': () => { buildMode = 'destroy'; return 'Destroy mode!'; },
    'TERRAFORM_MODE': () => { buildMode = 'terraform'; return 'Terraform mode!'; },
  };

  // Match by checking if action starts with a known key
  for (const [key, fn] of Object.entries(map)) {
    if (action.includes(key)) return fn();
  }

  // Also check block selection
  for (const name of BLOCK_LIST) {
    if (action.includes(name.toUpperCase())) {
      selectedBlock = name;
      return `Selected ${name}!`;
    }
  }

  return executeCommand(action.toLowerCase());
}

// ── Speech Recognition (Web Speech API) ──
function initSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;

  const recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        const result = processLLMCommand(transcript.trim());
        if (result && typeof result === 'string') {
          KI.emit('voxel-world:response', { text: result, command: transcript });
        }
        transcript = '';
      }
    }
  };

  recognition.onerror = (e) => {
    if (e.error !== 'no-speech') console.warn('Speech recognition error:', e.error);
  };

  recognition.onend = () => {
    // Auto-restart
    try { recognition.start(); } catch (e) { /* already started */ }
  };

  try {
    recognition.start();
    KI.emit('voxel-world:speech-ready');
  } catch (e) {
    console.warn('Speech recognition not available:', e.message);
  }
}

// ── Main Update ──
function update(dt, t) {
  const fb = KI.get('freq-bands-12');
  const fbState = fb?.state;
  const energy = fbState ? fbState.totalEnergy : 0;

  // Process voice input
  processVoice(dt, t);

  // Day/night cycle — slow ambient color shift
  dayPhase += dt * 0.02;
  const dayLight = 0.5 + Math.sin(dayPhase) * 0.3;

  // Voice energy → animate blocks (subtle pulse)
  if (energy > 0.1 && instanceMesh.count > 0) {
    const pulse = 1 + Math.sin(t * 4) * energy * 0.03;
    group.scale.setScalar(pulse);
  } else {
    group.scale.setScalar(1);
  }

  // Update cursor position visualization
  cursorMesh.position.set(
    cursorX * BLOCK_SIZE - HALF_W,
    cursorY * BLOCK_SIZE,
    cursorZ * BLOCK_SIZE - HALF_D
  );
  // Cursor color based on mode
  const modeColors = { place: 0x00ff88, destroy: 0xff4444, terraform: 0xffaa00 };
  cursorMesh.material.color.setHex(modeColors[buildMode] || 0xffffff);
  cursorMesh.material.opacity = 0.3 + Math.sin(t * 5) * 0.15;

  // Rebuild mesh if blocks changed
  if (needsRebuild) rebuildMesh();

  // Update block colors with voice energy (glow effect)
  if (energy > 0.2 && instanceMesh.count > 0 && instanceMesh.instanceColor) {
    // Ambient glow on nearby blocks to cursor
    // (Handled via material opacity pulse for performance)
    instanceMesh.material.opacity = 0.88 + energy * 0.12;
  }

  // Weather
  updateWeather(dt, t, energy);

  // Gentle world rotation based on voice
  if (fbState && fbState.spectralCentroid > 0) {
    group.rotation.y += dt * 0.05 * (fbState.spectralCentroid / 4000);
  }
}
