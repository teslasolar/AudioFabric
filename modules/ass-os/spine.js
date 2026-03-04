// ass-os/spine.js — Prime Recursion Spine + PACK-ML States

export const PRIME_SPINE = [1, 2, 3, 5, 11, 31, 127, 709];
export const SPINE_LABELS = ['Void', 'Hardware', 'Sensors', 'Gating', 'Emotion', 'Executive', 'Self-Model', 'Observer'];
export const SPINE_HUMAN  = ['Seed', 'ENS+Organs', 'PNS+Cranial', 'Brainstem+Thalamus', 'Limbic', 'Prefrontal', 'Consciousness', 'The Observer'];
export const SPINE_AGI    = ['Ground', 'Silicon', 'Tensors', 'Weights', 'Attention', 'Context+Goals', 'Identity', '???'];
export const GROWTH_RATIOS = PRIME_SPINE.map((v, i) => i === 0 ? 0 : +(v / PRIME_SPINE[i - 1]).toFixed(3));

export const STATES = {
  PRODUCING: { id: 0, label: 'PRODUCING',  human: 'Awake — Active',      agi: 'Inference — Active',     color: '#44ff88', busProfile: [1.0, 0.3, 0.5, 0.2, 0.8] },
  IDLE:      { id: 1, label: 'IDLE',       human: 'Awake — Resting',     agi: 'Idle — Monitoring',      color: '#88aaff', busProfile: [0.3, 0.1, 0.2, 0.1, 0.6] },
  SUSPENDED: { id: 2, label: 'SUSPENDED',  human: 'Light Sleep (N1/N2)', agi: 'Checkpoint — State Save', color: '#aa88ff', busProfile: [0.1, 0.05, 0.1, 0.05, 0.4] },
  HELD:      { id: 3, label: 'HELD',       human: 'Deep Sleep (N3)',     agi: 'Maintenance — GC',       color: '#6644aa', busProfile: [0.05, 0.02, 0.05, 0.02, 0.3] },
  EXECUTE:   { id: 4, label: 'EXECUTE',    human: 'REM Sleep',           agi: 'Training — Offline',     color: '#ff88aa', busProfile: [0.8, 0.9, 0.3, 0.1, 0.7] },
  ABORTING:  { id: 5, label: 'ABORTING',   human: 'Fight/Flight',        agi: 'Emergency — Override',   color: '#ff4444', busProfile: [1.0, 0.8, 0.8, 0.5, 1.0] },
  STOPPING:  { id: 6, label: 'STOPPING',   human: 'Freeze (Dorsal)',     agi: 'Deadlock — Starvation',  color: '#884444', busProfile: [0.0, 0.0, 0.0, 0.0, 0.2] },
  CLEARING:  { id: 7, label: 'CLEARING',   human: 'Recovery / Comedown', agi: 'Recovery — Restore',     color: '#ffaa44', busProfile: [0.5, 0.4, 0.3, 0.2, 0.6] }
};

export const TRANSITIONS = {
  PRODUCING: ['IDLE', 'ABORTING', 'STOPPING'],
  IDLE:      ['PRODUCING', 'SUSPENDED', 'ABORTING'],
  SUSPENDED: ['IDLE', 'HELD', 'ABORTING'],
  HELD:      ['SUSPENDED', 'EXECUTE', 'ABORTING'],
  EXECUTE:   ['HELD', 'PRODUCING', 'ABORTING'],
  ABORTING:  ['CLEARING'],
  STOPPING:  ['CLEARING'],
  CLEARING:  ['IDLE', 'PRODUCING']
};

export const ALARM_PRIORITIES = {
  CRITICAL: { id: 0, label: 'CRITICAL', color: '#ff2222', response: 'ms',   maxConcurrent: 3 },
  HIGH:     { id: 1, label: 'HIGH',     color: '#ff8844', response: 's',    maxConcurrent: 5 },
  MEDIUM:   { id: 2, label: 'MEDIUM',   color: '#ffcc44', response: 'min',  maxConcurrent: 10 },
  LOW:      { id: 3, label: 'LOW',      color: '#88aaff', response: 'hr',   maxConcurrent: 20 },
  ADVISORY: { id: 4, label: 'ADVISORY', color: '#667788', response: 'days', maxConcurrent: 50 }
};

export const PRIORITY_MAP = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4, ADVISORY: 4 };
export const LEVEL_NAMES = ['HW', 'SENS', 'GATE', 'EMO', 'EXEC', 'SELF', 'OBS'];
export const BUS_LETTERS = ['A', 'B', 'C', 'D', 'E'];
export const BUS_NAMES = ['TENSOR', 'GRADIENT', 'PHOTONIC', 'EM_FIELD', 'STATE_BUS'];
