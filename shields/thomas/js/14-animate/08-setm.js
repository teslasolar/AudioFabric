function setM(id,v){var e=document.getElementById(id);if(e)e.style.width=Math.min(100,Math.max(0,v*100))+'%';}
function setT(id,t){var e=document.getElementById(id);if(e)e.textContent=t;}

function drawWaveform() {
  var w=waveformCtx.canvas.width,h=waveformCtx.canvas.height;
  waveformCtx.clearRect(0,0,w,h);
  waveformCtx.strokeStyle=voice.mode==='PULSED'?'#ff6600':voice.mode==='SUSTAINED'?'#00ccff':'#cc44ff';
  waveformCtx.lineWidth=1;waveformCtx.globalAlpha=0.7;waveformCtx.beginPath();
  var step=Math.floor(timeData.length/w);
  for(var i=0;i<w;i++){var y=(timeData[i*step]+1)/2*h;if(i===0)waveformCtx.moveTo(i,y);else waveformCtx.lineTo(i,y);}
  waveformCtx.stroke();waveformCtx.globalAlpha=1;
}

