
function initCore() {
  shieldMeshes.core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35,2),new THREE.MeshPhongMaterial({color:0xffd700,emissive:0xaa8800,emissiveIntensity:0.6,transparent:true,opacity:0.85}));
  orbGroup.add(shieldMeshes.core);
  var w=new THREE.Mesh(new THREE.IcosahedronGeometry(0.45,1),new THREE.MeshBasicMaterial({color:0xffd700,wireframe:true,transparent:true,opacity:0.25}));w.name='coreWire';orbGroup.add(w);
  var cl=new THREE.PointLight(0xffd700,2.5,12);cl.name='coreLight';orbGroup.add(cl);
  var sl=new THREE.PointLight(0x4466ff,1.5,20);sl.name='softLight';orbGroup.add(sl);
}

// ─── Music Orb — second sphere visualizing music FFT ───
