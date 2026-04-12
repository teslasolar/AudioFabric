function chatConnect() {
  if (chatConnected) {
    chatDisconnect();
    return;
  }
  if (typeof mqtt === 'undefined') {
    chatLog('system', 'mqtt library not loaded');
    return;
  }

  chatRoom = (document.getElementById('chat-room').value || 'THOMAS').toUpperCase().replace(/[^A-Z0-9]/g, '');
  chatName = (document.getElementById('chat-name').value || loadChatName()).slice(0, 16).replace(/[^\w-]/g, '');
  if (!chatName) chatName = loadChatName();
  saveChatName(chatName);

  document.getElementById('chat-status').textContent = 'connecting...';
  document.getElementById('chat-status').style.color = '#fa0';
  document.getElementById('chat-connect-btn').textContent = '... CONNECTING';

  tryConnectChat(0);
}

