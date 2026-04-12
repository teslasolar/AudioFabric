function computeR2() {
  if(!voice.isSounding){voice.ringActivity[2]*=0.92;return;}
  var bw=audioCtx.sampleRate/(freqData.length*2);
  var sh=bandE(freqData,2500,6000,bw),ss=bandE(freqData,4000,8000,bw),wh=bandE(freqData,500,2000,bw),tot=bandE(freqData,100,8000,bw);
  var f=0;if(tot>0)f=(sh+ss*0.8+wh*0.4)/tot;
  var eb=Math.min(1,Math.max(0,(voice.exhaleRatio-1)*0.5));
  var a=Math.min(1,f*2+eb*0.3);
  if(voice.f0>100&&voice.spectralCentroid<2000)a*=0.3;
  voice.ringActivity[2]=clamp01(a);
}
function computeR3() {
  if(!voice.isSounding){voice.ringActivity[3]*=0.9;return;}
  var f1=voice.formants.f1,f2=voice.formants.f2,a=0;
  if(f1>400&&f1<600&&f2>700&&f2<1100)a=Math.max(a,0.8);
  if(f1>600&&f1<900&&f2>1000&&f2<1400)a=Math.max(a,0.9);
  var bw=audioCtx.sampleRate/(freqData.length*2);
  var lo=bandE(freqData,80,500,bw),hi=bandE(freqData,500,4000,bw);
  if(hi>0)a=Math.max(a,Math.min(1,(lo/hi)*0.6));
  voice.ringActivity[3]=clamp01(a);
}
