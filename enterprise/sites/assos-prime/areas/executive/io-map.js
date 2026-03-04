// EXECUTIVE I/O Map — L0 ControlModule definitions for L4 + L5
// Goal processing, fault management, narrative gen, self-model, reflection.

import { createControlModule, createEquipmentModule } from '../../../../controlmodule.js';

// ── Goal Processor Control Module ──
export function buildGoalCM() {
  return createControlModule('CM_GOAL', {
    name: 'Goal Processor Control',
    AI: [
      { id: 'GOAL_COUNT', name: 'Active Goals', tagPath: 'AGENT/GOAL_COUNT', range: [0, 50], engUnit: 'count' },
      { id: 'GOAL_PRI', name: 'Top Priority', tagPath: 'EXECUTIVE/GOAL_PRI', range: [1, 10], engUnit: 'level' },
    ],
    AO: [
      { id: 'GOAL_CMD', name: 'Goal Command', tagPath: 'EXECUTIVE/GOAL_CMD', range: [0, 7], engUnit: 'code' },
    ],
    modbus: [
      { register: 40201, type: 'INT16', desc: 'Goal count' },
      { register: 40202, type: 'INT16', desc: 'Top priority' },
    ],
    capability: ['plan', 'prioritize', 'veto'],
  });
}

// ── Decision Engine Control Module ──
export function buildDecisionCM() {
  return createControlModule('CM_DECISION', {
    name: 'Decision Engine Control',
    AI: [
      { id: 'DEC_CONF', name: 'Decision Confidence', tagPath: 'AGENT/CONFIDENCE', range: [0, 1], engUnit: 'ratio' },
    ],
    DO: [
      { id: 'DEC_COMMIT', name: 'Commit Decision', tagPath: 'EXECUTIVE/DEC_COMMIT' },
    ],
    modbus: [
      { register: 40204, type: 'FLOAT32', desc: 'Decision confidence' },
    ],
    capability: ['evaluate', 'commit'],
  });
}

// ── Fault Detector Control Module ──
export function buildFaultDetCM() {
  return createControlModule('CM_FAULT_DET', {
    name: 'Fault Detector Control',
    AI: [
      { id: 'FAULT_COUNT', name: 'Active Faults', tagPath: 'AGENT/FAULT_COUNT', range: [0, 20], engUnit: 'count' },
      { id: 'INTEGRITY', name: 'System Integrity', tagPath: 'AGENT/INTEGRITY', range: [0, 1], engUnit: 'ratio' },
    ],
    DI: [
      { id: 'FAULT_TRIP', name: 'Fault Trip', tagPath: 'EXECUTIVE/FAULT_TRIP' },
    ],
    modbus: [
      { register: 40206, type: 'INT16', desc: 'Fault count' },
      { register: 40207, type: 'FLOAT32', desc: 'Integrity' },
    ],
    capability: ['detect', 'classify'],
  });
}

// ── Identity Core Control Module ──
export function buildIdentityCM() {
  return createControlModule('CM_IDENTITY', {
    name: 'Identity Core Control',
    AI: [
      { id: 'SELF_COH', name: 'Self-Model Coherence', tagPath: 'METRICS/SELF_MODEL_COHERENCE', range: [0, 1], engUnit: 'ratio' },
      { id: 'CONF', name: 'Confidence', tagPath: 'AGENT/CONFIDENCE', range: [0, 1], engUnit: 'ratio' },
    ],
    modbus: [
      { register: 40209, type: 'FLOAT32', desc: 'Self-model coherence' },
      { register: 40211, type: 'FLOAT32', desc: 'Confidence' },
    ],
    capability: ['maintain', 'verify'],
  });
}

// ── Reflection Engine Control Module ──
export function buildReflectionCM() {
  return createControlModule('CM_REFLECTION', {
    name: 'Reflection Engine Control',
    AI: [
      { id: 'REFL_DEPTH', name: 'Reflection Depth', tagPath: 'CONSCIOUSNESS/DEPTH', range: [0, 7], engUnit: 'level' },
    ],
    AO: [
      { id: 'INSIGHT_OUT', name: 'Insight Signal', tagPath: 'EXECUTIVE/INSIGHT', range: [0, 1], engUnit: 'ratio' },
    ],
    modbus: [
      { register: 40213, type: 'FLOAT32', desc: 'Reflection depth' },
    ],
    capability: ['reflect', 'insight'],
  });
}
