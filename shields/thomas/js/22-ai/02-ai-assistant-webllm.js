
function getAiSystemPrompt() {
  var prompt = AI_SYSTEM_PROMPT;
  if (mcpTools.length > 0) {
    prompt += '\n\nYou also have access to these MCP tools. To call a tool, output a JSON block with {tool_call: "<tool_name>", params: {<params>}}:\n';
    mcpTools.forEach(function(t) {
      prompt += '- ' + t.name + ': ' + t.description + ' (params: ' + JSON.stringify(t.params) + ')\n';
    });
  }
  return prompt;
}

