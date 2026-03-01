// periodic-visuals.js — 3D element visualization for Three.js scenes
// Each element rendered as an atom model: nucleus + electron shells
// Category determines geometry, period determines shell count, group determines color intensity
// Electron orbits animate, nucleus pulses with density

import { ELEMENTS, BY_SYMBOL, CATEGORIES } from './periodic-elements.js';

let scene = null;
const activeAtoms = [];
const particles = [];

export function init(threeScene) {
  scene = threeScene;
}

// category → nucleus geometry
function nucleusGeo(cat) {
  switch (cat) {
    case 'alkali-metal':     return new THREE.IcosahedronGeometry(0.4, 0);
    case 'alkaline-earth':   return new THREE.OctahedronGeometry(0.4, 0);
    case 'transition-metal': return new THREE.DodecahedronGeometry(0.4, 0);
    case 'post-transition':  return new THREE.BoxGeometry(0.5, 0.5, 0.5);
    case 'metalloid':        return new THREE.TetrahedronGeometry(0.4, 0);
    case 'nonmetal':         return new THREE.SphereGeometry(0.35, 8, 8);
    case 'noble-gas':        return new THREE.SphereGeometry(0.3, 16, 16);
    case 'lanthanide':       return new THREE.IcosahedronGeometry(0.4, 1);
    case 'actinide':         return new THREE.IcosahedronGeometry(0.45, 1);
    default:                 return new THREE.SphereGeometry(0.35, 6, 6);
  }
}

// create a 3D atom at a position
export function createAtom(element, position) {
  if (!scene) return null;
  const group = new THREE.Group();
  const color = new THREE.Color(element.color);

  // nucleus
  const nGeo = nucleusGeo(element.category);
  const nMat = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.7 });
  const nucleus = new THREE.Mesh(nGeo, nMat);
  group.add(nucleus);

  // inner glow
  const glowGeo = new THREE.SphereGeometry(0.5, 12, 12);
  const glowMat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.08,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  group.add(new THREE.Mesh(glowGeo, glowMat));

  // electron shells (1 per period, up to 7)
  const shellCount = Math.min(element.period, 4); // cap at 4 visible shells
  const shells = [];
  for (let s = 0; s < shellCount; s++) {
    const radius = 0.8 + s * 0.5;
    const electronCount = s === 0 ? 2 : (s === 1 ? 4 : (s === 2 ? 6 : 8));
    const ePosArr = new Float32Array(electronCount * 3);
    const eGeo = new THREE.BufferGeometry();
    eGeo.setAttribute('position', new THREE.Float32BufferAttribute(ePosArr, 3));
    const eMat = new THREE.PointsMaterial({
      color, size: 0.1 - s * 0.01, transparent: true, opacity: 0.6 - s * 0.1,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const electrons = new THREE.Points(eGeo, eMat);
    group.add(electrons);

    // orbit ring
    const ringGeo = new THREE.RingGeometry(radius - 0.02, radius + 0.02, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.08, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2 + s * 0.3;
    ring.rotation.y = s * 0.5;
    group.add(ring);

    shells.push({ geo: eGeo, count: electronCount, radius, ring, speed: 1.5 - s * 0.2, tiltX: s * 0.3, tiltY: s * 0.5 });
  }

  // symbol sprite
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const c2 = canvas.getContext('2d');
  c2.fillStyle = element.color;
  c2.font = 'bold 56px monospace';
  c2.textAlign = 'center';
  c2.textBaseline = 'middle';
  c2.fillText(element.symbol, 64, 54);
  c2.font = '20px monospace';
  c2.fillText(String(element.z), 64, 100);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  sprite.scale.set(1.4, 1.4, 1);
  sprite.position.y = 1.2;
  group.add(sprite);

  group.position.copy(position);
  scene.add(group);

  const entry = {
    group, nucleus, shells, element, sprite,
    animate(t) {
      nucleus.rotation.y = t * 0.4;
      nucleus.rotation.x = Math.sin(t * 0.2) * 0.3;

      shells.forEach((sh, si) => {
        const pos = sh.geo.attributes.position;
        for (let i = 0; i < sh.count; i++) {
          const a = t * sh.speed + (i / sh.count) * Math.PI * 2;
          const r = sh.radius + Math.sin(t * 2 + i) * 0.05;
          // tilted orbit
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r * Math.sin(sh.tiltX);
          const z = Math.sin(a) * r * Math.cos(sh.tiltX);
          pos.setXYZ(i, x, y, z);
        }
        pos.needsUpdate = true;
        sh.ring.rotation.z = t * 0.1 * (si + 1);
      });

      // hover bob
      group.position.y = position.y + Math.sin(t * 0.5 + element.z * 0.1) * 0.2;
    },
    remove() {
      scene.remove(group);
    }
  };
  activeAtoms.push(entry);
  return entry;
}

// create a group of element atoms in a row
export function createElementRow(elements, center, spacing = 2.0) {
  if (!scene) return null;
  const atoms = [];
  const total = (elements.length - 1) * spacing;
  const startX = -total / 2;

  elements.forEach((el, i) => {
    const pos = new THREE.Vector3(startX + i * spacing + center.x, center.y, center.z);
    const atom = createAtom(el, pos);
    if (atom) atoms.push(atom);
  });

  // connecting beams
  for (let i = 0; i < atoms.length - 1; i++) {
    const from = atoms[i].group.position;
    const to = atoms[i + 1].group.position;
    const bGeo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const bMat = new THREE.LineBasicMaterial({
      color: 0x446688, transparent: true, opacity: 0.15,
      blending: THREE.AdditiveBlending
    });
    scene.add(new THREE.Line(bGeo, bMat));
  }

  return {
    atoms,
    animate(t) { atoms.forEach(a => a.animate(t)); },
    remove() { atoms.forEach(a => a.remove()); }
  };
}

// element burst
export function spawnElementBurst(element, position, count = 25) {
  if (!scene) return;
  const color = new THREE.Color(element.color);
  for (let i = 0; i < count; i++) {
    const geo = new THREE.SphereGeometry(0.04, 4, 4);
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
    particles.push({ mesh: p, vel, life: 0.8 + Math.random() * 0.6 });
  }
}

// update loop
export function update(dt, t) {
  activeAtoms.forEach(a => a.animate(t));
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.vel.y -= 2 * dt;
    p.mesh.material.opacity = Math.max(0, p.life * 0.5);
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }
}

export function clearAll() {
  activeAtoms.forEach(a => a.remove());
  activeAtoms.length = 0;
  particles.forEach(p => scene?.remove(p.mesh));
  particles.length = 0;
}
