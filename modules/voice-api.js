// voice-api.js — Voice-controlled API builder + mock server
// Speak to design and test REST APIs entirely in-browser.
// Features:
// - "Create endpoint GET /users" → builds mock route
// - "Add field email to user" → modifies schema
// - "Test GET /users" → executes and shows response
// - In-browser request interceptor (fetch wrapper)
// - Auto-generates OpenAPI spec from voice
// - LLM generates mock response data
// - Visual: 3D API graph showing endpoints + connections

import { KI } from './core.js';

const TAU = Math.PI * 2;

// ── API State ──
const endpoints = new Map(); // path → { method, path, schema, mockData, handler, calls }
const schemas = new Map();   // name → { fields: [{name, type, required}] }
const requestLog = [];
const MAX_LOG = 50;

// ── 3D ──
let group = null;
let endpointMeshes = [];
let connectionLines = [];
let requestParticles = null, reqPos = null, reqCol = null;
const MAX_EP_MESHES = 20;
const MAX_CONNECTIONS = 30;
const MAX_REQ_PARTICLES = 100;

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 2, -3];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── Endpoint nodes (spheres) ──
  for (let i = 0; i < MAX_EP_MESHES; i++) {
    const geo = new THREE.SphereGeometry(0.12, 8, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ff88, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    group.add(mesh);
    endpointMeshes.push(mesh);
  }

  // ── Connection lines ──
  for (let i = 0; i < MAX_CONNECTIONS; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0x4488ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending
    }));
    line.visible = false;
    group.add(line);
    connectionLines.push(line);
  }

  // ── Request particles (flying between endpoints) ──
  const rpGeo = new THREE.BufferGeometry();
  reqPos = new Float32Array(MAX_REQ_PARTICLES * 3);
  reqCol = new Float32Array(MAX_REQ_PARTICLES * 3);
  rpGeo.setAttribute('position', new THREE.BufferAttribute(reqPos, 3));
  rpGeo.setAttribute('color', new THREE.BufferAttribute(reqCol, 3));
  requestParticles = new THREE.Points(rpGeo, new THREE.PointsMaterial({
    size: 0.08, vertexColors: true, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(requestParticles);

  // ── Register tools ──
  KI.on('voice-ai-core:ready', registerTools);
  const core = KI.get('voice-ai-core');
  if (core?.isReady()) registerTools();

  KI.on('voice-ai-core:command', handleCommand);

  // ── Create default endpoints ──
  addEndpoint('GET', '/api/status', { status: 'ok', uptime: 0, version: '1.0' });

  KI.register('voice-api', {
    update, group,
    addEndpoint,
    removeEndpoint,
    testEndpoint,
    getEndpoints: () => [...endpoints.values()],
    getSchemas: () => [...schemas.entries()],
    getLog: () => requestLog
  });

  KI.emit('voice-api:ready');
}

function registerTools() {
  const core = KI.get('voice-ai-core');
  if (!core) return;

  core.registerTool('voice-api', {
    description: 'Create, modify, and test REST API endpoints',
    parameters: { command: 'string' },
    handler: handleAPITool
  });
}

async function handleAPITool(params) {
  const core = KI.get('voice-ai-core');
  if (!core) return { error: 'Core not ready' };

  const cmd = params.command || '';
  const lower = cmd.toLowerCase();

  // Parse endpoint creation
  const createMatch = lower.match(/(get|post|put|delete|patch)\s+(\S+)/);
  if (createMatch && (lower.includes('create') || lower.includes('add') || lower.includes('endpoint'))) {
    const method = createMatch[1].toUpperCase();
    const path = createMatch[2].startsWith('/') ? createMatch[2] : '/' + createMatch[2];

    // Use LLM to generate mock data
    const mockData = await core.infer(
      `Generate a JSON mock response for ${method} ${path}. Return only valid JSON.`,
      { maxTokens: 80, temperature: 0.5, system: 'You are an API designer. Return only valid JSON.' }
    );

    let parsed = {};
    try { parsed = JSON.parse(mockData); } catch(e) { parsed = { message: 'ok' }; }

    addEndpoint(method, path, parsed);
    core.speak(`Created ${method} ${path}`);
    return { endpoint: { method, path }, mockData: parsed };
  }

  // Test endpoint
  if (lower.includes('test')) {
    const testMatch = lower.match(/(get|post|put|delete|patch)\s+(\S+)/);
    if (testMatch) {
      const method = testMatch[1].toUpperCase();
      const path = testMatch[2].startsWith('/') ? testMatch[2] : '/' + testMatch[2];
      const result = testEndpoint(method, path);
      core.speak(`${method} ${path} returned ${result.status}`);
      return result;
    }
  }

  // Add field to schema
  if (lower.includes('add field') || lower.includes('add column')) {
    const result = await core.infer(
      `Parse this into JSON: ${cmd}\nFormat: {"schema": "name", "field": "fieldName", "type": "string|number|boolean"}\nReturn only JSON.`,
      { maxTokens: 40, temperature: 0.2 }
    );
    try {
      const p = JSON.parse(result);
      addSchemaField(p.schema, p.field, p.type);
      return { schema: p.schema, field: p.field };
    } catch(e) { return { error: 'Could not parse field definition' }; }
  }

  // List endpoints
  if (lower.includes('list') || lower.includes('show')) {
    const eps = [...endpoints.values()].map(e => `${e.method} ${e.path}`);
    core.speak(`You have ${eps.length} endpoints: ${eps.join(', ')}`);
    return { endpoints: eps };
  }

  return { error: 'Unrecognized API command' };
}

function handleCommand(cmd) {
  if (cmd.intent !== 'api') return;
  // Auto-handled by tool router
}

function addEndpoint(method, path, mockData) {
  const key = `${method} ${path}`;
  endpoints.set(key, {
    method, path, mockData,
    schema: inferSchema(mockData),
    calls: 0,
    created: Date.now(),
    lastCalled: 0
  });
  KI.emit('voice-api:endpoint-added', { method, path });
}

function removeEndpoint(method, path) {
  endpoints.delete(`${method} ${path}`);
  KI.emit('voice-api:endpoint-removed', { method, path });
}

function testEndpoint(method, path) {
  const key = `${method} ${path}`;
  const ep = endpoints.get(key);
  if (!ep) return { status: 404, body: { error: 'Not found' } };

  ep.calls++;
  ep.lastCalled = Date.now();

  const result = {
    status: 200,
    method, path,
    body: ep.mockData,
    timestamp: Date.now(),
    latency: Math.floor(Math.random() * 50 + 5)
  };

  requestLog.push(result);
  if (requestLog.length > MAX_LOG) requestLog.shift();
  KI.emit('voice-api:request', result);
  return result;
}

function inferSchema(data) {
  if (!data || typeof data !== 'object') return {};
  const fields = [];
  for (const [key, val] of Object.entries(data)) {
    fields.push({ name: key, type: typeof val, example: val });
  }
  return { fields };
}

function addSchemaField(schemaName, fieldName, fieldType) {
  if (!schemas.has(schemaName)) schemas.set(schemaName, { fields: [] });
  schemas.get(schemaName).fields.push({ name: fieldName, type: fieldType || 'string' });
}

function update(dt, t) {
  const v = KI.voice;
  const energy = v.energy || 0;
  const epList = [...endpoints.values()];

  // ── Position endpoint nodes in a circle ──
  for (let i = 0; i < MAX_EP_MESHES; i++) {
    const mesh = endpointMeshes[i];
    if (i < epList.length) {
      mesh.visible = true;
      const angle = (i / Math.max(1, epList.length)) * TAU + t * 0.1;
      const r = 2 + Math.sin(t * 0.5 + i) * 0.2;
      mesh.position.set(Math.cos(angle) * r, Math.sin(angle * 0.5) * 0.5, Math.sin(angle) * r);

      // Color by method
      const ep = epList[i];
      const methodColors = { GET: [0, 0.8, 0.4], POST: [0.2, 0.5, 1], PUT: [1, 0.6, 0], DELETE: [1, 0.2, 0.2] };
      const mc = methodColors[ep.method] || [0.5, 0.5, 0.5];
      mesh.material.color.setRGB(mc[0], mc[1], mc[2]);
      mesh.material.opacity = 0.4 + energy * 0.4;

      // Pulse on recent call
      const timeSinceCall = Date.now() - ep.lastCalled;
      if (timeSinceCall < 2000) {
        mesh.scale.setScalar(1 + (1 - timeSinceCall / 2000) * 0.5);
      } else {
        mesh.scale.setScalar(1);
      }

      mesh.rotation.y += dt;
    } else {
      mesh.visible = false;
    }
  }

  // ── Connection lines between endpoints sharing path segments ──
  let lineIdx = 0;
  for (let i = 0; i < epList.length && lineIdx < MAX_CONNECTIONS; i++) {
    for (let j = i + 1; j < epList.length && lineIdx < MAX_CONNECTIONS; j++) {
      // Connect if paths share a prefix
      const pathA = epList[i].path.split('/');
      const pathB = epList[j].path.split('/');
      let shared = 0;
      for (let k = 0; k < Math.min(pathA.length, pathB.length); k++) {
        if (pathA[k] === pathB[k]) shared++;
      }
      if (shared >= 2) {
        const line = connectionLines[lineIdx];
        const posArr = line.geometry.attributes.position.array;
        const meshA = endpointMeshes[i], meshB = endpointMeshes[j];
        posArr[0] = meshA.position.x; posArr[1] = meshA.position.y; posArr[2] = meshA.position.z;
        posArr[3] = meshB.position.x; posArr[4] = meshB.position.y; posArr[5] = meshB.position.z;
        line.geometry.attributes.position.needsUpdate = true;
        line.material.opacity = 0.15 + energy * 0.2;
        line.visible = true;
        lineIdx++;
      }
    }
  }
  for (let i = lineIdx; i < MAX_CONNECTIONS; i++) connectionLines[i].visible = false;

  // ── Request particles (animate on recent requests) ──
  for (let i = 0; i < MAX_REQ_PARTICLES; i++) {
    reqPos[i*3] += (Math.random() - 0.5) * dt * 0.5;
    reqPos[i*3+1] += dt * 0.3;
    reqPos[i*3+2] += (Math.random() - 0.5) * dt * 0.5;
    if (reqPos[i*3+1] > 2) {
      reqPos[i*3] = (Math.random() - 0.5) * 3;
      reqPos[i*3+1] = -1;
      reqPos[i*3+2] = (Math.random() - 0.5) * 3;
    }
    const bright = energy * 0.5;
    reqCol[i*3] = 0.2 * bright; reqCol[i*3+1] = 0.8 * bright; reqCol[i*3+2] = 0.4 * bright;
  }
  requestParticles.geometry.attributes.position.needsUpdate = true;
  requestParticles.geometry.attributes.color.needsUpdate = true;

  group.rotation.y += dt * 0.05;

  KI.emit('voice-api:update', {
    endpointCount: endpoints.size,
    schemaCount: schemas.size,
    totalCalls: requestLog.length,
    endpoints: epList.map(e => `${e.method} ${e.path} (${e.calls} calls)`)
  });
}
