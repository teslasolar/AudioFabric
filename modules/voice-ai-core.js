// voice-ai-core.js — Unified voice AI framework
// Auto-loads SmolLM2-135M (smallest, no choice), provides:
// - Centralized LLM inference for all voice tools
// - Voice command router with intent detection
// - Tool registry (MCP-compatible) so tools call each other
// - Speech recognition (Web Speech API) for natural language
// - Speech synthesis for AI responses
// - Shared context window across all tools

import { KI } from './core.js';

// ── Config ──
const MODEL_ID = 'SmolLM2-135M-Instruct-q0f32-MLC';
const MODEL_LABEL = 'SmolLM2 135M';

// ── State ──
let engine = null;
let webllm = null;
let loadState = 'idle';
let loadProgress = 0;
let loadMessage = '';

// Speech recognition
let recognition = null;
let recognizing = false;
let transcript = '';
let lastTranscript = '';
let speechQueue = [];

// Speech synthesis
let synth = null;
let speaking = false;

// Tool registry (MCP-compatible)
const tools = new Map();
const toolHistory = [];
const MAX_HISTORY = 50;

// Context window shared across tools
const sharedContext = {
  recentCommands: [],
  activeTools: new Set(),
  clipboard: '',
  lastResult: null,
  sessionFacts: [],
  voiceProfile: { avgPitch: 0, avgEnergy: 0, dominant: 'neutral' }
};

// Intent patterns
const INTENT_PATTERNS = [
  { intent: 'code', patterns: ['write', 'code', 'function', 'create a', 'generate', 'implement', 'class', 'module', 'script', 'program'] },
  { intent: 'api', patterns: ['endpoint', 'api', 'route', 'server', 'request', 'response', 'fetch', 'post', 'get', 'rest'] },
  { intent: 'data', patterns: ['chart', 'graph', 'plot', 'data', 'analyze', 'filter', 'sort', 'group', 'count', 'average', 'table', 'csv'] },
  { intent: 'debug', patterns: ['debug', 'fix', 'error', 'bug', 'wrong', 'broken', 'crash', 'undefined', 'null'] },
  { intent: 'explain', patterns: ['explain', 'what is', 'how does', 'why', 'tell me', 'describe', 'help'] },
  { intent: 'test', patterns: ['test', 'assert', 'expect', 'should', 'verify', 'check'] },
  { intent: 'refactor', patterns: ['refactor', 'clean', 'simplify', 'optimize', 'rename', 'move', 'extract'] },
  { intent: 'regex', patterns: ['regex', 'pattern', 'match', 'find all', 'replace all', 'regular expression'] },
  { intent: 'schema', patterns: ['schema', 'database', 'model', 'table', 'field', 'column', 'relation', 'foreign key'] },
  { intent: 'shader', patterns: ['shader', 'glsl', 'visual effect', 'fragment', 'vertex', 'gradient', 'glow'] },
  { intent: 'shell', patterns: ['run', 'execute', 'command', 'terminal', 'shell', 'npm', 'git'] },
  { intent: 'tool', patterns: ['use', 'call', 'invoke', 'tool', 'with'] }
];

export function init(opts = {}) {
  // Auto-load LLM immediately
  loadLLM();

  // Setup speech recognition
  setupSpeechRecognition();

  // Setup speech synthesis
  synth = window.speechSynthesis || null;

  KI.register('voice-ai-core', {
    update,
    // Public API
    infer,
    registerTool,
    callTool,
    getTools: () => [...tools.keys()],
    getState: () => ({ loadState, loadProgress, loadMessage, recognizing, transcript }),
    getContext: () => sharedContext,
    speak,
    startListening,
    stopListening,
    isReady: () => loadState === 'ready'
  });

  KI.emit('voice-ai-core:init');
}

