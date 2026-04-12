function ytAddFromInput() {
  var input = document.getElementById('yt-url-input');
  var val = input.value.trim();
  if (!val) return;
  var id = extractVideoId(val);
  if (!id) { alert('Could not parse video ID'); return; }
  // Title from URL or generic
  var title = 'Track ' + (playlist.length + 1) + ' [' + id + ']';
  playlist.push({ id: id, title: title, type: 'yt' });
  input.value = '';
  renderPlaylist();
  // Auto-play if first track
  if (playlist.length === 1) ytPlayIndex(0);
  savePlaylist();
}

function ytAddTrack(id, title) {
  playlist.push({ id: id, title: title || ('Track [' + id + ']'), type: 'yt' });
  renderPlaylist();
  savePlaylist();
}

function ytRemoveTrack(idx) {
  var removed = playlist[idx];
  if (removed && removed.type === 'local' && removed.blob) {
    try { URL.revokeObjectURL(removed.blob); } catch(e) {}
  }
  playlist.splice(idx, 1);
  if (plIndex >= playlist.length) plIndex = playlist.length - 1;
  renderPlaylist();
  savePlaylist();
}

