
async function calibrateNoiseFloor() {
  return new Promise(function(resolve) {
    var samples = 0, sum = 0;
    var interval = setInterval(function() {
      analyser.getFloatTimeDomainData(timeData);
      var rms = 0;
      for (var j = 0; j < timeData.length; j++) rms += timeData[j] * timeData[j];
      rms = Math.sqrt(rms / timeData.length);
      sum += rms; samples++;
      if (samples >= 12) { clearInterval(interval); voice.noiseFloor = (sum / samples) * 1.5 + 0.003; resolve(); }
    }, 50);
  });
}

