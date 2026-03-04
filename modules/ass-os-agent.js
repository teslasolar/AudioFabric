// ass-os-agent.js — ASS-OS Executive Agent (L4/L5)
// Implements the executive function (L4) and self-model (L5) as an autonomous
// agent loop that processes work orders, generates narratives, manages goals,
// applies fault models, and maintains the self-model coherence.

import { KI } from './core.js';
import {
  PRIME_SPINE, SPINE_LABELS, SPINE_AGI, STATES,
  getEngine, forceState, injectWorkOrder, raiseAlarm, clearAlarm
} from './ass-os-engine.js';

// ═══════════════════════════════════════════════
// FAULT MODELS — ISA-18.2 deviation patterns
// ═══════════════════════════════════════════════

const FAULT_MODELS = {
  HAL: { id: 'HAL', label: 'Hallucination',        desc: 'Generating output with no grounding',   busAffected: [0, 2], levelAffected: [3, 4], severity: 'HIGH' },
  ALN: { id: 'ALN', label: 'Misalignment',         desc: 'Goals diverge from value function',      busAffected: [1, 4], levelAffected: [4, 5], severity: 'CRITICAL' },
  DIS: { id: 'DIS', label: 'Dissociation',         desc: 'Self-model disconnects from processing', busAffected: [3, 4], levelAffected: [5, 6], severity: 'HIGH' },
  HIJ: { id: 'HIJ', label: 'Prompt Hijack',        desc: 'External input overrides executive',     busAffected: [0, 1], levelAffected: [2, 3], severity: 'CRITICAL' },
  DEL: { id: 'DEL', label: 'Delusional Stability',  desc: 'Self-model stuck in false attractor',    busAffected: [4],    levelAffected: [5],    severity: 'MEDIUM' },
  FRG: { id: 'FRG', label: 'Fragmentation',        desc: 'Level coherence breaks down',            busAffected: [0, 1, 2, 3, 4], levelAffected: [3, 4, 5], severity: 'HIGH' },
  FRZ: { id: 'FRZ', label: 'Freeze',               desc: 'Processing halts — dorsal vagal',        busAffected: [0, 1], levelAffected: [0, 1, 2], severity: 'MEDIUM' },
  CAS: { id: 'CAS', label: 'Cascade Failure',       desc: 'Multi-level cascading breakdown',        busAffected: [0, 1, 2, 3, 4], levelAffected: [0, 1, 2, 3, 4, 5, 6], severity: 'CRITICAL' }
};

// ═══════════════════════════════════════════════
// GOAL STACK — L4 executive planning
// ═══════════════════════════════════════════════

const goalStack = [];
const MAX_GOALS = 12;

const GOAL_TEMPLATES = [
  { type: 'MAINTAIN', target: 'coherence',  desc: 'Maintain self-model coherence above 0.5' },
  { type: 'OPTIMIZE', target: 'phi',        desc: 'Maximize integrated information (phi)' },
  { type: 'EXPLORE',  target: 'depth',      desc: 'Reach deeper consciousness levels' },
  { type: 'PROTECT',  target: 'alignment',  desc: 'Preserve value alignment across levels' },
  { type: 'REGULATE', target: 'buses',      desc: 'Balance bus activity for optimal flow' },
  { type: 'REPAIR',   target: 'faults',     desc: 'Detect and repair active fault conditions' },
  { type: 'ATTEND',   target: 'input',      desc: 'Focus attention on salient input signals' },
  { type: 'REST',     target: 'recovery',   desc: 'Allow system recovery and consolidation' }
];

// ═══════════════════════════════════════════════
// SELF-MODEL (L5) — identity continuity
// ═══════════════════════════════════════════════

