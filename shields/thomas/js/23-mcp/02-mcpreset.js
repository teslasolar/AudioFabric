function mcpReset() {
  mcpTools = JSON.parse(JSON.stringify(MCP_DEFAULTS));
  document.getElementById('mcp-editor').value = JSON.stringify(mcpTools, null, 2);
  document.getElementById('mcp-status').textContent = mcpTools.length + ' tools';
  mcpLog('Reset to ' + mcpTools.length + ' default tools');
  updateAiToolsPrompt();
}

function mcpLog(msg) {
  var logEl = document.getElementById('mcp-log');
  var div = document.createElement('div');
  div.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

