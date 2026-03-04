// neural-cascade.js — Neural network firing cascade visualization
// Voice triggers cascading activation through a 3D neural network.
// You're inside a brain made of light. Each sound fires neurons in chains.
// Features:
// - 3D neural network: nodes (somas) + connections (axons/dendrites)
// - Energy → firing rate (how many neurons trigger per second)
// - Pitch → which layer fires first (low=deep brain, high=cortex)
// - Coherence → synchronization (neurons fire together vs random)
// - Vowel → network topology (a=random, e=lattice, i=small-world, o=ring, u=star)
// - Pulse → propagation wave speed
// - Firing cascades propagate through connections with delay
// - Refractory period: neurons cool down before re-firing
// - Dendrite growth: new connections form during sustained voice

import { KI } from './core.js';

const TAU = Math.PI * 2;

// ── Network parameters ──
const NODE_COUNT = 120;
const MAX_CONNECTIONS = 400;
const FIRE_DURATION = 0.4;     // how long a neuron stays lit
const REFRACTORY = 0.8;        // cooldown before re-fire
const PROPAGATION_DELAY = 0.08; // seconds between connected firings
const DENDRITE_GROW_RATE = 0.3; // new connections per second during voice

// ── State ──
const nodes = [];     // { pos, firing, fireTime, lastFire, layer, activation }
const connections = []; // { from, to, weight, signal, signalTime }
let topology = 'random';
let totalFires = 0;
let cascadeDepth = 0;

