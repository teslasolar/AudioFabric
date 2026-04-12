function initHUD() {
  var barsEl = document.getElementById('shield-bars');
  barsEl.innerHTML = SHIELD_RINGS.map(function(r,i){
    return '<div class="shield-bar"><span class="sname">'+r.name+'</span><div class="strack"><div class="sfill" id="sfill-'+i+'" style="width:0%;background:'+r.color+'"></div></div><span class="spct" id="spct-'+i+'">0%</span></div>';
  }).join('');

  var modesEl = document.getElementById('modes-grid');
  modesEl.innerHTML = Object.keys(SHIELD_MODES).map(function(key){
    var m = SHIELD_MODES[key];
    return '<button class="mode-btn'+(key==='VOICE'?' voice-active':'')+'" data-mode="'+key+'" onclick="setShieldMode(\''+key+'\')">'+m.label+'</button>';
  }).join('');

  renderPlaylist();
  setupSlider('rotation');setupSlider('expansion');
  setupSlider('dimfold',function(v){controls.dimFold=Math.round(v*126+1);document.getElementById('sv-dimfold').textContent=controls.dimFold;});
  setupSlider('phi',function(v){controls.phiPhase=v;document.getElementById('sv-phi').textContent=v.toFixed(2);});
  setupSlider('density');

  // Sync voice-sound button to saved state
  var vsBtn = document.getElementById('voice-sound-btn');
  if (vsBtn) {
    vsBtn.textContent = window.voiceSoundMuted ? 'VOICE TONE: OFF' : 'VOICE TONE: ON';
    vsBtn.classList.toggle('active', !window.voiceSoundMuted);
  }
}
