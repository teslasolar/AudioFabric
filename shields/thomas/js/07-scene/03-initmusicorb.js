function initMusicOrb() {
  musicOrb = new THREE.Group();
  musicOrb.position.set(2.8, 0, 0); // offset to the right of main shield
  musicOrb.visible = true; // shown in standby mode, fully lit during music playback
  scene.add(musicOrb);

  // Core sphere — blue/cyan palette (opposite of gold voice orb)
  var coreMat = new THREE.MeshPhongMaterial({ color: 0x44aaff, emissive: 0x0066cc, emissiveIntensity: 0.6, transparent: true, opacity: 0.8 });
  var core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 2), coreMat);
  core.name = 'musicCore';
  musicOrb.add(core);

  // Wireframe shell
  var wireMat = new THREE.MeshBasicMaterial({ color: 0x88ccff, wireframe: true, transparent: true, opacity: 0.3 });
  var wire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), wireMat);
  wire.name = 'musicWire';
  musicOrb.add(wire);

  // Light
  var ml = new THREE.PointLight(0x66ccff, 2.0, 10);
  ml.name = 'musicLight';
  musicOrb.add(ml);

  // Frequency rings — 3 concentric rings representing bass / mid / hi
  var ringColors = [0x00aaff, 0x44ccff, 0x88ffff];
  var ringRadii = [0.55, 0.75, 0.95];
  for (var i = 0; i < 3; i++) {
    var torusGeo = new THREE.TorusGeometry(ringRadii[i], 0.015, 8, 48);
    var torusMat = new THREE.MeshBasicMaterial({ color: ringColors[i], transparent: true, opacity: 0.2 });
    var torus = new THREE.Mesh(torusGeo, torusMat);
    torus.rotation.x = Math.PI / 2 * (i / 2);
    torus.rotation.y = Math.PI / 3 * i;
    musicOrb.add(torus);
    musicRings.push({ mesh: torus, mat: torusMat, baseRadius: ringRadii[i] });
  }

  // Waveform ring — displays actual time-domain signal as a circular trace
  var wavePoints = 128;
  var waveGeo = new THREE.BufferGeometry();
  var wavePositions = new Float32Array(wavePoints * 3);
  for (var j = 0; j < wavePoints; j++) {
    var a = (j / wavePoints) * TAU;
    wavePositions[j*3] = Math.cos(a) * 1.1;
    wavePositions[j*3+1] = Math.sin(a) * 1.1;
    wavePositions[j*3+2] = 0;
  }
  waveGeo.setAttribute('position', new THREE.BufferAttribute(wavePositions, 3));
  var waveMat = new THREE.LineBasicMaterial({ color: 0xaaeeff, transparent: true, opacity: 0.6 });
  var waveLine = new THREE.LineLoop(waveGeo, waveMat);
  waveLine.name = 'musicWave';
  musicOrb.add(waveLine);
  musicRings.push({ mesh: waveLine, mat: waveMat, isWave: true, geo: waveGeo, positions: wavePositions, count: wavePoints });
}
