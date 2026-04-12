function mcpExecute(toolName, params) {
  var tool = null;
  for (var i = 0; i < mcpTools.length; i++) {
    if (mcpTools[i].name === toolName) { tool = mcpTools[i]; break; }
  }
  if (!tool) { mcpLog('Unknown tool: ' + toolName); return; }
  var handler = tool.handler;
  // Substitute params into handler string
  Object.keys(params).forEach(function(key) {
    handler = handler.replace(new RegExp('\\{' + key + '\\}', 'g'), params[key]);
    handler = handler.replace(new RegExp('\\$' + key, 'g'), params[key]);
  });
  mcpLog('Executing ' + toolName + ': ' + handler);
  try {
    var fn = new Function(handler);
    fn();
  } catch(e) {
    mcpLog('Execution error: ' + e.message);
  }
}

function updateAiToolsPrompt() {
  // Update the AI system prompt with current MCP tools
  if (aiMessages.length > 0 && aiMessages[0].role === 'system') {
    aiMessages[0].content = getAiSystemPrompt();
  }
}

