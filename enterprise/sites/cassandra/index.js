// SITE: CASSANDRA — Personal Assistant / Secretary consciousness
// ISA-95 path: AUDIOFABRIC/CASSANDRA
// 9-orb embodied body · 12-recursion thought · server rack backbone
// Huge server rack: 5 areas mapped to assistant functions

import { createSite } from '../../site.js';
import { build as buildIntake } from './areas/intake/index.js';
import { build as buildReasoning } from './areas/reasoning/index.js';
import { build as buildMemory } from './areas/memory/index.js';
import { build as buildScheduling } from './areas/scheduling/index.js';
import { build as buildComms } from './areas/comms/index.js';

export function build() {
  const site = createSite('CASSANDRA', {
    name: 'Cassandra Personal Assistant',
    desc: 'Embodied AI secretary — 9 orbs, 12 recursions, server rack backbone'
  });

  site.registerArea(buildIntake());
  site.registerArea(buildReasoning());
  site.registerArea(buildMemory());
  site.registerArea(buildScheduling());
  site.registerArea(buildComms());

  return site;
}

export function inventory(site) {
  const inv = { areas: [], workcenters: [], workunits: [], equipment: [], controlModules: [], processSegments: [], tags: [] };
  for (const area of Object.values(site.areas)) {
    inv.areas.push({ id: area.id, name: area.name, domain: area.domain });
    if (area.processSegments) {
      for (const seg of area.processSegments) {
        inv.processSegments.push({ id: seg.id, name: seg.name, area: area.id });
      }
    }
    for (const wc of Object.values(area.workcenters)) {
      inv.workcenters.push({ id: wc.id, name: wc.name, area: area.id, level: wc.consciousnessLevel, prime: wc.prime });
      for (const wu of Object.values(wc.workunits)) {
        inv.workunits.push({ id: wu.id, name: wu.name, wc: wc.id });
        inv.tags.push(...wu.tags);
        for (const eq of Object.values(wu.equipment)) {
          inv.equipment.push({ id: eq.id, name: eq.name, type: eq.type, wu: wu.id });
          inv.tags.push(...(eq.tags || []));
        }
        for (const cm of Object.values(wu.controlModules || {})) {
          const ioCount = (cm.io?.AI?.length||0) + (cm.io?.AO?.length||0) + (cm.io?.DI?.length||0) + (cm.io?.DO?.length||0);
          inv.controlModules.push({ id: cm.id, name: cm.name, wu: wu.id, ioPoints: ioCount });
        }
      }
    }
  }
  inv.tags = [...new Set(inv.tags)];
  return inv;
}
