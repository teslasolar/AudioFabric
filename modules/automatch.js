// automatch.js — Global FIFO matchmaking queue via MQTT + WebRTC P2P fight rooms
// Players join a global queue. First-in-first-out pairing.
// Once matched, both connect via WebRTC for low-latency combat.

import { KI } from './core.js';

const MQTT_BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
const WS_TRACKER = 'wss://tracker.openwebtorrent.com';
const ICE_CFG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const QUEUE_TOPIC = 'kamehameha-duel/queue/';
const MATCH_TOPIC = 'kamehameha-duel/match/';
const HEARTBEAT_MS = 3000;
const STALE_MS = 8000;

let mqttClient = null, mqttConnected = false;
let ws = null, infoHash = null, peerId = '';
const dcs = new Map();
const pcs = new Map();
const pending = new Map();

const state = {
  phase: 'idle',        // idle, queued, matching, connected, fight, ko
  myId: '',
  opponentId: null,
  opponentName: null,
  room: null,
  side: 0,              // 1=left, 2=right (assigned by queue order)
  queuePosition: -1,
  queueSize: 0,
  heartbeat: 0,
  peerConnected: false,
  opData: null           // latest opponent state
};

// queue tracking
const knownQueue = {};   // id -> { name, ts, id }

export function init() {
  state.myId = KI.player.name + '_' + Math.random().toString(36).slice(2, 8);

  KI.register('automatch', {
    state,
    joinQueue,
    leaveQueue,
    broadcastState,
    getPeerConnected: () => state.peerConnected,
    getOpData: () => state.opData,
    getSide: () => state.side,
    sendMsg
  });

  tryMqttBroker(0);
}

// ===== MQTT =====
function tryMqttBroker(idx) {
  if (idx >= MQTT_BROKERS.length) {
    KI.emit('automatch:mqttFail');
    return;
  }
  try {
    const cid = 'kd_' + state.myId.slice(0, 12) + '_' + Math.random().toString(36).slice(2, 6);
    mqttClient = mqtt.connect(MQTT_BROKERS[idx], {
      clientId: cid, clean: true, connectTimeout: 8000,
      reconnectPeriod: 5000, keepalive: 30
    });
    mqttClient.on('connect', () => {
      mqttConnected = true;
      mqttClient.subscribe(QUEUE_TOPIC + '#');
      mqttClient.subscribe(MATCH_TOPIC + state.myId);
      KI.emit('automatch:mqttReady');
    });
    mqttClient.on('message', handleMqttMessage);
    mqttClient.on('error', () => { mqttClient.end(true); tryMqttBroker(idx + 1); });
  } catch (e) { tryMqttBroker(idx + 1); }
}

function mqttPublish(subtopic, data) {
  if (!mqttClient || !mqttConnected) return;
  mqttClient.publish(subtopic, JSON.stringify(data), { qos: 0 });
}

function handleMqttMessage(topic, payload) {
  try {
    const data = JSON.parse(payload.toString());
    if (!data || !data.id || data.id === state.myId) return;

    if (topic.startsWith(QUEUE_TOPIC)) {
      // someone in queue
      if (data.action === 'join') {
        knownQueue[data.id] = { name: data.name, ts: data.ts, id: data.id };
        updateQueueState();
        // if I'm queued and I'm earlier, try to match
        if (state.phase === 'queued') attemptMatch();
      } else if (data.action === 'leave' || data.action === 'matched') {
        delete knownQueue[data.id];
        updateQueueState();
      } else if (data.action === 'heartbeat') {
        if (knownQueue[data.id]) knownQueue[data.id].ts = data.ts;
      }
    } else if (topic === MATCH_TOPIC + state.myId) {
      // someone wants to match with us
      if (data.action === 'invite' && state.phase === 'queued') {
        acceptMatch(data);
      }
    }
  } catch (e) {}
}

function updateQueueState() {
  // prune stale entries
  const now = Date.now();
  Object.keys(knownQueue).forEach(id => {
    if (now - knownQueue[id].ts > STALE_MS) delete knownQueue[id];
  });
  state.queueSize = Object.keys(knownQueue).length + (state.phase === 'queued' ? 1 : 0);
  KI.emit('automatch:queueUpdate', { size: state.queueSize });
}

// ===== QUEUE =====
export function joinQueue() {
  if (state.phase !== 'idle') return;
  state.phase = 'queued';
  state.heartbeat = 0;
  mqttPublish(QUEUE_TOPIC + state.myId, {
    action: 'join', id: state.myId, name: KI.player.name, ts: Date.now()
  });
  // subscribe to direct match channel
  if (mqttClient && mqttConnected) {
    mqttClient.subscribe(MATCH_TOPIC + state.myId);
  }
  KI.emit('automatch:queued');
  // start heartbeat
  startHeartbeat();
  // check if anyone already waiting
  setTimeout(() => attemptMatch(), 500);
}

export function leaveQueue() {
  mqttPublish(QUEUE_TOPIC + state.myId, { action: 'leave', id: state.myId, ts: Date.now() });
  state.phase = 'idle';
  stopHeartbeat();
  KI.emit('automatch:idle');
}

