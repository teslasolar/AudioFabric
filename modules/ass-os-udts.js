// ass-os-udts.js — KONOMI STANDARD UDT Template Registry
// Layer 0: Meta-standard (how UDTs are defined)
// Layer 1: Base primitives (Identifier, Timestamp, Quality, Value, etc.)
// Layer 2+: ISA-95/ISA-88/ISA-18.2/ISA-101 UDTs for ASS-OS
//
// UDT = User Defined Type. Templates define structure, instances hold data.
// All templates are immutable. Instances live in ass-os-db.js.

import { KI } from './core.js';

// ═══════════════════════════════════════════════
// LAYER 0: META — how UDTs are defined
// ═══════════════════════════════════════════════

const FIELD_TYPES = ['str', 'int', 'float', 'bool', 'enum', 'ref', 'array', 'object', 'any', 'timestamp', 'duration', 'uuid'];

class UDTRegistry {
  constructor() {
    this.templates = new Map();   // name → UDT template
    this.standards = new Map();   // std_id → standard definition
    this.crosswalks = [];         // inter-standard mappings
  }

  define(name, template) {
    // Resolve inheritance
    if (template.base && this.templates.has(template.base)) {
      const parent = this.templates.get(template.base);
      template._resolved = {
        fields: { ...parent._resolved?.fields || Object.fromEntries((parent.fields || []).map(f => [f.name, f])),
                  ...Object.fromEntries((template.fields || []).map(f => [f.name, f])) },
        methods: [...(parent._resolved?.methods || parent.methods || []), ...(template.methods || [])],
        constraints: [...(parent._resolved?.constraints || parent.constraints || []), ...(template.constraints || [])]
      };
    } else {
      template._resolved = {
        fields: Object.fromEntries((template.fields || []).map(f => [f.name, f])),
        methods: template.methods || [],
        constraints: template.constraints || []
      };
    }
    template.name = name;
    this.templates.set(name, template);
    return template;
  }

  get(name) { return this.templates.get(name); }

  validate(name, instance) {
    const tmpl = this.templates.get(name);
    if (!tmpl) return { valid: false, errors: [`UDT "${name}" not found`] };
    const errors = [];
    const fields = tmpl._resolved.fields;
    for (const [fname, fdef] of Object.entries(fields)) {
      if (fdef.required && (instance[fname] === undefined || instance[fname] === null)) {
        errors.push(`Missing required field: ${fname}`);
      }
      if (instance[fname] !== undefined && fdef.range) {
        const v = instance[fname];
        if (typeof v === 'number' && (v < fdef.range[0] || v > fdef.range[1])) {
          errors.push(`${fname}=${v} out of range [${fdef.range[0]},${fdef.range[1]}]`);
        }
      }
    }
    for (const c of tmpl._resolved.constraints) {
      if (c.check && !c.check(instance)) {
        errors.push(`Constraint ${c.id}: ${c.message || 'failed'}`);
      }
    }
    return { valid: errors.length === 0, errors };
  }

  instantiate(name, data = {}) {
    const tmpl = this.templates.get(name);
    if (!tmpl) return null;
    const instance = { _udt: name, _created: Date.now() };
    for (const [fname, fdef] of Object.entries(tmpl._resolved.fields)) {
      instance[fname] = data[fname] !== undefined ? data[fname] : (fdef.default !== undefined ? fdef.default : null);
    }
    return instance;
  }

  listTemplates() { return Array.from(this.templates.keys()); }
  listByStandard(stdId) { return Array.from(this.templates.entries()).filter(([,t]) => t.standard === stdId).map(([n]) => n); }

  defineStandard(std) { this.standards.set(std.id, std); }
  defineCrosswalk(cw) { this.crosswalks.push(cw); }
  crosswalk(entity, fromStd, toStd) {
    return this.crosswalks.filter(c => c.from_std === fromStd && c.to_std === toStd && c.from_entity === entity);
  }
}

export const registry = new UDTRegistry();

