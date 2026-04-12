function updateOrbitCamera(){if(Date.now()-orbitState.lastInteraction>5000)orbitState.autoRotate=true;if(orbitState.autoRotate)orbitState.theta+=0.001+controls.rotation*0.003;camera.position.set(orbitState.radius*Math.sin(orbitState.phi)*Math.cos(orbitState.theta),orbitState.radius*Math.cos(orbitState.phi),orbitState.radius*Math.sin(orbitState.phi)*Math.sin(orbitState.theta));camera.lookAt(0,0,0);}
function onResize(){camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);}