let hbInterval = null;
function startHeartbeat() {
  stopHeartbeat();
  hbInterval = setInterval(() => {
    if (state.phase === 'queued') {
      mqttPublish(QUEUE_TOPIC + state.myId, {
        action: 'heartbeat', id: state.myId, name: KI.player.name, ts: Date.now()
      });
    }
  }, HEARTBEAT_MS);
}
function stopHeartbeat() { if (hbInterval) { clearInterval(hbInterval); hbInterval = null; } }

// ===== MATCHING =====
function attemptMatch() {
  if (state.phase !== 'queued') return;
  const now = Date.now();
  // find oldest queued player that isn't us
  const candidates = Object.values(knownQueue)
    .filter(p => now - p.ts < STALE_MS)
    .sort((a, b) => a.ts - b.ts);
  if (candidates.length === 0) return;

  const target = candidates[0];
  state.phase = 'matching';
  state.opponentId = target.id;
  state.opponentName = target.name;
  state.room = 'KD-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  state.side = 1; // initiator is P1 (left)

  // send match invite
  mqttPublish(MATCH_TOPIC + target.id, {
    action: 'invite',
    id: state.myId,
    name: KI.player.name,
    room: state.room,
    ts: Date.now()
  });

  // announce we're matched (remove from queue)
  mqttPublish(QUEUE_TOPIC + state.myId, { action: 'matched', id: state.myId, ts: Date.now() });
  delete knownQueue[target.id];
  stopHeartbeat();

  KI.emit('automatch:matching', { opponent: target.name, room: state.room });

  // start WebRTC
  initWebRTC(state.room);

  // timeout — if no connection in 10s, go back to queue
  setTimeout(() => {
    if (state.phase === 'matching' && !state.peerConnected) {
      state.phase = 'idle';
      KI.emit('automatch:timeout');
    }
  }, 10000);
}

function acceptMatch(data) {
  state.phase = 'matching';
  state.opponentId = data.id;
  state.opponentName = data.name;
  state.room = data.room;
  state.side = 2; // acceptor is P2 (right)

  mqttPublish(QUEUE_TOPIC + state.myId, { action: 'matched', id: state.myId, ts: Date.now() });
  stopHeartbeat();

  KI.emit('automatch:matching', { opponent: data.name, room: state.room });
  initWebRTC(state.room);
}

// ===== WebRTC =====
function initWebRTC(room) {
  peerId = '-KD0001-' + Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  crypto.subtle.digest('SHA-1', new TextEncoder().encode('kamehameha-duel:' + room)).then(buf => {
    infoHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    joinTracker();
  });
}

function joinTracker() {
  genOffers(5).then(offers => {
    ws = new WebSocket(WS_TRACKER);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        action: 'announce', info_hash: infoHash, peer_id: peerId,
        numwant: 5, uploaded: 0, downloaded: 0, left: 1, offers
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
    ws.onclose = () => {
      if (state.phase === 'matching') setTimeout(joinTracker, 3000);
    };
  });
}

function genOffers(n) {
  const promises = [];
  for (let i = 0; i < n; i++) {
    const pc = new RTCPeerConnection(ICE_CFG);
    const dc = pc.createDataChannel('kduel');
    const oid = crypto.randomUUID();
    const p = new Promise(res => {
      pc.onicecandidate = e => {
        if (!e.candidate) res({ offer_id: oid, offer: { type: 'offer', sdp: pc.localDescription.sdp } });
      };
      pc.createOffer().then(o => pc.setLocalDescription(o));
    });
    pending.set(oid, { pc, dc });
    setupDC(pc, dc, oid);
    promises.push(p);
  }
  return Promise.all(promises);
}

function setupDC(pc, dc, id) {
  dc.onopen = () => {
    dcs.set(id, dc);
    state.peerConnected = true;
    if (state.phase === 'matching') {
      state.phase = 'connected';
      KI.emit('automatch:connected', { side: state.side, opponent: state.opponentName });
    }
    dc.send(JSON.stringify({ type: 'hello', name: KI.player.name, side: state.side }));
  };
  dc.onclose = () => {
    dcs.delete(id);
    if (dcs.size === 0) {
      state.peerConnected = false;
      KI.emit('automatch:disconnected');
    }
  };
  dc.onmessage = ev => {
    try {
      const d = JSON.parse(ev.data);
      if (d.type === 'hello') {
        state.opponentName = d.name;
        KI.emit('automatch:opponentHello', d);
      } else if (d.type === 'state') {
        state.opData = d;
        KI.emit('automatch:opState', d);
      } else if (d.type === 'blast') {
        KI.emit('automatch:opBlast', d);
      } else if (d.type === 'rematch') {
        KI.emit('automatch:opRematch', d);
      }
    } catch (e) {}
  };
  pcs.set(id, pc);
}

function handleOffer(msg) {
  const pc = new RTCPeerConnection(ICE_CFG);
  pc.ondatachannel = e => setupDC(pc, e.channel, msg.peer_id);
  pcs.set(msg.peer_id, pc);
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
  genOffers(3).then(o => {
    ws.send(JSON.stringify({ action: 'announce', info_hash: infoHash, peer_id: peerId, numwant: 5, offers: o }));
  });
}

export function sendMsg(msg) {
  const d = JSON.stringify(msg);
  dcs.forEach(dc => { if (dc.readyState === 'open') dc.send(d); });
}

export function broadcastState(stateData) {
  sendMsg({ type: 'state', ...stateData });
}
