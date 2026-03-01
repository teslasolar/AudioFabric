// sandbox-templates.js — Project scaffolds and quick-start templates
// Each template creates a set of files in the virtual filesystem.

import { createFile, commitChanges, initRepo } from './mcp-tools-engine.js';

export const TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank Project',
    icon: '▫',
    desc: 'Empty project with just a README',
    files: []
  },
  {
    id: 'hello',
    name: 'Hello World',
    icon: '◇',
    desc: 'Simple HTML page with styled greeting',
    files: [
      { path: '/index.html', content: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hello World</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(135deg,#0a0a20,#1a0a30);font-family:system-ui,sans-serif}
h1{font-size:clamp(2rem,8vw,6rem);background:linear-gradient(135deg,#44aaff,#ff44aa);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  animation:pulse 3s ease infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.8;transform:scale(1.02)}}
</style>
</head>
<body><h1>Hello World</h1></body>
</html>` }
    ]
  },
  {
    id: 'todo',
    name: 'Todo App',
    icon: '☑',
    desc: 'Interactive todo list with local storage',
    files: [
      { path: '/index.html', content: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Todo App</title>
<link rel="stylesheet" href="/style.css">
</head>
<body>
<div class="app">
  <h1>Todo</h1>
  <form id="form">
    <input id="input" placeholder="What needs to be done?" autocomplete="off">
    <button type="submit">Add</button>
  </form>
  <ul id="list"></ul>
  <div class="footer">
    <span id="count">0 items</span>
    <button onclick="clearDone()">Clear done</button>
  </div>
</div>
<script src="/app.js"><\/script>
</body>
</html>` },
      { path: '/style.css', content: `*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;background:#0d0d1a;color:#dde;font-family:system-ui,sans-serif;
  display:flex;justify-content:center;padding:40px 16px}
.app{width:100%;max-width:480px}
h1{font-size:28px;color:#44aaff;margin-bottom:20px;letter-spacing:2px}
form{display:flex;gap:8px;margin-bottom:16px}
input{flex:1;background:#1a1a2e;border:1px solid #333;color:#eee;padding:10px 14px;
  border-radius:6px;font-size:14px;outline:none}
input:focus{border-color:#44aaff}
button{background:#44aaff;color:#000;border:none;padding:10px 18px;border-radius:6px;
  cursor:pointer;font-weight:600;font-size:13px}
button:hover{background:#66ccff}
ul{list-style:none}
li{padding:10px 14px;border-bottom:1px solid #1a1a2e;display:flex;align-items:center;gap:10px;
  cursor:pointer;transition:background .2s}
li:hover{background:rgba(68,170,255,.05)}
li.done{opacity:.4;text-decoration:line-through}
li .check{width:18px;height:18px;border:2px solid #333;border-radius:50%;flex-shrink:0}
li.done .check{background:#44aaff;border-color:#44aaff}
.footer{display:flex;justify-content:space-between;align-items:center;padding:12px 0;
  font-size:12px;color:#667}
.footer button{background:transparent;color:#667;border:1px solid #333;padding:4px 10px;
  border-radius:4px;font-size:11px}` },
      { path: '/app.js', content: `const form = document.getElementById('form');
const input = document.getElementById('input');
const list = document.getElementById('list');
const countEl = document.getElementById('count');
let todos = JSON.parse(localStorage.getItem('todos') || '[]');

function render() {
  list.innerHTML = '';
  todos.forEach((t, i) => {
    const li = document.createElement('li');
    if (t.done) li.classList.add('done');
    li.innerHTML = '<div class="check"></div><span>' + esc(t.text) + '</span>';
    li.onclick = () => { todos[i].done = !todos[i].done; save(); render(); };
    list.appendChild(li);
  });
  countEl.textContent = todos.filter(t => !t.done).length + ' items left';
}

function save() { localStorage.setItem('todos', JSON.stringify(todos)); }
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

form.onsubmit = e => {
  e.preventDefault();
  if (!input.value.trim()) return;
  todos.push({ text: input.value.trim(), done: false });
  input.value = '';
  save(); render();
};

window.clearDone = () => { todos = todos.filter(t => !t.done); save(); render(); };
render();` }
    ]
  },
  {
    id: 'canvas-game',
    name: 'Canvas Game',
    icon: '▶',
    desc: 'Particle game with mouse interaction',
    files: [
      { path: '/index.html', content: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Particle Game</title>
<style>
*{margin:0;padding:0}body{overflow:hidden;background:#000}canvas{display:block}
#score{position:fixed;top:12px;left:12px;color:rgba(255,255,255,.3);font:14px monospace}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="score">Score: 0</div>
<script src="/game.js"><\/script>
</body>
</html>` },
      { path: '/game.js', content: `const c = document.getElementById('c'), ctx = c.getContext('2d');
let W, H; function resize() { W = c.width = innerWidth; H = c.height = innerHeight; }
resize(); onresize = resize;
let mx = W/2, my = H/2, score = 0, particles = [], targets = [];
onmousemove = e => { mx = e.clientX; my = e.clientY; };

function spawnTarget() {
  targets.push({ x: Math.random()*W, y: Math.random()*H, r: 12+Math.random()*20,
    hue: Math.random()*360, life: 1, vy: -.5-Math.random() });
}
for (let i = 0; i < 8; i++) spawnTarget();

onclick = () => {
  for (let i = targets.length-1; i >= 0; i--) {
    const t = targets[i], dx = mx-t.x, dy = my-t.y;
    if (dx*dx+dy*dy < t.r*t.r) {
      score += Math.round(t.r);
      for (let j = 0; j < 20; j++) {
        const a = Math.random()*Math.PI*2, s = 2+Math.random()*5;
        particles.push({ x:t.x, y:t.y, vx:Math.cos(a)*s, vy:Math.sin(a)*s,
          size:2+Math.random()*3, life:1, hue:t.hue });
      }
      targets.splice(i, 1);
      spawnTarget(); spawnTarget();
      break;
    }
  }
};

(function loop() {
  requestAnimationFrame(loop);
  ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.fillRect(0,0,W,H);
  targets.forEach(t => {
    t.y += t.vy; t.life -= .001;
    if (t.y < -50 || t.life < 0) { Object.assign(t,{x:Math.random()*W,y:H+50,life:1}); }
    ctx.beginPath(); ctx.arc(t.x,t.y,t.r,0,Math.PI*2);
    ctx.fillStyle = 'hsla('+t.hue+',70%,60%,.6)'; ctx.fill();
    ctx.strokeStyle = 'hsla('+t.hue+',70%,80%,.3)'; ctx.lineWidth = 2; ctx.stroke();
  });
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.vy += .08; p.life -= .02; p.vx *= .98;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.size*p.life,0,Math.PI*2);
    ctx.fillStyle = 'hsla('+p.hue+',80%,70%,'+p.life+')'; ctx.fill();
  });
  particles = particles.filter(p => p.life > 0);
  // cursor glow
  const g = ctx.createRadialGradient(mx,my,0,mx,my,40);
  g.addColorStop(0,'rgba(100,200,255,.15)'); g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(mx-40,my-40,80,80);
  document.getElementById('score').textContent = 'Score: '+score;
})();` }
    ]
  },
  {
    id: 'dashboard',
    name: 'Data Dashboard',
    icon: '▣',
    desc: 'Real-time charts with animated data',
    files: [
      { path: '/index.html', content: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dashboard</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;background:#0a0a14;color:#ccd;font-family:system-ui,sans-serif;padding:16px}
h1{font-size:18px;color:#44aaff;margin-bottom:16px;letter-spacing:1px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.card{background:#111122;border:1px solid #222;border-radius:8px;padding:16px}
.card h2{font-size:12px;color:#889;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
.card .value{font-size:28px;font-weight:700;color:#44aaff}
.card .sub{font-size:11px;color:#556;margin-top:4px}
canvas{width:100%;height:120px;margin-top:8px;border-radius:4px}
.card.green .value{color:#44ff88}
.card.orange .value{color:#ffaa44}
.card.purple .value{color:#aa88ff}
</style>
</head>
<body>
<h1>Dashboard</h1>
<div class="grid">
  <div class="card"><h2>Revenue</h2><div class="value" id="v1">$0</div><div class="sub">Last 30 days</div><canvas id="c1"></canvas></div>
  <div class="card green"><h2>Users</h2><div class="value" id="v2">0</div><div class="sub">Active now</div><canvas id="c2"></canvas></div>
  <div class="card orange"><h2>Requests</h2><div class="value" id="v3">0/s</div><div class="sub">API throughput</div><canvas id="c3"></canvas></div>
  <div class="card purple"><h2>Latency</h2><div class="value" id="v4">0ms</div><div class="sub">p99 response</div><canvas id="c4"></canvas></div>
</div>
<script>
const charts = [
  {el:'c1',data:[],color:'#44aaff',valEl:'v1',fmt:v=>'$'+Math.round(v).toLocaleString()},
  {el:'c2',data:[],color:'#44ff88',valEl:'v2',fmt:v=>Math.round(v).toLocaleString()},
  {el:'c3',data:[],color:'#ffaa44',valEl:'v3',fmt:v=>Math.round(v)+'/s'},
  {el:'c4',data:[],color:'#aa88ff',valEl:'v4',fmt:v=>Math.round(v)+'ms'}
];
charts.forEach(ch => {
  const c = document.getElementById(ch.el);
  c.width = c.offsetWidth * 2; c.height = 240;
  ch.ctx = c.getContext('2d');
  for(let i=0;i<60;i++) ch.data.push(Math.random()*100);
});
setInterval(()=>{
  charts.forEach((ch,i)=>{
    const base = [12000,3400,890,45][i];
    const noise = base * (.15*Math.sin(Date.now()/2000+i)+.1*(Math.random()-.5));
    ch.data.push(base+noise); if(ch.data.length>60) ch.data.shift();
    document.getElementById(ch.valEl).textContent = ch.fmt(ch.data[ch.data.length-1]);
    const ctx=ch.ctx, w=ctx.canvas.width, h=ctx.canvas.height;
    ctx.clearRect(0,0,w,h);
    const max=Math.max(...ch.data)*1.1, min=Math.min(...ch.data)*.9;
    ctx.beginPath();
    ch.data.forEach((v,j)=>{
      const x=j/(ch.data.length-1)*w, y=h-(v-min)/(max-min)*h;
      j===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    });
    ctx.strokeStyle=ch.color; ctx.lineWidth=2; ctx.stroke();
    ctx.lineTo(w,h); ctx.lineTo(0,h); ctx.closePath();
    ctx.fillStyle=ch.color+'18'; ctx.fill();
  });
},500);
<\/script>
</body>
</html>` }
    ]
  },
  {
    id: 'three-scene',
    name: '3D Scene',
    icon: '◈',
    desc: 'Three.js rotating geometry',
    files: [
      { path: '/index.html', content: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>3D Scene</title>
<style>*{margin:0;padding:0}body{overflow:hidden;background:#000}canvas{display:block}</style>
</head>
<body>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
<script>
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.1, 100);
camera.position.z = 4;
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
document.body.appendChild(renderer.domElement);
onresize = () => { camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); };

// lights
scene.add(new THREE.AmbientLight(0x404060));
const dl = new THREE.DirectionalLight(0xffffff, 1); dl.position.set(5,5,5); scene.add(dl);
const pl = new THREE.PointLight(0x44aaff, 1, 20); pl.position.set(-3,3,3); scene.add(pl);

// geometry
const shapes = [];
const geos = [new THREE.BoxGeometry(1,1,1), new THREE.SphereGeometry(.6,32,32),
  new THREE.TorusGeometry(.5,.2,16,48), new THREE.OctahedronGeometry(.7),
  new THREE.ConeGeometry(.5,1,8)];
for(let i=0;i<12;i++){
  const mat = new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(i/12,.7,.5),
    metalness:.3, roughness:.4});
  const mesh = new THREE.Mesh(geos[i%geos.length], mat);
  const a = (i/12)*Math.PI*2;
  mesh.position.set(Math.cos(a)*2.5, Math.sin(a*2)*.8, Math.sin(a)*2.5);
  scene.add(mesh); shapes.push(mesh);
}

(function loop(){
  requestAnimationFrame(loop);
  const t = Date.now()*.001;
  shapes.forEach((s,i) => { s.rotation.x=t+i; s.rotation.y=t*.7+i; });
  camera.position.x = Math.sin(t*.3)*1.5;
  camera.position.y = Math.sin(t*.2)*.5+1;
  camera.lookAt(0,0,0);
  pl.position.x = Math.sin(t)*3; pl.position.z = Math.cos(t)*3;
  renderer.render(scene, camera);
})();
<\/script>
</body>
</html>` }
    ]
  }
];

// ===== SCAFFOLD =====
export function scaffold(templateId, repoName) {
  const template = TEMPLATES.find(t => t.id === templateId);
  if (!template) return { ok: false, error: 'Unknown template: ' + templateId };

  initRepo(repoName || template.name);

  for (const file of template.files) {
    createFile(file.path, file.content);
  }

  if (template.files.length > 0) {
    commitChanges('Scaffold: ' + template.name);
  }

  return {
    ok: true,
    template: template.name,
    files: template.files.map(f => f.path),
    count: template.files.length
  };
}

export function getTemplateList() {
  return TEMPLATES.map(t => ({ id: t.id, name: t.name, icon: t.icon, desc: t.desc }));
}