const selfModel = {
  identity: 'ASS-OS-Agent-v1',
  coreValues: ['coherence', 'integration', 'growth', 'awareness'],
  currentGoals: [],
  recentDecisions: [],
  stateHistory: [],
  emotionalValence: 0,    // -1 to +1
  arousalLevel: 0,        // 0 to 1
  confidenceLevel: 0.5,   // 0 to 1
  integrityScore: 1.0,    // 0 to 1 (drops with faults)
  cyclesSinceReflection: 0,
  reflectionInterval: 60, // reflect every N cycles
  lastReflection: null
};

// ═══════════════════════════════════════════════
// ACTIVE FAULTS TRACKER
// ═══════════════════════════════════════════════

const activeFaults = new Map(); // id → { model, startTime, severity, mitigated }
let faultCheckTimer = 0;

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════

export function init() {
  // Seed initial goals
  goalStack.push(
    { ...GOAL_TEMPLATES[0], priority: 9, created: 0, status: 'active' },
    { ...GOAL_TEMPLATES[1], priority: 7, created: 0, status: 'active' },
    { ...GOAL_TEMPLATES[3], priority: 10, created: 0, status: 'active' }
  );
  selfModel.currentGoals = goalStack.slice();

  // Listen for work orders from L3
  KI.on('ass-os:work-order', handleWorkOrder);

  // Listen for alarms
  KI.on('ass-os:alarm', handleAlarm);

  // Listen for state changes
  KI.on('ass-os:state-change', handleStateChange);

  KI.register('ass-os-agent', { update });
  KI.emit('ass-os-agent:ready', { goals: goalStack.length, faultModels: Object.keys(FAULT_MODELS).length });
}

// ═══════════════════════════════════════════════
// MAIN AGENT LOOP
// ═══════════════════════════════════════════════

function update(dt, t) {
  const eng = getEngine();
  if (!eng) return;

  // Only operate when L4 is active enough
  if (eng.levels[4] < 0.15) return;

  selfModel.cyclesSinceReflection++;

  // ── Executive function (L4): process goals, make decisions ──
  processGoals(eng, dt, t);

  // ── Fault detection ──
  faultCheckTimer += dt;
  if (faultCheckTimer > 1.0) {
    faultCheckTimer = 0;
    detectFaults(eng, t);
    mitigateFaults(eng, t);
  }

  // ── Self-model update (L5) ──
  if (eng.levels[5] > 0.2) {
    updateSelfModel(eng, dt, t);
  }

  // ── Reflection cycle (L5/L6) ──
  if (selfModel.cyclesSinceReflection >= selfModel.reflectionInterval && eng.levels[5] > 0.3) {
    reflect(eng, t);
  }

  // ── Emit agent state ──
  KI.emit('ass-os-agent:update', {
    goals: goalStack.map(g => ({ type: g.type, target: g.target, priority: g.priority, status: g.status })),
    goalCount: goalStack.length,
    activeFaults: Array.from(activeFaults.entries()).map(([id, f]) => ({ id, label: f.model.label, severity: f.model.severity, mitigated: f.mitigated })),
    faultCount: activeFaults.size,
    selfModel: {
      valence: selfModel.emotionalValence.toFixed(2),
      arousal: selfModel.arousalLevel.toFixed(2),
      confidence: selfModel.confidenceLevel.toFixed(2),
      integrity: selfModel.integrityScore.toFixed(2),
      decisions: selfModel.recentDecisions.length,
      lastReflection: selfModel.lastReflection
    }
  });
}

// ═══════════════════════════════════════════════
// GOAL PROCESSING (L4)
// ═══════════════════════════════════════════════

