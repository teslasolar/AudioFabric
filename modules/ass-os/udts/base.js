// ass-os/udts/base.js — Layer 1: Base UDT primitives
// Identifier, Timestamp, Quality, Value, Range, Duration, Status

import { registry } from './registry.js';

export function defineBase() {
  registry.define('Identifier', { standard: 'BASE', base: null, fields: [
    { name: 'id',    type: 'uuid', desc: 'Unique identifier',  required: true },
    { name: 'path',  type: 'str',  desc: 'Hierarchical path',  required: false },
    { name: 'tag',   type: 'str',  desc: 'Equipment tag',      required: false },
    { name: 'scope', type: 'str',  desc: 'Global/local/area',  required: false, default: 'local' }
  ]});

  registry.define('Timestamp', { standard: 'BASE', base: null, fields: [
    { name: 'value',      type: 'int', desc: 'Epoch ms',      required: true, default: 0 },
    { name: 'resolution', type: 'str', desc: 'ms/us/ns',      required: false, default: 'ms' },
    { name: 'timezone',   type: 'str', desc: 'IANA timezone',  required: false, default: 'UTC' }
  ]});

  registry.define('Quality', { standard: 'BASE', base: null, fields: [
    { name: 'value',       type: 'int',  desc: 'Quality code',  required: true, default: 192 },
    { name: 'good',        type: 'bool', desc: 'Good quality',  required: false, default: true },
    { name: 'bad',         type: 'bool', desc: 'Bad quality',   required: false, default: false },
    { name: 'uncertain',   type: 'bool', desc: 'Uncertain',     required: false, default: false },
    { name: 'substituted', type: 'bool', desc: 'Substituted',   required: false, default: false }
  ]});

  registry.define('Value', { standard: 'BASE', base: null, fields: [
    { name: 'v',    type: 'any',       desc: 'Value',           required: true },
    { name: 'q',    type: 'ref',       desc: 'Quality ref',     required: false, refType: 'Quality' },
    { name: 't',    type: 'timestamp', desc: 'Timestamp',       required: false },
    { name: 'unit', type: 'str',       desc: 'Engineering unit',required: false }
  ]});

  registry.define('Range', { standard: 'BASE', base: null, fields: [
    { name: 'lo',   type: 'float', desc: 'Low limit',        required: true, default: 0 },
    { name: 'hi',   type: 'float', desc: 'High limit',       required: true, default: 1 },
    { name: 'unit', type: 'str',   desc: 'Engineering unit',  required: false }
  ]});

  registry.define('Duration', { standard: 'BASE', base: null, fields: [
    { name: 'value', type: 'float', desc: 'Duration value',   required: true, default: 0 },
    { name: 'unit',  type: 'str',   desc: 'ms/s/min/hr/day', required: false, default: 's' }
  ]});

  registry.define('Status', { standard: 'BASE', base: null, fields: [
    { name: 'code',     type: 'int',  desc: 'Status code',     required: true, default: 0 },
    { name: 'name',     type: 'str',  desc: 'Status name',     required: true, default: 'OK' },
    { name: 'severity', type: 'enum', desc: 'Severity level',  required: false, default: 'info', enum: ['info', 'warn', 'error', 'fatal'] }
  ]});
}
