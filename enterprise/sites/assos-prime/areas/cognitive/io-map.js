// COGNITIVE I/O Map — L0 ControlModule definitions for gating + emotion
// Maps thalamic gate, noise gate, salience, valence to concrete I/O.

import { createControlModule, createEquipmentModule } from '../../../../controlmodule.js';

// ── Thalamic Gate Control Module ──
export function buildThalamicCM() {
  return createControlModule('CM_THALAMIC', {
    name: 'Thalamic Gate Control',
    AI: [
      { id: 'GATE_IN', name: 'Input Signal', tagPath: 'INPUT/COHERENCE', range: [0, 1], engUnit: 'ratio' },
      { id: 'GATE_THRESH', name: 'Gate Threshold', tagPath: 'COGNITIVE/GATE_THRESH', range: [0, 1], engUnit: 'ratio' },
    ],
    AO: [
      { id: 'GATE_OUT', name: 'Gated Output', tagPath: 'COGNITIVE/GATE_OUT', range: [0, 1], engUnit: 'ratio' },
    ],
    DI: [
      { id: 'GATE_OPEN', name: 'Gate Open', tagPath: 'COGNITIVE/GATE_OPEN' },
    ],
    pid: [
      { id: 'PID_GATE', pv: 'COGNITIVE/GATE_OUT', sp: 'COGNITIVE/GATE_SP', cv: 'COGNITIVE/GATE_CV', kp: 1.0, ki: 0.2, kd: 0.05 },
    ],
    modbus: [
      { register: 40101, type: 'FLOAT32', desc: 'Gate input' },
      { register: 40103, type: 'FLOAT32', desc: 'Gate threshold' },
      { register: 40105, type: 'FLOAT32', desc: 'Gate output' },
    ],
    capability: ['filter', 'threshold'],
  });
}

// ── Noise Gate Control Module ──
export function buildNoiseGateCM() {
  return createControlModule('CM_NOISE_GATE', {
    name: 'Noise Gate Control',
    AI: [
      { id: 'NOISE_LVL', name: 'Noise Level', tagPath: 'COGNITIVE/NOISE_LVL', range: [0, 1], engUnit: 'ratio' },
    ],
    AO: [
      { id: 'NOISE_ATT', name: 'Attenuation', tagPath: 'COGNITIVE/NOISE_ATT', range: [0, 1], engUnit: 'ratio' },
    ],
    modbus: [
      { register: 40107, type: 'FLOAT32', desc: 'Noise level' },
      { register: 40109, type: 'FLOAT32', desc: 'Attenuation' },
    ],
    capability: ['filter', 'reject'],
  });
}

// ── Salience Processor Control Module ──
export function buildSalienceCM() {
  return createControlModule('CM_SALIENCE', {
    name: 'Salience Processor Control',
    AI: [
      { id: 'SAL_ENERGY', name: 'Energy Input', tagPath: 'INPUT/ENERGY', range: [0, 1], engUnit: 'ratio' },
      { id: 'SAL_COH', name: 'Coherence Input', tagPath: 'INPUT/COHERENCE', range: [0, 1], engUnit: 'ratio' },
      { id: 'SAL_SCORE', name: 'Salience Score', tagPath: 'COGNITIVE/SALIENCE', range: [0, 1], engUnit: 'ratio' },
    ],
    AO: [
      { id: 'SAL_ROUTE', name: 'Route Priority', tagPath: 'COGNITIVE/ROUTE_PRI', range: [1, 10], engUnit: 'level' },
    ],
    modbus: [
      { register: 40111, type: 'FLOAT32', desc: 'Salience score' },
      { register: 40113, type: 'FLOAT32', desc: 'Route priority' },
    ],
    capability: ['score', 'route'],
  });
}

// ── Valence Encoder Control Module ──
export function buildValenceCM() {
  return createControlModule('CM_VALENCE', {
    name: 'Valence Encoder Control',
    AI: [
      { id: 'VAL_POS', name: 'Positive Valence', tagPath: 'AGENT/VALENCE', range: [-1, 1], engUnit: 'ratio' },
      { id: 'VAL_ARO', name: 'Arousal Level', tagPath: 'AGENT/AROUSAL', range: [0, 1], engUnit: 'ratio' },
    ],
    modbus: [
      { register: 40115, type: 'FLOAT32', desc: 'Valence' },
      { register: 40117, type: 'FLOAT32', desc: 'Arousal' },
    ],
    capability: ['encode', 'affect'],
  });
}