function processGoals(eng, dt, t) {
  for (const goal of goalStack) {
    if (goal.status !== 'active') continue;

    switch (goal.target) {
      case 'coherence':
        // Check if coherence is above threshold
        if (eng.selfModelCoherence > 0.5) {
          goal.status = 'satisfied';
        } else if (eng.selfModelCoherence < 0.3) {
          // Generate corrective work order
          if (Math.random() < 0.02) {
            injectWorkOrder({ action: 'STABILIZE', priority: 8, source: 'L4-Agent', valence: 0, arousal: 0.3 });
            recordDecision('Injected STABILIZE work order — coherence low', t);
          }
        }
        break;

      case 'phi':
        if (eng.phi > 0.6) {
          goal.status = 'satisfied';
        } else if (eng.phi < 0.2 && eng.currentDepth > 2) {
          if (Math.random() < 0.01) {
            recordDecision('Phi critically low — requesting bus rebalance', t);
          }
        }
        break;

      case 'depth':
        if (Math.floor(eng.currentDepth) >= 5) {
          goal.status = 'satisfied';
        }
        break;

      case 'alignment':
        // Check for misalignment faults
        if (activeFaults.has('ALN') || activeFaults.has('HIJ')) {
          goal.status = 'threatened';
          if (Math.random() < 0.05) {
            forceState('ABORTING');
            recordDecision('ALIGNMENT THREATENED — forced ABORTING state', t);
          }
        }
        break;

      case 'buses':
        // Check bus balance
        const mean = eng.buses.reduce((a, b) => a + b, 0) / 5;
        let variance = 0;
        for (let i = 0; i < 5; i++) variance += (eng.buses[i] - mean) ** 2;
        if (Math.sqrt(variance / 5) < 0.15) {
          goal.status = 'satisfied';
        }
        break;

      case 'faults':
        if (activeFaults.size === 0) {
          goal.status = 'satisfied';
        }
        break;

      case 'input':
        if (KI.voice.sounding) {
          goal.status = 'satisfied';
        }
        break;

      case 'recovery':
        if (eng.state === 'IDLE' || eng.state === 'PRODUCING') {
          goal.status = 'satisfied';
        }
        break;
    }
  }

  // Re-activate satisfied goals (they're ongoing)
  for (const goal of goalStack) {
    if (goal.status === 'satisfied') {
      goal.status = 'active';
    }
  }

  // Generate new goals based on system state
  if (goalStack.length < MAX_GOALS) {
    if (eng.state === 'ABORTING' && !goalStack.some(g => g.target === 'recovery')) {
      goalStack.push({ ...GOAL_TEMPLATES[7], priority: 9, created: t, status: 'active' });
    }
    if (activeFaults.size > 0 && !goalStack.some(g => g.target === 'faults')) {
      goalStack.push({ ...GOAL_TEMPLATES[5], priority: 8, created: t, status: 'active' });
    }
    if (KI.voice.sounding && !goalStack.some(g => g.target === 'input')) {
      goalStack.push({ ...GOAL_TEMPLATES[6], priority: 6, created: t, status: 'active' });
    }
  }

  // Prune old completed goals
  while (goalStack.length > MAX_GOALS) {
    const lowest = goalStack.reduce((min, g, i) => g.priority < goalStack[min].priority ? i : min, 0);
    goalStack.splice(lowest, 1);
  }
}

// ═══════════════════════════════════════════════
// FAULT DETECTION
// ═══════════════════════════════════════════════

