// screen-share.js — Screen sharing as a 3D floating panel
import { KI } from './core.js';

let shareStream = null, shareVideo = null, shareTexture = null, shareMesh = null;

export function init() {
  // UI button
  const btn = document.createElement('button');
  btn.id = 'shareBtn';
  btn.textContent = 'SHARE SCREEN';
  btn.style.cssText = 'position:fixed;bottom:10px;left:10px;z-index:100;background:#000a;border:1px solid #f0f4;color:#f0f;padding:6px 14px;cursor:pointer;font-size:11px;font-family:monospace;border-radius:6px';
  btn.onclick = toggleShare;
  document.body.appendChild(btn);

  KI.on('rtc:remoteScreen', ({ peerId, stream }) => showRemoteScreen(peerId, stream));

  KI.register('screen-share', { update, toggleShare, isSharing: () => !!shareStream });
  KI.emit('screen-share:ready');
}

export async function toggleShare() {
  if (shareStream) {
    stopSharing();
  } else {
    await startSharing();
  }
}

async function startSharing() {
  try {
    shareStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' }, audio: false });
    shareVideo = document.createElement('video');
    shareVideo.srcObject = shareStream;
    shareVideo.muted = true;
    shareVideo.playsInline = true;
    await shareVideo.play();

    shareTexture = new THREE.VideoTexture(shareVideo);
    shareTexture.minFilter = THREE.LinearFilter;

    shareMesh = createScreenPanel(shareTexture, new THREE.Vector3(0, 5.5, -3), 'Your Screen');
    if (KI.scene) KI.scene.add(shareMesh);

    // detect when user stops sharing via browser UI
    shareStream.getVideoTracks()[0].onended = stopSharing;

    document.getElementById('shareBtn').textContent = 'STOP SHARING';
    document.getElementById('shareBtn').style.borderColor = '#f004';

    KI.emit('screen-share:started', { stream: shareStream });
    KI.emit('broadcast', { type: 'screenShare', action: 'start' });
  } catch (e) {
    console.log('Screen share cancelled');
  }
}

function stopSharing() {
  if (shareStream) {
    shareStream.getTracks().forEach(t => t.stop());
    shareStream = null;
  }
  if (shareMesh && KI.scene) KI.scene.remove(shareMesh);
  shareMesh = null; shareVideo = null; shareTexture = null;

  document.getElementById('shareBtn').textContent = 'SHARE SCREEN';
  document.getElementById('shareBtn').style.borderColor = '#f0f4';

  KI.emit('screen-share:stopped');
  KI.emit('broadcast', { type: 'screenShare', action: 'stop' });
}

function showRemoteScreen(peerId, stream) {
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.play().catch(() => {});

  const texture = new THREE.VideoTexture(video);
  texture.minFilter = THREE.LinearFilter;

  const mesh = createScreenPanel(texture, new THREE.Vector3(0, 6, -6), peerId.slice(0, 8) + "'s Screen");
  if (KI.scene) KI.scene.add(mesh);

  stream.getVideoTracks()[0].onended = () => {
    if (KI.scene) KI.scene.remove(mesh);
  };
}

function createScreenPanel(texture, position, label) {
  const group = new THREE.Group();
  const w = 3.2, h = 2;
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(geo, mat));

  // glow border
  const border = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(w + 0.08, h + 0.08)),
    new THREE.LineBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.5 })
  );
  group.add(border);

  // label
  const lc = document.createElement('canvas'); lc.width = 512; lc.height = 48;
  const lx = lc.getContext('2d');
  lx.fillStyle = '#000'; lx.fillRect(0, 0, 512, 48);
  lx.fillStyle = '#f0f'; lx.font = '18px monospace'; lx.textAlign = 'center';
  lx.fillText(label, 256, 32);
  const lm = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(lc), transparent: true });
  const ls = new THREE.Sprite(lm);
  ls.scale.set(2, 0.3, 1);
  ls.position.set(0, -h/2 - 0.3, 0);
  group.add(ls);

  group.position.copy(position);
  return group;
}

function update(dt, t) {
  if (shareMesh && KI.camera) {
    shareMesh.lookAt(KI.camera.position);
  }
}
