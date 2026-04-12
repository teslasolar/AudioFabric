function initScene() {
  scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x06040e, 0.02);
  camera = new THREE.PerspectiveCamera(55, window.innerWidth/window.innerHeight, 0.1, 500);
  renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.setClearColor(0x06040e);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  document.getElementById('canvas-container').appendChild(renderer.domElement);
  orbGroup = new THREE.Group(); scene.add(orbGroup);
  scene.add(new THREE.AmbientLight(0x222244, 0.4));
  var key = new THREE.DirectionalLight(0xffeedd, 0.5); key.position.set(10,20,15); scene.add(key);
  // Stars
  var sg = new THREE.BufferGeometry(), sp = new Float32Array(2000*3);
  for(var i=0;i<2000;i++){var th=Math.random()*TAU,ph=Math.acos(2*Math.random()-1),r=100+Math.random()*150;sp[i*3]=r*Math.sin(ph)*Math.cos(th);sp[i*3+1]=r*Math.sin(ph)*Math.sin(th);sp[i*3+2]=r*Math.cos(ph);}
  sg.setAttribute('position',new THREE.BufferAttribute(sp,3));
  scene.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:0.4,transparent:true,opacity:0.6,sizeAttenuation:true})));
  renderer.domElement.addEventListener('mousedown',onMouseDown);renderer.domElement.addEventListener('mousemove',onMouseMove);renderer.domElement.addEventListener('mouseup',onMouseUp);
  renderer.domElement.addEventListener('wheel',onWheel,{passive:false});
  renderer.domElement.addEventListener('touchstart',onTouchStart,{passive:false});renderer.domElement.addEventListener('touchmove',onTouchMove,{passive:false});renderer.domElement.addEventListener('touchend',onTouchEnd);
  window.addEventListener('resize',onResize);
}
