// ass-os/udts/index.js — UDT barrel export + init
import { KI } from '../../core.js';
export { registry } from './registry.js';
import { defineBase } from './base.js';
import { defineISA95 } from './isa95.js';
import { defineISA88 } from './isa88.js';
import { defineISA101 } from './isa101.js';
import { defineISA18 } from './isa18.js';
import { defineASSOS } from './assos.js';
import { defineMetrics } from './metrics.js';
import { defineCrosswalks } from './crosswalks.js';
import { registry } from './registry.js';

export function init() {
  defineBase(); defineISA95(); defineISA88();
  defineISA101(); defineISA18(); defineASSOS();
  defineMetrics(); defineCrosswalks();
  KI.register('ass-os-udts', { getState: () => ({ templates: registry.listTemplates().length, standards: registry.standards.size }) });
  KI.emit('ass-os-udts:ready', { templates: registry.listTemplates(), standards: Array.from(registry.standards.keys()) });
}
