function _createYtPlayer() {
  if (typeof YT === 'undefined' || !YT.Player) return false;
  if (ytPlayer) return true;
  ytPlayer = new YT.Player('yt-player', {
    height: '100%', width: '100%',
    playerVars: {
      autoplay: 0, controls: 1, modestbranding: 1,
      rel: 0, fs: 0, playsinline: 1,
      origin: window.location.origin
    },
    events: {
      onReady: function() {
        ytReady = true;
        if (playlist.length === 0) {
          setTimeout(loadChannel, 1000);
        } else if (playlist.length > 0 && plIndex < 0) {
          plIndex = 0;
          ytPlayer.cueVideoById(playlist[0].id);
        }
      },
      onStateChange: onYTStateChange,
      onError: function(event) { console.warn('YT player error:', event.data); }
    }
  });
  return true;
}

// YT iframe API calls this global when ready
function onYouTubeIframeAPIReady() { window._ytApiReady = true; _createYtPlayer(); }

// In case the API loaded BEFORE this script (race), poll briefly
(function pollYt() {
  if (_createYtPlayer()) return;
  setTimeout(pollYt, 200);
})();