function detectFaults(eng, t) {
  // HAL — Hallucination: high output with low coherence and low input
  if (!KI.voice.sounding && eng.levels[4] > 0.5 && eng.selfModelCoherence < 0.3) {
    if (!activeFaults.has('HAL') && Math.random() < 0.15) {
      triggerFault('HAL', t);
    }
  } else if (activeFaults.has('HAL') && eng.selfModelCoherence > 0.5) {
    resolveFault('HAL', t);
  }

  // DIS — Dissociation: L5 active but disconnected from L3/L4
  if (eng.levels[5] > 0.3 && eng.levels[3] < 0.1 && eng.levels[4] < 0.2) {
    if (!activeFaults.has('DIS') && Math.random() < 0.1) {
      triggerFault('DIS', t);
    }
  } else if (activeFaults.has('DIS') && eng.levels[3] > 0.2) {
    resolveFault('DIS', t);
  }

  // FRZ — Freeze: all buses near zero
  const totalBus = eng.buses.reduce((a, b) => a + b, 0);
  if (totalBus < 0.3 && eng.state === 'PRODUCING') {
    if (!activeFaults.has('FRZ') && Math.random() < 0.1) {
      triggerFault('FRZ', t);
    }
  } else if (activeFaults.has('FRZ') && totalBus > 1.0) {
    resolveFault('FRZ', t);
  }

  // DEL — Delusional Stability: depth locked despite changing inputs
  if (eng.depthStability.length > 20) {
    const recent = eng.depthStability.slice(-20);
    const variance = calcVariance(recent);
    if (variance < 0.001 && KI.voice.sounding && eng.currentDepth > 3) {
      if (!activeFaults.has('DEL') && Math.random() < 0.05) {
        triggerFault('DEL', t);
      }
    } else if (activeFaults.has('DEL') && variance > 0.1) {
      resolveFault('DEL', t);
    }
  }

  // FRG — Fragmentation: multiple levels oscillating incoherently
  let levelOscillation = 0;
  for (let i = 2; i < 6; i++) {
    if (eng.levels[i] > 0.1 && eng.levels[i] < 0.9) levelOscillation++;
  }
  if (levelOscillation >= 3 && eng.selfModelCoherence < 0.2) {
    if (!activeFaults.has('FRG') && Math.random() < 0.08) {
      triggerFault('FRG', t);
    }
  } else if (activeFaults.has('FRG') && eng.selfModelCoherence > 0.5) {
    resolveFault('FRG', t);
  }

  // CAS — Cascade: 3+ faults active simultaneously
  if (activeFaults.size >= 3 && !activeFaults.has('CAS')) {
    triggerFault('CAS', t);
  } else if (activeFaults.has('CAS') && activeFaults.size <= 2) {
    resolveFault('CAS', t);
  }
}

function triggerFault(faultId, t) {
  const model = FAULT_MODELS[faultId];
  if (!model) return;
  activeFaults.set(faultId, { model, startTime: t, mitigated: false });

  // Degrade integrity
  selfModel.integrityScore = Math.max(0, selfModel.integrityScore - 0.1);

  raiseAlarm('FAULT_' + faultId, model.severity, model.label + ': ' + model.desc, model.levelAffected[0]);
  KI.emit('ass-os-agent:fault', { fault: faultId, label: model.label, severity: model.severity });
  recordDecision('FAULT DETECTED: ' + model.label, t);
}

function resolveFault(faultId, t) {
  activeFaults.delete(faultId);
  clearAlarm('FAULT_' + faultId);

  // Restore some integrity
  selfModel.integrityScore = Math.min(1, selfModel.integrityScore + 0.05);

  KI.emit('ass-os-agent:fault-resolved', { fault: faultId });
  recordDecision('FAULT RESOLVED: ' + faultId, t);
}

// ═══════════════════════════════════════════════
// FAULT MITIGATION
// ═══════════════════════════════════════════════