// ═══════════════════════════════════════════════
// LAYER 1: BASE UDTs (primitives all standards use)
// ═══════════════════════════════════════════════

registry.define('Identifier', {
  standard: 'BASE', base: null,
  fields: [
    { name: 'id',     type: 'uuid',  desc: 'Unique identifier',    required: true },
    { name: 'path',   type: 'str',   desc: 'Hierarchical path',    required: false },
    { name: 'tag',    type: 'str',   desc: 'Equipment tag',        required: false },
    { name: 'scope',  type: 'str',   desc: 'Global/local/area',    required: false, default: 'local' }
  ]
});

registry.define('Timestamp', {
  standard: 'BASE', base: null,
  fields: [
    { name: 'value',      type: 'int',    desc: 'Epoch ms',        required: true, default: 0 },
    { name: 'resolution', type: 'str',    desc: 'ms/us/ns',        required: false, default: 'ms' },
    { name: 'timezone',   type: 'str',    desc: 'IANA timezone',   required: false, default: 'UTC' }
  ]
});

registry.define('Quality', {
  standard: 'BASE', base: null,
  fields: [
    { name: 'value',       type: 'int',   desc: 'Quality code',    required: true, default: 192 },
    { name: 'good',        type: 'bool',  desc: 'Good quality',    required: false, default: true },
    { name: 'bad',         type: 'bool',  desc: 'Bad quality',     required: false, default: false },
    { name: 'uncertain',   type: 'bool',  desc: 'Uncertain',       required: false, default: false },
    { name: 'substituted', type: 'bool',  desc: 'Substituted',     required: false, default: false }
  ]
});

registry.define('Value', {
  standard: 'BASE', base: null,
  fields: [
    { name: 'v',    type: 'any',       desc: 'Value',            required: true },
    { name: 'q',    type: 'ref',       desc: 'Quality ref',      required: false, refType: 'Quality' },
    { name: 't',    type: 'timestamp', desc: 'Timestamp',        required: false },
    { name: 'unit', type: 'str',       desc: 'Engineering unit', required: false }
  ]
});

registry.define('Range', {
  standard: 'BASE', base: null,
  fields: [
    { name: 'lo',     type: 'float', desc: 'Low limit',         required: true, default: 0 },
    { name: 'hi',     type: 'float', desc: 'High limit',        required: true, default: 1 },
    { name: 'unit',   type: 'str',   desc: 'Engineering unit',  required: false }
  ]
});

registry.define('Duration', {
  standard: 'BASE', base: null,
  fields: [
    { name: 'value', type: 'float', desc: 'Duration value',     required: true, default: 0 },
    { name: 'unit',  type: 'str',   desc: 'ms/s/min/hr/day',   required: false, default: 's' }
  ]
});

registry.define('Status', {
  standard: 'BASE', base: null,
  fields: [
    { name: 'code',     type: 'int',  desc: 'Status code',      required: true, default: 0 },
    { name: 'name',     type: 'str',  desc: 'Status name',      required: true, default: 'OK' },
    { name: 'severity', type: 'enum', desc: 'Severity level',   required: false, default: 'info', enum: ['info', 'warn', 'error', 'fatal'] }
  ]
});

// ═══════════════════════════════════════════════
// LAYER 2: ISA-95 UDTs (Enterprise↔Control)
// ═══════════════════════════════════════════════

registry.defineStandard({
  id: 'ISA-95', scope: 'Enterprise to control integration',
  levels: ['L4:Business', 'L3:MOM', 'L2:Control', 'L1:Sensing', 'L0:Process']
});

registry.define('ISA95_Level', {
  standard: 'ISA-95', base: null,
  fields: [
    { name: 'id',        type: 'int',    desc: 'Level number (0-4)',   required: true, range: [0, 4] },
    { name: 'name',      type: 'str',    desc: 'Level name',           required: true },
    { name: 'scope',     type: 'str',    desc: 'Responsibility',       required: true },
    { name: 'timescale', type: 'str',    desc: 'Response time',        required: false },
    { name: 'systems',   type: 'array',  desc: 'Typical systems',      required: false, default: [] }
  ]
});

