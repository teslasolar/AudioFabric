function mcpLoad() {
  var editor = document.getElementById('mcp-editor');
  var text = editor.value.trim();
  if (!text) { mcpLog('Error: empty editor'); return; }
  try {
    var parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) { mcpLog('Error: must be a JSON array'); return; }
    var valid = [];
    parsed.forEach(function(tool, i) {
      if (!tool.name) { mcpLog('Warning: tool at index ' + i + ' has no name, skipped'); return; }
      if (!tool.handler) { mcpLog('Warning: tool "' + tool.name + '" has no handler, skipped'); return; }
      valid.push(tool);
    });
    mcpTools = valid;
    document.getElementById('mcp-status').textContent = mcpTools.length + ' tools';
    mcpLog('Loaded ' + mcpTools.length + ' tools: ' + mcpTools.map(function(t) { return t.name; }).join(', '));
    updateAiToolsPrompt();
  } catch(e) {
    mcpLog('JSON parse error: ' + e.message);
  }
}

