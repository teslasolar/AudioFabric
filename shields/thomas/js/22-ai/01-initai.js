function initAI() {
  if (aiEngine || aiLoading) return;
  aiLoading = true;
  var statusEl = document.getElementById('ai-status');
  statusEl.textContent = 'loading...';
  statusEl.style.color = '#ff8800';

  // Dynamically load WebLLM from CDN
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm';
  script.onload = function() {
    statusEl.textContent = 'initializing...';
    try {
      var engine = new webllm.MLCEngine();
      var initProgressCallback = function(report) {
        statusEl.textContent = report.text || 'loading model...';
      };
      engine.setInitProgressCallback(initProgressCallback);
      engine.reload('Llama-3.2-1B-Instruct-q4f16_1-MLC').then(function() {
        aiEngine = engine;
        aiLoading = false;
        statusEl.textContent = 'online';
        statusEl.style.color = '#4f8';
        aiMessages = [{ role: 'system', content: getAiSystemPrompt() }];
        aiAppendChat('system', 'AI assistant online. Ask me to control the shield.');
      }).catch(function(err) {
        aiLoading = false;
        statusEl.textContent = 'error';
        statusEl.style.color = '#f44';
        console.error('WebLLM init error:', err);
        aiAppendChat('system', 'Failed to load AI model: ' + err.message);
      });
    } catch(err) {
      aiLoading = false;
      statusEl.textContent = 'error';
      statusEl.style.color = '#f44';
      console.error('WebLLM init error:', err);
    }
  };
  script.onerror = function() {
    aiLoading = false;
    statusEl.textContent = 'load failed';
    statusEl.style.color = '#f44';
    aiAppendChat('system', 'Failed to load WebLLM from CDN.');
  };
  document.head.appendChild(script);
}
