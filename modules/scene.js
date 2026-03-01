// scene.js — Three.js scene, camera, renderer, starfield, arena floor
import { KI } from './core.js';

export function init(opts = {}) {
  const W = window.innerWidth, H = window.innerHeight;
  KI.W = W; KI.H = H;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(opts.fogColor || 0x000011, opts.fogDensity || 0.012);

  const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 500);
  camera.position.set(0, 3.5, 9);
  camera.lookAt(0, 2, -4);

  const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('c'),
    antialias: true, alpha: true
  });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const clock = new THREE.Clock();

  KI.scene = scene; KI.camera = camera; KI.renderer = renderer; KI.clock = clock;

  window.onresize = () => {
    KI.W = window.innerWidth; KI.H = window.innerHeight;
    camera.aspect = KI.W / KI.H;
    camera.updateProjectionMatrix();
    renderer.setSize(KI.W, KI.H);
    KI.emit('resize', { w: KI.W, h: KI.H });
  };

  // starfield
  const starCount = opts.stars || 3000;
  const sg = new THREE.BufferGeometry();
  const sp = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    sp[i*3] = (Math.random()-0.5)*300;
    sp[i*3+1] = (Math.random()-0.5)*300;
    sp[i*3+2] = (Math.random()-0.5)*300;
  }
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.4 })));

  // arena floor
  const fg = new THREE.CircleGeometry(opts.arenaRadius || 18, 64);
  const fm = new THREE.MeshBasicMaterial({ color: 0x0a0a3a, transparent: true, opacity: 0.6 });
  const floor = new THREE.Mesh(fg, fm);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  scene.add(new THREE.GridHelper(36, 36, 0x003366, 0x001133));

  // target
  const tg = new THREE.IcosahedronGeometry(1.8, 2);
  const tm = new THREE.MeshBasicMaterial({ color: 0xff2222, wireframe: true, transparent: true, opacity: 0.8 });
  const target = new THREE.Mesh(tg, tm);
  target.position.set(0, 2.5, -8);
  scene.add(target);

  const tig = new THREE.SphereGeometry(1.4, 16, 16);
  const tim = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false });
  target.add(new THREE.Mesh(tig, tim));

  const rg = new THREE.TorusGeometry(2.2, 0.06, 8, 64);
  const rm = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.6 });
  target.hpRing = new THREE.Mesh(rg, rm);
  target.add(target.hpRing);
  KI.target.mesh = target;

  // player aura
  const ag = new THREE.SphereGeometry(1, 16, 16);
  const am = new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const aura = new THREE.Mesh(ag, am);
  aura.position.set(0, 2.5, 5);
  scene.add(aura);

  const ag2 = new THREE.SphereGeometry(1.5, 12, 12);
  const am2 = new THREE.MeshBasicMaterial({ color: 0x2244aa, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const auraGlow = new THREE.Mesh(ag2, am2);
  aura.add(auraGlow);

  scene.add(new THREE.AmbientLight(0x222244, 0.5));

  KI._scene = { aura, auraGlow, target, camAngle: 0, screenShake: 0 };

  KI.register('scene', {
    aura, auraGlow, target,
    update(dt, t) {
      const s = KI._scene;
      s.camAngle += 0.003;
      camera.position.x = Math.sin(s.camAngle) * 1.5;
      camera.position.y = 3.5 + Math.sin(s.camAngle * 0.7) * 0.3;
      camera.lookAt(0, 2.5, -4);
      if (s.screenShake > 0.1) {
        camera.position.x += (Math.random()-0.5) * s.screenShake * 0.3;
        camera.position.y += (Math.random()-0.5) * s.screenShake * 0.3;
        s.screenShake *= 0.9;
      }
      target.rotation.y = t * 0.3;
      target.rotation.x = Math.sin(t * 0.5) * 0.2;
      const hp = KI.target.hp / KI.target.maxHP;
      target.scale.setScalar(1 + Math.sin(t*3) * (1-hp) * 0.1);
    }
  });

  KI.emit('scene:ready', { scene, camera, renderer });
}
