// voice-chat.js — WebRTC voice chat with audio streams
// Extracted from ki-arena-plus-voice.html into a reusable KI module
// Handles: mic stream cloning, WebRTC audio track attachment,
// remote audio elements, per-peer volume, mute toggle, speaking detection
//
// Requires: webrtc-net.js (or manual WebRTC) to be initialized first
// Emits: voice-chat:peer-joined, voice-chat:peer-left, voice-chat:speaking

import { KI } from './core.js';

const state = {
  micStream: null,       // cloned mic stream for RTC (separate from analysis)
  micMuted: false,
  masterVolume: 0.8,
  remotePeers: {},       // { connId: { audio, analyser, levelData, vol, stream, name, speaking } }
  peerNames: {},         // { connId: name }
  speakingThreshold: 0.01
};

// DOM element IDs (can be overridden in init opts)
let els = {
  muteBtn: 'muteBtn',
  masterVol: 'masterVolSlider',
  masterValDisplay: 'mvVal',
  peerContainer: 'voicePeers'
};

export function init(opts = {}) {
  if (opts.elements) Object.assign(els, opts.elements);

  // clone mic stream for RTC broadcast (separate from voice-engine analysis)
  if (KI.stream) {
    state.micStream = KI.stream.clone();
  } else {
    KI.on('audio:ready', ({ stream }) => {
      state.micStream = stream.clone();
    });
  }

  // hook into WebRTC peer connections for audio
  KI.on('webrtc:peer-connected', ({ connId, pc }) => {
    addAudioTrack(pc);
    pc.ontrack = (ev) => {
      if (ev.streams && ev.streams[0]) {
        createRemoteAudio(connId, ev.streams[0]);
      }
    };
  });

  KI.on('webrtc:peer-disconnected', ({ connId }) => {
    removeRemoteAudio(connId);
  });

  // also accept manual peer registration
  KI.on('voice-chat:register-peer', ({ connId, stream, name }) => {
    if (stream) createRemoteAudio(connId, stream);
    if (name) state.peerNames[connId] = name;
  });

  KI.on('voice-chat:peer-name', ({ connId, name }) => {
    state.peerNames[connId] = name;
    updatePeerUI();
  });

  KI.register('voice-chat', {
    update, state,
    toggleMute, setMasterVolume, setPeerVolume,
    getMicStream, addAudioTrack, createRemoteAudio, removeRemoteAudio,
    getPeerLevel, isAnyoneSpeaking
  });

  KI.emit('voice-chat:ready');
}

// === MIC STREAM ACCESS ===
export function getMicStream() {
  return state.micStream;
}

// === ADD AUDIO TRACKS TO PEER CONNECTION ===
export function addAudioTrack(pc) {
  if (!state.micStream) return;
  state.micStream.getAudioTracks().forEach(track => {
    pc.addTrack(track, state.micStream);
  });
}

