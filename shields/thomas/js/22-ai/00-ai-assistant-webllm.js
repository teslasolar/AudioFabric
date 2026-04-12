// ═══ AI ASSISTANT (WebLLM) ═══
var AI_SYSTEM_PROMPT = 'You are the Thomas Shield AI. You control a 127-dimensional voice-reactive energy shield. You can control the shield by outputting JSON commands in ```json blocks. Available commands: {action:"pulse", ring:0-6, intensity:0-1}, {action:"expand", value:0-1}, {action:"rotate", speed:0-1}, {action:"chord", notes:[freq1,freq2,...]}, {action:"color", ring:0-6, hue:0-360}, {action:"dim", count:1-127}, {action:"mode", name:"VOICE|STANDBY|ALERT|PRIME_LOCK|FORTRESS|BLOOM|COLLAPSE"}. Respond conversationally but include commands when the user wants you to change something.';

function toggleAiPanel() {
  var panel = document.getElementById('ai-panel');
  var visible = panel.style.display !== 'none';
  panel.style.display = visible ? 'none' : 'block';
  if (!visible && !aiEngine && !aiLoading) {
    initAI();
  }
}

