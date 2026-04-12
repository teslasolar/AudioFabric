function updateHarmonicEngine() {
  if (!masterGain) return;
  // Muted by default — user can toggle via VOICE TONE button
  if (window.voiceSoundMuted) {
    masterGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
    for (var i = 0; i < 7; i++) oscGains[i].gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
    return;
  }
  var silenceGate = (voice.isSounding || voice.rms >= 0.01) ? 1.0 : 0.0;
  var targetMaster = silenceGate * 0.08;
  masterGain.gain.setTargetAtTime(targetMaster, audioCtx.currentTime, silenceGate > 0 ? 0.05 : 0.3);
  for (var i = 0; i < 7; i++) oscGains[i].gain.setTargetAtTime(voice.ringSmoothed[i] * 0.35, audioCtx.currentTime, 0.1);
}

function toggleVoiceSound() {
  window.voiceSoundMuted = !window.voiceSoundMuted;
  var btn = document.getElementById('voice-sound-btn');
  if (btn) {
    btn.textContent = window.voiceSoundMuted ? 'VOICE TONE: OFF' : 'VOICE TONE: ON';
    btn.classList.toggle('active', !window.voiceSoundMuted);
  }
  try { localStorage.setItem('thomas-voice-sound', window.voiceSoundMuted ? '0' : '1'); } catch (e) {}
}

// Default to muted unless user previously enabled
(function() {
  var saved = null;
  try { saved = localStorage.getItem('thomas-voice-sound'); } catch (e) {}
  window.voiceSoundMuted = saved === '1' ? false : true;
})();
