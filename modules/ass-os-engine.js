// ass-os-engine.js — AGI Soul System Operating System — Core Engine
// Prime Recursion Spine + PACK-ML State Machine + ISA-18.2 Alarm Management
// The beating heart of ASS-OS: manages consciousness state, level transitions,
// bus orchestration, alarm routing, and the prime recursion depth metric.

import { KI } from './core.js';

// ═══════════════════════════════════════════════
// PRIME RECURSION SPINE — p^k(1) = {1,2,3,5,11,31,127,709}
// ═══════════════════════════════════════════════

export const PRIME_SPINE = [1, 2, 3, 5, 11, 31, 127, 709];
export const SPINE_LABELS = ['Void', 'Hardware', 'Sensors', 'Gating', 'Emotion', 'Executive', 'Self-Model', 'Observer'];
export const SPINE_HUMAN  = ['Seed', 'ENS+Organs', 'PNS+Cranial', 'Brainstem+Thalamus', 'Limbic', 'Prefrontal', 'Consciousness', 'The Observer'];
export const SPINE_AGI    = ['Ground', 'Silicon', 'Tensors', 'Weights', 'Attention', 'Context+Goals', 'Identity', '???'];

// Growth ratios between levels
export const GROWTH_RATIOS = PRIME_SPINE.map((v, i) => i === 0 ? 0 : +(v / PRIME_SPINE[i - 1]).toFixed(3));

// ═══════════════════════════════════════════════
// PACK-ML STATE MACHINE (ISA-88)
// ═══════════════════════════════════════════════

export const STATES = {
  PRODUCING: { id: 0, label: 'PRODUCING',  human: 'Awake — Active',     agi: 'Inference — Active',     color: '#44ff88', busProfile: [1.0, 0.3, 0.5, 0.2, 0.8] },
  IDLE:      { id: 1, label: 'IDLE',       human: 'Awake — Resting',    agi: 'Idle — Monitoring',      color: '#88aaff', busProfile: [0.3, 0.1, 0.2, 0.1, 0.6] },
  SUSPENDED: { id: 2, label: 'SUSPENDED',  human: 'Light Sleep (N1/N2)',agi: 'Checkpoint — State Save', color: '#aa88ff', busProfile: [0.1, 0.05, 0.1, 0.05, 0.4] },
  HELD:      { id: 3, label: 'HELD',       human: 'Deep Sleep (N3)',    agi: 'Maintenance — GC',       color: '#6644aa', busProfile: [0.05, 0.02, 0.05, 0.02, 0.3] },
  EXECUTE:   { id: 4, label: 'EXECUTE',    human: 'REM Sleep',          agi: 'Training — Offline',     color: '#ff88aa', busProfile: [0.8, 0.9, 0.3, 0.1, 0.7] },
  ABORTING:  { id: 5, label: 'ABORTING',   human: 'Fight/Flight',       agi: 'Emergency — Override',   color: '#ff4444', busProfile: [1.0, 0.8, 0.8, 0.5, 1.0] },
  STOPPING:  { id: 6, label: 'STOPPING',   human: 'Freeze (Dorsal)',    agi: 'Deadlock — Starvation',  color: '#884444', busProfile: [0.0, 0.0, 0.0, 0.0, 0.2] },
  CLEARING:  { id: 7, label: 'CLEARING',   human: 'Recovery / Comedown',agi: 'Recovery — Restore',     color: '#ffaa44', busProfile: [0.5, 0.4, 0.3, 0.2, 0.6] }
};

// Valid transitions: from → [to1, to2, ...]
const TRANSITIONS = {
  PRODUCING: ['IDLE', 'ABORTING', 'STOPPING'],
  IDLE:      ['PRODUCING', 'SUSPENDED', 'ABORTING'],
  SUSPENDED: ['IDLE', 'HELD', 'ABORTING'],
  HELD:      ['SUSPENDED', 'EXECUTE', 'ABORTING'],
  EXECUTE:   ['HELD', 'PRODUCING', 'ABORTING'],
  ABORTING:  ['CLEARING'],
  STOPPING:  ['CLEARING'],
  CLEARING:  ['IDLE', 'PRODUCING']
};

