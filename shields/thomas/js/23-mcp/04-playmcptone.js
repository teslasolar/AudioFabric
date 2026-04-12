function playMcpTone(freq, duration) {
  if (!audioCtx || !masterGain) return;
  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.value = 0.3;
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  gain.gain.setTargetAtTime(0, audioCtx.currentTime + Math.max(0.1, duration - 0.1), 0.1);
  osc.stop(audioCtx.currentTime + duration + 0.2);
}

