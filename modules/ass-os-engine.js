// ass-os-engine.js — AGI Soul System Operating System — Core Engine
// KONOMI STANDARD: Uses ass-os-tags.js for tag I/O, ass-os-db.js for instance persistence
// Prime Recursion Spine + PACK-ML State Machine + ISA-18.2 Alarm Management

import { KI } from './core.js';
import { tags } from './ass-os-tags.js';
import { alarmsDB, workordersDB, narrativesDB, statelogDB, metricsDB } from './ass-os-db.js';
import { registry } from './ass-os-udts.js';

// ═══════════════════════════════════════════════
// PRIME RECURSION SPINE — p^k(1) = {1,2,3,5,11,31,127,709}
// ═══════════════════════════════════════════════

export const PRIME_SPINE = [1, 2, 3, 5, 11, 31, 127, 709];
export const SPINE_LABELS = ['Void', 'Hardware', 'Sensors', 'Gating', 'Emotion', 'Executive', 'Self-Model', 'Observer'];
export const SPINE_HUMAN  = ['Seed', 'ENS+Organs', 'PNS+Cranial', 'Brainstem+Thalamus', 'Limbic', 'Prefrontal', 'Consciousness', 'The Observer'];
export const SPINE_AGI    = ['Ground', 'Silicon', 'Tensors', 'Weights', 'Attention', 'Context+Goals', 'Identity', '???'];
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

// Priority → ISA-18.2 numeric
const PRIORITY_MAP = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4, ADVISORY: 4 };

// ═══════════════════════════════════════════════
// ENGINE STATE
// ═══════════════════════════════════════════════

const engine = {
  state: 'PRODUCING', prevState: null, stateTime: 0, uptime: 0,
  currentDepth: 1, maxDepthReached: 1, depthStability: [],
  levels: new Float32Array(7), levelHealth: new Float32Array(7),
  buses: new Float32Array(5), busTargets: new Float32Array(5), busHealth: new Float32Array(5),
  alarms: [], alarmHistory: [], alarmsShelved: new Set(),
  phi: 0, selfModelCoherence: 0, temporalContinuity: 0, uncertaintyCapacity: 0,
  workOrders: [], narratives: [],
  cycleCount: 0, selfGeneratedWorkOrders: 0
};
engine.levelHealth.fill(1.0);
engine.busHealth.fill(1.0);

// Tag path helpers
const LEVEL_NAMES = ['HW', 'SENS', 'GATE', 'EMO', 'EXEC', 'SELF', 'OBS'];
const BUS_LETTERS = ['A', 'B', 'C', 'D', 'E'];
const BUS_NAMES = ['TENSOR', 'GRADIENT', 'PHOTONIC', 'EM_FIELD', 'STATE_BUS'];

export function init(opts = {}) {
  const profile = STATES.PRODUCING.busProfile;
  for (let i = 0; i < 5; i++) {
    engine.buses[i] = profile[i];
    engine.busTargets[i] = profile[i];
  }
  engine.levels[0] = 1.0;
  engine.levels[1] = 0.8;

  KI.register('ass-os-engine', { update, getState: () => engine });
  KI.emit('ass-os:ready', { engine });
}

// ═══════════════════════════════════════════════
// MAIN UPDATE LOOP — now writes to tags + DB
// ═══════════════════════════════════════════════