// ── 3D ──
let group = null;
let nodeMeshes = [];
let axonLines = [];
let sparkSystem = null, sparkPos = null, sparkCol = null;
const MAX_SPARKS = 500;
let dendritePulse = null, dpPos = null, dpCol = null;
const MAX_DP = 300;

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 3, -2];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── Generate nodes ──
  generateNetwork('random');

  // ── Node meshes (icosahedrons = somas) ──
  for (let i = 0; i < NODE_COUNT; i++) {
    const geo = new THREE.IcosahedronGeometry(0.08, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x224488, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(nodes[i].pos);
    group.add(mesh);
    nodeMeshes.push(mesh);
  }

  // ── Axon lines ──
  for (let i = 0; i < MAX_CONNECTIONS; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0x113366, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending
    }));
    line.visible = false;
    group.add(line);
    axonLines.push(line);
  }

  // ── Spark particles (firing signals traveling along axons) ──
  const sGeo = new THREE.BufferGeometry();
  sparkPos = new Float32Array(MAX_SPARKS * 3);
  sparkCol = new Float32Array(MAX_SPARKS * 3);
  sGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  sGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
  sparkSystem = new THREE.Points(sGeo, new THREE.PointsMaterial({
    size: 0.07, vertexColors: true, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(sparkSystem);

  // ── Dendrite pulse particles (growing connections) ──
  const dGeo = new THREE.BufferGeometry();
  dpPos = new Float32Array(MAX_DP * 3);
  dpCol = new Float32Array(MAX_DP * 3);
  dGeo.setAttribute('position', new THREE.BufferAttribute(dpPos, 3));
  dGeo.setAttribute('color', new THREE.BufferAttribute(dpCol, 3));
  dendritePulse = new THREE.Points(dGeo, new THREE.PointsMaterial({
    size: 0.04, vertexColors: true, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(dendritePulse);

  KI.register('neural-cascade', {
    update, group,
    getNodeCount: () => NODE_COUNT,
    getConnectionCount: () => connections.length,
    getTotalFires: () => totalFires,
    getTopology: () => topology,
    getCascadeDepth: () => cascadeDepth
  });

  KI.emit('neural-cascade:ready');
}

function generateNetwork(topo) {
  topology = topo;
  nodes.length = 0;
  connections.length = 0;

  // Generate node positions based on topology
  for (let i = 0; i < NODE_COUNT; i++) {
    const layer = Math.floor(i / (NODE_COUNT / 5)); // 5 layers
    let pos;
    switch (topo) {
      case 'lattice':
        pos = new THREE.Vector3(
          ((i % 6) - 2.5) * 0.8,
          (Math.floor(i / 6) % 5 - 2) * 0.8,
          (Math.floor(i / 30) - 2) * 0.8
        );
        break;
      case 'ring':
        const angle = (i / NODE_COUNT) * TAU;
        const ringR = 2 + layer * 0.3;
        pos = new THREE.Vector3(Math.cos(angle) * ringR, (layer - 2) * 0.6, Math.sin(angle) * ringR);
        break;
      case 'star': {
        const hub = i < 5;
        if (hub) {
          pos = new THREE.Vector3((Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5);
        } else {
          const a = Math.random() * TAU, r = 1.5 + Math.random() * 1.5;
          pos = new THREE.Vector3(Math.cos(a)*r, (Math.random()-0.5)*3, Math.sin(a)*r);
        }
        break;
      }
      case 'small-world': {
        // Watts-Strogatz: ring with random long-range shortcuts
        const sw_angle = (i / NODE_COUNT) * TAU;
        const sw_r = 2;
        pos = new THREE.Vector3(
          Math.cos(sw_angle) * sw_r + (Math.random()-0.5)*0.3,
          (Math.random()-0.5)*2,
          Math.sin(sw_angle) * sw_r + (Math.random()-0.5)*0.3
        );
        break;
      }
      default: // random
        pos = new THREE.Vector3(
          (Math.random()-0.5)*5,
          (Math.random()-0.5)*4,
          (Math.random()-0.5)*4
        );
    }
    nodes.push({
      pos,
      firing: false,
      fireTime: 0,
      lastFire: -10,
      layer,
      activation: 0
    });
  }

  // Generate connections
  for (let i = 0; i < NODE_COUNT; i++) {
    const connectCount = topo === 'star' && i < 5 ? 20 : (topo === 'lattice' ? 6 : 3 + Math.floor(Math.random() * 3));
    // Connect to nearest neighbors + some random
    const dists = [];
    for (let j = 0; j < NODE_COUNT; j++) {
      if (i === j) continue;
      dists.push({ idx: j, dist: nodes[i].pos.distanceTo(nodes[j].pos) });
    }
    dists.sort((a, b) => a.dist - b.dist);

    for (let c = 0; c < Math.min(connectCount, dists.length); c++) {
      const j = c < connectCount - 1 ? dists[c].idx : dists[Math.floor(Math.random() * Math.min(20, dists.length))].idx;
      if (connections.length < MAX_CONNECTIONS) {
        connections.push({
          from: i, to: j,
          weight: 0.5 + Math.random() * 0.5,
          signal: 0,
          signalTime: 0,
          signalPos: 0
        });
      }
    }
  }
}

function fireNeuron(idx, t, depth) {
  const node = nodes[idx];
  if (!node || node.firing || (t - node.lastFire) < REFRACTORY) return;

  node.firing = true;
  node.fireTime = t;
  node.activation = 1;
  totalFires++;
  cascadeDepth = Math.max(cascadeDepth, depth);

  // Propagate to connected neurons
  for (const conn of connections) {
    if (conn.from === idx && !nodes[conn.to].firing) {
      conn.signal = 1;
      conn.signalTime = t;
      conn.signalPos = 0;
    }
  }
}

function update(dt, t) {
  const v = KI.voice;
  const energy = v.energy || 0;
  const coherence = v.coherence || 0;
  const pitch = v.pn || 0;
  const sounding = v.sounding;
  const pulseRate = v.pulseRate || 1;

  // ── Topology from vowel ──
  if (sounding) {
    const vowelTopo = { a: 'random', e: 'lattice', i: 'small-world', o: 'ring', u: 'star' };
    const newTopo = vowelTopo[v.vowel || 'a'] || 'random';
    if (newTopo !== topology) {
      generateNetwork(newTopo);
      // Re-position meshes
      for (let i = 0; i < NODE_COUNT; i++) {
        nodeMeshes[i].position.copy(nodes[i].pos);
      }
      KI.emit('neural-cascade:topology-change', { topology: newTopo });
    }
  }

  // ── Fire neurons from voice ──
  if (sounding && energy > 0.1) {
    const fireRate = energy * 15; // neurons per second
    const firesToDo = Math.floor(fireRate * dt + Math.random());
    const startLayer = Math.floor(pitch * 5); // pitch selects starting layer

    for (let f = 0; f < firesToDo; f++) {
      // Find an unfired neuron in the target layer (or nearby)
      let candidates = [];
      for (let i = 0; i < NODE_COUNT; i++) {
        if (!nodes[i].firing && (t - nodes[i].lastFire) >= REFRACTORY) {
          const layerDist = Math.abs(nodes[i].layer - startLayer);
          if (coherence > 0.5 ? layerDist <= 1 : true) {
            candidates.push(i);
          }
        }
      }
      if (candidates.length > 0) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        fireNeuron(pick, t, 0);
      }
    }
  }

  // ── Propagate signals along connections ──
  const propSpeed = 1.0 + pulseRate * 2;
  cascadeDepth = 0;
  for (const conn of connections) {
    if (conn.signal > 0) {
      conn.signalPos += dt * propSpeed;
      if (conn.signalPos >= 1) {
        // Signal arrived: fire target neuron
        conn.signal = 0;
        conn.signalPos = 0;
        const targetNode = nodes[conn.to];
        if (targetNode && !targetNode.firing && (t - targetNode.lastFire) >= REFRACTORY) {
          targetNode.activation += conn.weight;
          if (targetNode.activation >= 0.8) {
            fireNeuron(conn.to, t, 1);
          }
        }
      }
    }
  }

  // ── Update node states ──
  let sparkIdx = 0;
  for (let i = 0; i < NODE_COUNT; i++) {
    const node = nodes[i];
    const mesh = nodeMeshes[i];

    if (node.firing) {
      const elapsed = t - node.fireTime;
      if (elapsed > FIRE_DURATION) {
        node.firing = false;
        node.lastFire = t;
        node.activation = 0;
      } else {
        // Fire animation: bright flash then fade
        const fireProgress = elapsed / FIRE_DURATION;
        const brightness = 1 - fireProgress;
        const hue = (pitch + node.layer * 0.1) % 1;
        const rgb = hslToRgb(hue, 0.9, 0.4 + brightness * 0.5);
        mesh.material.color.setRGB(rgb[0], rgb[1], rgb[2]);
        mesh.material.opacity = 0.4 + brightness * 0.6;
        mesh.scale.setScalar(1 + brightness * 0.8);

        // Emit sparks from firing neurons
        if (sparkIdx < MAX_SPARKS) {
          sparkPos[sparkIdx*3]   = node.pos.x + (Math.random()-0.5)*0.3;
          sparkPos[sparkIdx*3+1] = node.pos.y + (Math.random()-0.5)*0.3;
          sparkPos[sparkIdx*3+2] = node.pos.z + (Math.random()-0.5)*0.3;
          sparkCol[sparkIdx*3]   = rgb[0]; sparkCol[sparkIdx*3+1] = rgb[1]; sparkCol[sparkIdx*3+2] = rgb[2];
          sparkIdx++;
        }
      }
    } else {
      // Resting state
      const restHue = node.layer * 0.15;
      const rrgb = hslToRgb(restHue, 0.4, 0.15 + energy * 0.1);
      mesh.material.color.setRGB(rrgb[0], rrgb[1], rrgb[2]);
      mesh.material.opacity = 0.2 + energy * 0.1;
      mesh.scale.setScalar(1);
      node.activation *= 0.95; // decay
    }
  }
  // Fade out unused spark slots
  for (let i = sparkIdx; i < MAX_SPARKS; i++) {
    sparkCol[i*3] *= 0.9; sparkCol[i*3+1] *= 0.9; sparkCol[i*3+2] *= 0.9;
  }
  sparkSystem.geometry.attributes.position.needsUpdate = true;
  sparkSystem.geometry.attributes.color.needsUpdate = true;

  // ── Update axon lines ──
  let dpIdx = 0;
  for (let c = 0; c < connections.length && c < MAX_CONNECTIONS; c++) {
    const conn = connections[c];
    const line = axonLines[c];
    const from = nodes[conn.from], to = nodes[conn.to];
    if (!from || !to) continue;

    line.visible = true;
    const posArr = line.geometry.attributes.position.array;
    posArr[0] = from.pos.x; posArr[1] = from.pos.y; posArr[2] = from.pos.z;
    posArr[3] = to.pos.x;   posArr[4] = to.pos.y;   posArr[5] = to.pos.z;
    line.geometry.attributes.position.needsUpdate = true;

    if (conn.signal > 0) {
      // Bright signal traveling
      line.material.opacity = 0.3 + conn.signal * 0.4;
      line.material.color.setRGB(0.2, 0.8, 1.0);

      // Dendrite pulse particle at signal position
      if (dpIdx < MAX_DP) {
        const sp = conn.signalPos;
        dpPos[dpIdx*3]   = from.pos.x * (1-sp) + to.pos.x * sp;
        dpPos[dpIdx*3+1] = from.pos.y * (1-sp) + to.pos.y * sp;
        dpPos[dpIdx*3+2] = from.pos.z * (1-sp) + to.pos.z * sp;
        dpCol[dpIdx*3] = 0.3; dpCol[dpIdx*3+1] = 1; dpCol[dpIdx*3+2] = 0.8;
        dpIdx++;
      }
    } else {
      // Resting axon
      const fromFiring = from.firing ? 0.2 : 0;
      const toFiring = to.firing ? 0.2 : 0;
      line.material.opacity = 0.03 + energy * 0.05 + fromFiring + toFiring;
      line.material.color.setRGB(0.07, 0.2, 0.4);
    }
  }
  for (let c = connections.length; c < MAX_CONNECTIONS; c++) axonLines[c].visible = false;

  // Fade unused dendrite particles
  for (let i = dpIdx; i < MAX_DP; i++) {
    dpCol[i*3] *= 0.9; dpCol[i*3+1] *= 0.9; dpCol[i*3+2] *= 0.9;
  }
  dendritePulse.geometry.attributes.position.needsUpdate = true;
  dendritePulse.geometry.attributes.color.needsUpdate = true;

  // ── Dendrite growth during sustained voice ──
  if (sounding && coherence > 0.4 && connections.length < MAX_CONNECTIONS) {
    // Grow new connections between recently active neurons
    const recentlyFired = nodes.map((n, i) => ({ i, t: n.lastFire })).filter(n => (t - n.t) < 1).map(n => n.i);
    if (recentlyFired.length >= 2 && Math.random() < DENDRITE_GROW_RATE * dt) {
      const a = recentlyFired[Math.floor(Math.random() * recentlyFired.length)];
      const b = recentlyFired[Math.floor(Math.random() * recentlyFired.length)];
      if (a !== b) {
        connections.push({ from: a, to: b, weight: 0.3, signal: 0, signalTime: 0, signalPos: 0 });
      }
    }
  }

  // ── Group rotation ──
  group.rotation.y += dt * 0.06;
  group.rotation.x = Math.sin(t * 0.12) * 0.08;

  // Count currently firing
  const firingCount = nodes.filter(n => n.firing).length;

  KI.emit('neural-cascade:update', {
    topology,
    nodeCount: NODE_COUNT,
    connectionCount: connections.length,
    firingCount,
    totalFires,
    cascadeDepth,
    firingRate: (firingCount / NODE_COUNT * 100).toFixed(0)
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