// === CREATE REMOTE AUDIO ELEMENT ===
export function createRemoteAudio(connId, remoteStream) {
  if (state.remotePeers[connId]) return;

  const audio = new Audio();
  audio.srcObject = remoteStream;
  audio.autoplay = true;
  audio.volume = state.masterVolume * 0.8;
  audio.play().catch(() => {});

  // analyser for speaking detection
  const ctx = KI.audioCtx;
  let analyser = null, levelData = null;
  if (ctx) {
    const source = ctx.createMediaStreamSource(remoteStream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    levelData = new Float32Array(128);
  }

  state.remotePeers[connId] = {
    audio, analyser, levelData,
    vol: 0.8, stream: remoteStream,
    name: state.peerNames[connId] || connId.slice(0, 10),
    speaking: false
  };

  updatePeerUI();
  KI.emit('voice-chat:peer-joined', { connId, name: state.remotePeers[connId].name });
}

// === REMOVE REMOTE AUDIO ===
export function removeRemoteAudio(connId) {
  const ra = state.remotePeers[connId];
  if (!ra) return;
  if (ra.audio) { ra.audio.pause(); ra.audio.srcObject = null; }
  delete state.remotePeers[connId];
  updatePeerUI();
  KI.emit('voice-chat:peer-left', { connId });
}

// === MUTE TOGGLE ===
export function toggleMute() {
  state.micMuted = !state.micMuted;
  if (state.micStream) {
    state.micStream.getAudioTracks().forEach(t => { t.enabled = !state.micMuted; });
  }
  // update button if exists
  const btn = document.getElementById(els.muteBtn);
  if (btn) {
    btn.textContent = state.micMuted ? 'MIC OFF — muted' : 'MIC ON — broadcasting voice';
    btn.classList.toggle('muted', state.micMuted);
  }
  KI.emit('voice-chat:mute-changed', { muted: state.micMuted });
}

// === VOLUME CONTROLS ===
export function setMasterVolume(val) {
  state.masterVolume = val / 100;
  Object.values(state.remotePeers).forEach(ra => {
    if (ra.audio) ra.audio.volume = state.masterVolume * (ra.vol || 1);
  });
  const display = document.getElementById(els.masterValDisplay);
  if (display) display.textContent = val + '%';
}

export function setPeerVolume(connId, val) {
  const ra = state.remotePeers[connId];
  if (!ra) return;
  ra.vol = val / 100;
  if (ra.audio) ra.audio.volume = state.masterVolume * ra.vol;
}

// === SPEAKING DETECTION ===
export function getPeerLevel(connId) {
  const ra = state.remotePeers[connId];
  if (!ra || !ra.analyser) return 0;
  ra.analyser.getFloatTimeDomainData(ra.levelData);
  let rms = 0;
  for (let i = 0; i < ra.levelData.length; i++) rms += ra.levelData[i] * ra.levelData[i];
  return Math.sqrt(rms / ra.levelData.length);
}

export function isAnyoneSpeaking() {
  for (const connId of Object.keys(state.remotePeers)) {
    if (getPeerLevel(connId) > state.speakingThreshold) return true;
  }
  return false;
}

// === UPDATE (called every frame) ===
function update(dt) {
  // check speaking levels for each peer
  for (const [connId, ra] of Object.entries(state.remotePeers)) {
    const level = getPeerLevel(connId);
    const wasSpeaking = ra.speaking;
    ra.speaking = level > state.speakingThreshold;

    // update speaking indicator DOM
    const safeId = connId.replace(/[^a-zA-Z0-9]/g, '');
    const ind = document.getElementById('vi-' + safeId);
    if (ind) {
      if (ra.speaking) ind.classList.add('speaking');
      else ind.classList.remove('speaking');
    }

    // emit speaking events
    if (ra.speaking && !wasSpeaking) {
      KI.emit('voice-chat:speaking', { connId, name: ra.name, level });
    }

    // pulse remote player aura when speaking (if scene has them)
    if (ra.speaking && level > 0.01) {
      KI.emit('voice-chat:peer-level', { connId, name: ra.name, level });
    }
  }
}

// === PEER UI ===
function updatePeerUI() {
  const container = document.getElementById(els.peerContainer);
  if (!container) return;
  container.innerHTML = '';

  Object.entries(state.remotePeers).forEach(([connId, ra]) => {
    const name = state.peerNames[connId] || ra.name || connId.slice(0, 10);
    ra.name = name;
    const safeId = connId.replace(/[^a-zA-Z0-9]/g, '');
    const div = document.createElement('div');
    div.className = 'vp';
    div.id = 'vp-' + safeId;
    div.innerHTML =
      '<div class="vp-indicator" id="vi-' + safeId + '"></div>' +
      '<span class="vp-name" style="color:' + nameColor(name) + '">' + escHtml(name) + '</span>' +
      '<input type="range" min="0" max="100" value="' + Math.round((ra.vol || 0.8) * 100) + '">' +
      '<span class="vp-vol" id="pvol-' + safeId + '">' + Math.round((ra.vol || 0.8) * 100) + '%</span>';
    container.appendChild(div);
    div.querySelector('input').addEventListener('input', function() {
      setPeerVolume(connId, parseInt(this.value));
      const volEl = document.getElementById('pvol-' + safeId);
      if (volEl) volEl.textContent = this.value + '%';
    });
  });
}

function nameColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  return 'hsl(' + (h % 360) + ',70%,65%)';
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
