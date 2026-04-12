
function updateNowPlaying() {
  var el = document.getElementById('now-playing');
  if (plIndex >= 0 && plIndex < playlist.length) {
    el.textContent = '\u266B ' + playlist[plIndex].title;
  } else {
    el.textContent = '';
  }
}

function extractVideoId(input) {
  input = input.trim();
  // Full URL patterns
  var patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/ // bare ID
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = input.match(patterns[i]);
    if (m) return m[1];
  }
  return null;
}

