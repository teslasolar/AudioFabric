// camera.js — Webcam video feeds rendered as Three.js textures + floating panels
// Supports local + remote video streams
import { KI } from './core.js';

const feeds = new Map(); // peerId -> { video, texture, mesh, stream }
let localVideo = null, localStream = null, localTexture = null;
let feedGroup = null;

export function init(opts = {}) {
  feedGroup = new THREE.Group();
  if (KI.scene) KI.scene.add(feedGroup);

  KI.on('scene:ready', ({ scene }) => { scene.add(feedGroup); });

  // listen for remote video streams
  KI.on('rtc:remoteStream', ({ peerId, stream }) => addRemoteFeed(peerId, stream));
  KI.on('rtc:peerDisconnect', ({ peerId }) => removeFeed(peerId));

  KI.register('camera', { update, getLocalStream, startLocal, stopLocal, addRemoteFeed, removeFeed, feeds });
  KI.emit('camera:ready');
}

export async function startLocal(opts = {}) {
  const constraints = {
    video: { width: opts.width || 320, height: opts.height || 240, facingMode: 'user' },
    audio: false // audio handled by voice-engine
  };
  localStream = await navigator.mediaDevices.getUserMedia(constraints);
  localVideo = document.createElement('video');
  localVideo.srcObject = localStream;
  localVideo.muted = true;
  localVideo.playsInline = true;
  await localVideo.play();

  localTexture = new THREE.VideoTexture(localVideo);
  localTexture.minFilter = THREE.LinearFilter;

  // create floating panel for local feed
  const mesh = createFeedPanel(localTexture, opts.position || new THREE.Vector3(-4, 4, 2), '(You)');
  feedGroup.add(mesh);
  feeds.set('__local__', { video: localVideo, texture: localTexture, mesh, stream: localStream });

  KI.emit('camera:localStarted', { stream: localStream, video: localVideo });
  return localStream;
}

export function stopLocal() {
  const f = feeds.get('__local__');
  if (f) {
    f.stream.getTracks().forEach(t => t.stop());
    feedGroup.remove(f.mesh);
    feeds.delete('__local__');
    localStream = null; localVideo = null; localTexture = null;
  }
  KI.emit('camera:localStopped');
}

export function getLocalStream() { return localStream; }

function addRemoteFeed(peerId, stream) {
  if (feeds.has(peerId)) return;
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = false;
  video.playsInline = true;
  video.play().catch(() => {});

  const texture = new THREE.VideoTexture(video);
  texture.minFilter = THREE.LinearFilter;

  // position in a grid around the arena
  const idx = feeds.size;
  const angle = (idx / 8) * Math.PI * 2;
  const pos = new THREE.Vector3(Math.cos(angle) * 7, 4.5, Math.sin(angle) * 7);
  const mesh = createFeedPanel(texture, pos, peerId.slice(0, 8));
  feedGroup.add(mesh);
  feeds.set(peerId, { video, texture, mesh, stream });
  KI.emit('camera:remoteFeedAdded', { peerId });
}

function removeFeed(peerId) {
  const f = feeds.get(peerId);
  if (f) {
    f.stream.getTracks().forEach(t => t.stop());
    feedGroup.remove(f.mesh);
    feeds.delete(peerId);
    KI.emit('camera:remoteFeedRemoved', { peerId });
  }
}

function createFeedPanel(texture, position, label) {
  const group = new THREE.Group();

  // video plane (16:9-ish)
  const w = 1.6, h = 1.2;
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
  const plane = new THREE.Mesh(geo, mat);
  group.add(plane);

  // border frame
  const border = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(w + 0.05, h + 0.05)),
    new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.6 })
  );
  group.add(border);

  // name label
  const lc = document.createElement('canvas'); lc.width = 256; lc.height = 48;
  const lx = lc.getContext('2d');
  lx.fillStyle = '#000'; lx.fillRect(0, 0, 256, 48);
  lx.fillStyle = '#0ff'; lx.font = '18px monospace'; lx.textAlign = 'center';
  lx.fillText(label, 128, 32);
  const lm = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(lc), transparent: true });
  const ls = new THREE.Sprite(lm);
  ls.scale.set(1.2, 0.3, 1);
  ls.position.set(0, -h/2 - 0.25, 0);
  group.add(ls);

  group.position.copy(position);
  group.lookAt(KI.camera ? KI.camera.position : new THREE.Vector3(0, 3.5, 9));

  return group;
}

function update(dt, t) {
  // make feed panels slowly face camera
  feeds.forEach(f => {
    if (KI.camera) {
      f.mesh.lookAt(KI.camera.position);
    }
    // subtle float
    f.mesh.position.y += Math.sin(t * 0.5 + f.mesh.id * 0.7) * 0.001;
  });
}
