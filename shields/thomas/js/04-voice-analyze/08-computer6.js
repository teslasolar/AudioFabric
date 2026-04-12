function computeR6() {
  if(!voice.isSounding){voice.ringActivity[6]*=0.92;return;}
  var ms=0;
  if(voice.isSounding&&voice.rms>voice.noiseFloor*2)ms=Math.min(1,voice.rms/(voice.noiseFloor*6));
  voice.ringActivity[6]=clamp01(ms);
}

function classifyVowel(f1,f2) {
  if(!f1||!f2)return '';
  if(f1<400&&f2>2000)return 'ee';if(f1>400&&f1<650&&f2>1600)return 'eh';
  if(f1>600&&f2>900&&f2<1500)return 'ah';if(f1>350&&f1<600&&f2<1100)return 'oh';
  if(f1<400&&f2<1000)return 'oo';if(f1<350&&f2<1200)return 'mm';return '';
}

function computeVoiceMetrics() {
  var r=voice.ringSmoothed;
  voice.vagalTone=r[0]*0.2+r[1]*0.15+r[2]*0.15+r[3]*0.15+r[4]*0.1+r[5]*0.1+r[6]*0.15;
  var cs=0;
  for(var i=0;i<6;i++){var a=Math.max(r[i],0.001),b=Math.max(r[i+1],0.001);cs+=1-Math.abs(Math.max(a,b)/Math.min(a,b)-PHI)/PHI;}
  voice.coherence=clamp01(cs/6);
  voice.psiLevel=r[6]*0.3+r[5]*0.3+r[4]*0.2+voice.coherence*0.2;
}