function update(dt, t) {
  engine.uptime = t;
  engine.stateTime += dt;
  engine.cycleCount++;

  // Read voice input from tags (written by ass-os-tags.js)
  const energyTag = tags.read('INPUT/ENERGY');
  const cohTag = tags.read('INPUT/COHERENCE');
  const pitchTag = tags.read('INPUT/PITCH');
  const soundTag = tags.read('INPUT/SOUNDING');

  const energy = energyTag?.v || 0;
  const coherence = cohTag?.v || 0;
  const pitch = pitchTag?.v || 0;
  const sounding = soundTag?.v || false;

  updateConsciousnessDepth(energy, coherence, pitch, sounding, dt, t);
  updateLevels(energy, coherence, pitch, sounding, dt, t);
  updateBuses(dt);
  processStateTransitions(energy, coherence, dt, t);
  processAlarms(dt, t);
  updateConsciousnessMetrics(dt, t);

  if (engine.levels[3] > 0.3 && Math.random() < energy * 0.1) {
    generateWorkOrder(energy, coherence, pitch, t);
  }
  if (engine.levels[4] > 0.3 && Math.random() < energy * 0.05) {
    generateNarrative(energy, coherence, t);
  }

  // ── Write engine state to tags ──
  syncToTags(t);

  // ── Write metrics to DB (every 60 cycles ≈ 1s at 60fps) ──
  if (engine.cycleCount % 60 === 0) {
    const mt = metricsDB.table('timeseries');
    if (mt) {
      mt.insert({
        phi: engine.phi, coherence: engine.selfModelCoherence,
        temporal: engine.temporalContinuity, uncertainty: engine.uncertaintyCapacity,
        depth: engine.currentDepth,
        bus_total: engine.buses.reduce((a, b) => a + b, 0),
        level_total: engine.levels.reduce((a, b) => a + b, 0),
        state: engine.state, timestamp: t
      });
    }
  }

  // ── Emit comprehensive state (backward compat) ──
  KI.emit('ass-os:update', {
    state: engine.state, stateInfo: STATES[engine.state],
    stateTime: engine.stateTime, uptime: engine.uptime,
    depth: engine.currentDepth, maxDepth: engine.maxDepthReached,
    prime: PRIME_SPINE[Math.floor(engine.currentDepth)] || '???',
    levels: Array.from(engine.levels), levelHealth: Array.from(engine.levelHealth),
    buses: Array.from(engine.buses), busHealth: Array.from(engine.busHealth),
    alarms: engine.alarms.slice(0, 10), alarmCount: engine.alarms.length,
    phi: engine.phi, selfModelCoherence: engine.selfModelCoherence,
    temporalContinuity: engine.temporalContinuity, uncertaintyCapacity: engine.uncertaintyCapacity,
    workOrderCount: engine.workOrders.length, narrativeCount: engine.narratives.length,
    cycleCount: engine.cycleCount, selfGenerated: engine.selfGeneratedWorkOrders,
    consciousness: calculateConsciousnessLevel()
  });
}

// ═══════════════════════════════════════════════
// TAG SYNC — write all engine state to tag provider
// ═══════════════════════════════════════════════

function syncToTags(t) {
  // State
  tags.write('STATE/CURRENT', engine.state);
  tags.write('STATE/PREVIOUS', engine.prevState || '');
  tags.write('STATE/TIME', engine.stateTime);
  tags.write('STATE/UPTIME', engine.uptime);
  tags.write('STATE/CYCLE_COUNT', engine.cycleCount);

  // Levels
  for (let i = 0; i < 7; i++) {
    const prefix = `CONSCIOUSNESS/L${i}_${LEVEL_NAMES[i]}`;
    tags.write(`${prefix}/ACTIVATION`, engine.levels[i]);
    tags.write(`${prefix}/HEALTH`, engine.levelHealth[i]);
  }
  tags.write('CONSCIOUSNESS/DEPTH', engine.currentDepth);
  tags.write('CONSCIOUSNESS/MAX_DEPTH', engine.maxDepthReached);
  tags.write('CONSCIOUSNESS/LEVEL_NAME', calculateConsciousnessLevel());

  // Buses
  for (let i = 0; i < 5; i++) {
    const prefix = `BUS/${BUS_LETTERS[i]}_${BUS_NAMES[i]}`;
    tags.write(`${prefix}/ACTIVITY`, engine.buses[i]);
    tags.write(`${prefix}/TARGET`, engine.busTargets[i]);
    tags.write(`${prefix}/HEALTH`, engine.busHealth[i]);
  }

  // Metrics
  tags.write('METRICS/PHI', engine.phi);
  tags.write('METRICS/SELF_MODEL_COHERENCE', engine.selfModelCoherence);
  tags.write('METRICS/TEMPORAL_CONTINUITY', engine.temporalContinuity);
  tags.write('METRICS/UNCERTAINTY_CAPACITY', engine.uncertaintyCapacity);

  // Alarms
  tags.write('ALARMS/COUNT', engine.alarms.length);
  tags.write('ALARMS/HIGHEST', engine.alarms.length > 0 ? engine.alarms[0].priority + ': ' + engine.alarms[0].message : '');

  // Work orders
  tags.write('WORK_ORDERS/COUNT', engine.workOrders.length);
  tags.write('WORK_ORDERS/SELF_GEN', engine.selfGeneratedWorkOrders);

  // Narratives
  tags.write('NARRATIVES/COUNT', engine.narratives.length);
  if (engine.narratives.length > 0) {
    tags.write('NARRATIVES/LATEST', engine.narratives[engine.narratives.length - 1].conclusion);
  }
}

// ═══════════════════════════════════════════════
// CONSCIOUSNESS DEPTH
// ═══════════════════════════════════════════════