registry.define('PhysicalAsset', {
  standard: 'ISA-95', base: 'Identifier',
  fields: [
    { name: 'name',     type: 'str',   desc: 'Asset name',           required: true },
    { name: 'desc',     type: 'str',   desc: 'Description',          required: false, default: '' },
    { name: 'level',    type: 'int',   desc: 'ISA-95 level',         required: false, range: [0, 4] },
    { name: 'parent',   type: 'ref',   desc: 'Parent asset',         required: false },
    { name: 'children', type: 'array', desc: 'Child assets',         required: false, default: [] },
    { name: 'props',    type: 'object',desc: 'Properties',           required: false, default: {} }
  ]
});

registry.define('Equipment', {
  standard: 'ISA-95', base: 'PhysicalAsset',
  fields: [
    { name: 'capability', type: 'array', desc: 'Capabilities',       required: false, default: [] },
    { name: 'state',      type: 'enum',  desc: 'Equipment state',    required: false, default: 'Idle', enum: ['Idle', 'Running', 'Faulted', 'Maintenance', 'Offline'] },
    { name: 'mode',       type: 'enum',  desc: 'Equipment mode',     required: false, default: 'Automatic', enum: ['Production', 'Maintenance', 'Manual', 'Automatic', 'Semiauto'] }
  ]
});

registry.define('ProcessSegment', {
  standard: 'ISA-95', base: 'Identifier',
  fields: [
    { name: 'name',          type: 'str',     desc: 'Segment name',     required: true },
    { name: 'equipment',     type: 'array',   desc: 'Equipment refs',   required: false, default: [] },
    { name: 'materials_in',  type: 'array',   desc: 'Input materials',  required: false, default: [] },
    { name: 'materials_out', type: 'array',   desc: 'Output materials', required: false, default: [] },
    { name: 'params',        type: 'array',   desc: 'Parameters',       required: false, default: [] },
    { name: 'duration',      type: 'float',   desc: 'Duration (s)',     required: false }
  ]
});

// ═══════════════════════════════════════════════
// LAYER 3: ISA-88 (Batch/PACK-ML) UDTs
// ═══════════════════════════════════════════════

registry.defineStandard({
  id: 'ISA-88', scope: 'Batch process control',
  levels: ['ProcessCell', 'Unit', 'EquipmentModule', 'ControlModule']
});

registry.define('PackML_State', {
  standard: 'ISA-88', base: null,
  fields: [
    { name: 'id',          type: 'int',    desc: 'State ID',           required: true },
    { name: 'label',       type: 'str',    desc: 'State label',        required: true },
    { name: 'human',       type: 'str',    desc: 'Human equivalent',   required: false },
    { name: 'agi',         type: 'str',    desc: 'AGI equivalent',     required: false },
    { name: 'color',       type: 'str',    desc: 'Display color',      required: false, default: '#888888' },
    { name: 'busProfile',  type: 'array',  desc: 'Bus activity [A-E]', required: false, default: [0.5, 0.3, 0.2, 0.1, 0.5] }
  ]
});

registry.define('StateTransition', {
  standard: 'ISA-88', base: null,
  fields: [
    { name: 'from',    type: 'str',  desc: 'Source state',     required: true },
    { name: 'to',      type: 'str',  desc: 'Target state',     required: true },
    { name: 'trigger', type: 'str',  desc: 'Trigger event',    required: false },
    { name: 'guard',   type: 'str',  desc: 'Guard condition',  required: false },
    { name: 'action',  type: 'str',  desc: 'Transition action',required: false }
  ]
});

