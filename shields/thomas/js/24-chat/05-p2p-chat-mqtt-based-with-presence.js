
function chatCleanupPeers() {
  var now = Date.now();
  var changed = false;
  for (var name in chatPeers) {
    if (now - chatPeers[name].lastSeen > 45000) {
      delete chatPeers[name];
      changed = true;
    }
  }
  if (changed) chatUpdatePeerCount();
}

function chatUpdatePeerCount() {
  var names = Object.keys(chatPeers);
  var el = document.getElementById('chat-peers');
  if (!el) return;
  if (names.length === 0) {
    el.textContent = '0 peers';
  } else {
    el.textContent = names.length + ' peer' + (names.length === 1 ? '' : 's') + ': ' + names.join(', ');
  }
}

