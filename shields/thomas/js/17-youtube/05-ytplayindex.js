function ytPlayIndex(idx) {
  if (idx < 0 || idx >= playlist.length) return;
  // Stop any currently playing local media
  if (localMediaEl) { localMediaEl.pause(); localMediaEl.currentTime = 0; }
  plIndex = idx;
  var item = playlist[idx];
  if (item.type === 'local') {
    playLocalTrack(idx);
  } else {
    // Switching to YouTube — exit music mode (YT runs in iframe, can't tap)
    musicMode = false;
    if (musicOrb) musicOrb.visible = false;
    if (!ytReady) return;
    ytPlayer.loadVideoById(item.id);
    // Try to get actual video title
    setTimeout(function() {
      try {
        var data = ytPlayer.getVideoData();
        if (data && data.title) {
          playlist[idx].title = data.title;
          renderPlaylist();
          updateNowPlaying();
          savePlaylist();
        }
      } catch(e) {}
    }, 2000);
  }
  renderPlaylist();
  updateNowPlaying();
}