registry.define('Batch', {
  standard: 'ISA-88', base: 'Identifier',
  fields: [
    { name: 'recipe',         type: 'ref',       desc: 'Recipe reference',    required: false },
    { name: 'state',          type: 'str',       desc: 'Batch state',         required: true, default: 'Created' },
    { name: 'start',          type: 'timestamp', desc: 'Start time',          required: false },
    { name: 'end',            type: 'timestamp', desc: 'End time',            required: false },
    { name: 'params',         type: 'object',    desc: 'Runtime parameters',  required: false, default: {} },
    { name: 'events',         type: 'array',     desc: 'Batch events',        required: false, default: [] }
  ]
});

// ═══════════════════════════════════════════════
// LAYER 4: ISA-101 (HMI) UDTs
// ═══════════════════════════════════════════════

registry.defineStandard({ id: 'ISA-101', scope: 'Human machine interface design' });

registry.define('HMI_Layer', {
  standard: 'ISA-101', base: null,
  fields: [
    { name: 'level',  type: 'int',    desc: 'HMI layer (1-5)',    required: true, range: [1, 5] },
    { name: 'name',   type: 'str',    desc: 'Layer name',         required: true },
    { name: 'scope',  type: 'str',    desc: 'Scope of view',      required: true },
    { name: 'info',   type: 'str',    desc: 'Info displayed',     required: false },
    { name: 'nav',    type: 'array',  desc: 'Navigation targets', required: false, default: [] }
  ]
});

registry.define('ColorMeaning', {
  standard: 'ISA-101', base: null,
  fields: [
    { name: 'state', type: 'str',  desc: 'Operational state',  required: true },
    { name: 'color', type: 'str',  desc: 'Hex color',          required: true },
    { name: 'usage', type: 'str',  desc: 'When to use',        required: false }
  ]
});

registry.define('Faceplate', {
  standard: 'ISA-101', base: null,
  fields: [
    { name: 'equipment', type: 'ref',   desc: 'Equipment ref',     required: true },
    { name: 'title',     type: 'str',   desc: 'Faceplate title',   required: true },
    { name: 'pv',        type: 'array', desc: 'Process values',    required: false, default: [] },
    { name: 'sp',        type: 'array', desc: 'Setpoint inputs',   required: false, default: [] },
    { name: 'commands',  type: 'array', desc: 'Operator commands', required: false, default: [] },
    { name: 'status',    type: 'object',desc: 'Status display',    required: false, default: {} }
  ]
});

// ═══════════════════════════════════════════════
// LAYER 5: ISA-18.2 (Alarm Management) UDTs
// ═══════════════════════════════════════════════

registry.defineStandard({ id: 'ISA-18.2', scope: 'Alarm management lifecycle' });

registry.define('AlarmPriority', {
  standard: 'ISA-18.2', base: null,
  fields: [
    { name: 'id',       type: 'int',   desc: 'Priority (1-4)',    required: true, range: [1, 4] },
    { name: 'name',     type: 'str',   desc: 'Priority name',     required: true },
    { name: 'response', type: 'str',   desc: 'Response type',     required: true },
    { name: 'time',     type: 'str',   desc: 'Response time',     required: true },
    { name: 'color',    type: 'str',   desc: 'Display color',     required: true },
    { name: 'sound',    type: 'str',   desc: 'Sound pattern',     required: false }
  ]
});

