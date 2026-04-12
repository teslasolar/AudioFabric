
function chatDisconnect() {
  if (!chatConnected || !chatClient) return;
  chatPublish('presence/' + chatName, { name: chatName, status: 'leave', t: Date.now() });
  setTimeout(function() {
    try { chatClient.end(true); } catch (e) {}
    chatClient = null;
    chatConnected = false;
    chatPeers = {};
    chatUpdatePeerCount();
  }, 100);
}

function chatPublish(subtopic, data) {
  if (!chatClient || !chatConnected) return;
  try {
    chatClient.publish('thomas-shield/' + chatRoom + '/' + subtopic, JSON.stringify(data), { qos: 0 });
  } catch (e) {}
}

function chatSend() {
  if (!chatConnected) {
    chatLog('system', 'not connected \u2014 click CONNECT first');
    return;
  }
  var input = document.getElementById('chat-input');
  var text = input.value.trim();
  if (!text) return;
  input.value = '';
  var now = Date.now();
  chatLog('self', text, chatName, now);
  chatPublish('msg/' + chatName, { name: chatName, text: text, t: now });
}

