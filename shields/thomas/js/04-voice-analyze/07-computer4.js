function computeR4() {
  if(!voice.isSounding){voice.ringActivity[4]*=0.9;return;}
  var f2=voice.formants.f2,a=0;
  if(f2>2000&&f2<2700)a=Math.max(a,0.8);
  var bw=audioCtx.sampleRate/(freqData.length*2);
  if(bandE(freqData,200,300,bw)>bandE(freqData,450,550,bw)*1.5)a=Math.max(a,0.6);
  if(voice.pulseRate>3&&f2>2000)a=Math.max(a,0.7);
  voice.ringActivity[4]=clamp01(a);
}
function computeR5() {
  if(!voice.isSounding){voice.ringActivity[5]*=0.92;return;}
  var f1=voice.formants.f1,f2=voice.formants.f2,v=classifyVowel(f1,f2);
  voice.currentVowel=v;
  if(v){voice.vowelHistory.add(v);clearTimeout(voice.vowelHistoryTimer);voice.vowelHistoryTimer=setTimeout(function(){voice.vowelHistory.clear();},30000);}
  voice.sweep=voice.vowelHistory.size/6;
  voice.ringActivity[5]=clamp01(v?0.7+voice.sweep*0.3:0);
}
