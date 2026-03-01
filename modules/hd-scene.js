// hd-scene.js — High-resolution scene with multi-layer bloom, detailed geo, nebula backdrop
import { KI } from './core.js';

export function init(opts = {}) {
  const W = window.innerWidth, H = window.innerHeight;
  KI.W = W; KI.H = H;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(opts.fogColor || 0x000008, opts.fogDensity || 0.008);

  const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 800);
  camera.position.set(0, 4, 11);
  camera.lookAt(0, 2.5, -4);

  const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('c'),
    antialias: true, alpha: true, powerPreference: 'high-performance'
  });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  renderer.outputEncoding = THREE.sRGBEncoding;

  const clock = new THREE.Clock();
  KI.scene = scene; KI.camera = camera; KI.renderer = renderer; KI.clock = clock;

  window.onresize = () => {
    KI.W = window.innerWidth; KI.H = window.innerHeight;
    camera.aspect = KI.W / KI.H;
    camera.updateProjectionMatrix();
    renderer.setSize(KI.W, KI.H);
    KI.emit('resize', { w: KI.W, h: KI.H });
  };

  // === STARFIELD — 6000 stars, variable sizes ===
  const starCount = opts.stars || 6000;
  const sg = new THREE.BufferGeometry();
  const sp = new Float32Array(starCount * 3);
  const ss = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    sp[i*3] = (Math.random()-0.5)*500;
    sp[i*3+1] = (Math.random()-0.5)*500;
    sp[i*3+2] = (Math.random()-0.5)*500;
    ss[i] = 0.2 + Math.random() * 0.8;
  }
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  sg.setAttribute('size', new THREE.BufferAttribute(ss, 1));
  // custom star shader for twinkle
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xccddff) } },
    vertexShader: `
      attribute float size;
      uniform float uTime;
      varying float vBright;
      void main() {
        vBright = 0.5 + 0.5 * sin(uTime * 0.5 + position.x * 0.1 + position.y * 0.15);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (200.0 / -mvPosition.z) * vBright;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vBright;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float alpha = (1.0 - d * d) * vBright;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const stars = new THREE.Points(sg, starMat);
  scene.add(stars);

  // === NEBULA BACKDROP — layered color planes ===
  const nebulaColors = [0x110033, 0x002244, 0x330011, 0x001133];
  const nebulae = [];
  nebulaColors.forEach((col, i) => {
    const ng = new THREE.PlaneGeometry(120, 60, 20, 10);
    const nm = new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0.06,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    const plane = new THREE.Mesh(ng, nm);
    plane.position.set((i-1.5)*20, 15 + i*5, -80 - i*30);
    plane.rotation.set(0.2 * i, 0.3 * i, 0);
    scene.add(plane);
    nebulae.push(plane);
  });

  // === ARENA FLOOR — high-res with ring patterns ===
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = 1024; floorCanvas.height = 1024;
  const fctx = floorCanvas.getContext('2d');
  fctx.fillStyle = '#050520';
  fctx.fillRect(0, 0, 1024, 1024);
  // concentric rings
  for (let r = 50; r < 512; r += 40) {
    fctx.beginPath();
    fctx.arc(512, 512, r, 0, Math.PI*2);
    fctx.strokeStyle = `rgba(0, 80, 180, ${0.15 - r/5000})`;
    fctx.lineWidth = 1;
    fctx.stroke();
  }
  // radial lines
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
    fctx.beginPath();
    fctx.moveTo(512, 512);
    fctx.lineTo(512 + Math.cos(a)*500, 512 + Math.sin(a)*500);
    fctx.strokeStyle = 'rgba(0, 60, 150, 0.08)';
    fctx.lineWidth = 1;
    fctx.stroke();
  }
  // glyphs at edges
  const glyphs = ['火','雷','気','水','風','土','光','闇','命','力','心','魂'];
  fctx.font = '28px serif';
  fctx.textAlign = 'center';
  glyphs.forEach((g, i) => {
    const a = (i / glyphs.length) * Math.PI * 2;
    fctx.fillStyle = 'rgba(0, 150, 255, 0.12)';
    fctx.fillText(g, 512 + Math.cos(a)*420, 512 + Math.sin(a)*420);
  });

  const floorTex = new THREE.CanvasTexture(floorCanvas);
  const fg = new THREE.CircleGeometry(22, 96);
  const fm = new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, opacity: 0.7 });
  const floor = new THREE.Mesh(fg, fm);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  scene.add(floor);

  // grid
  const grid = new THREE.GridHelper(44, 44, 0x003366, 0x000d22);
  grid.material.transparent = true;
  grid.material.opacity = 0.3;
  scene.add(grid);

  // === TARGET — higher poly with layered shields ===
  const tg = new THREE.IcosahedronGeometry(1.8, 3); // subdivision 3 instead of 2
  const tm = new THREE.MeshBasicMaterial({ color: 0xff2222, wireframe: true, transparent: true, opacity: 0.7 });
  const target = new THREE.Mesh(tg, tm);
  target.position.set(0, 2.5, -8);
  scene.add(target);

  // inner glow layers
  [1.4, 1.1, 0.7].forEach((r, i) => {
    const sg = new THREE.SphereGeometry(r, 24, 24);
    const sm = new THREE.MeshBasicMaterial({
      color: [0xff4444, 0xff6600, 0xffaa00][i],
      transparent: true, opacity: [0.1, 0.06, 0.04][i],
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    target.add(new THREE.Mesh(sg, sm));
  });

  // hp ring
  const rg = new THREE.TorusGeometry(2.4, 0.08, 12, 96);
  const rm = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.6 });
  target.hpRing = new THREE.Mesh(rg, rm);
  target.add(target.hpRing);

  // outer shield ring
  const org = new THREE.TorusGeometry(2.8, 0.03, 8, 96);
  const orm = new THREE.MeshBasicMaterial({
    color: 0x4444ff, transparent: true, opacity: 0.2,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  target.outerRing = new THREE.Mesh(org, orm);
  target.add(target.outerRing);
  KI.target.mesh = target;

  // === PLAYER AURA — multi-layer ===
  const auraGroup = new THREE.Group();
  auraGroup.position.set(0, 2.5, 5);
  scene.add(auraGroup);

  const auraLayers = [];
  [
    { r: 0.8, color: 0x4488ff, opacity: 0 },
    { r: 1.2, color: 0x2266dd, opacity: 0 },
    { r: 1.8, color: 0x1144aa, opacity: 0 },
    { r: 2.5, color: 0x0a2266, opacity: 0 }
  ].forEach(cfg => {
    const g = new THREE.SphereGeometry(cfg.r, 20, 20);
    const m = new THREE.MeshBasicMaterial({
      color: cfg.color, transparent: true, opacity: cfg.opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(g, m);
    auraGroup.add(mesh);
    auraLayers.push(mesh);
  });

  scene.add(new THREE.AmbientLight(0x222244, 0.5));
  const pointLight = new THREE.PointLight(0x4488ff, 0.5, 30);
  pointLight.position.set(0, 5, 0);
  scene.add(pointLight);

  KI._scene = {
    aura: auraGroup, auraGlow: auraLayers[1], auraLayers,
    target, camAngle: 0, screenShake: 0,
    stars, starMat, nebulae, floor, pointLight
  };

  KI.register('scene', {
    aura: auraGroup, auraGlow: auraLayers[1], auraLayers, target,
    update(dt, t) {
      const s = KI._scene;

      // star twinkle
      starMat.uniforms.uTime.value = t;

      // nebula undulation
      nebulae.forEach((n, i) => {
        const pos = n.geometry.attributes.position;
        for (let j = 0; j < pos.count; j++) {
          const x = pos.getX(j);
          pos.setZ(j, Math.sin(t * 0.2 + x * 0.05 + i * 1.5) * 3);
        }
        pos.needsUpdate = true;
        n.material.opacity = 0.05 + Math.sin(t * 0.3 + i) * 0.015;
      });

      // floor ring pulse
      floor.rotation.z = t * 0.02;

      // camera orbit
      s.camAngle += 0.002;
      camera.position.x = Math.sin(s.camAngle) * 2;
      camera.position.y = 4 + Math.sin(s.camAngle * 0.5) * 0.4;
      camera.lookAt(0, 2.5, -2);
      if (s.screenShake > 0.1) {
        camera.position.x += (Math.random()-0.5) * s.screenShake * 0.4;
        camera.position.y += (Math.random()-0.5) * s.screenShake * 0.3;
        s.screenShake *= 0.88;
      }

      // target animation
      target.rotation.y = t * 0.25;
      target.rotation.x = Math.sin(t * 0.4) * 0.15;
      const hp = KI.target.hp / KI.target.maxHP;
      target.scale.setScalar(1 + Math.sin(t*4) * (1-hp) * 0.08);
      target.outerRing.rotation.z = -t * 0.5;

      // dynamic point light color from resonance
      const res = KI.get('resonance');
      if (res) {
        const layer = res.state.activeLayer;
        if (layer >= 0) {
          const LAYERS = res.LAYERS;
          pointLight.color.setHex(LAYERS[layer].color);
          pointLight.intensity = 0.5 + layer * 0.3;
        } else {
          pointLight.color.setHex(0x4488ff);
          pointLight.intensity = 0.5;
        }
      }
    }
  });

  KI.emit('scene:ready', { scene, camera, renderer });
}
