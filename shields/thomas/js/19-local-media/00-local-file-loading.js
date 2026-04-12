// ═══ LOCAL FILE LOADING ═══
function handleLocalFile(input) {
  if (!input.files || !input.files[0]) return;
  loadLocalFile(input.files[0]);
  input.value = '';
}

function loadLocalFile(file) {
  var blobUrl = URL.createObjectURL(file);
  var ext = file.name.split('.').pop().toLowerCase();
  var isVideo = (ext === 'mp4' || ext === 'webm');
  var title = file.name.replace(/\.[^.]+$/, '');
  var idx = playlist.length;

  playlist.push({ id: 'local-' + Date.now(), title: title, type: 'local', blob: blobUrl, isVideo: isVideo });
  renderPlaylist();
  document.getElementById('pl-count').textContent = '(' + playlist.length + ')';
  savePlaylist();

  // Auto-play if first track
  if (playlist.length === 1) ytPlayIndex(0);
}

