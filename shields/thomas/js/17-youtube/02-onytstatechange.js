function onYTStateChange(event) {
  if (event.data === YT.PlayerState.ENDED) {
    if (ytLoop) {
      ytPlayer.seekTo(0);
      ytPlayer.playVideo();
    } else {
      ytNext();
    }
  }
  // Update play button
  var btn = document.getElementById('yt-play-btn');
  if (event.data === YT.PlayerState.PLAYING) {
    btn.innerHTML = '&#10074;&#10074;';
    // Update title for currently playing track
    try {
      var data = ytPlayer.getVideoData();
      if (data && data.title && plIndex >= 0 && plIndex < playlist.length) {
        playlist[plIndex].title = data.title;
        renderPlaylist();
        savePlaylist();
      }
      // Try to discover channel ID for uploads playlist
      if (!channelId && data && data.channel_id) {
        channelId = data.channel_id;
        tryLoadUploadsPlaylist();
      }
    } catch(e) {}
    updateNowPlaying();
  } else if (event.data === YT.PlayerState.CUED) {
    // Playlist was loaded — sync
    syncPlaylistFromPlayer();
  } else {
    btn.innerHTML = '&#9654;';
  }
}
