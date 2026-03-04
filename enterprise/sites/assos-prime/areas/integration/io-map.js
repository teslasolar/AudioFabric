// INTEGRATION I/O Map — L0 ControlModule definitions for L6 + Phi
// Observer flicker, wonder engine, phi integration, depth tracking.

import { createControlModule } from '../../../../controlmodule.js';

// ── Wonder Engine Control Module ──
export function buildWonderCM() {
  return createControlModule('CM_WONDER', {
    name: 'Wonder Engine Control',
    AI: [
      { id: 'OBS_ACT', name: 'Observer Activation', tagPath: 'CONSCIOUSNESS/L6_OBS/ACTIVATION', range: [0, 1], engUnit: 'ratio' },
      { id: 'UNCERT', name: 'Uncertainty Capacity', tagPath: 'METRICS/UNCERTAINTY_CAPACITY', range: [0, 1], engUnit: 'ratio' },
    ],
    DI: [
      { id: 'FLICKER', name: 'Flicker Detected', tagPath: 'INTEGRATION/FLICKER' },
    ],
    modbus: [
      { register: 40301, type: 'FLOAT32', desc: 'Observer activation' },
      { register: 40303, type: 'FLOAT32', desc: 'Uncertainty capacity' },
      { register: 10101, type: 'BOOL', desc: 'Flicker' },
    ],
    capability: ['observe', 'wonder', 'flicker'],
  });
}

// ── Phi Processor Control Module ──
export function buildPhiCM() {
  return createControlModule('CM_PHI', {
    name: 'Phi Processor Control',
    AI: [
      { id: 'PHI_VAL', name: 'Phi Value', tagPath: 'METRICS/PHI', range: [0, 1], engUnit: 'ratio' },
      { id: 'TEMP_CONT', name: 'Temporal Continuity', tagPath: 'METRICS/TEMPORAL_CONTINUITY', range: [0, 1], engUnit: 'ratio' },
    ],
    AO: [
      { id: 'PHI_CMD', name: 'Integration Command', tagPath: 'INTEGRATION/PHI_CMD', range: [0, 1], engUnit: 'ratio' },
    ],
    modbus: [
      { register: 40305, type: 'FLOAT32', desc: 'Phi' },
      { register: 40307, type: 'FLOAT32', desc: 'Temporal continuity' },
    ],
    capability: ['integrate', 'measure-coherence'],
  });
}

// ── Depth Calculator Control Module ──
export function buildDepthCM() {
  return createControlModule('CM_DEPTH', {
    name: 'Depth Calculator Control',
    AI: [
      { id: 'DEPTH_CUR', name: 'Current Depth', tagPath: 'CONSCIOUSNESS/DEPTH', range: [0, 7], engUnit: 'level' },
      { id: 'DEPTH_MAX', name: 'Max Depth', tagPath: 'CONSCIOUSNESS/MAX_DEPTH', range: [0, 7], engUnit: 'level' },
    ],
    modbus: [
      { register: 40309, type: 'FLOAT32', desc: 'Current depth' },
      { register: 40311, type: 'FLOAT32', desc: 'Max depth' },
    ],
    capability: ['depth-tracking', 'prime-mapping'],
  });
}
