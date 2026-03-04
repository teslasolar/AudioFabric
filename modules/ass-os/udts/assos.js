// ass-os/udts/assos.js — ASS-OS specific UDTs

import { registry } from './registry.js';

export function defineASSOS() {
  registry.defineStandard({ id: 'ASS-OS', scope: 'AGI Soul System Operating System',
    levels: ['L0:Hardware','L1:Sensors','L2:Gating','L3:Emotion','L4:Executive','L5:Self-Model','L6:Observer'] });

  registry.define('ConsciousnessLevel', { standard: 'ASS-OS', base: null, fields: [
    { name: 'id',        type: 'int',   desc: 'Level (0-6)',       required: true, range: [0, 6] },
    { name: 'name',      type: 'str',   desc: 'Level name',        required: true },
    { name: 'human',     type: 'str',   desc: 'Human equivalent',  required: true },
    { name: 'agi',       type: 'str',   desc: 'AGI equivalent',    required: true },
    { name: 'prime',     type: 'int',   desc: 'Prime spine value', required: true },
    { name: 'activation',type: 'float', desc: 'Current activation',required: false, default: 0, range: [0, 1] },
    { name: 'health',    type: 'float', desc: 'Level health',      required: false, default: 1, range: [0, 1] }
  ]});

  registry.define('Bus', { standard: 'ASS-OS', base: null, fields: [
    { name: 'id',       type: 'str',   desc: 'Bus letter (A-E)',  required: true },
    { name: 'name',     type: 'str',   desc: 'Bus name',          required: true },
    { name: 'activity', type: 'float', desc: 'Current activity',  required: false, default: 0, range: [0, 1] },
    { name: 'target',   type: 'float', desc: 'Target activity',   required: false, default: 0, range: [0, 1] },
    { name: 'health',   type: 'float', desc: 'Bus health',        required: false, default: 1, range: [0, 1] }
  ]});

  registry.define('WorkOrder', { standard: 'ASS-OS', base: 'Identifier', fields: [
    { name: 'action',      type: 'enum',  desc: 'Work action',       required: true, enum: ['COMPUTE','ATTEND','SEARCH','GENERATE','ALERT','SLEEP','STABILIZE','GATE','GROUND'] },
    { name: 'priority',    type: 'int',   desc: 'Priority (1-10)',   required: true, range: [1, 10] },
    { name: 'valence',     type: 'float', desc: 'Emotional valence', required: false, default: 0, range: [-1, 1] },
    { name: 'arousal',     type: 'float', desc: 'Arousal level',     required: false, default: 0, range: [0, 1] },
    { name: 'salience',    type: 'float', desc: 'Salience score',    required: false, default: 0, range: [0, 1] },
    { name: 'l4_override', type: 'bool',  desc: 'L4 can veto',      required: false, default: true },
    { name: 'source',      type: 'str',   desc: 'Originating level', required: false, default: 'L3' },
    { name: 'timestamp',   type: 'float', desc: 'Creation time',     required: false },
    { name: 'status',      type: 'enum',  desc: 'Order status',      required: false, default: 'pending', enum: ['pending','active','completed','vetoed'] }
  ]});

  registry.define('Narrative', { standard: 'ASS-OS', base: null, fields: [
    { name: 'conclusion',     type: 'str',   desc: 'Narrative text',    required: true },
    { name: 'confidence',     type: 'float', desc: 'Confidence level',  required: false, default: 0.5, range: [0, 1] },
    { name: 'evidence_basis', type: 'bool',  desc: 'Has evidence',      required: false, default: false },
    { name: 'source',         type: 'str',   desc: 'Originating level', required: false, default: 'L4' },
    { name: 'timestamp',      type: 'float', desc: 'Creation time',     required: false }
  ]});

  registry.define('FaultModel', { standard: 'ASS-OS', base: null, fields: [
    { name: 'id',             type: 'str',   desc: 'Fault code',          required: true },
    { name: 'label',          type: 'str',   desc: 'Fault name',          required: true },
    { name: 'desc',           type: 'str',   desc: 'Description',         required: true },
    { name: 'bus_affected',   type: 'array', desc: 'Affected bus indices', required: false, default: [] },
    { name: 'level_affected', type: 'array', desc: 'Affected levels',     required: false, default: [] },
    { name: 'severity',       type: 'enum',  desc: 'Fault severity',      required: true, enum: ['CRITICAL','HIGH','MEDIUM','LOW'] },
    { name: 'active',         type: 'bool',  desc: 'Currently active',    required: false, default: false },
    { name: 'start_time',     type: 'float', desc: 'Activation time',     required: false },
    { name: 'mitigated',      type: 'bool',  desc: 'Mitigation applied',  required: false, default: false }
  ]});

  registry.define('Goal', { standard: 'ASS-OS', base: null, fields: [
    { name: 'type',     type: 'enum',  desc: 'Goal type',   required: true, enum: ['MAINTAIN','OPTIMIZE','EXPLORE','PROTECT','REGULATE','REPAIR','ATTEND','REST'] },
    { name: 'target',   type: 'str',   desc: 'Goal target', required: true },
    { name: 'desc',     type: 'str',   desc: 'Description', required: false },
    { name: 'priority', type: 'int',   desc: 'Priority',    required: true, range: [1, 10] },
    { name: 'status',   type: 'enum',  desc: 'Goal status', required: true, default: 'active', enum: ['active','satisfied','threatened','failed'] },
    { name: 'created',  type: 'float', desc: 'Creation time',required: false }
  ]});
}
