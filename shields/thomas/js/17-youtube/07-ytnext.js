function ytNext() {
  if (playlist.length === 0) return;
  ytPlayIndex((plIndex + 1) % playlist.length);
}

function ytPrev() {
  if (playlist.length === 0) return;
  ytPlayIndex((plIndex - 1 + playlist.length) % playlist.length);
}

function ytToggleVideo() {
  ytVideoHidden = !ytVideoHidden;
  var wrap = document.getElementById('yt-player-wrap');
  var btn = document.getElementById('yt-minimize-btn');
  if (ytVideoHidden) {
    wrap.classList.add('minimized');
    btn.textContent = 'show video';
  } else {
    wrap.classList.remove('minimized');
    btn.textContent = 'hide video';
  }
}

function ytToggleLoop() {
  ytLoop = !ytLoop;
  var btn = document.getElementById('yt-loop-btn');
  btn.classList.toggle('active', ytLoop);
}