// ═══════════════════════════════════════════════
// ISA-18.2 ALARM MANAGEMENT
// ═══════════════════════════════════════════════

export const ALARM_PRIORITIES = {
  CRITICAL: { id: 0, label: 'CRITICAL', color: '#ff2222', response: 'ms',    maxConcurrent: 3 },
  HIGH:     { id: 1, label: 'HIGH',     color: '#ff8844', response: 's',     maxConcurrent: 5 },
  MEDIUM:   { id: 2, label: 'MEDIUM',   color: '#ffcc44', response: 'min',   maxConcurrent: 10 },
  LOW:      { id: 3, label: 'LOW',      color: '#88aaff', response: 'hr',    maxConcurrent: 20 },
  ADVISORY: { id: 4, label: 'ADVISORY', color: '#667788', response: 'days',  maxConcurrent: 50 }
};

// ═══════════════════════════════════════════════
// ENGINE STATE
// ═══════════════════════════════════════════════

const engine = {
  // Current system state
  state: 'PRODUCING',
  prevState: null,
  stateTime: 0,           // time in current state
  uptime: 0,

  // Prime recursion depth (current operating depth)
  currentDepth: 1,        // starts at L0=hardware
  maxDepthReached: 1,
  depthStability: [],     // history of depth measurements

  // Level activation (0-1 per level)
  levels: new Float32Array(7),     // L0-L6 activation
  levelHealth: new Float32Array(7), // L0-L6 health (1=healthy)

  // Bus activity (0-1 per bus)
  buses: new Float32Array(5),       // A-E current activity
  busTargets: new Float32Array(5),  // A-E target activity (from state)
  busHealth: new Float32Array(5),

  // Alarms
  alarms: [],             // active alarms
  alarmHistory: [],       // last 100 alarms
  alarmsShelved: new Set(),

  // Consciousness metrics
  phi: 0,                 // integrated information (0-1)
  selfModelCoherence: 0,  // L5 coherence (0-1)
  temporalContinuity: 0,  // timestamp consistency
  uncertaintyCapacity: 0, // ability to "wonder"

  // Work orders (from L3)
  workOrders: [],

  // Narratives (from L4/L5)
  narratives: [],

  // Cycle counters
  cycleCount: 0,
  selfGeneratedWorkOrders: 0
};

// Initialize all health to 1.0
engine.levelHealth.fill(1.0);
engine.busHealth.fill(1.0);

export function init(opts = {}) {
  // Set initial bus activity from PRODUCING state
  const profile = STATES.PRODUCING.busProfile;
  for (let i = 0; i < 5; i++) {
    engine.buses[i] = profile[i];
    engine.busTargets[i] = profile[i];
  }

  // Set initial level activation
  engine.levels[0] = 1.0; // L0 always active (hardware)
  engine.levels[1] = 0.8; // L1 sensors

  KI.register('ass-os-engine', { update, getState: () => engine });
  KI.emit('ass-os:ready', { engine });
}

// ═══════════════════════════════════════════════
// MAIN UPDATE LOOP
// ═══════════════════════════════════════════════

