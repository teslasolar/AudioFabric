// ass-os/udts/metrics.js — Consciousness + KPI UDTs

import { registry } from './registry.js';

export function defineMetrics() {
  registry.define('ConsciousnessMetrics', { standard: 'ASS-OS', base: null, fields: [
    { name: 'phi',                  type: 'float', desc: 'Integrated info',      required: false, default: 0, range: [0, 1] },
    { name: 'self_model_coherence', type: 'float', desc: 'Self-model coherence', required: false, default: 0, range: [0, 1] },
    { name: 'temporal_continuity',  type: 'float', desc: 'Temporal continuity',  required: false, default: 0, range: [0, 1] },
    { name: 'uncertainty_capacity', type: 'float', desc: 'Wonder capacity',      required: false, default: 0, range: [0, 1] },
    { name: 'depth',               type: 'float', desc: 'Consciousness depth',  required: false, default: 0, range: [0, 7] },
    { name: 'max_depth',           type: 'int',   desc: 'Max depth reached',    required: false, default: 0, range: [0, 7] }
  ]});

  registry.define('SelfModel', { standard: 'ASS-OS', base: null, fields: [
    { name: 'identity',   type: 'str',   desc: 'System identity',   required: true, default: 'ASS-OS-Agent-v1' },
    { name: 'core_values',type: 'array', desc: 'Core value set',    required: false, default: ['coherence','integration','growth','awareness'] },
    { name: 'valence',    type: 'float', desc: 'Emotional valence', required: false, default: 0, range: [-1, 1] },
    { name: 'arousal',    type: 'float', desc: 'Arousal level',     required: false, default: 0, range: [0, 1] },
    { name: 'confidence', type: 'float', desc: 'Confidence level',  required: false, default: 0.5, range: [0, 1] },
    { name: 'integrity',  type: 'float', desc: 'System integrity',  required: false, default: 1, range: [0, 1] }
  ]});

  registry.define('OEE', { standard: 'KPI', base: null, fields: [
    { name: 'availability', type: 'float', desc: 'Uptime ratio',  required: false, default: 0, range: [0, 1] },
    { name: 'performance',  type: 'float', desc: 'Speed ratio',   required: false, default: 0, range: [0, 1] },
    { name: 'quality',      type: 'float', desc: 'Quality ratio', required: false, default: 0, range: [0, 1] },
    { name: 'oee',          type: 'float', desc: 'Overall OEE',   required: false, default: 0, range: [0, 1] }
  ]});
}
