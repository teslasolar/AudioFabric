// ═══ BOOT SEQUENCE ═══
async function runBoot() {
  var phases = document.querySelectorAll('.boot-phase');
  for (var i = 0; i < PRIMES.length; i++) {
    var el = phases[i];
    el.classList.add('active');
    el.querySelector('.status').textContent = '\u27F3';
    await sleep(200 + Math.random() * 200);
    try {
      switch (i) {
        case 0: await initMicrophone(); break;
        case 1: initAudioAnalyser(); break;
        case 2: await calibrateNoiseFloor(); break;
        case 3: initScene(); initCore(); initShieldRings(); initParticleField(); initToroidalFields(); initDimThreads(); try { initMusicOrb(); } catch(e) { console.warn('musicOrb init failed:', e); } break;
        case 4: initHarmonicEngine(); break;
        case 5: loadPlaylist(); break; // YT API loads itself
        case 6: initHUD(); break;
      }
      el.classList.remove('active'); el.classList.add('done');
      el.querySelector('.status').textContent = '\u2713';
    } catch(err) {
      console.error('Phase p=' + PRIMES[i] + ' failed:', err);
      el.classList.remove('active'); el.classList.add('fail');
      el.querySelector('.status').textContent = '\u2717';
    }
  }
  document.getElementById('boot-enter').classList.add('visible');
}

async function initMicrophone() {
  // Echo cancellation ON: prevents music from speakers bleeding into voice analysis
  micStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false }
  });
  audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
}

