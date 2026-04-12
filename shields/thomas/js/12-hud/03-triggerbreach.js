function triggerBreach(){breachActive=true;breachRing=2;SHIELD_RINGS[2].integrity=Math.max(0,SHIELD_RINGS[2].integrity-0.5);SHIELD_RINGS[3].integrity=Math.max(0,SHIELD_RINGS[3].integrity-0.25);var a=document.getElementById('breach-alert');a.textContent='\u26A0 BREACH \u2014 R2 GATE \u26A0';a.style.opacity='1';setTimeout(function(){a.style.opacity='0';breachActive=false;},6000);}

// ORBIT
function onMouseDown(e){isDragging=true;dragPrevX=e.clientX;dragPrevY=e.clientY;orbitState.autoRotate=false;orbitState.lastInteraction=Date.now();}
function onMouseUp(){isDragging=false;}
function onMouseMove(e){if(!isDragging)return;orbitState.theta-=(e.clientX-dragPrevX)*0.005;orbitState.phi=Math.max(0.1,Math.min(Math.PI-0.1,orbitState.phi-(e.clientY-dragPrevY)*0.005));dragPrevX=e.clientX;dragPrevY=e.clientY;orbitState.lastInteraction=Date.now();}
