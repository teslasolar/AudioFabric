// Tab audio capture — lets the music orb visualize YouTube (and any other
// iframe/tab audio). Browsers block direct Web Audio access to cross-origin
// iframes, so we use getDisplayMedia to capture the tab's audio stream.

var tabAudioStream = null;
var tabAudioSource = null;
var tabAudioTrack = null;

function captureTabAudio() {
  var btn = document.getElementById('tab-audio-btn');
  if (tabAudioStream) {
    stopTabAudioCapture();
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    if (btn) btn.textContent = 'UNSUPPORTED BROWSER';
    alert('Tab audio capture is not supported in this browser. Try Chrome/Edge desktop.');
    return;
  }
  if (!audioCtx) {
    alert('AudioContext not ready yet. Wait for boot to finish.');
    return;
  }
  if (!musicAnalyser) {
    alert('Music analyser not initialised.');
    return;
  }

  if (btn) { btn.textContent = 'PICK THIS TAB...'; btn.disabled = true; }

  // Request tab audio — user must check "Share audio" in the picker
  navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 1 },  // minimum video (required by some browsers to enable audio)
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
  }).then(function(stream) {
    var audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      stream.getTracks().forEach(function(t) { t.stop(); });
      alert('No audio was shared. In the picker, pick THIS TAB and tick "Share audio".');
      if (btn) { btn.textContent = '\u2726 LINK TAB AUDIO'; btn.disabled = false; }
      return;
    }
    // Stop the video track — we only wanted audio
    stream.getVideoTracks().forEach(function(t) { t.stop(); });

    tabAudioStream = stream;
    tabAudioTrack = audioTracks[0];

    try {
      tabAudioSource = audioCtx.createMediaStreamSource(stream);
      tabAudioSource.connect(musicAnalyser);
      // Do NOT connect to destination — user already hears the YouTube audio via the iframe
    } catch (e) {
      console.warn('Could not connect tab audio to analyser:', e);
      stopTabAudioCapture();
      return;
    }

    musicMode = true;
    if (musicOrb) musicOrb.visible = true;
    try { setSpectrogramSource('tab audio'); } catch (e) {}

    if (btn) {
      btn.classList.remove('pulse-hint');
      btn.textContent = '\u25A0 UNLINK TAB AUDIO';
      btn.classList.add('active');
      btn.style.color = '#f84';
      btn.style.borderColor = 'rgba(255,136,68,0.4)';
      btn.disabled = false;
    }

    // Auto-cleanup when user revokes via browser's "Stop sharing" UI
    tabAudioTrack.addEventListener('ended', function() { stopTabAudioCapture(); });
  }).catch(function(err) {
    console.warn('getDisplayMedia failed:', err);
    if (btn) { btn.textContent = '\u2726 LINK TAB AUDIO'; btn.disabled = false; }
    if (err.name !== 'NotAllowedError') {
      alert('Tab audio capture failed: ' + err.message);
    }
  });
}

function stopTabAudioCapture() {
  try { if (tabAudioSource) tabAudioSource.disconnect(); } catch (e) {}
  if (tabAudioStream) {
    tabAudioStream.getTracks().forEach(function(t) { try { t.stop(); } catch (e) {} });
  }
  tabAudioStream = null;
  tabAudioSource = null;
  tabAudioTrack = null;

  // Exit music mode unless a local file is playing
  if (!localMediaEl || localMediaEl.paused) {
    musicMode = false;
    if (musicOrb) musicOrb.visible = false;
    try { setSpectrogramSource('idle — link tab audio to activate'); } catch (e) {}
  }

  var btn = document.getElementById('tab-audio-btn');
  if (btn) {
    btn.textContent = '\u2726 LINK TAB AUDIO';
    btn.classList.remove('active');
    btn.style.color = '';
    btn.style.borderColor = '';
    btn.disabled = false;
  }
}