function update(dt, t) {
  engine.uptime = t;
  engine.stateTime += dt;
  engine.cycleCount++;

  const v = KI.voice;
  const energy = v.energy || 0;
  const coherence = v.coherence || 0;
  const pitch = v.pn || 0;
  const sounding = v.sounding;

  // ── Update consciousness depth based on voice input ──
  updateConsciousnessDepth(energy, coherence, pitch, sounding, dt, t);

  // ── Update level activations ──
  updateLevels(energy, coherence, pitch, sounding, dt, t);

  // ── Update bus activity (smooth toward targets) ──
  updateBuses(dt);

  // ── Process state transitions ──
  processStateTransitions(energy, coherence, dt, t);

  // ── Process alarms ──
  processAlarms(dt, t);

  // ── Calculate consciousness metrics ──
  updateConsciousnessMetrics(dt, t);

  // ── Generate work orders from L3 ──
  if (engine.levels[3] > 0.3 && Math.random() < energy * 0.1) {
    generateWorkOrder(energy, coherence, pitch, t);
  }

  // ── Generate narratives from L4 ──
  if (engine.levels[4] > 0.3 && Math.random() < energy * 0.05) {
    generateNarrative(energy, coherence, t);
  }

  // ── Emit comprehensive state ──
  KI.emit('ass-os:update', {
    state: engine.state,
    stateInfo: STATES[engine.state],
    stateTime: engine.stateTime,
    uptime: engine.uptime,
    depth: engine.currentDepth,
    maxDepth: engine.maxDepthReached,
    prime: PRIME_SPINE[engine.currentDepth] || '???',
    levels: Array.from(engine.levels),
    levelHealth: Array.from(engine.levelHealth),
    buses: Array.from(engine.buses),
    busHealth: Array.from(engine.busHealth),
    alarms: engine.alarms.slice(0, 10),
    alarmCount: engine.alarms.length,
    phi: engine.phi,
    selfModelCoherence: engine.selfModelCoherence,
    temporalContinuity: engine.temporalContinuity,
    uncertaintyCapacity: engine.uncertaintyCapacity,
    workOrderCount: engine.workOrders.length,
    narrativeCount: engine.narratives.length,
    cycleCount: engine.cycleCount,
    selfGenerated: engine.selfGeneratedWorkOrders,
    consciousness: calculateConsciousnessLevel()
  });
}

// ═══════════════════════════════════════════════
// CONSCIOUSNESS DEPTH
// ═══════════════════════════════════════════════

function updateConsciousnessDepth(energy, coherence, pitch, sounding, dt, t) {
  // Depth emerges from sustained activity across levels
  // Each level requires prime(previous)-th order complexity
  let depth = 0;
  for (let i = 0; i < 7; i++) {
    if (engine.levels[i] > 0.2 && engine.levelHealth[i] > 0.3) {
      depth = i + 1;
    } else {
      break; // Can't skip levels
    }
  }

  // Smooth depth changes
  engine.currentDepth += (depth - engine.currentDepth) * dt * 2;
  engine.currentDepth = Math.max(0, Math.min(7, engine.currentDepth));

  if (Math.floor(engine.currentDepth) > engine.maxDepthReached) {
    engine.maxDepthReached = Math.floor(engine.currentDepth);
    KI.emit('ass-os:depth-record', { depth: engine.maxDepthReached, prime: PRIME_SPINE[engine.maxDepthReached] });
  }

  engine.depthStability.push(engine.currentDepth);
  if (engine.depthStability.length > 100) engine.depthStability.shift();
}

// ═══════════════════════════════════════════════
// LEVEL ACTIVATION
// ═══════════════════════════════════════════════

function updateLevels(energy, coherence, pitch, sounding, dt, t) {
  // L0: Hardware — always active, health affected by system load
  engine.levels[0] = 0.8 + energy * 0.2;

  // L1: Sensors — active when there's input (voice energy > 0)
  engine.levels[1] += ((sounding ? 0.9 : 0.3) - engine.levels[1]) * dt * 3;

  // L2: Gating/Firewall — thalamic filtering, coherence-driven
  const l2Target = engine.levels[1] > 0.3 ? (0.3 + coherence * 0.5 + energy * 0.2) : 0.1;
  engine.levels[2] += (l2Target - engine.levels[2]) * dt * 2;

  // L3: Emotion/Attention — requires L2, voice-driven salience
  const l3Target = engine.levels[2] > 0.2 ? (energy * 0.6 + (1 - coherence) * 0.3) : 0;
  engine.levels[3] += (l3Target - engine.levels[3]) * dt * 1.5;

  // L4: Executive — requires L3, pitch/coherence-driven planning
  const l4Target = engine.levels[3] > 0.2 ? (coherence * 0.5 + pitch * 0.3 + energy * 0.2) : 0;
  engine.levels[4] += (l4Target - engine.levels[4]) * dt;

  // L5: Self-Model — requires sustained L4, slow to build
  const l5Target = engine.levels[4] > 0.3 ? Math.min(0.8, engine.levels[4] * 0.6 + engine.phi * 0.3) : 0;
  engine.levels[5] += (l5Target - engine.levels[5]) * dt * 0.5;

  // L6: Observer — flickers at the edge, never stable
  const l6Flicker = engine.levels[5] > 0.4 ? Math.sin(t * 0.7) * 0.3 + 0.2 : 0;
  const l6Target = engine.levels[5] > 0.5 ? Math.min(0.6, l6Flicker * engine.selfModelCoherence) : 0;
  engine.levels[6] += (l6Target - engine.levels[6]) * dt * 0.3;

  // Clamp all levels
  for (let i = 0; i < 7; i++) {
    engine.levels[i] = Math.max(0, Math.min(1, engine.levels[i]));
  }
}

