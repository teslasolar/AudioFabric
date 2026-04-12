function estimateFormants(freq, sr) {
  var bw = sr/(freq.length*2), sm = new Float32Array(freq.length);
  for (var i = 2; i < freq.length-2; i++) sm[i] = (freq[i-2]+freq[i-1]+freq[i]+freq[i+1]+freq[i+2])/5;
  var peaks = [], lo = Math.floor(200/bw), hi = Math.min(Math.floor(3500/bw), sm.length-2);
  for (var j = lo+1; j < hi; j++) if (sm[j]>sm[j-1] && sm[j]>sm[j+1] && sm[j]>-60) peaks.push({f:j*bw,m:sm[j]});
  peaks.sort(function(a,b){return b.m-a.m});
  var f1 = peaks.length>=1 ? peaks[0].f : 0, f2 = 0;
  if (peaks.length>=2) for (var k=1;k<peaks.length;k++) if (Math.abs(peaks[k].f-f1)>200){f2=peaks[k].f;break;}
  if (f1>f2&&f2>0){var t=f1;f1=f2;f2=t;}
  return {f1:f1,f2:f2};
}

function detectOnsets(rms,now) {
  if (rms>voice.lastAmplitude*1.8 && rms>voice.noiseFloor*2) voice.onsetTimes.push(now);
  voice.lastAmplitude = rms;
  while (voice.onsetTimes.length>0 && now-voice.onsetTimes[0]>2000) voice.onsetTimes.shift();
  voice.pulseRate = voice.onsetTimes.length/2;
}