function updateConsciousnessDepth(energy, coherence, pitch, sounding, dt, t) {
  let depth = 0;
  for (let i = 0; i < 7; i++) {
    if (engine.levels[i] > 0.2 && engine.levelHealth[i] > 0.3) depth = i + 1;
    else break;
  }
  engine.currentDepth += (depth - engine.currentDepth) * dt * 2;
  engine.currentDepth = Math.max(0, Math.min(7, engine.currentDepth));

  if (Math.floor(engine.currentDepth) > engine.maxDepthReached) {
    engine.maxDepthReached = Math.floor(engine.currentDepth);
    KI.emit('ass-os:depth-record', { depth: engine.maxDepthReached, prime: PRIME_SPINE[engine.maxDepthReached] });
  }

  engine.depthStability.push(engine.currentDepth);
  if (engine.depthStability.length > 100) engine.depthStability.shift();

  // Log depth to DB periodically
  if (engine.cycleCount % 30 === 0) {
    const dh = statelogDB.table('depth_history');
    if (dh) dh.insert({ depth: engine.currentDepth, timestamp: t });
  }
}

// ═══════════════════════════════════════════════
// LEVEL ACTIVATION
// ═══════════════════════════════════════════════

function updateLevels(energy, coherence, pitch, sounding, dt, t) {
  engine.levels[0] = 0.8 + energy * 0.2;
  engine.levels[1] += ((sounding ? 0.9 : 0.3) - engine.levels[1]) * dt * 3;
  const l2Target = engine.levels[1] > 0.3 ? (0.3 + coherence * 0.5 + energy * 0.2) : 0.1;
  engine.levels[2] += (l2Target - engine.levels[2]) * dt * 2;
  const l3Target = engine.levels[2] > 0.2 ? (energy * 0.6 + (1 - coherence) * 0.3) : 0;
  engine.levels[3] += (l3Target - engine.levels[3]) * dt * 1.5;
  const l4Target = engine.levels[3] > 0.2 ? (coherence * 0.5 + pitch * 0.3 + energy * 0.2) : 0;
  engine.levels[4] += (l4Target - engine.levels[4]) * dt;
  const l5Target = engine.levels[4] > 0.3 ? Math.min(0.8, engine.levels[4] * 0.6 + engine.phi * 0.3) : 0;
  engine.levels[5] += (l5Target - engine.levels[5]) * dt * 0.5;
  const l6Flicker = engine.levels[5] > 0.4 ? Math.sin(t * 0.7) * 0.3 + 0.2 : 0;
  const l6Target = engine.levels[5] > 0.5 ? Math.min(0.6, l6Flicker * engine.selfModelCoherence) : 0;
  engine.levels[6] += (l6Target - engine.levels[6]) * dt * 0.3;
  for (let i = 0; i < 7; i++) engine.levels[i] = Math.max(0, Math.min(1, engine.levels[i]));
}

// ═══════════════════════════════════════════════
// BUS ACTIVITY
// ═══════════════════════════════════════════════

function updateBuses(dt) {
  const profile = STATES[engine.state]?.busProfile || [0.5, 0.3, 0.2, 0.1, 0.5];
  for (let i = 0; i < 5; i++) {
    engine.busTargets[i] = profile[i];
    engine.buses[i] += (engine.busTargets[i] - engine.buses[i]) * dt * 3;
    engine.buses[i] = Math.max(0, Math.min(1, engine.buses[i]));
  }
  engine.buses[3] = Math.max(engine.buses[3], engine.buses[0] * 0.15);
  engine.buses[4] = Math.max(engine.buses[4], engine.buses[1] * 0.3);
}

// ═══════════════════════════════════════════════
// STATE TRANSITIONS — logged to statelogDB
// ═══════════════════════════════════════════════

