// ═══ P2P CHAT — MQTT-based with presence ═══
var CHAT_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081'
];
var chatClient = null;
var chatConnected = false;
var chatRoom = 'THOMAS';
var chatName = '';
var chatPeers = {}; // name -> { lastSeen }
var chatPresenceTimer = null;

function loadChatName() {
  try {
    var saved = localStorage.getItem('thomas-shield-chat-name');
    if (saved) return saved;
  } catch (e) {}
  return 'user-' + Math.random().toString(36).substr(2, 5);
}

function saveChatName(name) {
  try { localStorage.setItem('thomas-shield-chat-name', name); } catch (e) {}
}

function toggleChatPanel() {
  var panel = document.getElementById('chat-panel');
  var open = panel.style.display === 'none';
  panel.style.display = open ? 'block' : 'none';
  if (open && !chatName) {
    chatName = loadChatName();
    document.getElementById('chat-name').value = chatName;
  }
}

