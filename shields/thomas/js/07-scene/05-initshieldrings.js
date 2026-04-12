function initShieldRings() {
  SHIELD_RINGS.forEach(function(ring,i){
    var g=new THREE.Group();
    var tm=new THREE.MeshPhongMaterial({color:ring.hex,emissive:ring.hex,emissiveIntensity:0.25,transparent:true,opacity:0.15});
    var t1=new THREE.Mesh(new THREE.TorusGeometry(ring.baseRadius,0.025,12,80),tm);g.add(t1);
    var t2m=new THREE.MeshPhongMaterial({color:ring.hex,emissive:ring.hex,emissiveIntensity:0.15,transparent:true,opacity:0.08});
    var t2=new THREE.Mesh(new THREE.TorusGeometry(ring.baseRadius,0.018,8,64),t2m);t2.rotation.x=Math.PI/2;g.add(t2);
    var t3m=new THREE.MeshPhongMaterial({color:ring.hex,emissive:ring.hex,emissiveIntensity:0.1,transparent:true,opacity:0.05});
    var t3=new THREE.Mesh(new THREE.TorusGeometry(ring.baseRadius,0.012,6,48),t3m);t3.rotation.x=Math.PI/3;t3.rotation.z=Math.PI/5;g.add(t3);
    var im=new THREE.MeshBasicMaterial({color:ring.hex,wireframe:true,transparent:true,opacity:0.06});
    var ico=new THREE.Mesh(new THREE.IcosahedronGeometry(ring.baseRadius,i<3?1:2),im);g.add(ico);
    var sm=new THREE.MeshPhongMaterial({color:ring.hex,transparent:true,opacity:0.02,side:THREE.DoubleSide,depthWrite:false});
    var sh=new THREE.Mesh(new THREE.SphereGeometry(ring.baseRadius,16,12),sm);g.add(sh);
    orbGroup.add(g);
    shieldMeshes.rings.push({group:g,torus:t1,torusMat:tm,torus2:t2,torus2Mat:t2m,torus3:t3,torus3Mat:t3m,ico:ico,icoMat:im,shell:sh,shellMat:sm});
  });
}
