// presence.js — Online status, remote player avatars, leaderboard, user list
import { KI } from './core.js';

const peerScores = {};
const remotePlayers = {};
const REMOTE_POS = [
  [-5,2.5,4],[5,2.5,4],[-7,2.5,1],[7,2.5,1],
  [-3,2.5,7],[3,2.5,7],[-8,2.5,-1],[8,2.5,-1]
];
let liveTimer = 0;

export function init() {
  KI.on('remote:score', handleScore);
  KI.on('remote:state', handleState);
  KI.on('remote:blast', handleBlast);
  KI.on('rtc:peerConnect', updateLeaderboard);
  KI.on('rtc:peerDisconnect', updateLeaderboard);

  KI.register('presence', { update, remotePlayers, peerScores, updateLeaderboard, getOrCreateRemote });
}

function getOrCreateRemote(name) {
  if (remotePlayers[name]) return remotePlayers[name];
  const scene = KI.scene;
  if (!scene) return null;

  const idx = Object.keys(remotePlayers).length;
  const pos = REMOTE_POS[idx % REMOTE_POS.length];

  const rAura = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  rAura.position.set(pos[0], pos[1], pos[2]);
  scene.add(rAura);

  const lc = document.createElement('canvas'); lc.width = 256; lc.height = 64;
  const lx = lc.getContext('2d');
  lx.fillStyle = '#fff'; lx.font = '20px monospace'; lx.textAlign = 'center';
  lx.fillText(name, 128, 40);
  const lm = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(lc), transparent: true, depthWrite: false });
  const ls = new THREE.Sprite(lm);
  ls.scale.set(2, 0.5, 1);
  ls.position.set(pos[0], pos[1] + 1.5, pos[2]);
  scene.add(ls);

  remotePlayers[name] = {
    name, aura: rAura, label: ls, charge: 0, vowel: '', pn: 0,
    lastUpdate: Date.now(),
    position: new THREE.Vector3(pos[0], pos[1], pos[2])
  };
  return remotePlayers[name];
}

function handleScore(data) {
  peerScores[data.name] = { name: data.name, score: data.score || 0, time: data.t || Date.now() };
  getOrCreateRemote(data.name);
  updateLeaderboard();
}

function handleState(data) {
  const rp = getOrCreateRemote(data.name);
  if (!rp) return;
  rp.charge = data.charge || 0;
  rp.vowel = data.vowel || '';
  rp.pn = data.pn || 0;
  rp.lastUpdate = Date.now();
}

function handleBlast(data) {
  const rp = getOrCreateRemote(data.name);
  if (!rp) return;
  const blastMod = KI.get('ki-blasts');
  if (blastMod) blastMod.fireBlast(data.blastType || 'kiball', data.power || 0.5, rp.position);
}

function updateLeaderboard() {
  const all = Object.keys(peerScores).map(k => peerScores[k]);
  all.push({ name: KI.player.name, score: KI.player.score, time: Date.now() });
  const best = {};
  all.forEach(e => { if (!best[e.name] || e.score > best[e.name].score) best[e.name] = e; });
  const sorted = Object.values(best).sort((a, b) => b.score - a.score).slice(0, 10);

  const lbRows = document.getElementById('lbRows');
  if (lbRows) {
    let html = '';
    sorted.forEach((e, i) => {
      const me = e.name === KI.player.name ? ' me' : '';
      html += `<div class="row"><span class="n${me}">${i+1}. ${e.name}</span><span class="s${me}">${e.score.toLocaleString()}</span></div>`;
    });
    lbRows.innerHTML = html;
  }

  const peerCount = Object.keys(best).length;
  const rtcMod = KI.get('webrtc-net');
  const rtcPeers = rtcMod?.getPeerCount?.() || 0;
  const el = document.getElementById('peers');
  if (el) el.textContent = `${peerCount} warrior${peerCount !== 1 ? 's' : ''} online${rtcPeers ? ` (${rtcPeers} WebRTC)` : ''}`;
}

function update(dt, t) {
  const kanji = KI.get('kanji');
  const KANJI = kanji?.KANJI || {};

  Object.keys(remotePlayers).forEach(name => {
    const rp = remotePlayers[name];
    const stale = Date.now() - rp.lastUpdate > 15000;
    if (stale) { rp.aura.material.opacity *= 0.95; rp.label.material.opacity *= 0.95; return; }
    const cl = rp.charge;
    const kj = KANJI[rp.vowel];
    const col = kj ? kj.hex : 0x4488ff;
    rp.aura.material.color.setHex(col);
    rp.aura.material.opacity = cl * 0.3;
    rp.aura.scale.setScalar(1 + cl * 2);
    rp.label.material.opacity = 0.7;
  });

  // periodic live publish
  liveTimer += dt;
  if (liveTimer > 5) {
    liveTimer = 0;
    KI.emit('broadcast', { type: 'score', name: KI.player.name, score: KI.player.score });
    updateLeaderboard();
  }
}
