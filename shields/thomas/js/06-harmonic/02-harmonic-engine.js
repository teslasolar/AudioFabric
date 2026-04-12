
function updateHarmonicEngine() {
  var silenceGate = (voice.isSounding || voice.rms >= 0.01) ? 1.0 : 0.0;
  var targetMaster = silenceGate * 0.08;
  masterGain.gain.setTargetAtTime(targetMaster, audioCtx.currentTime, silenceGate > 0 ? 0.05 : 0.3);
  for (var i=0;i<7;i++) oscGains[i].gain.setTargetAtTime(voice.ringSmoothed[i]*0.35, audioCtx.currentTime, 0.1);
}

