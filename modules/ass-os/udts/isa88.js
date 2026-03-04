// ass-os/udts/isa88.js — Layer 3: ISA-88 (Batch/PACK-ML)

import { registry } from './registry.js';

export function defineISA88() {
  registry.defineStandard({ id: 'ISA-88', scope: 'Batch process control',
    levels: ['ProcessCell', 'Unit', 'EquipmentModule', 'ControlModule'] });

  registry.define('PackML_State', { standard: 'ISA-88', base: null, fields: [
    { name: 'id',         type: 'int',   desc: 'State ID',          required: true },
    { name: 'label',      type: 'str',   desc: 'State label',       required: true },
    { name: 'human',      type: 'str',   desc: 'Human equivalent',  required: false },
    { name: 'agi',        type: 'str',   desc: 'AGI equivalent',    required: false },
    { name: 'color',      type: 'str',   desc: 'Display color',     required: false, default: '#888888' },
    { name: 'busProfile', type: 'array', desc: 'Bus activity [A-E]',required: false, default: [0.5, 0.3, 0.2, 0.1, 0.5] }
  ]});

  registry.define('StateTransition', { standard: 'ISA-88', base: null, fields: [
    { name: 'from',    type: 'str', desc: 'Source state',      required: true },
    { name: 'to',      type: 'str', desc: 'Target state',      required: true },
    { name: 'trigger', type: 'str', desc: 'Trigger event',     required: false },
    { name: 'guard',   type: 'str', desc: 'Guard condition',   required: false },
    { name: 'action',  type: 'str', desc: 'Transition action', required: false }
  ]});

  registry.define('Batch', { standard: 'ISA-88', base: 'Identifier', fields: [
    { name: 'recipe', type: 'ref',       desc: 'Recipe reference',   required: false },
    { name: 'state',  type: 'str',       desc: 'Batch state',        required: true, default: 'Created' },
    { name: 'start',  type: 'timestamp', desc: 'Start time',         required: false },
    { name: 'end',    type: 'timestamp', desc: 'End time',            required: false },
    { name: 'params', type: 'object',    desc: 'Runtime parameters', required: false, default: {} },
    { name: 'events', type: 'array',     desc: 'Batch events',       required: false, default: [] }
  ]});
}