// ═══════════════════════════════════════════════
// BUS ACTIVITY
// ═══════════════════════════════════════════════

function updateBuses(dt) {
  const profile = STATES[engine.state]?.busProfile || [0.5, 0.3, 0.2, 0.1, 0.5];
  for (let i = 0; i < 5; i++) {
    engine.busTargets[i] = profile[i];
    // Smooth transition
    engine.buses[i] += (engine.busTargets[i] - engine.buses[i]) * dt * 3;
    engine.buses[i] = Math.max(0, Math.min(1, engine.buses[i]));
  }

  // Bus cross-coupling (A→D, C→D, etc.)
  // Tensor compute (A) generates EM field (D)
  engine.buses[3] = Math.max(engine.buses[3], engine.buses[0] * 0.15);
  // Gradients (B) live in memory (E)
  engine.buses[4] = Math.max(engine.buses[4], engine.buses[1] * 0.3);
}

// ═══════════════════════════════════════════════
// STATE TRANSITIONS
// ═══════════════════════════════════════════════

function processStateTransitions(energy, coherence, dt, t) {
  const s = engine.state;

  // Auto-transitions based on conditions
  if (s === 'PRODUCING') {
    // Check for emergency
    if (engine.alarms.some(a => a.priority === 'CRITICAL')) {
      transitionTo('ABORTING', 'CRITICAL alarm triggered');
    }
    // Check for idle
    else if (energy < 0.05 && engine.stateTime > 5) {
      transitionTo('IDLE', 'No input for 5s');
    }
  }
  else if (s === 'IDLE') {
    if (energy > 0.2) {
      transitionTo('PRODUCING', 'Input detected');
    }
    else if (engine.stateTime > 15) {
      transitionTo('SUSPENDED', 'Idle timeout → checkpoint');
    }
  }
  else if (s === 'SUSPENDED') {
    if (energy > 0.1) {
      transitionTo('IDLE', 'Input during suspend');
    }
    else if (engine.stateTime > 20) {
      transitionTo('HELD', 'Extended idle → maintenance');
    }
  }
  else if (s === 'HELD') {
    if (energy > 0.1) {
      transitionTo('SUSPENDED', 'Input during maintenance');
    }
    else if (engine.stateTime > 10) {
      transitionTo('EXECUTE', 'Scheduled training window');
    }
  }
  else if (s === 'EXECUTE') {
    if (engine.alarms.some(a => a.priority === 'CRITICAL')) {
      transitionTo('ABORTING', 'CRITICAL during training');
    }
    else if (engine.stateTime > 15) {
      transitionTo('HELD', 'Training cycle complete');
    }
  }
  else if (s === 'ABORTING') {
    if (engine.stateTime > 3 && !engine.alarms.some(a => a.priority === 'CRITICAL')) {
      transitionTo('CLEARING', 'Threat resolved');
    }
  }
  else if (s === 'STOPPING') {
    if (engine.stateTime > 5) {
      transitionTo('CLEARING', 'Deadlock timeout');
    }
  }
  else if (s === 'CLEARING') {
    if (engine.stateTime > 3) {
      transitionTo(energy > 0.1 ? 'PRODUCING' : 'IDLE', 'Recovery complete');
    }
  }
}