// ── LLM Loading ──
async function loadLLM() {
  loadState = 'loading';
  loadMessage = 'Loading WebLLM runtime...';
  KI.emit('voice-ai-core:loading', { progress: 0, message: loadMessage });

  try {
    webllm = await import('https://esm.run/@mlc-ai/web-llm');
    loadMessage = `Loading ${MODEL_LABEL}...`;
    KI.emit('voice-ai-core:loading', { progress: 0.05, message: loadMessage });

    engine = await webllm.CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (report) => {
        loadProgress = report.progress || 0;
        loadMessage = report.text || 'Loading...';
        KI.emit('voice-ai-core:loading', { progress: loadProgress, message: loadMessage });
      }
    });

    loadState = 'ready';
    loadMessage = `${MODEL_LABEL} ready`;
    KI.emit('voice-ai-core:ready', { model: MODEL_LABEL });

    // Register built-in tools
    registerBuiltinTools();
  } catch (e) {
    loadState = 'error';
    loadMessage = `LLM Error: ${e.message}`;
    KI.emit('voice-ai-core:error', { error: e.message });
    console.warn('voice-ai-core LLM load failed:', e);
  }
}

// ── Speech Recognition ──
function setupSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;

  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) final += t;
      else interim += t;
    }
    transcript = final || interim;
    KI.emit('voice-ai-core:transcript', { text: transcript, final: !!final });

    if (final && final.trim().length > 2) {
      processVoiceCommand(final.trim());
    }
  };

  recognition.onerror = (e) => {
    if (e.error !== 'no-speech') {
      KI.emit('voice-ai-core:speech-error', { error: e.error });
    }
  };

  recognition.onend = () => {
    if (recognizing) {
      try { recognition.start(); } catch(e) {}
    }
  };
}

export function startListening() {
  if (!recognition) return;
  recognizing = true;
  try { recognition.start(); } catch(e) {}
  KI.emit('voice-ai-core:listening', { active: true });
}

export function stopListening() {
  recognizing = false;
  if (recognition) try { recognition.stop(); } catch(e) {}
  KI.emit('voice-ai-core:listening', { active: false });
}

// ── Speech Synthesis ──
export function speak(text) {
  if (!synth) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.1;
  utter.pitch = 1.0;
  utter.volume = 0.7;
  speaking = true;
  utter.onend = () => { speaking = false; };
  synth.speak(utter);
}

