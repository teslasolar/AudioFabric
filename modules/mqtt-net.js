// mqtt-net.js — MQTT networking for global multiplayer
import { KI } from './core.js';

const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
let client = null, connected = false, topicBase = '';

export function init(opts = {}) {
  const room = opts.room || 'THOMAS';
  topicBase = `ki-arena-ultra/${room}/`;

  KI.on('broadcast', msg => publish('live/' + KI.player.name, msg));
  KI.on('ko', () => submitScore());

  document.getElementById('peers') && (document.getElementById('peers').textContent = 'Connecting...');
  tryBroker(0);

  KI.register('mqtt-net', { publish, isConnected: () => connected });
}

function tryBroker(idx) {
  if (idx >= BROKERS.length) {
    const el = document.getElementById('peers');
    if (el) el.textContent = 'WebRTC only';
    return;
  }
  try {
    const cid = 'kiu_' + KI.player.name + '_' + Math.random().toString(36).slice(2, 8);
    client = mqtt.connect(BROKERS[idx], { clientId: cid, clean: true, connectTimeout: 8000, reconnectPeriod: 5000, keepalive: 30 });

    client.on('connect', () => {
      connected = true;
      const el = document.getElementById('peers');
      if (el) el.textContent = topicBase.split('/')[1] + ' (worldwide)';
      client.subscribe(topicBase + 'scores/#');
      client.subscribe(topicBase + 'live/#');
      client.subscribe(topicBase + 'blasts/#');
      client.subscribe(topicBase + 'chat/#');
      publish('live/' + KI.player.name, { name: KI.player.name, score: 0, t: Date.now() });
      KI.emit('mqtt:connected');
    });

    client.on('message', (topic, payload) => {
      try {
        const data = JSON.parse(payload.toString());
        if (!data || !data.name || data.name === KI.player.name) return;

        if (topic.includes('/blasts/')) {
          KI.emit('remote:blast', data);
        } else if (topic.includes('/chat/')) {
          KI.emit('chat:receive', data);
        } else {
          KI.emit('remote:score', data);
        }
      } catch (e) {}
    });

    client.on('error', () => { client.end(true); tryBroker(idx + 1); });
    client.on('offline', () => {
      const el = document.getElementById('peers');
      if (el) el.textContent = 'Reconnecting...';
    });
  } catch (e) { tryBroker(idx + 1); }
}

function publish(subtopic, data) {
  if (!client || !connected) return;
  client.publish(topicBase + subtopic, JSON.stringify(data), { qos: 0 });
}

function submitScore() {
  if (!client || !connected) return;
  client.publish(topicBase + 'scores/' + KI.player.name,
    JSON.stringify({ name: KI.player.name, score: KI.player.score, t: Date.now() }),
    { qos: 1, retain: true });
}