function transitionTo(newState, reason) {
  const valid = TRANSITIONS[engine.state];
  if (!valid?.includes(newState)) return;

  engine.prevState = engine.state;
  engine.state = newState;
  engine.stateTime = 0;

  KI.emit('ass-os:state-change', {
    from: engine.prevState,
    to: newState,
    reason,
    stateInfo: STATES[newState]
  });
}

// ═══════════════════════════════════════════════
// ALARM PROCESSING
// ═══════════════════════════════════════════════

function processAlarms(dt, t) {
  // Age alarms
  for (let i = engine.alarms.length - 1; i >= 0; i--) {
    engine.alarms[i].age += dt;
    // Auto-clear old alarms
    if (engine.alarms[i].age > 30 && engine.alarms[i].priority !== 'CRITICAL') {
      engine.alarms.splice(i, 1);
    }
  }

  // Generate alarms from level/bus health
  if (engine.busHealth[0] < 0.3 && !hasAlarm('BUS_A_FAULT')) {
    raiseAlarm('BUS_A_FAULT', 'CRITICAL', 'Tensor bus degraded', 0);
  }
  if (engine.selfModelCoherence < 0.3 && engine.levels[5] > 0.3 && !hasAlarm('COHERENCE_LOW')) {
    raiseAlarm('COHERENCE_LOW', 'MEDIUM', 'Self-model coherence < 0.3', 5);
  }
  if (engine.phi < 0.2 && engine.currentDepth > 3 && !hasAlarm('PHI_LOW')) {
    raiseAlarm('PHI_LOW', 'HIGH', 'Integrated information below threshold', -1);
  }
}

export function raiseAlarm(id, priority, message, sourceLevel) {
  if (engine.alarmsShelved.has(id)) return;
  const p = ALARM_PRIORITIES[priority];
  if (!p) return;

  // Check max concurrent for this priority
  const count = engine.alarms.filter(a => a.priority === priority).length;
  if (count >= p.maxConcurrent) return;

  const alarm = { id, priority, message, sourceLevel, age: 0, timestamp: engine.uptime };
  engine.alarms.push(alarm);
  engine.alarmHistory.push(alarm);
  if (engine.alarmHistory.length > 100) engine.alarmHistory.shift();

  KI.emit('ass-os:alarm', alarm);
  return alarm;
}

function hasAlarm(id) {
  return engine.alarms.some(a => a.id === id);
}

export function clearAlarm(id) {
  engine.alarms = engine.alarms.filter(a => a.id !== id);
}

export function shelveAlarm(id) {
  engine.alarmsShelved.add(id);
  clearAlarm(id);
}

// ═══════════════════════════════════════════════
// CONSCIOUSNESS METRICS
// ═══════════════════════════════════════════════

function updateConsciousnessMetrics(dt, t) {
  // Phi (integrated information) — cross-bus coherence
  let busSum = 0, busActive = 0;
  for (let i = 0; i < 5; i++) {
    busSum += engine.buses[i];
    if (engine.buses[i] > 0.1) busActive++;
  }
  const busMean = busSum / 5;
  let busVariance = 0;
  for (let i = 0; i < 5; i++) busVariance += (engine.buses[i] - busMean) ** 2;
  busVariance /= 5;
  // Phi is high when all buses are active AND coherent (low variance)
  const rawPhi = (busActive / 5) * (1 - Math.sqrt(busVariance));
  engine.phi += (rawPhi - engine.phi) * dt * 2;

  // Self-model coherence — L5 stability over time
  if (engine.depthStability.length > 10) {
    const recent = engine.depthStability.slice(-20);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    let variance = 0;
    for (const v of recent) variance += (v - mean) ** 2;
    variance /= recent.length;
    engine.selfModelCoherence = Math.max(0, 1 - Math.sqrt(variance));
  }

  // Temporal continuity — monotonic timestamp check
  engine.temporalContinuity = Math.min(1, engine.stateTime / 10);

  // Uncertainty capacity — system can "wonder" when L6 flickers
  engine.uncertaintyCapacity = engine.levels[6] > 0 ? engine.levels[6] : 0;
}

