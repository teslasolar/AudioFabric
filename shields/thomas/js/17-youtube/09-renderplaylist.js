function renderPlaylist() {
  var el = document.getElementById('playlist');
  if (playlist.length === 0) {
    el.innerHTML = '<div style="font-size:9px;color:rgba(255,248,231,0.2);padding:8px;text-align:center">click LOAD ALL CHANNEL VIDEOS or paste URLs</div>';
    return;
  }
  el.innerHTML = playlist.map(function(item, i) {
    var icon = item.type === 'local' ? '\u266B ' : '';
    return '<div class="pl-item' + (i === plIndex ? ' active' : '') + '" onclick="ytPlayIndex(' + i + ')">' +
      '<span class="pl-num">' + (i + 1) + '</span>' +
      '<span class="pl-title">' + icon + escapeHtml(item.title) + '</span>' +
      '<span class="pl-remove" onclick="event.stopPropagation();ytRemoveTrack(' + i + ')">\u00d7</span>' +
    '</div>';
  }).join('');
}

function savePlaylist() {
  try { localStorage.setItem('thomas-shield-playlist', JSON.stringify(playlist)); } catch(e) {}
}

