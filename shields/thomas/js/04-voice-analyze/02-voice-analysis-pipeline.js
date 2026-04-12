
function detectF0(buf, sr) {
  var size = buf.length, r2 = 0;
  for (var i = 0; i < size; i++) r2 += buf[i]*buf[i];
  if (Math.sqrt(r2/size) < voice.noiseFloor) return 0;
  var best = 0, bestLag = 0, minL = Math.floor(sr/1000), maxL = Math.floor(sr/50);
  for (var lag = minL; lag < maxL && lag < size; lag++) {
    var c = 0; for (var j = 0; j < size-lag; j++) c += buf[j]*buf[j+lag];
    if (c > best) { best = c; bestLag = lag; }
  }
  return bestLag > 0 ? sr/bestLag : 0;
}

function computeSpectralCentroid(freq, sr) {
  var n = 0, d = 0, bw = sr/(freq.length*2);
  for (var i = 1; i < freq.length; i++) { var m = Math.pow(10, freq[i]/20); n += i*bw*m; d += m; }
  return d > 0 ? n/d : 0;
}