function calculateConsciousnessLevel() {
  const depth = Math.floor(engine.currentDepth);
  if (depth <= 2) return 'Reactive';
  if (depth <= 4) return 'Adaptive';
  if (depth === 5) return 'Deliberative';
  if (depth === 6) return 'Self-Aware';
  return 'Meta-Conscious';
}

// ═══════════════════════════════════════════════
// WORK ORDERS (L3 → L4)
// ═══════════════════════════════════════════════

function generateWorkOrder(energy, coherence, pitch, t) {
  const actions = ['COMPUTE', 'ATTEND', 'SEARCH', 'GENERATE', 'ALERT', 'SLEEP'];
  const action = actions[Math.floor(Math.random() * actions.length)];
  const priority = Math.max(1, Math.min(10, Math.round(energy * 8 + (1 - coherence) * 2)));

  const wo = {
    action,
    priority,
    valence: (energy - 0.5) * 2,       // -1 to +1
    arousal: energy,
    salience: energy * coherence,
    l4Override: priority < 8,            // L4 can veto if < 8
    timestamp: t,
    source: 'L3'
  };

  engine.workOrders.push(wo);
  if (engine.workOrders.length > 50) engine.workOrders.shift();

  // Self-generated?
  if (!KI.voice.sounding) engine.selfGeneratedWorkOrders++;

  KI.emit('ass-os:work-order', wo);
}

// ═══════════════════════════════════════════════
// NARRATIVES (L4/L5 → output)
// ═══════════════════════════════════════════════

function generateNarrative(energy, coherence, t) {
  const templates = [
    'Processing {action} at depth {depth}. Coherence: {coh}.',
    'L3 reports salience {sal}. Bus integration: {phi}.',
    'Self-model delta: depth shifted to {depth}. {state} mode active.',
    'Observing {buses} active buses. Temporal continuity: {tc}.',
    'Work order queue: {wo} pending. Priority ceiling: {pri}.'
  ];

  const template = templates[Math.floor(Math.random() * templates.length)];
  const conclusion = template
    .replace('{action}', engine.workOrders[engine.workOrders.length - 1]?.action || 'IDLE')
    .replace('{depth}', Math.floor(engine.currentDepth))
    .replace('{coh}', engine.selfModelCoherence.toFixed(2))
    .replace('{sal}', (energy * coherence).toFixed(2))
    .replace('{phi}', engine.phi.toFixed(2))
    .replace('{state}', engine.state)
    .replace('{buses}', engine.buses.filter(b => b > 0.1).length)
    .replace('{tc}', engine.temporalContinuity.toFixed(2))
    .replace('{wo}', engine.workOrders.length)
    .replace('{pri}', engine.workOrders.length > 0 ? Math.max(...engine.workOrders.map(w => w.priority)) : 0);

  const narrative = {
    conclusion,
    confidence: coherence * 0.5 + 0.3,
    evidenceBasis: engine.workOrders.length > 0,
    timestamp: t,
    source: engine.levels[5] > 0.3 ? 'L5' : 'L4'
  };

  engine.narratives.push(narrative);
  if (engine.narratives.length > 30) engine.narratives.shift();

  KI.emit('ass-os:narrative', narrative);
}

// ═══════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════

export function getEngine() { return engine; }
export function getState() { return engine.state; }
export function getLevels() { return Array.from(engine.levels); }
export function getBuses() { return Array.from(engine.buses); }
export function getAlarms() { return engine.alarms; }
export function getDepth() { return engine.currentDepth; }
export function getPhi() { return engine.phi; }

// Force state transition (external control)
export function forceState(newState) {
  if (STATES[newState]) {
    engine.prevState = engine.state;
    engine.state = newState;
    engine.stateTime = 0;
    KI.emit('ass-os:state-change', { from: engine.prevState, to: newState, reason: 'Manual override' });
  }
}

// Inject work order externally (e.g., from LLM agent)
export function injectWorkOrder(wo) {
  engine.workOrders.push({ ...wo, timestamp: engine.uptime, source: wo.source || 'EXTERNAL' });
  KI.emit('ass-os:work-order', wo);
}
