function tryConnectChat(idx) {
  if (idx >= CHAT_BROKERS.length) {
    document.getElementById('chat-status').textContent = 'failed';
    document.getElementById('chat-status').style.color = '#f44';
    document.getElementById('chat-connect-btn').textContent = '\u2736 CONNECT';
    chatLog('system', 'all brokers failed');
    return;
  }

  var topicBase = 'thomas-shield/' + chatRoom + '/';
  var cid = 'tsc_' + chatName + '_' + Math.random().toString(36).slice(2, 8);

  try {
    chatClient = mqtt.connect(CHAT_BROKERS[idx], {
      clientId: cid,
      clean: true,
      connectTimeout: 6000,
      reconnectPeriod: 0,
      keepalive: 30,
      will: {
        topic: topicBase + 'presence/' + chatName,
        payload: JSON.stringify({ name: chatName, status: 'leave', t: Date.now() }),
        qos: 0,
        retain: false
      }
    });

    chatClient.on('connect', function() {
      chatConnected = true;
      document.getElementById('chat-status').textContent = chatRoom + ' \u2022 live';
      document.getElementById('chat-status').style.color = '#0f8';
      document.getElementById('chat-connect-btn').textContent = '\u25A0 DISCONNECT';
      document.getElementById('chat-connect-btn').style.color = '#f84';
      document.getElementById('chat-connect-btn').style.borderColor = 'rgba(255,136,68,0.3)';

      chatClient.subscribe(topicBase + 'msg/#');
      chatClient.subscribe(topicBase + 'presence/#');

      // Announce presence
      chatPublish('presence/' + chatName, { name: chatName, status: 'join', t: Date.now() });
      chatLog('system', 'connected to ' + chatRoom + ' as ' + chatName);

      // Heartbeat every 15s
      if (chatPresenceTimer) clearInterval(chatPresenceTimer);
      chatPresenceTimer = setInterval(function() {
        if (chatConnected) chatPublish('presence/' + chatName, { name: chatName, status: 'here', t: Date.now() });
        chatCleanupPeers();
      }, 15000);
    });

    chatClient.on('message', function(topic, payload) {
      try {
        var data = JSON.parse(payload.toString());
        if (!data || !data.name) return;
        if (data.name === chatName) return; // ignore own echo

        if (topic.indexOf('/presence/') >= 0) {
          if (data.status === 'leave') {
            delete chatPeers[data.name];
            chatLog('system', data.name + ' left');
          } else {
            var isNew = !chatPeers[data.name];
            chatPeers[data.name] = { lastSeen: Date.now() };
            if (isNew && data.status === 'join') chatLog('system', data.name + ' joined');
          }
          chatUpdatePeerCount();
        } else if (topic.indexOf('/msg/') >= 0) {
          chatLog('peer', data.text, data.name, data.t);
          // Keep them in peers list even if we missed presence
          chatPeers[data.name] = { lastSeen: Date.now() };
          chatUpdatePeerCount();
        }
      } catch (e) {}
    });

    chatClient.on('error', function(err) {
      console.warn('chat broker ' + idx + ' error:', err && err.message);
      try { chatClient.end(true); } catch (e) {}
      chatClient = null;
      tryConnectChat(idx + 1);
    });

    chatClient.on('close', function() {
      if (chatConnected) {
        chatConnected = false;
        document.getElementById('chat-status').textContent = 'disconnected';
        document.getElementById('chat-status').style.color = '#888';
        document.getElementById('chat-connect-btn').textContent = '\u2736 CONNECT';
        document.getElementById('chat-connect-btn').style.color = '#0cf';
        document.getElementById('chat-connect-btn').style.borderColor = 'rgba(0,200,255,0.3)';
        chatLog('system', 'disconnected');
        if (chatPresenceTimer) { clearInterval(chatPresenceTimer); chatPresenceTimer = null; }
      }
    });
  } catch (e) {
    tryConnectChat(idx + 1);
  }
}
