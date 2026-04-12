
function setupSlider(name,fn){var el=document.getElementById('sl-'+name);if(!el)return;el.addEventListener('input',function(){var v=el.value/100;if(fn)fn(v);else{controls[name]=v;var s=document.getElementById('sv-'+name);if(s)s.textContent=v.toFixed(2);}});}

function setShieldMode(mode) {
  currentMode = mode;
  if (SHIELD_MODES[mode].targets) SHIELD_RINGS.forEach(function(r,i){r.target=SHIELD_MODES[mode].targets[i];});
  document.querySelectorAll('.mode-btn').forEach(function(b){b.classList.remove('active','voice-active');if(b.dataset.mode===mode)b.classList.add(mode==='VOICE'?'voice-active':'active');});
}

function triggerFold(){foldTarget=0;bloomCascadeActive=false;}
function triggerUnfold(){foldTarget=1;bloomCascadeActive=false;}
function triggerBloom(){bloomCascadeActive=true;bloomCascadeTime=0;SHIELD_RINGS.forEach(function(r){r.target=0;});}
