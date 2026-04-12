function detectBreathPhase(rms,now) {
  voice.amplitudeHistory.push({rms:rms,time:now});
  while (voice.amplitudeHistory.length>0 && now-voice.amplitudeHistory[0].time>5000) voice.amplitudeHistory.shift();
  if (voice.amplitudeHistory.length>10) {
    var rec = voice.amplitudeHistory.slice(-20), avgR = rec.reduce(function(s,x){return s+x.rms},0)/rec.length;
    var old = voice.amplitudeHistory.slice(0,Math.max(1,voice.amplitudeHistory.length-20)), avgO = old.reduce(function(s,x){return s+x.rms},0)/old.length;
    if (avgR>avgO*1.3 && voice.breathPhase==='exhale') { voice.breathPhase='inhale'; voice.exhaleTime+=(now-voice.breathCycleStart)/1000; voice.breathCycleStart=now; voice.breathCount++; }
    else if (avgR<avgO*0.7 && voice.breathPhase==='inhale') { voice.breathPhase='exhale'; voice.inhaleTime+=(now-voice.breathCycleStart)/1000; voice.breathCycleStart=now; }
  }
  var el = (now-voice.breathStartTime)/60000;
  voice.breathRate = el>0.05 ? voice.breathCount/el : 0;
  voice.exhaleRatio = voice.inhaleTime>0.1 ? voice.exhaleTime/voice.inhaleTime : 1.0;
}
