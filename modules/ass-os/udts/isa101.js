// ass-os/udts/isa101.js — Layer 4: ISA-101 (HMI Design)

import { registry } from './registry.js';

export function defineISA101() {
  registry.defineStandard({ id: 'ISA-101', scope: 'Human machine interface design' });

  registry.define('HMI_Layer', { standard: 'ISA-101', base: null, fields: [
    { name: 'level', type: 'int',   desc: 'HMI layer (1-5)',   required: true, range: [1, 5] },
    { name: 'name',  type: 'str',   desc: 'Layer name',        required: true },
    { name: 'scope', type: 'str',   desc: 'Scope of view',     required: true },
    { name: 'info',  type: 'str',   desc: 'Info displayed',    required: false },
    { name: 'nav',   type: 'array', desc: 'Navigation targets',required: false, default: [] }
  ]});

  registry.define('ColorMeaning', { standard: 'ISA-101', base: null, fields: [
    { name: 'state', type: 'str', desc: 'Operational state', required: true },
    { name: 'color', type: 'str', desc: 'Hex color',         required: true },
    { name: 'usage', type: 'str', desc: 'When to use',       required: false }
  ]});

  registry.define('Faceplate', { standard: 'ISA-101', base: null, fields: [
    { name: 'equipment', type: 'ref',    desc: 'Equipment ref',    required: true },
    { name: 'title',     type: 'str',    desc: 'Faceplate title',  required: true },
    { name: 'pv',        type: 'array',  desc: 'Process values',   required: false, default: [] },
    { name: 'sp',        type: 'array',  desc: 'Setpoint inputs',  required: false, default: [] },
    { name: 'commands',  type: 'array',  desc: 'Operator commands',required: false, default: [] },
    { name: 'status',    type: 'object', desc: 'Status display',   required: false, default: {} }
  ]});
}
