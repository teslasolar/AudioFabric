function playLocalTrack(idx) {
  var item = playlist[idx];
  if (!item || item.type !== 'local') return;

  // Stop YouTube if playing
  if (ytReady) { try { ytPlayer.stopVideo(); } catch(e) {} }

  // Clean up previous local media
  if (localMediaSource) { try { localMediaSource.disconnect(); } catch(e) {} localMediaSource = null; }
  if (localMediaEl) { localMediaEl.pause(); localMediaEl.remove(); localMediaEl = null; }

  // Create appropriate element
  var wrap = document.getElementById('yt-player-wrap');
  if (item.isVideo) {
    localMediaEl = document.createElement('video');
    localMediaEl.style.cssText = 'width:100%;height:100%;border:none';
    // Show in player wrap
    wrap.classList.remove('minimized');
    wrap.appendChild(localMediaEl);
    document.getElementById('yt-minimize-btn').textContent = 'hide video';
    ytVideoHidden = false;
  } else {
    localMediaEl = document.createElement('audio');
  }

  localMediaEl.src = item.blob;
  localMediaEl.crossOrigin = 'anonymous';

  // Connect ONLY to the dedicated music analyser + destination.
  // NOT to the main (mic) analyser — this keeps voice visualization clean.
  if (audioCtx) {
    try {
      localMediaSource = audioCtx.createMediaElementSource(localMediaEl);
      if (musicAnalyser) localMediaSource.connect(musicAnalyser);
      localMediaSource.connect(audioCtx.destination);
    } catch(e) {
      console.warn('Could not connect local media to AudioContext:', e);
    }
  }

  // Entering music mode
  musicMode = true;
  if (musicOrb) musicOrb.visible = true;
  try { setSpectrogramSource(item.title || 'local file'); } catch (e) {}

  localMediaEl.play();
  document.getElementById('yt-play-btn').innerHTML = '&#10074;&#10074;';

  // Handle end of track
  localMediaEl.addEventListener('ended', function() {
    if (ytLoop) {
      localMediaEl.currentTime = 0;
      localMediaEl.play();
    } else {
      ytNext();
    }
  });
  localMediaEl.addEventListener('pause', function() {
    // Stay in music mode if just paused — user may resume
  });
}
