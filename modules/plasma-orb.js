// plasma-orb.js — Electric plasma globe with voice-driven lightning
// A central sphere that crackles with electricity, like a plasma ball.
// Features:
// - Core sphere with pulsing inner glow
// - Lightning arcs that crawl across the surface between electrode nodes
// - Energy → arc intensity and count
// - Pitch → arc color temperature (cool blue → hot white → violet)
// - Coherence → arc stability (stable vs chaotic branching)
// - Vowel → discharge pattern (corona, bolt, web, storm, pulse)
// - Pulse → core throb rate
// - Touch points where arcs concentrate (simulated finger touches)

import { KI } from './core.js';

const TAU = Math.PI * 2;

// ── Config ──
const SPHERE_DETAIL = 40;
const MAX_ARCS = 24;
const ARC_SEGMENTS = 20;  // points per arc
const MAX_NODES = 16;     // electrode surface nodes
const MAX_SPARKS = 400;   // spark particles
const MAX_GLOW = 300;     // ambient glow particles

let group = null;
let coreMesh = null, coreMat = null;
let shellMesh = null, shellMat = null;
let arcLines = [], arcMats = [];
let nodes = [];
let sparkSystem = null, sparkPos = null, sparkCol = null;
let glowSystem = null, glowPos = null, glowCol = null;
let dischargePattern = 'corona';
let sparkIdx = 0;

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 2.5, -3.5];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── Inner core (bright hot center) ──
  const coreGeo = new THREE.SphereGeometry(0.35, 16, 12);
  coreMat = new THREE.MeshBasicMaterial({
    color: 0x4488ff, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  coreMesh = new THREE.Mesh(coreGeo, coreMat);
  group.add(coreMesh);

  // ── Outer shell (translucent glass) ──
  const shellGeo = new THREE.SphereGeometry(1.2, SPHERE_DETAIL, SPHERE_DETAIL / 2);
  shellMat = new THREE.MeshBasicMaterial({
    color: 0x112244, transparent: true, opacity: 0.08,
    blending: THREE.AdditiveBlending, depthWrite: false,
    side: THREE.DoubleSide
  });
  shellMesh = new THREE.Mesh(shellGeo, shellMat);
  group.add(shellMesh);

  // ── Electrode nodes on surface ──
  for (let i = 0; i < MAX_NODES; i++) {
    const theta = Math.acos(2 * Math.random() - 1);
    const phi = TAU * Math.random();
    nodes.push({
      theta, phi,
      x: Math.sin(theta) * Math.cos(phi) * 1.2,
      y: Math.cos(theta) * 1.2,
      z: Math.sin(theta) * Math.sin(phi) * 1.2,
      charge: Math.random(),
      active: false
    });
  }

  // ── Arc lines ──
  for (let i = 0; i < MAX_ARCS; i++) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(ARC_SEGMENTS * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0x88ccff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    group.add(line);
    arcLines.push(line);
    arcMats.push(mat);
  }

  // ── Spark particles ──
  const sGeo = new THREE.BufferGeometry();
  sparkPos = new Float32Array(MAX_SPARKS * 3);
  sparkCol = new Float32Array(MAX_SPARKS * 3);
  sGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  sGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
  sparkSystem = new THREE.Points(sGeo, new THREE.PointsMaterial({
    size: 0.04, vertexColors: true, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(sparkSystem);

  // ── Ambient glow particles (around shell) ──
  const gGeo = new THREE.BufferGeometry();
  glowPos = new Float32Array(MAX_GLOW * 3);
  glowCol = new Float32Array(MAX_GLOW * 3);
  gGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
  gGeo.setAttribute('color', new THREE.BufferAttribute(glowCol, 3));
  glowSystem = new THREE.Points(gGeo, new THREE.PointsMaterial({
    size: 0.06, vertexColors: true, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(glowSystem);

  KI.register('plasma-orb', { update, group, getPattern: () => dischargePattern });
  KI.emit('plasma-orb:ready');
}

// ── Arc path generation with branching ──
function generateArc(start, end, chaos, t) {
  const points = [];
  for (let i = 0; i < ARC_SEGMENTS; i++) {
    const f = i / (ARC_SEGMENTS - 1);
    // Lerp between start and end
    let x = start.x + (end.x - start.x) * f;
    let y = start.y + (end.y - start.y) * f;
    let z = start.z + (end.z - start.z) * f;
    // Add jagged displacement (more in middle, less at ends)
    const jag = Math.sin(f * Math.PI) * chaos;
    const seed = t * 20 + i * 7.3;
    x += Math.sin(seed) * jag;
    y += Math.cos(seed * 1.3) * jag;
    z += Math.sin(seed * 0.7) * jag;
    points.push(x, y, z);
  }
  return points;
}

function getDischargeNodes(pattern, t, energy, nodeList) {
  // Returns pairs of [sourceIdx, targetIdx] for arcs
  const pairs = [];
  const active = nodeList.filter(n => n.active);
  const count = Math.max(2, Math.min(MAX_ARCS, Math.floor(energy * MAX_ARCS)));

  switch (pattern) {
    case 'bolt': {
      // All arcs from core to random surface nodes
      for (let i = 0; i < count; i++) {
        pairs.push({ from: { x: 0, y: 0, z: 0 }, to: nodeList[i % MAX_NODES] });
      }
      break;
    }
    case 'web': {
      // Surface-to-surface arcs forming a web
      for (let i = 0; i < count; i++) {
        const a = Math.floor(Math.random() * MAX_NODES);
        const b = (a + 1 + Math.floor(Math.random() * (MAX_NODES - 2))) % MAX_NODES;
        pairs.push({ from: nodeList[a], to: nodeList[b] });
      }
      break;
    }
    case 'storm': {
      // Rapid random arcs everywhere
      for (let i = 0; i < count; i++) {
        const useCore = Math.random() < 0.4;
        const a = useCore ? { x: 0, y: 0, z: 0 } : nodeList[Math.floor(Math.random() * MAX_NODES)];
        const b = nodeList[Math.floor(Math.random() * MAX_NODES)];
        pairs.push({ from: a, to: b });
      }
      break;
    }
    case 'pulse': {
      // Arcs radiate outward in sync with pulse
      const phase = Math.sin(t * 5) * 0.5 + 0.5;
      const radiateCount = Math.floor(count * phase);
      for (let i = 0; i < radiateCount; i++) {
        pairs.push({ from: { x: 0, y: 0, z: 0 }, to: nodeList[i % MAX_NODES] });
      }
      break;
    }
    default: { // corona
      // Arcs from core to nearby surface, with occasional surface crawl
      for (let i = 0; i < count; i++) {
        if (i < count * 0.7) {
          pairs.push({ from: { x: 0, y: 0, z: 0 }, to: nodeList[i % MAX_NODES] });
        } else {
          const a = Math.floor(Math.random() * MAX_NODES);
          const b = (a + 1) % MAX_NODES;
          pairs.push({ from: nodeList[a], to: nodeList[b] });
        }
      }
    }
  }
  return pairs.slice(0, MAX_ARCS);
}

function update(dt, t) {
  const v = KI.voice;
  const energy = v.energy || 0;
  const coherence = v.coherence || 0;
  const pitch = v.pn || 0;
  const sounding = v.sounding;
  const pulseRate = v.pulseRate || 1;

  // ── Vowel → discharge pattern ──
  if (sounding) {
    const patterns = { a: 'corona', e: 'bolt', i: 'web', o: 'storm', u: 'pulse' };
    dischargePattern = patterns[v.vowel || 'a'] || 'corona';
  }

  // ── Rotate electrode nodes slowly ──
  for (let i = 0; i < MAX_NODES; i++) {
    const n = nodes[i];
    n.phi += dt * (0.1 + i * 0.02);
    n.x = Math.sin(n.theta) * Math.cos(n.phi) * 1.2;
    n.y = Math.cos(n.theta) * 1.2;
    n.z = Math.sin(n.theta) * Math.sin(n.phi) * 1.2;
    n.charge = 0.3 + energy * 0.7 * Math.sin(t * 3 + i * 1.5) * 0.5 + 0.5;
    n.active = n.charge > 0.5;
  }

  // ── Core throb ──
  const throb = 1 + Math.sin(t * pulseRate * 4) * 0.15 * energy;
  coreMesh.scale.setScalar(throb);
  // Color temperature: pitch controls blue→white→violet
  const coreHue = 0.6 - pitch * 0.15; // blue to violet
  const coreBright = 0.4 + energy * 0.5;
  const crgb = hslToRgb(coreHue, 0.6, coreBright);
  coreMat.color.setRGB(crgb[0], crgb[1], crgb[2]);
  coreMat.opacity = 0.5 + energy * 0.4;

  // ── Shell glow ──
  shellMat.opacity = 0.04 + energy * 0.06;
  const srgb = hslToRgb(coreHue, 0.3, 0.15 + energy * 0.1);
  shellMat.color.setRGB(srgb[0], srgb[1], srgb[2]);

  // ── Generate arcs ──
  const chaos = (1 - coherence) * 0.4 + 0.05;
  const arcPairs = getDischargeNodes(dischargePattern, t, energy, nodes);

  let activeArcCount = 0;
  for (let i = 0; i < MAX_ARCS; i++) {
    if (i < arcPairs.length && energy > 0.05) {
      const pair = arcPairs[i];
      const pts = generateArc(pair.from, pair.to, chaos, t + i * 0.5);
      const positions = arcLines[i].geometry.attributes.position.array;
      for (let j = 0; j < ARC_SEGMENTS * 3; j++) positions[j] = pts[j];
      arcLines[i].geometry.attributes.position.needsUpdate = true;
      arcLines[i].visible = true;

      // Arc color
      const arcHue = (coreHue + i * 0.02) % 1;
      const argb = hslToRgb(arcHue, 0.5 + energy * 0.3, 0.5 + energy * 0.4);
      arcMats[i].color.setRGB(argb[0], argb[1], argb[2]);
      arcMats[i].opacity = 0.3 + energy * 0.5 + Math.random() * 0.2; // flicker
      activeArcCount++;

      // Spawn sparks along arc
      if (Math.random() < energy * 0.5) {
        const si = sparkIdx % MAX_SPARKS;
        const pi = Math.floor(Math.random() * ARC_SEGMENTS) * 3;
        sparkPos[si * 3] = pts[pi] + (Math.random() - 0.5) * 0.1;
        sparkPos[si * 3 + 1] = pts[pi + 1] + (Math.random() - 0.5) * 0.1;
        sparkPos[si * 3 + 2] = pts[pi + 2] + (Math.random() - 0.5) * 0.1;
        sparkCol[si * 3] = argb[0]; sparkCol[si * 3 + 1] = argb[1]; sparkCol[si * 3 + 2] = argb[2];
        sparkIdx++;
      }
    } else {
      arcLines[i].visible = false;
      arcMats[i].opacity *= 0.9;
    }
  }

  // ── Fade sparks ──
  for (let i = 0; i < MAX_SPARKS; i++) {
    sparkCol[i * 3] *= 0.94; sparkCol[i * 3 + 1] *= 0.94; sparkCol[i * 3 + 2] *= 0.94;
    // drift outward
    const dx = sparkPos[i * 3], dy = sparkPos[i * 3 + 1], dz = sparkPos[i * 3 + 2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    sparkPos[i * 3] += (dx / dist) * 0.005;
    sparkPos[i * 3 + 1] += (dy / dist) * 0.005;
    sparkPos[i * 3 + 2] += (dz / dist) * 0.005;
  }
  sparkSystem.geometry.attributes.position.needsUpdate = true;
  sparkSystem.geometry.attributes.color.needsUpdate = true;

  // ── Ambient glow ──
  for (let i = 0; i < MAX_GLOW; i++) {
    const f = i / MAX_GLOW;
    const angle = t * 0.3 + f * TAU * 3;
    const r = 1.3 + Math.sin(t + f * 10) * 0.3;
    const yy = (Math.sin(f * TAU * 2 + t * 0.5) * 0.8);
    glowPos[i * 3] = Math.cos(angle) * r;
    glowPos[i * 3 + 1] = yy;
    glowPos[i * 3 + 2] = Math.sin(angle) * r;
    const brightness = 0.05 + energy * 0.15 * (Math.sin(t * 2 + f * 5) * 0.5 + 0.5);
    const grgb = hslToRgb(coreHue, 0.4, brightness);
    glowCol[i * 3] = grgb[0]; glowCol[i * 3 + 1] = grgb[1]; glowCol[i * 3 + 2] = grgb[2];
  }
  glowSystem.geometry.attributes.position.needsUpdate = true;
  glowSystem.geometry.attributes.color.needsUpdate = true;

  group.rotation.y += dt * 0.05;

  KI.emit('plasma-orb:update', {
    dischargePattern,
    arcCount: activeArcCount,
    nodeCount: nodes.filter(n => n.active).length,
    coreIntensity: Math.round(coreBright * 100)
  });
}

function hslToRgb(h, s, l) {
  if (KI.hslToRgb) return KI.hslToRgb(h, s, l);
  let r, g, b;
  if (s === 0) { r = g = b = l; } else {
    const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q-p)*6*t; if (t < 1/2) return q; if (t < 2/3) return p + (q-p)*(2/3-t)*6; return p; };
    const q = l < 0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
    r = hue2rgb(p, q, h+1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h-1/3);
  }
  return [r, g, b];
}
