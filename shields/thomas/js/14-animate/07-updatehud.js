function updateHUD(totalInt,intArr) {
  var ai=totalInt/7;
  var vm=document.getElementById('voice-mode');if(vm){vm.textContent=voice.mode;vm.className='voice-mode '+voice.mode.toLowerCase();}
  SHIELD_RINGS.forEach(function(r,i){var p=Math.round(r.integrity*100);var f=document.getElementById('sfill-'+i);var pc=document.getElementById('spct-'+i);if(f)f.style.width=p+'%';if(pc)pc.textContent=p+'%';});
  BUS_POWER.forEach(function(b,i){b.power+=((intArr[b.feeds[0]]+intArr[b.feeds[1]])/2-b.power)*0.08;});
  setM('vm-f0',voice.f0/500);setM('vm-centroid',voice.spectralCentroid/6000);setM('vm-f1',voice.formants.f1/1000);setM('vm-f2',voice.formants.f2/3000);setM('vm-rms',voice.rms/0.15);
  setT('rd-vagal',voice.vagalTone.toFixed(3));setT('rd-fold',foldState.toFixed(2));setT('rd-coh',voice.coherence.toFixed(3));
  setT('rd-psi',voice.psiLevel.toFixed(3));setT('rd-exhale',voice.exhaleRatio.toFixed(2));setT('rd-vowel',voice.currentVowel||'-');
  setT('rd-sweep',Math.round(voice.sweep*100)+'%');setT('rd-f0',voice.f0>0?Math.round(voice.f0)+' Hz':'-');
}
