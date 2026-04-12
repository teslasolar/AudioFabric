
function computeR0(rms,now) {
  var a=0;
  if (voice.pulseRate>4) a=Math.min(1,voice.pulseRate/8);
  else if (voice.isSounding && (now-voice.soundStartTime)>2000) a=Math.min(1,rms/(voice.noiseFloor*8));
  if (voice.amplitudeHistory.length>30) {
    var tail=voice.amplitudeHistory.slice(-30), pk=-Infinity;
    for(var i=0;i<tail.length;i++) if(tail[i].rms>pk)pk=tail[i].rms;
    if(pk>voice.noiseFloor*5 && tail[tail.length-1].rms<pk*0.3) a=Math.max(a,0.6);
  }
  voice.ringActivity[0]=clamp01(a);
}
function computeR1() {
  if(!voice.isSounding){voice.ringActivity[1]*=0.9;return;}
  var a=0;
  if(voice.f0>50&&voice.spectralCentroid<2000)a=Math.min(1,(2000-voice.spectralCentroid)/1500);
  else if(voice.spectralCentroid>3000)a=Math.min(1,(voice.spectralCentroid-3000)/3000);
  else a=0.2;
  voice.ringActivity[1]=clamp01(a);
}