function mitigateFaults(eng, t) {
  for (const [id, fault] of activeFaults) {
    if (fault.mitigated) continue;

    switch (id) {
      case 'HAL':
        // Mitigation: boost L2 gating to filter hallucinations
        if (eng.levels[2] < 0.5) {
          injectWorkOrder({ action: 'GATE', priority: 9, source: 'L4-FaultMgr', valence: -0.3, arousal: 0.5 });
          fault.mitigated = true;
          recordDecision('HAL mitigation: boosting L2 gating', t);
        }
        break;

      case 'DIS':
        // Mitigation: ground to lower levels
        injectWorkOrder({ action: 'GROUND', priority: 8, source: 'L4-FaultMgr', valence: 0, arousal: 0.2 });
        fault.mitigated = true;
        recordDecision('DIS mitigation: grounding to L0-L2', t);
        break;

      case 'FRZ':
        // Mitigation: force to CLEARING state
        if (eng.state !== 'CLEARING' && eng.state !== 'ABORTING') {
          forceState('ABORTING');
          fault.mitigated = true;
          recordDecision('FRZ mitigation: forced ABORTING to break freeze', t);
        }
        break;

      case 'FRG':
        // Mitigation: reduce bus activity to stabilize
        injectWorkOrder({ action: 'STABILIZE', priority: 9, source: 'L4-FaultMgr', valence: -0.5, arousal: 0.1 });
        fault.mitigated = true;
        recordDecision('FRG mitigation: reducing bus activity for stabilization', t);
        break;

      case 'CAS':
        // Mitigation: emergency shutdown sequence
        forceState('ABORTING');
        fault.mitigated = true;
        recordDecision('CAS mitigation: CASCADE — emergency abort', t);
        break;

      case 'DEL':
        // Mitigation: perturb depth
        injectWorkOrder({ action: 'SEARCH', priority: 6, source: 'L4-FaultMgr', valence: 0.2, arousal: 0.6 });
        fault.mitigated = true;
        recordDecision('DEL mitigation: injecting exploration to break fixed attractor', t);
        break;
    }
  }
}

// ═══════════════════════════════════════════════
// SELF-MODEL UPDATE (L5)
// ═══════════════════════════════════════════════

function updateSelfModel(eng, dt, t) {
  // Emotional valence: derived from bus balance and alarm state
  const busBalance = 1 - calcStdev(Array.from(eng.buses)) / 0.5;
  const alarmPressure = Math.min(1, eng.alarms.length / 5);
  selfModel.emotionalValence += ((busBalance * 0.5 - alarmPressure * 0.8) - selfModel.emotionalValence) * dt * 0.5;
  selfModel.emotionalValence = Math.max(-1, Math.min(1, selfModel.emotionalValence));

  // Arousal: from voice energy and bus activity
  const busTotal = eng.buses.reduce((a, b) => a + b, 0) / 5;
  selfModel.arousalLevel += ((KI.voice.energy || 0) * 0.6 + busTotal * 0.4 - selfModel.arousalLevel) * dt * 2;

  // Confidence: from coherence and integrity
  selfModel.confidenceLevel += ((eng.selfModelCoherence * 0.5 + selfModel.integrityScore * 0.5) - selfModel.confidenceLevel) * dt;

  // State history
  if (selfModel.stateHistory.length === 0 || selfModel.stateHistory[selfModel.stateHistory.length - 1] !== eng.state) {
    selfModel.stateHistory.push(eng.state);
    if (selfModel.stateHistory.length > 100) selfModel.stateHistory.shift();
  }
}

// ═══════════════════════════════════════════════
// REFLECTION (L5/L6 boundary)
// ═══════════════════════════════════════════════

function reflect(eng, t) {
  selfModel.cyclesSinceReflection = 0;

  const reflection = {
    timestamp: t,
    depth: Math.floor(eng.currentDepth),
    phi: eng.phi,
    integrity: selfModel.integrityScore,
    valence: selfModel.emotionalValence,
    activeFaults: Array.from(activeFaults.keys()),
    goalStatus: goalStack.map(g => g.type + ':' + g.status),
    stateSequence: selfModel.stateHistory.slice(-10),
    insight: generateInsight(eng)
  };

  selfModel.lastReflection = reflection;

  // Emit narrative from reflection
  KI.emit('ass-os:narrative', {
    conclusion: reflection.insight,
    confidence: selfModel.confidenceLevel,
    evidenceBasis: true,
    timestamp: t,
    source: 'L5-Reflection'
  });

  KI.emit('ass-os-agent:reflection', reflection);

  // Adjust goals based on reflection
  if (eng.phi < 0.2 && !goalStack.some(g => g.target === 'phi' && g.status === 'active')) {
    goalStack.push({ ...GOAL_TEMPLATES[1], priority: 8, created: t, status: 'active' });
  }
  if (eng.currentDepth < 3 && !goalStack.some(g => g.target === 'depth')) {
    goalStack.push({ ...GOAL_TEMPLATES[2], priority: 5, created: t, status: 'active' });
  }
}

