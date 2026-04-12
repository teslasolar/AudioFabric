function executeAiCommand(cmd) {
  if (!cmd || !cmd.action) return;
  switch(cmd.action) {
    case 'pulse':
      var ring = clamp01((cmd.ring || 0) / 6) * 6;
      var ri = Math.round(ring);
      var intensity = cmd.intensity != null ? clamp01(cmd.intensity) : 0.8;
      SHIELD_RINGS[ri].target = intensity;
      setTimeout(function() { SHIELD_RINGS[ri].target = 0; }, 1500);
      break;
    case 'expand':
      var val = cmd.value != null ? clamp01(cmd.value) : 0.8;
      controls.expansion = val;
      document.getElementById('sl-expansion').value = val * 100;
      document.getElementById('sv-expansion').textContent = val.toFixed(2);
      break;
    case 'rotate':
      var spd = cmd.speed != null ? clamp01(cmd.speed) : 0.5;
      controls.rotation = spd;
      document.getElementById('sl-rotation').value = spd * 100;
      document.getElementById('sv-rotation').textContent = spd.toFixed(2);
      break;
    case 'chord':
      if (cmd.notes && cmd.notes.length > 0) {
        cmd.notes.forEach(function(freq) { playMcpTone(freq, 2); });
      }
      break;
    case 'color':
      // Color changes are approximated via ring intensity
      if (cmd.ring != null && cmd.ring >= 0 && cmd.ring < 7) {
        SHIELD_RINGS[cmd.ring].target = 1.0;
      }
      break;
    case 'dim':
      var count = Math.max(1, Math.min(127, cmd.count || 127));
      controls.dimFold = count;
      document.getElementById('sl-dimfold').value = count;
      document.getElementById('sv-dimfold').textContent = count;
      break;
    case 'mode':
      if (cmd.name) activateMode(cmd.name);
      break;
  }
}
