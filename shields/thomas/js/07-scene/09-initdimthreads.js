function initDimThreads() {
  for(var d=0;d<DIM_COUNT;d++){
    var r=d%7,rad=SHIELD_RINGS[r].baseRadius,th=d*GOLDEN_ANGLE,ph=Math.acos(1-2*((d*PHI)%1));
    var ep=new THREE.Vector3(rad*Math.sin(ph)*Math.cos(th),rad*Math.sin(ph)*Math.sin(th),rad*Math.cos(ph));
    var geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),ep]);
    var mat=new THREE.LineBasicMaterial({color:SHIELD_RINGS[r].hex,transparent:true,opacity:0.03,blending:THREE.AdditiveBlending});
    var line=new THREE.Line(geo,mat);orbGroup.add(line);
    shieldMeshes.dimThreads.push({line:line,mat:mat,dim:d,ring:r});
  }
}

