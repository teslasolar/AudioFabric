
function initToroidalFields() {
  for(var t=0;t<14;t++){
    var ir=t>=7,ri=t%7,ring=SHIELD_RINGS[ri],pts=[];
    if(ir){var nr=SHIELD_RINGS[(ri+1)%7],r1=ring.baseRadius,r2=nr.baseRadius;for(var i=0;i<=100;i++){var u=(i/100)*TAU,bl=0.5+0.5*Math.sin(u*3),r=r1*(1-bl)+r2*bl;pts.push(new THREE.Vector3(r*Math.cos(u),(r2-r1)*0.8*Math.sin(u*2)*Math.cos(u),r*Math.sin(u)));}}
    else{var mj=ring.baseRadius,mn=0.15+ri*0.05,wr=PRIMES[ri]%5+2;for(var j=0;j<=120;j++){var uu=(j/120)*TAU,rr=mj+mn*Math.cos(uu*wr);pts.push(new THREE.Vector3(rr*Math.cos(uu),mn*Math.sin(uu*wr),rr*Math.sin(uu)));}}
    var cv=new THREE.CatmullRomCurve3(pts,true),tm=new THREE.MeshBasicMaterial({color:ir?0xffd700:ring.hex,transparent:true,opacity:0.04,blending:THREE.AdditiveBlending});
    var tube=new THREE.Mesh(new THREE.TubeGeometry(cv,80,ir?0.008:0.012,4,true),tm);orbGroup.add(tube);
    shieldMeshes.toroidals.push({mesh:tube,mat:tm,ringIdx:ri,isInterRing:ir});
  }
}

