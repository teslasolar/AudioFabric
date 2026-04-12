function onYouTubeIframeAPIReady() {
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
        // Auto-load channel if no saved playlist
        if (playlist.length === 0) {
          setTimeout(loadChannel, 1000);
        } else if (playlist.length > 0 && plIndex < 0) {
          // Resume saved playlist
          plIndex = 0;
          ytPlayer.cueVideoById(playlist[0].id);
        }
      },
      onStateChange: onYTStateChange,
      onError: function(event) {
        // Suppress player errors (2=invalid param, 5=HTML5 error, 100=not found, 101/150=embed blocked)
        console.warn('YT player error:', event.data);
      }
    }
  });
}

