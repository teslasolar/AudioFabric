// prismatic-shatter.js — Crystal sphere that shatters and reforms from voice
// A glass-like orb that fractures into shards when you sing, then reassembles
// as voice fades. Shards refract light into prismatic colors.
// Features:
// - Central crystal sphere made of triangular shards
// - Energy → shatter force (how far shards fly)
// - Coherence → reassembly speed (high = snaps back fast)
// - Pitch → prismatic color separation (rainbow refraction)
// - Vowel → shatter pattern (radial, vertical, spiral, random, cascade)
// - Pulse → shard rotation speed
// - Each shard has independent physics (position, rotation, velocity)
// - Light beams shoot through cracks during shatter
// - Dust particles from fracture points

import { KI } from './core.js';

const TAU = Math.PI * 2;

// ── Shard state ──
const MAX_SHARDS = 80;
const shards = [];
let shatterAmount = 0; // 0 = whole, 1 = fully shattered
let shatterPattern = 'radial';

// ── 3D ──
let group = null;
let shardMeshes = [];
// Light beams through cracks
let beamLines = [];
const MAX_BEAMS = 20;
// Dust particles
let dustSystem = null, dustPos = null, dustCol = null;
const MAX_DUST = 300;
// Central glow (visible when whole)
let centerGlow = null;
// Outer ring (intact indicator)
let intactRing = null;

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 3, -3];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── Generate shards (triangular pieces of a sphere) ──
  const baseGeo = new THREE.IcosahedronGeometry(1.2, 2);
  const faces = baseGeo.index;
  const verts = baseGeo.attributes.position.array;

  for (let i = 0; i < Math.min(MAX_SHARDS, faces.count / 3); i++) {
    const i0 = faces.getX(i * 3), i1 = faces.getX(i * 3 + 1), i2 = faces.getX(i * 3 + 2);

    // Triangle vertices
    const v0 = [verts[i0*3], verts[i0*3+1], verts[i0*3+2]];
    const v1 = [verts[i1*3], verts[i1*3+1], verts[i1*3+2]];
    const v2 = [verts[i2*3], verts[i2*3+1], verts[i2*3+2]];

    // Center of triangle
    const cx = (v0[0]+v1[0]+v2[0])/3;
    const cy = (v0[1]+v1[1]+v2[1])/3;
    const cz = (v0[2]+v1[2]+v2[2])/3;

    // Direction outward from center
    const len = Math.sqrt(cx*cx+cy*cy+cz*cz) || 1;
    const nx = cx/len, ny = cy/len, nz = cz/len;

    shards.push({
      homeX: cx, homeY: cy, homeZ: cz,
      x: cx, y: cy, z: cz,
      vx: 0, vy: 0, vz: 0,
      nx, ny, nz, // outward normal
      rotX: 0, rotY: 0, rotZ: 0,
      rotVX: 0, rotVY: 0, rotVZ: 0,
      hue: Math.atan2(nz, nx) / TAU + 0.5 // hue from angle
    });

    // Build shard mesh (thin triangular prism)
    const shardGeo = new THREE.BufferGeometry();
    const thickness = 0.03;
    const positions = new Float32Array([
      // Front face
      v0[0]-cx, v0[1]-cy, v0[2]-cz,
      v1[0]-cx, v1[1]-cy, v1[2]-cz,
      v2[0]-cx, v2[1]-cy, v2[2]-cz,
      // Back face (offset inward)
      (v0[0]-cx)*0.9, (v0[1]-cy)*0.9, (v0[2]-cz)*0.9,
      (v1[0]-cx)*0.9, (v1[1]-cy)*0.9, (v1[2]-cz)*0.9,
      (v2[0]-cx)*0.9, (v2[1]-cy)*0.9, (v2[2]-cz)*0.9
    ]);
    const indices = [0,1,2, 3,5,4, 0,3,1, 1,3,4, 1,4,2, 2,4,5, 2,5,0, 0,5,3];
    shardGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    shardGeo.setIndex(indices);
    shardGeo.computeVertexNormals();

    const mat = new THREE.MeshBasicMaterial({
      color: 0xaaeeff, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(shardGeo, mat);
    mesh.position.set(cx, cy, cz);
    group.add(mesh);
    shardMeshes.push(mesh);
  }

  // ── Light beams ──
  for (let i = 0; i < MAX_BEAMS; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending
    }));
    line.visible = false;
    group.add(line);
    beamLines.push(line);
  }

  // ── Dust particles ──
  const dGeo = new THREE.BufferGeometry();
  dustPos = new Float32Array(MAX_DUST * 3);
  dustCol = new Float32Array(MAX_DUST * 3);
  dGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dGeo.setAttribute('color', new THREE.BufferAttribute(dustCol, 3));
  dustSystem = new THREE.Points(dGeo, new THREE.PointsMaterial({
    size: 0.04, vertexColors: true, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(dustSystem);

  // ── Center glow ──
  const gGeo = new THREE.SphereGeometry(0.8, 16, 12);
  centerGlow = new THREE.Mesh(gGeo, new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.15,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(centerGlow);

  // ── Intact ring ──
  const rGeo = new THREE.TorusGeometry(1.3, 0.01, 4, 64);
  intactRing = new THREE.Mesh(rGeo, new THREE.MeshBasicMaterial({
    color: 0xaaeeff, transparent: true, opacity: 0.1,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  intactRing.rotation.x = Math.PI / 2;
  group.add(intactRing);

  KI.register('prismatic-shatter', {
    update, group,
    getShatterAmount: () => shatterAmount,
    getPattern: () => shatterPattern,
    getShardCount: () => shards.length
  });

  KI.emit('prismatic-shatter:ready');
}

function getShatterForce(shard, pattern, t) {
  const { nx, ny, nz, homeX, homeY, homeZ } = shard;
  switch (pattern) {
    case 'vertical':
      return { fx: nx * 0.3, fy: ny * 2 * Math.sign(homeY + 0.01), fz: nz * 0.3 };
    case 'spiral': {
      const angle = Math.atan2(nz, nx) + t;
      return { fx: Math.cos(angle) * 1.5, fy: ny, fz: Math.sin(angle) * 1.5 };
    }
    case 'cascade': {
      const delay = (homeY + 1.5) / 3; // top shatters first
      const force = Math.max(0, 1 - delay);
      return { fx: nx * force, fy: ny * force + 0.5, fz: nz * force };
    }
    case 'random':
      return { fx: (Math.random()-0.5) * 2, fy: (Math.random()-0.5) * 2, fz: (Math.random()-0.5) * 2 };
    default: // radial
      return { fx: nx * 1.5, fy: ny * 1.5, fz: nz * 1.5 };
  }
}

function update(dt, t) {
  const v = KI.voice;
  const energy = v.energy || 0;
  const coherence = v.coherence || 0;
  const pitch = v.pn || 0;
  const sounding = v.sounding;
  const pulseRate = v.pulseRate || 1;

  // ── Vowel → shatter pattern ──
  if (sounding) {
    const vowelPattern = { a: 'radial', e: 'vertical', i: 'spiral', o: 'cascade', u: 'random' };
    shatterPattern = vowelPattern[v.vowel || 'a'] || 'radial';
  }

  // ── Shatter amount: energy drives it, coherence reassembles ──
  const targetShatter = energy;
  if (shatterAmount < targetShatter) {
    shatterAmount += dt * (2 + energy * 3); // fast shatter
  } else {
    shatterAmount -= dt * (0.3 + coherence * 2); // coherence reassembles
  }
  shatterAmount = Math.max(0, Math.min(1, shatterAmount));

  // ── Update shards ──
  for (let i = 0; i < shards.length; i++) {
    const shard = shards[i];
    const mesh = shardMeshes[i];

    if (shatterAmount > 0.05) {
      // Apply shatter force
      const force = getShatterForce(shard, shatterPattern, t);
      const str = shatterAmount * 2;
      shard.vx += force.fx * str * dt;
      shard.vy += force.fy * str * dt;
      shard.vz += force.fz * str * dt;

      // Damping
      shard.vx *= 0.95; shard.vy *= 0.95; shard.vz *= 0.95;

      shard.x = shard.homeX + shard.vx * shatterAmount;
      shard.y = shard.homeY + shard.vy * shatterAmount;
      shard.z = shard.homeZ + shard.vz * shatterAmount;

      // Rotation
      shard.rotVX += (Math.random()-0.5) * dt * shatterAmount * 5;
      shard.rotVY += (Math.random()-0.5) * dt * shatterAmount * 5;
      shard.rotVZ += (Math.random()-0.5) * dt * shatterAmount * 5;
      shard.rotVX *= 0.97; shard.rotVY *= 0.97; shard.rotVZ *= 0.97;
    } else {
      // Return home
      shard.x += (shard.homeX - shard.x) * dt * 5;
      shard.y += (shard.homeY - shard.y) * dt * 5;
      shard.z += (shard.homeZ - shard.z) * dt * 5;
      shard.vx *= 0.9; shard.vy *= 0.9; shard.vz *= 0.9;
      shard.rotVX *= 0.9; shard.rotVY *= 0.9; shard.rotVZ *= 0.9;
    }

    shard.rotX += shard.rotVX * dt * pulseRate;
    shard.rotY += shard.rotVY * dt * pulseRate;
    shard.rotZ += shard.rotVZ * dt * pulseRate;

    mesh.position.set(shard.x, shard.y, shard.z);
    mesh.rotation.set(shard.rotX, shard.rotY, shard.rotZ);

    // Prismatic color: pitch spreads hue
    const hue = (shard.hue + pitch * 0.5) % 1;
    const rgb = hslToRgb(hue, 0.5 + shatterAmount * 0.4, 0.3 + energy * 0.3);
    mesh.material.color.setRGB(rgb[0], rgb[1], rgb[2]);
    mesh.material.opacity = 0.2 + shatterAmount * 0.2 + energy * 0.1;
  }

  // ── Light beams through cracks ──
  let beamIdx = 0;
  if (shatterAmount > 0.1) {
    for (let i = 0; i < shards.length && beamIdx < MAX_BEAMS; i += 4) {
      const shard = shards[i];
      const beam = beamLines[beamIdx];
      beam.visible = true;
      const posArr = beam.geometry.attributes.position.array;
      // Beam from center outward through crack
      posArr[0] = 0; posArr[1] = 0; posArr[2] = 0;
      posArr[3] = shard.nx * 3 * shatterAmount;
      posArr[4] = shard.ny * 3 * shatterAmount;
      posArr[5] = shard.nz * 3 * shatterAmount;
      beam.geometry.attributes.position.needsUpdate = true;
      beam.material.opacity = shatterAmount * 0.3 * energy;
      const bHue = (shard.hue + pitch) % 1;
      const brgb = hslToRgb(bHue, 0.8, 0.5);
      beam.material.color.setRGB(brgb[0], brgb[1], brgb[2]);
      beamIdx++;
    }
  }
  for (let i = beamIdx; i < MAX_BEAMS; i++) {
    beamLines[i].visible = false;
  }

  // ── Dust particles ──
  for (let i = 0; i < MAX_DUST; i++) {
    if (shatterAmount > 0.2 && Math.random() < shatterAmount * dt * 3) {
      // Spawn dust at a random shard
      const si = Math.floor(Math.random() * shards.length);
      const s = shards[si];
      dustPos[i*3] = s.x; dustPos[i*3+1] = s.y; dustPos[i*3+2] = s.z;
      const drgb = hslToRgb(s.hue, 0.5, 0.4);
      dustCol[i*3] = drgb[0]; dustCol[i*3+1] = drgb[1]; dustCol[i*3+2] = drgb[2];
    }
    // Drift and fade
    dustPos[i*3]   += (Math.random()-0.5) * dt * 0.5;
    dustPos[i*3+1] -= dt * 0.3; // gravity
    dustPos[i*3+2] += (Math.random()-0.5) * dt * 0.5;
    dustCol[i*3] *= 0.97; dustCol[i*3+1] *= 0.97; dustCol[i*3+2] *= 0.97;
  }
  dustSystem.geometry.attributes.position.needsUpdate = true;
  dustSystem.geometry.attributes.color.needsUpdate = true;

  // ── Center glow (brighter when intact) ──
  centerGlow.material.opacity = (1 - shatterAmount) * 0.15 + energy * 0.1;
  centerGlow.scale.setScalar(0.6 + Math.sin(t * 2) * 0.05);

  // ── Intact ring ──
  intactRing.material.opacity = (1 - shatterAmount) * 0.1;
  intactRing.rotation.z = t * 0.2;

  group.rotation.y += dt * 0.06;

  KI.emit('prismatic-shatter:update', {
    shatterAmount: (shatterAmount * 100).toFixed(0),
    pattern: shatterPattern,
    shardCount: shards.length,
    beamCount: beamIdx
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
