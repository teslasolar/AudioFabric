function ytTogglePlay() {
  // Handle local media
  if (plIndex >= 0 && plIndex < playlist.length && playlist[plIndex].type === 'local') {
    if (localMediaEl) {
      if (localMediaEl.paused) { localMediaEl.play(); document.getElementById('yt-play-btn').innerHTML = '&#10074;&#10074;'; }
      else { localMediaEl.pause(); document.getElementById('yt-play-btn').innerHTML = '&#9654;'; }
    }
    return;
  }
  if (!ytReady) return;
  var state = ytPlayer.getPlayerState();
  if (state === YT.PlayerState.PLAYING) ytPlayer.pauseVideo();
  else if (plIndex >= 0) ytPlayer.playVideo();
  else if (playlist.length > 0) ytPlayIndex(0);
}

function ytStop() {
  if (localMediaEl) { localMediaEl.pause(); localMediaEl.currentTime = 0; }
  if (ytReady) ytPlayer.stopVideo();
  // Exit music mode — hide second orb
  musicMode = false;
  if (musicOrb) musicOrb.visible = false;
  document.getElementById('yt-play-btn').innerHTML = '&#9654;';
  document.getElementById('now-playing').textContent = '';
}

