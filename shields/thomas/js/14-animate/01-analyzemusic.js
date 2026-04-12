function analyzeMusic() {
  if (!musicMode || !musicAnalyser || !musicFreqData) { musicRMS = 0; return; }
  musicAnalyser.getFloatTimeDomainData(musicTimeData);
  musicAnalyser.getFloatFrequencyData(musicFreqData);

  // RMS (loudness) from time domain
  var sum = 0;
  for (var i = 0; i < musicTimeData.length; i++) sum += musicTimeData[i] * musicTimeData[i];
  musicRMS = Math.sqrt(sum / musicTimeData.length);

  // Frequency bands from dB data (-100..0)
  var sr = audioCtx.sampleRate;
  var binHz = sr / FFT_SIZE;
  var bassLo = Math.floor(40 / binHz),   bassHi = Math.floor(250 / binHz);
  var midLo  = Math.floor(250 / binHz),  midHi  = Math.floor(2000 / binHz);
  var hiLo   = Math.floor(2000 / binHz), hiHi   = Math.floor(8000 / binHz);

  function bandAvg(lo, hi) {
    var s = 0, n = 0;
    for (var k = lo; k <= hi && k < musicFreqData.length; k++) {
      // Convert dB (-100..0) to linear (0..1)
      var lin = Math.max(0, (musicFreqData[k] + 100) / 100);
      s += lin; n++;
    }
    return n > 0 ? s / n : 0;
  }
  // Smooth with previous value
  musicBass = musicBass * 0.6 + bandAvg(bassLo, bassHi) * 0.4;
  musicMid  = musicMid  * 0.6 + bandAvg(midLo, midHi)  * 0.4;
  musicHi   = musicHi   * 0.6 + bandAvg(hiLo, hiHi)    * 0.4;
}
