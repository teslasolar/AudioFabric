function chatLog(kind, text, name, t) {
  var box = document.getElementById('chat-messages');
  if (!box) return;
  var ts = new Date(t || Date.now());
  var timeStr = String(ts.getHours()).padStart(2, '0') + ':' + String(ts.getMinutes()).padStart(2, '0');
  var line = document.createElement('div');
  line.style.marginBottom = '3px';
  line.style.wordWrap = 'break-word';
  if (kind === 'system') {
    line.style.color = 'rgba(255,215,0,0.4)';
    line.style.fontStyle = 'italic';
    line.innerHTML = '<span style="color:rgba(255,248,231,0.2)">' + timeStr + '</span> ' + escapeHtml(text);
  } else if (kind === 'self') {
    line.innerHTML = '<span style="color:rgba(255,248,231,0.2)">' + timeStr + '</span> ' +
      '<span style="color:#ffd700">' + escapeHtml(name) + ':</span> ' +
      '<span style="color:#fff8e7">' + escapeHtml(text) + '</span>';
  } else {
    line.innerHTML = '<span style="color:rgba(255,248,231,0.2)">' + timeStr + '</span> ' +
      '<span style="color:#0cf">' + escapeHtml(name) + ':</span> ' +
      '<span style="color:rgba(255,248,231,0.7)">' + escapeHtml(text) + '</span>';
  }
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
  // Cap at 100 messages
  while (box.children.length > 100) box.removeChild(box.firstChild);
}
