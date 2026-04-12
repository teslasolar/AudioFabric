function aiSend(text) {
  if (!text) {
    var inputEl = document.getElementById('ai-input');
    text = inputEl.value.trim();
    inputEl.value = '';
  }
  if (!text) return;

  aiAppendChat('user', text);

  if (!aiEngine) {
    aiAppendChat('system', 'AI is loading, please wait...');
    return;
  }

  aiMessages.push({ role: 'user', content: text });

  var statusEl = document.getElementById('ai-status');
  statusEl.textContent = 'thinking...';
  statusEl.style.color = '#ff8800';

  aiEngine.chat.completions.create({
    messages: aiMessages,
    max_tokens: 512,
    temperature: 0.7
  }).then(function(reply) {
    var content = reply.choices[0].message.content || '';
    aiMessages.push({ role: 'assistant', content: content });
    aiAppendChat('ai', content);
    statusEl.textContent = 'online';
    statusEl.style.color = '#4f8';

    // Parse and execute any JSON commands
    var jsonBlocks = content.match(/```json\s*([\s\S]*?)```/g);
    if (jsonBlocks) {
      jsonBlocks.forEach(function(block) {
        var json = block.replace(/```json\s*/, '').replace(/```/, '').trim();
        try {
          var cmds = JSON.parse(json);
          if (!Array.isArray(cmds)) cmds = [cmds];
          cmds.forEach(function(cmd) {
            if (cmd.tool_call) {
              mcpExecute(cmd.tool_call, cmd.params || {});
            } else {
              executeAiCommand(cmd);
            }
          });
        } catch(e) {
          console.warn('AI JSON parse error:', e);
        }
      });
    }
  }).catch(function(err) {
    statusEl.textContent = 'error';
    statusEl.style.color = '#f44';
    aiAppendChat('system', 'Error: ' + err.message);
    console.error('AI error:', err);
  });
}
