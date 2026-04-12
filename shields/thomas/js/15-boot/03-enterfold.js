function enterFold() {
  document.getElementById('boot-screen').classList.add('hidden');
  setTimeout(function() { document.getElementById('boot-screen').style.display = 'none'; }, 1200);
  document.getElementById('top-bar').style.display = '';
  document.getElementById('left-panel').style.display = '';
  document.getElementById('right-panel').style.display = '';
  var wc = document.getElementById('waveform-canvas');
  wc.width = wc.parentElement.clientWidth; wc.height = wc.parentElement.clientHeight;
  waveformCtx = wc.getContext('2d');
  voice.breathStartTime = Date.now(); voice.silenceStartTime = Date.now();
  setShieldMode('VOICE');
  animate();
}