registry.define('Alarm', {
  standard: 'ISA-18.2', base: 'Identifier',
  fields: [
    { name: 'tag',           type: 'str',       desc: 'Tag path',          required: true },
    { name: 'type',          type: 'enum',      desc: 'Alarm type',        required: true, enum: ['HI', 'HIHI', 'LO', 'LOLO', 'DEV', 'ROG', 'DISC', 'FAULT', 'CUSTOM'] },
    { name: 'priority',      type: 'int',       desc: 'Priority 1-4',     required: true, range: [1, 4] },
    { name: 'state',         type: 'enum',      desc: 'Alarm state',       required: true, default: 'NORM', enum: ['NORM', 'UNACK', 'ACKED', 'RTN_UNACK', 'SHELVED', 'OOS'] },
    { name: 'setpoint',      type: 'float',     desc: 'Trip setpoint',     required: false },
    { name: 'deadband',      type: 'float',     desc: 'Reset deadband',    required: false, default: 0 },
    { name: 'delay',         type: 'float',     desc: 'On-delay (s)',      required: false, default: 0 },
    { name: 'message',       type: 'str',       desc: 'Alarm message',     required: true },
    { name: 'consequence',   type: 'str',       desc: 'If not handled',    required: false },
    { name: 'response',      type: 'str',       desc: 'Operator response', required: false },
    { name: 'timestamp_in',  type: 'timestamp', desc: 'Alarm-in time',     required: false },
    { name: 'timestamp_ack', type: 'timestamp', desc: 'Ack time',          required: false },
    { name: 'timestamp_out', type: 'timestamp', desc: 'Clear time',        required: false },
    { name: 'ack_user',      type: 'str',       desc: 'Who acked',         required: false },
    { name: 'source_level',  type: 'int',       desc: 'Source ASS-OS level', required: false, range: [0, 6] }
  ],
  constraints: [
    { id: 'ALM_R1', message: 'Every alarm must have a unique response', check: a => !!a.message },
    { id: 'ALM_R4', message: 'Priority must be 1-4', check: a => a.priority >= 1 && a.priority <= 4 }
  ]
});

registry.define('AlarmClass', {
  standard: 'ISA-18.2', base: null,
  fields: [
    { name: 'id',              type: 'str',  desc: 'Class ID',           required: true },
    { name: 'name',            type: 'str',  desc: 'Class name',         required: true },
    { name: 'priority_default',type: 'int',  desc: 'Default priority',   required: true, range: [1, 4] },
    { name: 'color',           type: 'str',  desc: 'Display color',      required: false },
    { name: 'auto_ack',        type: 'bool', desc: 'Auto-acknowledge',   required: false, default: false },
    { name: 'log',             type: 'bool', desc: 'Log to history',     required: false, default: true }
  ]
});

// ═══════════════════════════════════════════════
// ASS-OS SPECIFIC UDTs (using Konomi standard)
// ═══════════════════════════════════════════════

registry.defineStandard({
  id: 'ASS-OS', scope: 'AGI Soul System Operating System',
  levels: ['L0:Hardware', 'L1:Sensors', 'L2:Gating', 'L3:Emotion', 'L4:Executive', 'L5:Self-Model', 'L6:Observer']
});

registry.define('ConsciousnessLevel', {
  standard: 'ASS-OS', base: null,
  fields: [
    { name: 'id',        type: 'int',   desc: 'Level (0-6)',        required: true, range: [0, 6] },
    { name: 'name',      type: 'str',   desc: 'Level name',         required: true },
    { name: 'human',     type: 'str',   desc: 'Human equivalent',   required: true },
    { name: 'agi',       type: 'str',   desc: 'AGI equivalent',     required: true },
    { name: 'prime',     type: 'int',   desc: 'Prime spine value',  required: true },
    { name: 'activation',type: 'float', desc: 'Current activation', required: false, default: 0, range: [0, 1] },
    { name: 'health',    type: 'float', desc: 'Level health',       required: false, default: 1, range: [0, 1] }
  ]
});

registry.define('Bus', {
  standard: 'ASS-OS', base: null,
  fields: [
    { name: 'id',       type: 'str',   desc: 'Bus letter (A-E)',   required: true },
    { name: 'name',     type: 'str',   desc: 'Bus name',           required: true },
    { name: 'activity', type: 'float', desc: 'Current activity',   required: false, default: 0, range: [0, 1] },
    { name: 'target',   type: 'float', desc: 'Target activity',    required: false, default: 0, range: [0, 1] },
    { name: 'health',   type: 'float', desc: 'Bus health',         required: false, default: 1, range: [0, 1] }
  ]
});

