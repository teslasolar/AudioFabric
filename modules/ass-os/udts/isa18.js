// ass-os/udts/isa18.js — Layer 5: ISA-18.2 (Alarm Management)

import { registry } from './registry.js';

export function defineISA18() {
  registry.defineStandard({ id: 'ISA-18.2', scope: 'Alarm management lifecycle' });

  registry.define('AlarmPriority', { standard: 'ISA-18.2', base: null, fields: [
    { name: 'id',       type: 'int', desc: 'Priority (1-4)',  required: true, range: [1, 4] },
    { name: 'name',     type: 'str', desc: 'Priority name',   required: true },
    { name: 'response', type: 'str', desc: 'Response type',   required: true },
    { name: 'time',     type: 'str', desc: 'Response time',   required: true },
    { name: 'color',    type: 'str', desc: 'Display color',   required: true },
    { name: 'sound',    type: 'str', desc: 'Sound pattern',   required: false }
  ]});

  registry.define('Alarm', { standard: 'ISA-18.2', base: 'Identifier', fields: [
    { name: 'tag',           type: 'str',       desc: 'Tag path',         required: true },
    { name: 'type',          type: 'enum',      desc: 'Alarm type',       required: true, enum: ['HI','HIHI','LO','LOLO','DEV','ROG','DISC','FAULT','CUSTOM'] },
    { name: 'priority',      type: 'int',       desc: 'Priority 1-4',    required: true, range: [1, 4] },
    { name: 'state',         type: 'enum',      desc: 'Alarm state',      required: true, default: 'NORM', enum: ['NORM','UNACK','ACKED','RTN_UNACK','SHELVED','OOS'] },
    { name: 'setpoint',      type: 'float',     desc: 'Trip setpoint',    required: false },
    { name: 'deadband',      type: 'float',     desc: 'Reset deadband',   required: false, default: 0 },
    { name: 'delay',         type: 'float',     desc: 'On-delay (s)',     required: false, default: 0 },
    { name: 'message',       type: 'str',       desc: 'Alarm message',    required: true },
    { name: 'consequence',   type: 'str',       desc: 'If not handled',   required: false },
    { name: 'response',      type: 'str',       desc: 'Operator response',required: false },
    { name: 'timestamp_in',  type: 'timestamp', desc: 'Alarm-in time',    required: false },
    { name: 'timestamp_ack', type: 'timestamp', desc: 'Ack time',         required: false },
    { name: 'timestamp_out', type: 'timestamp', desc: 'Clear time',       required: false },
    { name: 'ack_user',      type: 'str',       desc: 'Who acked',        required: false },
    { name: 'source_level',  type: 'int',       desc: 'Source ASS-OS level', required: false, range: [0, 6] }
  ], constraints: [
    { id: 'ALM_R1', message: 'Every alarm must have a message', check: a => !!a.message },
    { id: 'ALM_R4', message: 'Priority must be 1-4', check: a => a.priority >= 1 && a.priority <= 4 }
  ]});

  registry.define('AlarmClass', { standard: 'ISA-18.2', base: null, fields: [
    { name: 'id',               type: 'str',  desc: 'Class ID',         required: true },
    { name: 'name',             type: 'str',  desc: 'Class name',       required: true },
    { name: 'priority_default', type: 'int',  desc: 'Default priority', required: true, range: [1, 4] },
    { name: 'color',            type: 'str',  desc: 'Display color',    required: false },
    { name: 'auto_ack',         type: 'bool', desc: 'Auto-acknowledge', required: false, default: false },
    { name: 'log',              type: 'bool', desc: 'Log to history',   required: false, default: true }
  ]});
}
