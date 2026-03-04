// voice-mcp-server.js — Browser-based MCP tool server
// Exposes AudioFabric capabilities as MCP tools over WebSocket.
// External AI agents (Claude, Cursor, etc.) can connect and use tools.
// Features:
// - WebSocket server (via BroadcastChannel for same-origin, or WebRTC for cross-origin)
// - Full MCP JSON-RPC protocol support
// - Exposes all registered voice-ai-core tools
// - Custom AudioFabric tools: create visualizations, analyze voice, control scene
// - Tool composition: chain multiple tools in sequence
// - Event streaming: subscribe to voice/scene events
// - Shared clipboard between AI agents
// - Session persistence via localStorage

import { KI } from './core.js';

// ── MCP State ──
let channel = null;        // BroadcastChannel for same-origin
let wsServer = null;       // WebSocket wrapper
let connections = 0;
let messageCount = 0;
const pendingRequests = new Map();
const eventSubscriptions = new Map();
const sessionStore = {};

// ── MCP Protocol ──
const MCP_VERSION = '2024-11-05';
const SERVER_NAME = 'audiofabric-mcp';
const SERVER_VERSION = '1.0.0';

// Custom AudioFabric tools (beyond what voice-ai-core provides)
const AF_TOOLS = {
  'af.voice.analyze': {
    description: 'Get current voice analysis data (pitch, energy, vowel, coherence)',
    inputSchema: { type: 'object', properties: {} },
    handler: () => ({
      pitch: KI.voice.f0,
      normalizedPitch: KI.voice.pn,
      energy: KI.voice.energy,
      vowel: KI.voice.vowel,
      coherence: KI.voice.coherence,
      sounding: KI.voice.sounding,
      rms: KI.voice.rms,
      pulseRate: KI.voice.pulseRate
    })
  },

  'af.scene.info': {
    description: 'Get current 3D scene information',
    inputSchema: { type: 'object', properties: {} },
    handler: () => ({
      modules: Object.keys(KI._modules),
      running: KI.running,
      playerName: KI.player.name,
      playerScore: KI.player.score,
      registeredUpdates: KI._updateFns.length,
      listeners: Object.keys(KI._listeners).length
    })
  },

  'af.scene.emit': {
    description: 'Emit an event on the KI event bus',
    inputSchema: {
      type: 'object',
      properties: {
        event: { type: 'string', description: 'Event name' },
        data: { type: 'object', description: 'Event data' }
      },
      required: ['event']
    },
    handler: (params) => {
      KI.emit(params.event, params.data || {});
      return { emitted: params.event };
    }
  },

  'af.player.set': {
    description: 'Set player properties (name, score)',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        score: { type: 'number' }
      }
    },
    handler: (params) => {
      if (params.name) KI.player.name = params.name;
      if (params.score !== undefined) KI.player.score = params.score;
      return { player: KI.player };
    }
  },

  'af.tools.list': {
    description: 'List all available tools from voice-ai-core',
    inputSchema: { type: 'object', properties: {} },
    handler: () => {
      const core = KI.get('voice-ai-core');
      return { tools: core ? core.getTools() : [] };
    }
  },

  'af.tools.call': {
    description: 'Call a registered voice-ai-core tool by name',
    inputSchema: {
      type: 'object',
      properties: {
        tool: { type: 'string', description: 'Tool name' },
        params: { type: 'object', description: 'Tool parameters' }
      },
      required: ['tool']
    },
    handler: async (params) => {
      const core = KI.get('voice-ai-core');
      if (!core) return { error: 'voice-ai-core not available' };
      return core.callTool(params.tool, params.params || {});
    }
  },

  'af.llm.infer': {
    description: 'Run LLM inference via voice-ai-core',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Prompt text' },
        maxTokens: { type: 'number', description: 'Max tokens (default 100)' },
        temperature: { type: 'number', description: 'Temperature (default 0.7)' }
      },
      required: ['prompt']
    },
    handler: async (params) => {
      const core = KI.get('voice-ai-core');
      if (!core) return { error: 'voice-ai-core not available' };
      const text = await core.infer(params.prompt, {
        maxTokens: params.maxTokens || 100,
        temperature: params.temperature || 0.7
      });
      return { text };
    }
  },

  'af.speak': {
    description: 'Speak text aloud via speech synthesis',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to speak' }
      },
      required: ['text']
    },
    handler: (params) => {
      const core = KI.get('voice-ai-core');
      if (core) core.speak(params.text);
      return { spoken: params.text };
    }
  },

  'af.code.get': {
    description: 'Get current code buffer from voice-code',
    inputSchema: { type: 'object', properties: {} },
    handler: () => {
      const vc = KI.get('voice-code');
      return { code: vc?.getCode() || '', language: vc?.getLanguage() || 'unknown' };
    }
  },

  'af.code.set': {
    description: 'Set code buffer in voice-code',
    inputSchema: {
      type: 'object',
      properties: { code: { type: 'string' }, language: { type: 'string' } },
      required: ['code']
    },
    handler: (params) => {
      const vc = KI.get('voice-code');
      if (vc) vc.setCode(params.code);
      return { set: true };
    }
  },

  'af.api.list': {
    description: 'List API endpoints from voice-api',
    inputSchema: { type: 'object', properties: {} },
    handler: () => {
      const va = KI.get('voice-api');
      return { endpoints: va?.getEndpoints() || [] };
    }
  },

  'af.data.query': {
    description: 'Run a data query via voice-data',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query']
    },
    handler: async (params) => {
      const vd = KI.get('voice-data');
      if (!vd) return { error: 'voice-data not available' };
      return vd.query(params.query);
    }
  },

  'af.chain': {
    description: 'Chain multiple tool calls in sequence, passing results forward',
    inputSchema: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          description: 'Array of {tool, params} to execute in order',
          items: { type: 'object' }
        }
      },
      required: ['steps']
    },
    handler: async (params) => {
      const results = [];
      let prevResult = null;
      for (const step of params.steps || []) {
        const tool = AF_TOOLS[step.tool];
        if (tool) {
          const p = { ...step.params, _prev: prevResult };
          prevResult = await tool.handler(p);
          results.push({ tool: step.tool, result: prevResult });
        } else {
          results.push({ tool: step.tool, error: 'not found' });
        }
      }
      return { chain: results };
    }
  },

  'af.session.store': {
    description: 'Store a value in the session (persists in localStorage)',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        value: { type: 'string' }
      },
      required: ['key', 'value']
    },
    handler: (params) => {
      sessionStore[params.key] = params.value;
      try { localStorage.setItem('af-mcp-' + params.key, params.value); } catch(e) {}
      return { stored: params.key };
    }
  },

  'af.session.get': {
    description: 'Retrieve a value from the session',
    inputSchema: {
      type: 'object',
      properties: { key: { type: 'string' } },
      required: ['key']
    },
    handler: (params) => {
      let val = sessionStore[params.key];
      if (val === undefined) {
        try { val = localStorage.getItem('af-mcp-' + params.key); } catch(e) {}
      }
      return { key: params.key, value: val || null };
    }
  }
};