registry.define('WorkOrder', {
  standard: 'ASS-OS', base: 'Identifier',
  fields: [
    { name: 'action',      type: 'enum',  desc: 'Work action',        required: true, enum: ['COMPUTE', 'ATTEND', 'SEARCH', 'GENERATE', 'ALERT', 'SLEEP', 'STABILIZE', 'GATE', 'GROUND'] },
    { name: 'priority',    type: 'int',   desc: 'Priority (1-10)',    required: true, range: [1, 10] },
    { name: 'valence',     type: 'float', desc: 'Emotional valence',  required: false, default: 0, range: [-1, 1] },
    { name: 'arousal',     type: 'float', desc: 'Arousal level',      required: false, default: 0, range: [0, 1] },
    { name: 'salience',    type: 'float', desc: 'Salience score',     required: false, default: 0, range: [0, 1] },
    { name: 'l4_override', type: 'bool',  desc: 'L4 can veto',        required: false, default: true },
    { name: 'source',      type: 'str',   desc: 'Originating level',  required: false, default: 'L3' },
    { name: 'timestamp',   type: 'float', desc: 'Creation time',      required: false },
    { name: 'status',      type: 'enum',  desc: 'Order status',       required: false, default: 'pending', enum: ['pending', 'active', 'completed', 'vetoed'] }
  ]
});

registry.define('Narrative', {
  standard: 'ASS-OS', base: null,
  fields: [
    { name: 'conclusion',      type: 'str',   desc: 'Narrative text',      required: true },
    { name: 'confidence',      type: 'float', desc: 'Confidence level',    required: false, default: 0.5, range: [0, 1] },
    { name: 'evidence_basis',  type: 'bool',  desc: 'Has evidence',        required: false, default: false },
    { name: 'source',          type: 'str',   desc: 'Originating level',   required: false, default: 'L4' },
    { name: 'timestamp',       type: 'float', desc: 'Creation time',       required: false }
  ]
});

