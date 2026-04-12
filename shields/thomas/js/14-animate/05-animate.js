function animate() {
  requestAnimationFrame(animate);
  animFrame++;
  var time = (Date.now()-startTime)*0.001;

  analyzeVoice();
  try { analyzeMusic(); } catch(e) { musicRMS = 0; }
  try { updateMusicOrb(time); } catch(e) {}
  updateHarmonicEngine();
  updateOrbitCamera();

  foldState += (foldTarget-foldState)*0.025;

  if (bloomCascadeActive) {
    bloomCascadeTime += 0.016;
    for(var bc=0;bc<7;bc++){var dl=bc*0.5;if(bloomCascadeTime>dl){SHIELD_RINGS[bc].target=Math.min(1,(bloomCascadeTime-dl)/1.2);}}
    if(bloomCascadeTime>7*0.5+1.2){bloomCascadeActive=false;foldTarget=1;}
  }

  var totalInt=0, intArr=[];
  SHIELD_RINGS.forEach(function(ring,i){
    ring.integrity+=(ring.target-ring.integrity)*0.06;
    ring.integrity+=ring.regen;
    ring.integrity=Math.max(0,Math.min(1,ring.integrity));
    var di=ring.integrity;
    if(breachActive&&Math.abs(i-breachRing)<=1)di+=((Math.random()-0.5)*0.2);di=Math.max(0,di);
    if(i===0&&voice.mode==='PULSED')di*=0.5+0.5*Math.abs(Math.sin(time*voice.pulseRate*Math.PI));
    totalInt+=ring.integrity;intArr.push(ring.integrity);
    var rm=shieldMeshes.rings[i];if(!rm)return;
    rm.torusMat.opacity=0.05+di*0.55;rm.torusMat.emissiveIntensity=di*0.4;
    rm.torus2Mat.opacity=0.02+di*0.25;
    rm.torus.rotation.x+=(0.002+di*0.008)*(i%2===0?1:-1);rm.torus.rotation.z+=(0.001+di*0.004)*(i%3===0?1:-1);
    rm.torus2.rotation.y+=(0.003+di*0.006)*(i%2===0?-1:1);rm.torus2.rotation.z+=0.001;
    rm.torus3Mat.opacity=0.01+di*0.15;rm.torus3.rotation.x+=0.001*(i+1);rm.torus3.rotation.y-=0.0005*(i+1);
    rm.icoMat.opacity=0.02+di*0.12;rm.ico.rotation.y+=0.0008*(i+1)*di;rm.ico.rotation.x+=0.0003*(7-i)*di;
    rm.shellMat.opacity=di*0.04;
    rm.group.scale.setScalar((0.3+foldState*0.7)*(0.8+controls.expansion*0.4));
  });

  if(shieldMeshes.core){
    var ai=totalInt/7,pu=0.9+Math.sin(time*2)*0.1*ai,vb=1+voice.vagalTone*0.3;
    shieldMeshes.core.scale.setScalar(pu*vb);shieldMeshes.core.material.emissiveIntensity=0.3+ai*0.5;shieldMeshes.core.material.opacity=0.5+ai*0.4;
    var w=orbGroup.getObjectByName('coreWire');if(w){w.rotation.y+=0.003;w.rotation.x+=0.001;w.scale.setScalar(pu*vb*1.1);w.material.opacity=0.1+ai*0.2;}
    var cl=orbGroup.getObjectByName('coreLight');if(cl)cl.intensity=1+ai*3;
    var sl=orbGroup.getObjectByName('softLight');if(sl)sl.intensity=0.5+ai*2;
  }

  if(shieldMeshes.particles){var u=shieldMeshes.particles.material.uniforms;u.uTime.value=time;u.uFold.value=foldState;u.uExpansion.value=controls.expansion;u.uPhiPhase.value=controls.phiPhase;u.uDensity.value=controls.density;u.uActiveDims.value=controls.dimFold;u.uIntegrity.value=intArr;}

  shieldMeshes.toroidals.forEach(function(t){var ri=intArr[t.ringIdx];t.mat.opacity=t.isInterRing?voice.coherence*0.08:0.01+ri*0.06;t.mesh.rotation.y+=0.0005*(t.ringIdx+1);});
  shieldMeshes.dimThreads.forEach(function(dt){var ia=dt.dim<controls.dimFold;dt.mat.opacity=ia?(0.01+intArr[dt.ring]*0.04)*foldState:0;});
  for(var d=0;d<DIM_COUNT;d++){dimEnergy[d]+=(intArr[d%7]-dimEnergy[d])*0.05;dimPhase[d]+=0.02*PRIMES[d%7]/17;}

  if(animFrame%3===0) updateHUD(totalInt,intArr);
  if(animFrame%2===0&&waveformCtx) drawWaveform();
  if(animFrame%30===0){var el=Math.floor((Date.now()-startTime)/1000);document.getElementById('sys-clock').textContent=String(Math.floor(el/3600)).padStart(2,'0')+':'+String(Math.floor((el%3600)/60)).padStart(2,'0')+':'+String(el%60).padStart(2,'0');}

  renderer.render(scene,camera);
}
