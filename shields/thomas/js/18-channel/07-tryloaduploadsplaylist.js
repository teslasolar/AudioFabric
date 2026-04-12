function tryLoadUploadsPlaylist() {
  // If we discovered the channel ID from a playing video,
  // try to load the uploads playlist (UC... → UU...) for complete listing
  if (!channelId || !ytReady) return;
  var uploadsId = 'UU' + channelId.substring(2);
  var status = document.getElementById('channel-status');
  status.style.display = 'block';
  status.textContent = 'loading uploads playlist...';

  // Save current playback state
  var wasPlaying = false;
  var currentVideoId = null;
  try {
    wasPlaying = ytPlayer.getPlayerState() === YT.PlayerState.PLAYING;
    currentVideoId = ytPlayer.getVideoData().video_id;
  } catch(e) {}

  // Load the uploads playlist
  ytPlayer.cuePlaylist({
    listType: 'playlist',
    list: uploadsId
  });

  setTimeout(function() {
    syncPlaylistFromPlayer();
    finalizeChannelLoad();

    // Resume playback of the video that was playing
    if (currentVideoId && wasPlaying) {
      var idx = playlist.findIndex(function(p) { return p.id === currentVideoId; });
      if (idx >= 0) ytPlayIndex(idx);
    }
  }, 3000);
}
