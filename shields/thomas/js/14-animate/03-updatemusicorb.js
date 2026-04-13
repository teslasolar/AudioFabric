function updateMusicOrb(time) {
  try { updateSpectrogram(); } catch (e) {}
  if (!musicOrb) return;
  // Standby state when no music: dim, idle pulse, still visible as a small companion orb
  if (!musicMode) {
    musicOrb.visible = true;
    var core = musicOrb.getObjectByName('musicCore');
    if (core) { core.scale.setScalar(0.6 + Math.sin(time * 0.5) * 0.05); core.material.emissiveIntensity = 0.15; core.material.opacity = 0.35; core.rotation.y += 0.002; }
    var wire = musicOrb.getObjectByName('musicWire');
    if (wire) { wire.scale.setScalar(0.7); wire.material.opacity = 0.12; wire.rotation.y -= 0.001; }
    var light = musicOrb.getObjectByName('musicLight');
    if (light) light.intensity = 0.4;
    for (var si = 0; si < musicRings.length; si++) {
      if (musicRings[si].isWave) { musicRings[si].mat.opacity = 0.08; }
      else { musicRings[si].mat.opacity = 0.08; musicRings[si].mesh.scale.setScalar(0.8); }
    }
    return;
  }
  musicOrb.visible = true;

  // Core sphere — pulse with bass
  var core = musicOrb.getObjectByName('musicCore');
  if (core) {
    var bassPulse = 1 + musicBass * 0.6;
    core.scale.setScalar(bassPulse);
    core.material.emissiveIntensity = 0.3 + musicBass * 1.2;
    core.material.opacity = 0.6 + musicMid * 0.4;
    core.rotation.y += 0.008 + musicMid * 0.03;
    core.rotation.x += 0.003 + musicHi * 0.02;
  }

  // Wireframe — pulse with mid + hi
  var wire = musicOrb.getObjectByName('musicWire');
  if (wire) {
    wire.scale.setScalar(1 + musicMid * 0.3 + musicHi * 0.2);
    wire.material.opacity = 0.2 + (musicRMS * 4);
    wire.rotation.y -= 0.01;
    wire.rotation.z += 0.005;
  }

  // Light — flares with RMS
  var light = musicOrb.getObjectByName('musicLight');
  if (light) light.intensity = 1 + musicRMS * 8;

  // Frequency rings — bass/mid/hi
  var bands = [musicBass, musicMid, musicHi];
  for (var i = 0; i < 3 && i < musicRings.length; i++) {
    var r = musicRings[i];
    if (!r || r.isWave) continue;
    r.mesh.scale.setScalar(1 + bands[i] * 0.5);
    r.mat.opacity = 0.15 + bands[i] * 0.7;
    r.mesh.rotation.y += 0.005 * (i + 1);
    r.mesh.rotation.z += 0.002 * (i + 1);
  }

  // Waveform ring — distort circle by time-domain signal
  var waveRing = musicRings[musicRings.length - 1];
  if (waveRing && waveRing.isWave && musicTimeData) {
    var step = Math.floor(musicTimeData.length / waveRing.count);
    for (var j = 0; j < waveRing.count; j++) {
      var a = (j / waveRing.count) * TAU;
      var sample = musicTimeData[j * step] || 0;
      var radius = 1.1 + sample * 1.5;
      waveRing.positions[j*3]   = Math.cos(a) * radius;
      waveRing.positions[j*3+1] = Math.sin(a) * radius;
    }
    waveRing.geo.attributes.position.needsUpdate = true;
    waveRing.mat.opacity = 0.5 + musicRMS * 0.5;
  }

  // Gentle position oscillation
  musicOrb.position.x = 2.8 + Math.sin(time * 0.3) * 0.1;
  musicOrb.position.y = Math.cos(time * 0.25) * 0.15;
}
