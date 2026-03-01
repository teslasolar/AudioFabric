// webrtc-net.js — WebRTC P2P data channels + media streams via WebTorrent tracker
import { KI } from './core.js';

const WS_TRACKER = 'wss://tracker.openwebtorrent.com';
const ICE_CFG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
let ws = null, infoHash = null, peerId = '', pending = new Map();
const dcs = new Map();       // offerId -> DataChannel
const pcs = new Map();       // peerId -> RTCPeerConnection (for media)
const mediaStreams = new Map(); // peerId -> MediaStream

export function init(opts = {}) {
  const room = opts.room || 'THOMAS';
  peerId = '-KU0001-' + Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  crypto.subtle.digest('SHA-1', new TextEncoder().encode('ki-arena-ultra:' + room)).then(buf => {
    infoHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    joinTracker();
  });

  // relay broadcasts over data channels
  KI.on('broadcast', msg => broadcastDC(msg));

  // handle camera wanting to send video
  KI.on('camera:localStarted', ({ stream }) => {
    // add tracks to all existing peer connections
    pcs.forEach((pc, pid) => {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    });
  });

  KI.register('webrtc-net', { broadcastDC, getPeerCount: () => dcs.size, dcs, pcs });
  KI.emit('webrtc:ready');
}

function joinTracker() {
  genOffers(5).then(offers => {
    ws = new WebSocket(WS_TRACKER);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        action: 'announce', info_hash: infoHash, peer_id: peerId,
        numwant: 10, uploaded: 0, downloaded: 0, left: 1, offers
      }));
    };
    ws.onmessage = ev => {
      try {
        const m = JSON.parse(ev.data);
        if (m.offer && m.peer_id !== peerId) handleOffer(m);
        if (m.answer && m.offer_id) handleAnswer(m);
        if (m.interval) setTimeout(reannounce, m.interval * 1000);
      } catch (e) {}
    };
    ws.onerror = () => {};
    ws.onclose = () => setTimeout(joinTracker, 5000);
  });
}

function genOffers(n) {
  const promises = [];
  for (let i = 0; i < n; i++) {
    const pc = new RTCPeerConnection(ICE_CFG);
    const dc = pc.createDataChannel('kiu');
    const oid = crypto.randomUUID();
    const p = new Promise(res => {
      pc.onicecandidate = e => {
        if (!e.candidate) res({ offer_id: oid, offer: { type: 'offer', sdp: pc.localDescription.sdp } });
      };
      pc.createOffer().then(o => pc.setLocalDescription(o));
    });
    pending.set(oid, { pc, dc });
    setupDC(pc, dc, oid);
    setupMedia(pc, oid);
    promises.push(p);
  }
  return Promise.all(promises);
}

function setupDC(pc, dc, id) {
  dc.onopen = () => {
    dcs.set(id, dc);
    dc.send(JSON.stringify({ type: 'score', name: KI.player.name, score: KI.player.score }));
    KI.emit('rtc:peerConnect', { peerId: id });

    // send camera stream if active
    const cam = KI.get('camera');
    const localStream = cam?.getLocalStream?.();
    if (localStream) localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  };
  dc.onclose = () => {
    dcs.delete(id);
    KI.emit('rtc:peerDisconnect', { peerId: id });
  };
  dc.onmessage = ev => {
    try {
      const d = JSON.parse(ev.data);
      if (!d.name || d.name === KI.player.name) return;
      KI.emit('rtc:data', d);
      if (d.type === 'state') KI.emit('remote:state', d);
      else if (d.type === 'blast') KI.emit('remote:blast', d);
      else if (d.type === 'chat') KI.emit('chat:receive', d);
      else KI.emit('remote:score', d);
    } catch (e) {}
  };
}

function setupMedia(pc, id) {
  pc.ontrack = event => {
    const stream = event.streams[0];
    if (!stream) return;
    mediaStreams.set(id, stream);
    KI.emit('rtc:remoteStream', { peerId: id, stream });
  };
  pcs.set(id, pc);
}

function handleOffer(msg) {
  const pc = new RTCPeerConnection(ICE_CFG);
  pc.ondatachannel = e => setupDC(pc, e.channel, msg.peer_id);
  setupMedia(pc, msg.peer_id);
  pc.setRemoteDescription(msg.offer)
    .then(() => pc.createAnswer())
    .then(a => pc.setLocalDescription(a))
    .then(() => new Promise(r => {
      if (pc.iceGatheringState === 'complete') r();
      else pc.onicecandidate = e => { if (!e.candidate) r(); };
    }))
    .then(() => {
      ws.send(JSON.stringify({
        action: 'announce', info_hash: infoHash, peer_id: peerId,
        to_peer_id: msg.peer_id,
        answer: { type: 'answer', sdp: pc.localDescription.sdp },
        offer_id: msg.offer_id
      }));
    });
}

function handleAnswer(msg) {
  const p = pending.get(msg.offer_id);
  if (p) p.pc.setRemoteDescription(msg.answer);
}

function reannounce() {
  if (!ws || ws.readyState !== 1) return;
  genOffers(5).then(o => {
    ws.send(JSON.stringify({ action: 'announce', info_hash: infoHash, peer_id: peerId, numwant: 10, offers: o }));
  });
}

function broadcastDC(msg) {
  const d = JSON.stringify(msg);
  dcs.forEach(dc => { if (dc.readyState === 'open') dc.send(d); });
}
