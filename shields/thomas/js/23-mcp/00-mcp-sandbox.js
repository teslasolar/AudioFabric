// ═══ MCP SANDBOX ═══
function toggleMcpPanel() {
  var panel = document.getElementById('mcp-panel');
  var visible = panel.style.display !== 'none';
  panel.style.display = visible ? 'none' : 'block';
  if (!visible && mcpTools.length === 0) {
    // Load defaults
    mcpTools = JSON.parse(JSON.stringify(MCP_DEFAULTS));
    document.getElementById('mcp-editor').value = JSON.stringify(mcpTools, null, 2);
    document.getElementById('mcp-status').textContent = mcpTools.length + ' tools';
    mcpLog('Loaded ' + mcpTools.length + ' default tools');
    updateAiToolsPrompt();
  }
}

