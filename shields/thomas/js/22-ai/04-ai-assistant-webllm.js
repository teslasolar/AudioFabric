
function aiAppendChat(role, text) {
  var chatEl = document.getElementById('ai-chat');
  var div = document.createElement('div');
  div.style.marginBottom = '4px';
  if (role === 'user') {
    div.style.color = 'rgba(255,248,231,0.7)';
    div.textContent = '> ' + text;
  } else if (role === 'ai') {
    div.style.color = 'rgba(168,121,255,0.8)';
    div.textContent = text;
  } else {
    div.style.color = 'rgba(255,215,0,0.4)';
    div.style.fontStyle = 'italic';
    div.textContent = text;
  }
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

