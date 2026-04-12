function initHarmonicEngine() {
  masterGain = audioCtx.createGain(); masterGain.gain.value = 0.08; masterGain.connect(audioCtx.destination);
  var rf = [110,165,275,385,605,715,935];
  for (var i = 0; i < 7; i++) {
    var osc = audioCtx.createOscillator(), gain = audioCtx.createGain(); gain.gain.value = 0;
    if (i===2) { osc.type='sawtooth';osc.frequency.value=rf[i];var fl=audioCtx.createBiquadFilter();fl.type='lowpass';fl.frequency.value=600;osc.connect(fl);fl.connect(gain); }
    else if (i===4) { osc.type='sine';osc.frequency.value=rf[i];osc.connect(gain);var bo=audioCtx.createOscillator();bo.frequency.value=rf[i]*2.76;var bg=audioCtx.createGain();bg.gain.value=0.25;bo.connect(bg);bg.connect(gain);bo.start(); }
    else if (i===5) { osc.type='sine';osc.frequency.value=rf[i];osc.connect(gain);for(var d=0;d<3;d++){var co=audioCtx.createOscillator();co.type='sine';co.frequency.value=rf[i]*(1+(d-1)*0.003);var cg=audioCtx.createGain();cg.gain.value=0.2;co.connect(cg);cg.connect(gain);co.start();} }
    else if (i===6) { osc.type='sine';osc.frequency.value=rf[i];osc.connect(gain);var sh=audioCtx.createOscillator();sh.type='sine';sh.frequency.value=rf[i]*2;var sg=audioCtx.createGain();sg.gain.value=0.12;sh.connect(sg);sg.connect(gain);sh.start(); }
    else { osc.type=i===1?'triangle':'sine';osc.frequency.value=rf[i];osc.connect(gain); }
    gain.connect(masterGain); osc.start(); oscillators.push(osc); oscGains.push(gain);
  }
}