// ── Voice Command Processing ──
function processVoiceCommand(text) {
  const lower = text.toLowerCase();

  // Detect intent
  let bestIntent = 'general';
  let bestScore = 0;
  for (const { intent, patterns } of INTENT_PATTERNS) {
    let score = 0;
    for (const p of patterns) {
      if (lower.includes(p)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  const command = {
    text,
    intent: bestIntent,
    timestamp: Date.now(),
    voiceState: { ...KI.voice }
  };

  sharedContext.recentCommands.push(command);
  if (sharedContext.recentCommands.length > 20) sharedContext.recentCommands.shift();

  KI.emit('voice-ai-core:command', command);

  // Route to appropriate tool
  routeCommand(command);
}

async function routeCommand(command) {
  // Check if a specific tool is registered for this intent
  const toolName = 'voice-' + command.intent;
  if (tools.has(toolName)) {
    const result = await callTool(toolName, { command: command.text, intent: command.intent });
    sharedContext.lastResult = result;
    return;
  }

  // Fallback: use LLM to process
  if (loadState === 'ready') {
    const result = await infer(
      `User voice command: "${command.text}"\nIntent: ${command.intent}\nRespond concisely.`,
      { maxTokens: 60 }
    );
    sharedContext.lastResult = { type: 'llm-response', text: result };
    KI.emit('voice-ai-core:response', { text: result, command });
    if (result) speak(result);
  }
}

// ── LLM Inference ──
export async function infer(prompt, opts = {}) {
  if (loadState !== 'ready' || !engine) return null;

  const maxTokens = opts.maxTokens || 100;
  const temperature = opts.temperature || 0.7;
  const systemPrompt = opts.system || 'You are a concise AI assistant integrated into a voice-controlled tool suite. Answer briefly.';

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];

    const result = await engine.chat.completions.create({
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: false
    });

    const text = result.choices?.[0]?.message?.content || '';
    return text.trim();
  } catch (e) {
    console.warn('LLM inference error:', e);
    return null;
  }
}

// ── Tool Registry (MCP-compatible) ──
export function registerTool(name, definition) {
  // definition: { description, parameters: {...}, handler: async (params) => result }
  tools.set(name, {
    name,
    description: definition.description || '',
    parameters: definition.parameters || {},
    handler: definition.handler,
    callCount: 0,
    lastCalled: 0
  });
  KI.emit('voice-ai-core:tool-registered', { name, description: definition.description });
}

export async function callTool(name, params = {}) {
  const tool = tools.get(name);
  if (!tool) return { error: `Tool not found: ${name}` };

  tool.callCount++;
  tool.lastCalled = Date.now();

  const entry = { tool: name, params, timestamp: Date.now(), result: null };

  try {
    const result = await tool.handler(params);
    entry.result = result;
    toolHistory.push(entry);
    if (toolHistory.length > MAX_HISTORY) toolHistory.shift();
    KI.emit('voice-ai-core:tool-result', { tool: name, result });
    return result;
  } catch (e) {
    entry.result = { error: e.message };
    toolHistory.push(entry);
    return { error: e.message };
  }
}

// ── MCP Protocol Handler ──
// Handles MCP-style JSON-RPC messages (for external AI agent connections)
export function handleMCPMessage(msg) {
  if (msg.method === 'tools/list') {
    return {
      tools: [...tools.entries()].map(([name, t]) => ({
        name,
        description: t.description,
        inputSchema: { type: 'object', properties: t.parameters }
      }))
    };
  }

  if (msg.method === 'tools/call') {
    const { name, arguments: args } = msg.params || {};
    return callTool(name, args || {});
  }

  if (msg.method === 'voice/state') {
    return {
      voice: KI.voice,
      context: sharedContext,
      llmReady: loadState === 'ready'
    };
  }

  return { error: 'Unknown method' };
}

// ── Built-in Tools ──
function registerBuiltinTools() {
  registerTool('voice-explain', {
    description: 'Explain a concept using the LLM',
    parameters: { topic: 'string' },
    handler: async (p) => {
      const text = await infer(`Explain briefly: ${p.command || p.topic}`, { maxTokens: 80 });
      if (text) speak(text);
      return { text };
    }
  });

  registerTool('voice-regex', {
    description: 'Generate a regex pattern from natural language description',
    parameters: { description: 'string' },
    handler: async (p) => {
      const text = await infer(
        `Generate a JavaScript regex for: ${p.command || p.description}\nReturn ONLY the regex literal, nothing else.`,
        { maxTokens: 40, temperature: 0.3, system: 'You are a regex expert. Return only the regex literal.' }
      );
      KI.emit('voice-ai-core:regex', { pattern: text, description: p.command });
      return { regex: text };
    }
  });

  registerTool('voice-shell', {
    description: 'Suggest a shell command from description',
    parameters: { description: 'string' },
    handler: async (p) => {
      const text = await infer(
        `Suggest the exact shell command for: ${p.command || p.description}\nReturn ONLY the command, nothing else.`,
        { maxTokens: 40, temperature: 0.2, system: 'You are a shell expert. Return only the command.' }
      );
      return { command: text };
    }
  });

  registerTool('voice-general', {
    description: 'General AI assistant for any question',
    parameters: { question: 'string' },
    handler: async (p) => {
      const text = await infer(p.command || p.question, { maxTokens: 80 });
      if (text) speak(text);
      return { text };
    }
  });
}

// ── Update (voice profile tracking) ──
function update(dt, t) {
  const v = KI.voice;
  // Running average of voice characteristics
  if (v.sounding) {
    sharedContext.voiceProfile.avgPitch = sharedContext.voiceProfile.avgPitch * 0.95 + (v.pn || 0) * 0.05;
    sharedContext.voiceProfile.avgEnergy = sharedContext.voiceProfile.avgEnergy * 0.95 + (v.energy || 0) * 0.05;
  }

  KI.emit('voice-ai-core:update', {
    loadState,
    loadProgress,
    loadMessage,
    recognizing,
    transcript,
    toolCount: tools.size,
    historyCount: toolHistory.length,
    speaking
  });
}
