function loadPlaylist() {
  try {
    var data = localStorage.getItem('thomas-shield-playlist');
    if (data) {
      playlist = JSON.parse(data);
      renderPlaylist();
      document.getElementById('pl-count').textContent = '(' + playlist.length + ')';
      if (playlist.length > 0) {
        var btn = document.getElementById('btn-load-channel');
        btn.textContent = '\u2713 ' + playlist.length + ' VIDEOS LOADED';
        channelLoaded = true;
      }
    }
  } catch(e) {}
}

function escapeHtml(str) {
  var d = document.createElement('div'); d.textContent = str; return d.innerHTML;
}

