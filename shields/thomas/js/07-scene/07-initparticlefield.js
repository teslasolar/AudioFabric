function initParticleField() {
  var cnt=PARTICLE_COUNT,pos=new Float32Array(cnt*3),col=new Float32Array(cnt*3),siz=new Float32Array(cnt),dim=new Float32Array(cnt),ri=new Float32Array(cnt),sed=new Float32Array(cnt);
  for(var i=0;i<cnt;i++){
    var d=i%DIM_COUNT,r=d%7,rad=SHIELD_RINGS[r].baseRadius;
    var go=(d/DIM_COUNT)*TAU,th=(i*PHI*TAU+go)%TAU,ph=Math.acos(1-2*(((i*PHI)%1+d*0.0079)%1)),rv=rad+(Math.random()-0.5)*0.2;
    pos[i*3]=rv*Math.sin(ph)*Math.cos(th);pos[i*3+1]=rv*Math.sin(ph)*Math.sin(th);pos[i*3+2]=rv*Math.cos(ph);
    var c=new THREE.Color(SHIELD_RINGS[r].hex);col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;
    siz[i]=0.8+Math.random()*2.5;dim[i]=d;ri[i]=r;sed[i]=Math.random()*TAU;
  }
  var geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('aColor',new THREE.BufferAttribute(col,3));
  geo.setAttribute('aSize',new THREE.BufferAttribute(siz,1));geo.setAttribute('aDim',new THREE.BufferAttribute(dim,1));
  geo.setAttribute('aRing',new THREE.BufferAttribute(ri,1));geo.setAttribute('aSeed',new THREE.BufferAttribute(sed,1));
  var ga=GOLDEN_ANGLE.toFixed(8);
  var vs=['attribute float aSize;attribute vec3 aColor;attribute float aDim;attribute float aRing;attribute float aSeed;',
    'uniform float uTime;uniform float uFold;uniform float uExpansion;uniform float uPhiPhase;uniform float uDensity;uniform float uActiveDims;uniform float uIntegrity[7];',
    'varying vec3 vColor;varying float vAlpha;varying float vGlow;',
    'void main(){float d=aDim;float r=aRing;float integ=uIntegrity[int(r)];float da=d<uActiveDims?1.0:0.0;vColor=aColor;',
    'float ps=2.0;if(r>0.5&&r<1.5)ps=3.0;else if(r>1.5&&r<2.5)ps=5.0;else if(r>2.5&&r<3.5)ps=7.0;else if(r>3.5&&r<4.5)ps=11.0;else if(r>4.5&&r<5.5)ps=13.0;else if(r>5.5)ps=17.0;',
    'float os=0.02*ps/17.0;float a=uTime*os+d*0.05+aSeed;vec3 p=position;p*=mix(0.1,1.0,uFold);p*=(0.7+uExpansion*0.6);',
    'float dpa=d*'+ga+';float c1=cos(a);float s1=sin(a);float s2=sin(dpa);',
    'vec3 rot;rot.x=p.x*c1*cos(dpa)-p.z*s1*cos(dpa)+p.y*s2*sin(a*0.3);',
    'rot.y=p.y*cos(dpa*0.5)+p.x*s2*0.3*sin(uTime*0.1+d*0.1);rot.z=p.x*s1+p.z*c1;',
    'rot+=normalize(rot)*sin(uTime*0.5+d*uPhiPhase*0.1)*0.15*integ;',
    'vAlpha=clamp(integ*da*uDensity*(0.4+0.6*(0.5+0.5*sin(uTime*1.5+d*0.3))),0.0,1.0);vGlow=integ*da;',
    'vec4 mv=modelViewMatrix*vec4(rot,1.0);gl_PointSize=clamp(aSize*integ*da*uDensity*(180.0/-mv.z),0.5,12.0);gl_Position=projectionMatrix*mv;}'].join('\n');
  var fs='varying vec3 vColor;varying float vAlpha;varying float vGlow;void main(){float d=length(gl_PointCoord-vec2(0.5));if(d>0.5)discard;float c=1.0-smoothstep(0.0,0.2,d);float g=1.0-smoothstep(0.0,0.5,d);gl_FragColor=vec4(vColor*g+vec3(1.0)*c*vGlow*0.3,vAlpha*g);}';
  var mat=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uFold:{value:1},uExpansion:{value:0.5},uPhiPhase:{value:0.62},uDensity:{value:0.8},uActiveDims:{value:127},uIntegrity:{value:[0,0,0,0,0,0,0]}},vertexShader:vs,fragmentShader:fs,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
  shieldMeshes.particles=new THREE.Points(geo,mat);orbGroup.add(shieldMeshes.particles);
}