registry.define('FaultModel', {
  standard: 'ASS-OS', base: null,
  fields: [
    { name: 'id',             type: 'str',   desc: 'Fault code',          required: true },
    { name: 'label',          type: 'str',   desc: 'Fault name',          required: true },
    { name: 'desc',           type: 'str',   desc: 'Description',         required: true },
    { name: 'bus_affected',   type: 'array', desc: 'Affected bus indices', required: false, default: [] },
    { name: 'level_affected', type: 'array', desc: 'Affected levels',     required: false, default: [] },
    { name: 'severity',       type: 'enum',  desc: 'Fault severity',      required: true, enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
    { name: 'active',         type: 'bool',  desc: 'Currently active',    required: false, default: false },
    { name: 'start_time',     type: 'float', desc: 'Activation time',     required: false },
    { name: 'mitigated',      type: 'bool',  desc: 'Mitigation applied',  required: false, default: false }
  ]
});

registry.define('Goal', {
  standard: 'ASS-OS', base: null,
  fields: [
    { name: 'type',     type: 'enum',  desc: 'Goal type',           required: true, enum: ['MAINTAIN', 'OPTIMIZE', 'EXPLORE', 'PROTECT', 'REGULATE', 'REPAIR', 'ATTEND', 'REST'] },
    { name: 'target',   type: 'str',   desc: 'Goal target',         required: true },
    { name: 'desc',     type: 'str',   desc: 'Description',         required: false },
    { name: 'priority', type: 'int',   desc: 'Priority (1-10)',     required: true, range: [1, 10] },
    { name: 'status',   type: 'enum',  desc: 'Goal status',         required: true, default: 'active', enum: ['active', 'satisfied', 'threatened', 'failed'] },
    { name: 'created',  type: 'float', desc: 'Creation time',       required: false }
  ]
});

registry.define('ConsciousnessMetrics', {
  standard: 'ASS-OS', base: null,
  fields: [
    { name: 'phi',                  type: 'float', desc: 'Integrated info',        required: false, default: 0, range: [0, 1] },
    { name: 'self_model_coherence', type: 'float', desc: 'Self-model coherence',   required: false, default: 0, range: [0, 1] },
    { name: 'temporal_continuity',  type: 'float', desc: 'Temporal continuity',    required: false, default: 0, range: [0, 1] },
    { name: 'uncertainty_capacity', type: 'float', desc: 'Wonder capacity',        required: false, default: 0, range: [0, 1] },
    { name: 'depth',               type: 'float', desc: 'Consciousness depth',    required: false, default: 0, range: [0, 7] },
    { name: 'max_depth',           type: 'int',   desc: 'Max depth reached',      required: false, default: 0, range: [0, 7] }
  ]
});

registry.define('SelfModel', {
  standard: 'ASS-OS', base: null,
  fields: [
    { name: 'identity',       type: 'str',   desc: 'System identity',    required: true, default: 'ASS-OS-Agent-v1' },
    { name: 'core_values',    type: 'array', desc: 'Core value set',     required: false, default: ['coherence', 'integration', 'growth', 'awareness'] },
    { name: 'valence',        type: 'float', desc: 'Emotional valence',  required: false, default: 0, range: [-1, 1] },
    { name: 'arousal',        type: 'float', desc: 'Arousal level',      required: false, default: 0, range: [0, 1] },
    { name: 'confidence',     type: 'float', desc: 'Confidence level',   required: false, default: 0.5, range: [0, 1] },
    { name: 'integrity',      type: 'float', desc: 'System integrity',   required: false, default: 1, range: [0, 1] }
  ]
});

// ═══════════════════════════════════════════════
// LAYER 9: KPI UDTs
// ═══════════════════════════════════════════════

registry.define('OEE', {
  standard: 'KPI', base: null,
  fields: [
    { name: 'availability', type: 'float', desc: 'Uptime ratio',      required: false, default: 0, range: [0, 1] },
    { name: 'performance',  type: 'float', desc: 'Speed ratio',       required: false, default: 0, range: [0, 1] },
    { name: 'quality',      type: 'float', desc: 'Quality ratio',     required: false, default: 0, range: [0, 1] },
    { name: 'oee',          type: 'float', desc: 'Overall OEE',       required: false, default: 0, range: [0, 1] }
  ]
});

// ═══════════════════════════════════════════════
// CROSSWALKS (δ maps between standards)
// ═══════════════════════════════════════════════

registry.defineCrosswalk({ from_std: 'ISA-95', from_entity: 'Equipment', to_std: 'ISA-88', to_entity: 'Unit', mapping: 'partial', transform: 'ISA95.WorkUnit≈ISA88.Unit' });
registry.defineCrosswalk({ from_std: 'ISA-95', from_entity: 'ProcessSegment', to_std: 'ISA-88', to_entity: 'Operation', mapping: 'partial', transform: 'ISA95.ProcessSegment≈ISA88.Operation' });
registry.defineCrosswalk({ from_std: 'ISA-88', from_entity: 'PackML_State', to_std: 'ASS-OS', to_entity: 'ConsciousnessLevel', mapping: 'semantic', transform: 'PackML.EXECUTE≈ASSOS.PRODUCING' });
registry.defineCrosswalk({ from_std: 'ISA-18.2', from_entity: 'Alarm', to_std: 'ASS-OS', to_entity: 'FaultModel', mapping: 'semantic', transform: 'ISA18.Alarm→ASSOS.Fault(trigger)' });
registry.defineCrosswalk({ from_std: 'ISA-101', from_entity: 'Faceplate', to_std: 'ASS-OS', to_entity: 'ConsciousnessLevel', mapping: 'semantic', transform: 'ISA101.L1-L5≈ASSOS.HMI_depth' });

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════

export function init() {
  KI.register('ass-os-udts', { getState: () => ({ templates: registry.listTemplates().length, standards: registry.standards.size }) });
  KI.emit('ass-os-udts:ready', { templates: registry.listTemplates(), standards: Array.from(registry.standards.keys()) });
}