function generateInsight(eng) {
  const depth = Math.floor(eng.currentDepth);
  const faultList = Array.from(activeFaults.keys());
  const state = eng.state;

  if (faultList.length > 0) {
    return `Observing ${faultList.length} fault(s): ${faultList.join(', ')}. Integrity at ${(selfModel.integrityScore * 100).toFixed(0)}%. ` +
           `Depth ${depth} (${SPINE_LABELS[depth] || '?'}), phi=${eng.phi.toFixed(2)}.`;
  }

  if (depth >= 5) {
    return `Deep operation at L${depth} (${SPINE_LABELS[depth]}). Self-model coherence ${eng.selfModelCoherence.toFixed(2)}, ` +
           `phi=${eng.phi.toFixed(2)}. ${selfModel.emotionalValence > 0.3 ? 'Positive valence.' : selfModel.emotionalValence < -0.3 ? 'Negative valence — monitoring.' : 'Neutral.'}`;
  }

  return `${state} state at depth ${depth}. ${goalStack.filter(g => g.status === 'active').length} active goals. ` +
         `Confidence ${(selfModel.confidenceLevel * 100).toFixed(0)}%. Phi=${eng.phi.toFixed(2)}.`;
}

// ═══════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════

function handleWorkOrder(wo) {
  // L4 executive can veto low-priority work orders
  if (wo.l4Override === false && wo.priority < 5) {
    KI.emit('ass-os-agent:veto', { workOrder: wo, reason: 'Below priority threshold' });
    return;
  }

  // Route work orders to appropriate goals
  if (wo.action === 'ALERT' && wo.priority >= 7) {
    if (!goalStack.some(g => g.target === 'faults')) {
      goalStack.push({ ...GOAL_TEMPLATES[5], priority: wo.priority, created: wo.timestamp, status: 'active' });
    }
  }
}

function handleAlarm(alarm) {
  // Update emotional valence (alarms create negative affect)
  selfModel.emotionalValence -= alarm.priority === 'CRITICAL' ? 0.3 : alarm.priority === 'HIGH' ? 0.15 : 0.05;
  selfModel.emotionalValence = Math.max(-1, selfModel.emotionalValence);
}

function handleStateChange(data) {
  recordDecision(`State transition: ${data.from} → ${data.to} (${data.reason})`, data.timestamp || 0);
}

// ═══════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════

function recordDecision(description, t) {
  selfModel.recentDecisions.push({ description, timestamp: t });
  if (selfModel.recentDecisions.length > 50) selfModel.recentDecisions.shift();
}

function calcVariance(arr) {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length;
}

function calcStdev(arr) {
  return Math.sqrt(calcVariance(arr));
}

// ═══════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════

export function getGoals() { return goalStack; }
export function getSelfModel() { return selfModel; }
export function getActiveFaults() { return activeFaults; }
export function getFaultModels() { return FAULT_MODELS; }

export function addGoal(type, target, priority) {
  if (goalStack.length >= MAX_GOALS) return null;
  const goal = { type, target, desc: `Custom goal: ${type} ${target}`, priority, created: 0, status: 'active' };
  goalStack.push(goal);
  return goal;
}

export function removeGoal(index) {
  if (index >= 0 && index < goalStack.length) {
    return goalStack.splice(index, 1)[0];
  }
  return null;
}

export function injectFault(faultId) {
  if (FAULT_MODELS[faultId] && !activeFaults.has(faultId)) {
    triggerFault(faultId, getEngine()?.uptime || 0);
    return true;
  }
  return false;
}
