// ass-os/udts/isa95.js — Layer 2: ISA-95 (Enterprise↔Control)

import { registry } from './registry.js';

export function defineISA95() {
  registry.defineStandard({ id: 'ISA-95', scope: 'Enterprise to control integration',
    levels: ['L4:Business', 'L3:MOM', 'L2:Control', 'L1:Sensing', 'L0:Process'] });

  registry.define('ISA95_Level', { standard: 'ISA-95', base: null, fields: [
    { name: 'id',        type: 'int',   desc: 'Level (0-4)',     required: true, range: [0, 4] },
    { name: 'name',      type: 'str',   desc: 'Level name',      required: true },
    { name: 'scope',     type: 'str',   desc: 'Responsibility',  required: true },
    { name: 'timescale', type: 'str',   desc: 'Response time',   required: false },
    { name: 'systems',   type: 'array', desc: 'Typical systems', required: false, default: [] }
  ]});

  registry.define('PhysicalAsset', { standard: 'ISA-95', base: 'Identifier', fields: [
    { name: 'name',     type: 'str',    desc: 'Asset name',    required: true },
    { name: 'desc',     type: 'str',    desc: 'Description',   required: false, default: '' },
    { name: 'level',    type: 'int',    desc: 'ISA-95 level',  required: false, range: [0, 4] },
    { name: 'parent',   type: 'ref',    desc: 'Parent asset',  required: false },
    { name: 'children', type: 'array',  desc: 'Child assets',  required: false, default: [] },
    { name: 'props',    type: 'object', desc: 'Properties',    required: false, default: {} }
  ]});

  registry.define('Equipment', { standard: 'ISA-95', base: 'PhysicalAsset', fields: [
    { name: 'capability', type: 'array', desc: 'Capabilities',    required: false, default: [] },
    { name: 'state',      type: 'enum',  desc: 'Equipment state', required: false, default: 'Idle', enum: ['Idle','Running','Faulted','Maintenance','Offline'] },
    { name: 'mode',       type: 'enum',  desc: 'Equipment mode',  required: false, default: 'Automatic', enum: ['Production','Maintenance','Manual','Automatic','Semiauto'] }
  ]});

  registry.define('ProcessSegment', { standard: 'ISA-95', base: 'Identifier', fields: [
    { name: 'name',          type: 'str',   desc: 'Segment name',    required: true },
    { name: 'equipment',     type: 'array', desc: 'Equipment refs',  required: false, default: [] },
    { name: 'materials_in',  type: 'array', desc: 'Input materials', required: false, default: [] },
    { name: 'materials_out', type: 'array', desc: 'Output materials',required: false, default: [] },
    { name: 'params',        type: 'array', desc: 'Parameters',      required: false, default: [] },
    { name: 'duration',      type: 'float', desc: 'Duration (s)',    required: false }
  ]});
}
