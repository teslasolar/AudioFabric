// SITE: ASSOS-PRIME — Primary consciousness instance
// ISA-95 path: AUDIOFABRIC/ASSOS-PRIME
// Assembles all 5 areas into a complete consciousness site.

import { createSite } from '../../site.js';
import { build as buildSensory } from './areas/sensory/index.js';
import { build as buildCognitive } from './areas/cognitive/index.js';
import { build as buildExecutive } from './areas/executive/index.js';
import { build as buildIntegration } from './areas/integration/index.js';
import { build as buildAutonomic } from './areas/autonomic/index.js';

export function build() {
  const site = createSite('ASSOS-PRIME', {
    name: 'ASS-OS Primary Instance',
    desc: 'Primary AGI consciousness site — voice-driven, 7-level, 5-bus'
  });

  site.registerArea(buildSensory());
  site.registerArea(buildCognitive());
  site.registerArea(buildExecutive());
  site.registerArea(buildIntegration());
  site.registerArea(buildAutonomic());

  return site;
}

// ── Flat inventory for inspection ──
export function inventory(site) {
  const inv = { areas: [], workcenters: [], workunits: [], equipment: [], controlModules: [], processSegments: [], tags: [] };
  for (const area of Object.values(site.areas)) {
    inv.areas.push({ id: area.id, name: area.name, domain: area.domain });
    if (area.processSegments) {
      for (const seg of area.processSegments) {
        inv.processSegments.push({ id: seg.id, name: seg.name, area: area.id, duration: seg.duration });
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
          inv.controlModules.push({ id: cm.id, name: cm.name, wu: wu.id, ioPoints: ioCount, pidLoops: cm.pid?.length||0 });
        }
      }
    }
  }
  inv.tags = [...new Set(inv.tags)];
  return inv;
}