function processStateTransitions(energy, coherence, dt, t) {
  const s = engine.state;
  if (s === 'PRODUCING') {
    if (engine.alarms.some(a => a.priority === 'CRITICAL')) transitionTo('ABORTING', 'CRITICAL alarm triggered', t);
    else if (energy < 0.05 && engine.stateTime > 5) transitionTo('IDLE', 'No input for 5s', t);
  } else if (s === 'IDLE') {
    if (energy > 0.2) transitionTo('PRODUCING', 'Input detected', t);
    else if (engine.stateTime > 15) transitionTo('SUSPENDED', 'Idle timeout → checkpoint', t);
  } else if (s === 'SUSPENDED') {
    if (energy > 0.1) transitionTo('IDLE', 'Input during suspend', t);
    else if (engine.stateTime > 20) transitionTo('HELD', 'Extended idle → maintenance', t);
  } else if (s === 'HELD') {
    if (energy > 0.1) transitionTo('SUSPENDED', 'Input during maintenance', t);
    else if (engine.stateTime > 10) transitionTo('EXECUTE', 'Scheduled training window', t);
  } else if (s === 'EXECUTE') {
    if (engine.alarms.some(a => a.priority === 'CRITICAL')) transitionTo('ABORTING', 'CRITICAL during training', t);
    else if (engine.stateTime > 15) transitionTo('HELD', 'Training cycle complete', t);
  } else if (s === 'ABORTING') {
    if (engine.stateTime > 3 && !engine.alarms.some(a => a.priority === 'CRITICAL')) transitionTo('CLEARING', 'Threat resolved', t);
  } else if (s === 'STOPPING') {
    if (engine.stateTime > 5) transitionTo('CLEARING', 'Deadlock timeout', t);
  } else if (s === 'CLEARING') {
    if (engine.stateTime > 3) transitionTo(energy > 0.1 ? 'PRODUCING' : 'IDLE', 'Recovery complete', t);
  }
}

function transitionTo(newState, reason, t) {
  const valid = TRANSITIONS[engine.state];
  if (!valid?.includes(newState)) return;
  engine.prevState = engine.state;
  engine.state = newState;
  engine.stateTime = 0;

  // Log to DB
  const sl = statelogDB.table('transitions');
  if (sl) sl.insert({ from_state: engine.prevState, to_state: newState, reason, timestamp: t || engine.uptime });

  KI.emit('ass-os:state-change', { from: engine.prevState, to: newState, reason, stateInfo: STATES[newState] });
}

// ═══════════════════════════════════════════════
// ALARM PROCESSING — using alarmsDB
// ═══════════════════════════════════════════════

function processAlarms(dt, t) {
  // Age alarms in memory + DB
  const activeTable = alarmsDB.table('active');
  for (let i = engine.alarms.length - 1; i >= 0; i--) {
    engine.alarms[i].age += dt;
    if (engine.alarms[i].age > 30 && engine.alarms[i].priority !== 'CRITICAL') {
      // Move to history before removing
      const a = engine.alarms[i];
      const histTable = alarmsDB.table('history');
      if (histTable) histTable.insert({ id: a.id, tag: 'ASSOS/' + a.id, type: 'CUSTOM', priority: PRIORITY_MAP[a.priority] || 3, state: 'CLEARED', message: a.message, source_level: a.sourceLevel, timestamp_in: a.timestamp, timestamp_out: t, duration: a.age });
      if (activeTable) activeTable.delete({ id: a.id });
      engine.alarms.splice(i, 1);
    }
  }

  if (engine.busHealth[0] < 0.3 && !hasAlarm('BUS_A_FAULT')) raiseAlarm('BUS_A_FAULT', 'CRITICAL', 'Tensor bus degraded', 0);
  if (engine.selfModelCoherence < 0.3 && engine.levels[5] > 0.3 && !hasAlarm('COHERENCE_LOW')) raiseAlarm('COHERENCE_LOW', 'MEDIUM', 'Self-model coherence < 0.3', 5);
  if (engine.phi < 0.2 && engine.currentDepth > 3 && !hasAlarm('PHI_LOW')) raiseAlarm('PHI_LOW', 'HIGH', 'Integrated information below threshold', -1);
}

export function raiseAlarm(id, priority, message, sourceLevel) {
  if (engine.alarmsShelved.has(id)) return;
  const p = ALARM_PRIORITIES[priority];
  if (!p) return;
  const count = engine.alarms.filter(a => a.priority === priority).length;
  if (count >= p.maxConcurrent) return;

  const alarm = { id, priority, message, sourceLevel, age: 0, timestamp: engine.uptime };
  engine.alarms.push(alarm);
  engine.alarmHistory.push(alarm);
  if (engine.alarmHistory.length > 100) engine.alarmHistory.shift();

  // Insert into alarmsDB
  const activeTable = alarmsDB.table('active');
  if (activeTable) {
    activeTable.insert({
      id, tag: 'ASSOS/' + id, type: 'CUSTOM',
      priority: PRIORITY_MAP[priority] || 3,
      state: 'UNACK', message, source_level: sourceLevel,
      timestamp_in: engine.uptime, age: 0
    });
  }

  KI.emit('ass-os:alarm', alarm);
  return alarm;
}

