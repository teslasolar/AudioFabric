function analyzeVoice() {
  analyser.getFloatTimeDomainData(timeData);
  analyser.getFloatFrequencyData(freqData);

  var rms = 0;
  for (var i = 0; i < timeData.length; i++) rms += timeData[i] * timeData[i];
  rms = Math.sqrt(rms / timeData.length);
  voice.rms = rms;
  var isSounding = rms > voice.noiseFloor;
  var now = Date.now();

  if (isSounding && !voice.isSounding) {
    voice.isSounding = true; voice.soundStartTime = now;
    voice.silenceDuration = (now - voice.silenceStartTime) / 1000;
  } else if (!isSounding && voice.isSounding) {
    voice.isSounding = false; voice.silenceStartTime = now;
  }
  if (!isSounding) voice.silenceDuration = (now - voice.silenceStartTime) / 1000;

  voice.f0 = detectF0(timeData, audioCtx.sampleRate);
  voice.spectralCentroid = computeSpectralCentroid(freqData, audioCtx.sampleRate);
  voice.formants = estimateFormants(freqData, audioCtx.sampleRate);
  detectOnsets(rms, now);
  detectBreathPhase(rms, now);

  computeR0(rms, now); computeR1(); computeR2(); computeR3(); computeR4(); computeR5(); computeR6();

  for (var j = 0; j < 7; j++) voice.ringSmoothed[j] += (voice.ringActivity[j] - voice.ringSmoothed[j]) * 0.15;

  if (voice.pulseRate > 4) voice.mode = 'PULSED';
  else if (voice.isSounding && (now - voice.soundStartTime) > 1000) voice.mode = 'SUSTAINED';
  else if (!voice.isSounding && voice.silenceDuration > 0.5) voice.mode = 'SILENT';

  computeVoiceMetrics();

  if (currentMode === 'VOICE') {
    var total = 0;
    for (var k = 0; k < 7; k++) total += voice.ringSmoothed[k];
    var avg = total / 7;
    foldTarget = 0.2 + avg * 0.8;
    for (var m = 0; m < 7; m++) SHIELD_RINGS[m].target = voice.ringSmoothed[m];
    controls.expansion = 0.3 + avg * 0.5;
    controls.phiPhase = 0.3 + voice.sweep * 0.7;
    if (voice.sweep >= 0.8 && !bloomCascadeActive) triggerBloom();
  }
}