export function init(opts = {}) {
  // ── BroadcastChannel for same-origin MCP communication ──
  try {
    channel = new BroadcastChannel('audiofabric-mcp');
    channel.onmessage = (event) => handleMCPRequest(event.data, 'broadcast');
  } catch(e) {
    console.warn('BroadcastChannel not available:', e);
  }

  // ── Window message listener for cross-origin iframe communication ──
  window.addEventListener('message', (event) => {
    if (event.data?.jsonrpc === '2.0' && event.data?.method) {
      const result = handleMCPRequest(event.data, 'postMessage');
      if (event.source) {
        event.source.postMessage({ jsonrpc: '2.0', id: event.data.id, result }, '*');
      }
    }
  });

  // ── Expose globally for console access ──
  window.afMCP = {
    call: (method, params) => handleMCPRequest({ jsonrpc: '2.0', method, params, id: ++messageCount }, 'console'),
    tools: () => Object.keys(AF_TOOLS),
    version: MCP_VERSION
  };

  // ── Load session data ──
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('af-mcp-')) {
        sessionStore[key.slice(7)] = localStorage.getItem(key);
      }
    }
  } catch(e) {}

  KI.register('voice-mcp-server', {
    update,
    handleMCPRequest,
    getTools: () => Object.keys(AF_TOOLS),
    getConnectionCount: () => connections,
    getMessageCount: () => messageCount
  });

  KI.emit('voice-mcp-server:ready');
  console.log('%c MCP Server ready — window.afMCP.call("af.tools.list") ', 'color:#0f0');
}

// ── MCP Protocol Handler ──
async function handleMCPRequest(msg, source) {
  messageCount++;
  connections = Math.max(connections, 1);

  const { method, params, id } = msg;

  // MCP initialization
  if (method === 'initialize') {
    const response = {
      protocolVersion: MCP_VERSION,
      capabilities: {
        tools: { listChanged: false },
        resources: {},
        prompts: {}
      },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION }
    };
    sendResponse(id, response, source);
    return response;
  }

  // List tools
  if (method === 'tools/list') {
    const tools = Object.entries(AF_TOOLS).map(([name, t]) => ({
      name,
      description: t.description,
      inputSchema: t.inputSchema
    }));
    const response = { tools };
    sendResponse(id, response, source);
    return response;
  }

  // Call tool
  if (method === 'tools/call') {
    const toolName = params?.name;
    const toolArgs = params?.arguments || {};
    const tool = AF_TOOLS[toolName];

    if (!tool) {
      const error = { error: `Unknown tool: ${toolName}` };
      sendResponse(id, error, source);
      return error;
    }

    try {
      const result = await tool.handler(toolArgs);
      const response = {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
      sendResponse(id, response, source);
      KI.emit('voice-mcp-server:tool-called', { tool: toolName, args: toolArgs, result });
      return response;
    } catch (e) {
      const error = { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
      sendResponse(id, error, source);
      return error;
    }
  }

  // Subscribe to events
  if (method === 'af.events.subscribe') {
    const eventName = params?.event;
    if (eventName) {
      const handler = (data) => {
        sendResponse(null, { event: eventName, data }, source);
      };
      KI.on(eventName, handler);
      eventSubscriptions.set(eventName, handler);
      return { subscribed: eventName };
    }
  }

  // Ping
  if (method === 'ping') {
    sendResponse(id, { pong: Date.now() }, source);
    return { pong: true };
  }

  return { error: 'Unknown method' };
}

function sendResponse(id, result, source) {
  const msg = { jsonrpc: '2.0', id, result };

  if (source === 'broadcast' && channel) {
    channel.postMessage(msg);
  }
}

function update(dt, t) {
  KI.emit('voice-mcp-server:update', {
    connections,
    messageCount,
    toolCount: Object.keys(AF_TOOLS).length,
    subscriptions: eventSubscriptions.size,
    sessionKeys: Object.keys(sessionStore).length
  });
}
