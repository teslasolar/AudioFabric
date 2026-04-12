function initAudioAnalyser() {
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0.8;
  micSource = audioCtx.createMediaStreamSource(micStream);
  micSource.connect(analyser);
  timeData = new Float32Array(analyser.fftSize);
  freqData = new Float32Array(analyser.frequencyBinCount);

  // Dedicated music analyser — fed only by local media, NOT by mic
  musicAnalyser = audioCtx.createAnalyser();
  musicAnalyser.fftSize = FFT_SIZE;
  musicAnalyser.smoothingTimeConstant = 0.75;
  musicTimeData = new Float32Array(musicAnalyser.fftSize);
  musicFreqData = new Float32Array(musicAnalyser.frequencyBinCount);
}