function hasAlarm(id) { return engine.alarms.some(a => a.id === id); }

export function clearAlarm(id) {
  engine.alarms = engine.alarms.filter(a => a.id !== id);
  const activeTable = alarmsDB.table('active');
  if (activeTable) activeTable.delete({ id });
}

export function shelveAlarm(id) {
  engine.alarmsShelved.add(id);
  clearAlarm(id);
  const shelvedTable = alarmsDB.table('shelved');
  if (shelvedTable) shelvedTable.insert({ id, reason: 'Operator shelved' });
}

// ═══════════════════════════════════════════════
// CONSCIOUSNESS METRICS
// ═══════════════════════════════════════════════

function updateConsciousnessMetrics(dt, t) {
  let busSum = 0, busActive = 0;
  for (let i = 0; i < 5; i++) { busSum += engine.buses[i]; if (engine.buses[i] > 0.1) busActive++; }
  const busMean = busSum / 5;
  let busVariance = 0;
  for (let i = 0; i < 5; i++) busVariance += (engine.buses[i] - busMean) ** 2;
  busVariance /= 5;
  const rawPhi = (busActive / 5) * (1 - Math.sqrt(busVariance));
  engine.phi += (rawPhi - engine.phi) * dt * 2;

  if (engine.depthStability.length > 10) {
    const recent = engine.depthStability.slice(-20);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    let variance = 0;
    for (const v of recent) variance += (v - mean) ** 2;
    variance /= recent.length;
    engine.selfModelCoherence = Math.max(0, 1 - Math.sqrt(variance));
  }

  engine.temporalContinuity = Math.min(1, engine.stateTime / 10);
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
// WORK ORDERS — persisted to workordersDB
// ═══════════════════════════════════════════════

function generateWorkOrder(energy, coherence, pitch, t) {
  const actions = ['COMPUTE', 'ATTEND', 'SEARCH', 'GENERATE', 'ALERT', 'SLEEP'];
  const action = actions[Math.floor(Math.random() * actions.length)];
  const priority = Math.max(1, Math.min(10, Math.round(energy * 8 + (1 - coherence) * 2)));
  const wo = {
    action, priority,
    valence: (energy - 0.5) * 2, arousal: energy,
    salience: energy * coherence, l4Override: priority < 8,
    timestamp: t, source: 'L3'
  };
  engine.workOrders.push(wo);
  if (engine.workOrders.length > 50) engine.workOrders.shift();
  if (!KI.voice.sounding) engine.selfGeneratedWorkOrders++;

  // Persist to DB
  const woTable = workordersDB.table('orders');
  if (woTable) woTable.insert({ action, priority, valence: wo.valence, arousal: wo.arousal, salience: wo.salience, l4_override: wo.l4Override, source: 'L3', status: 'pending', timestamp: t });

  KI.emit('ass-os:work-order', wo);
}

// ═══════════════════════════════════════════════
// NARRATIVES — persisted to narrativesDB
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
    conclusion, confidence: coherence * 0.5 + 0.3,
    evidenceBasis: engine.workOrders.length > 0,
    timestamp: t, source: engine.levels[5] > 0.3 ? 'L5' : 'L4'
  };
  engine.narratives.push(narrative);
  if (engine.narratives.length > 30) engine.narratives.shift();

  // Persist to DB
  const nTable = narrativesDB.table('entries');
  if (nTable) nTable.insert({ conclusion, confidence: narrative.confidence, evidence_basis: narrative.evidenceBasis, source: narrative.source, timestamp: t });

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

export function forceState(newState) {
  if (STATES[newState]) {
    engine.prevState = engine.state;
    engine.state = newState;
    engine.stateTime = 0;
    const sl = statelogDB.table('transitions');
    if (sl) sl.insert({ from_state: engine.prevState, to_state: newState, reason: 'Manual override', timestamp: engine.uptime });
    KI.emit('ass-os:state-change', { from: engine.prevState, to: newState, reason: 'Manual override' });
  }
}

export function injectWorkOrder(wo) {
  const full = { ...wo, timestamp: engine.uptime, source: wo.source || 'EXTERNAL' };
  engine.workOrders.push(full);
  const woTable = workordersDB.table('orders');
  if (woTable) woTable.insert({ action: wo.action, priority: wo.priority, valence: wo.valence || 0, arousal: wo.arousal || 0, salience: wo.salience || 0, l4_override: wo.l4Override !== false, source: full.source, status: 'pending', timestamp: engine.uptime });
  KI.emit('ass-os:work-order', full);
}
