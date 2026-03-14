// enterprise/boot.js — Boot the full ISA-95 enterprise hierarchy
// Call boot() to instantiate: Enterprise → Sites → Areas → WorkCenters → WorkUnits → Equipment
// Then wire to ASS-OS runtime (tags, engine, db).

import { enterprise, registerSite, rollupKPI, getEnterprise } from './index.js';
import { build as buildAssosPrime, inventory as assosInventory } from './sites/assos-prime/index.js';
import { build as buildCassandra, inventory as cassInventory } from './sites/cassandra/index.js';
import { wireRuntime, updateEnterprise } from './runtime.js';

const _sites = [];

export function boot() {
  // ── Site 1: ASS-OS Prime (consciousness engine) ──
  const assos = buildAssosPrime();
  registerSite(assos);
  wireRuntime(assos);
  _sites.push(assos);

  // ── Site 2: Cassandra (personal assistant / secretary) ──
  const cass = buildCassandra();
  registerSite(cass);
  wireRuntime(cass);
  _sites.push(cass);

  // Initial KPI rollup
  for (const s of _sites) s.rollupKPI();
  rollupKPI();

  const assosInv = assosInventory(assos);
  const cassInv = cassInventory(cass);
  const summary = {
    enterprise: enterprise.id,
    sites: _sites.map(s => s.id),
    totalAreas: assosInv.areas.length + cassInv.areas.length,
    totalWorkcenters: assosInv.workcenters.length + cassInv.workcenters.length,
    totalWorkunits: assosInv.workunits.length + cassInv.workunits.length,
    totalEquipment: assosInv.equipment.length + cassInv.equipment.length,
    totalControlModules: (assosInv.controlModules?.length || 0) + (cassInv.controlModules?.length || 0),
    totalTags: assosInv.tags.length + cassInv.tags.length,
  };

  console.log('[Enterprise] Booted:', summary);
  return { enterprise, sites: { assos, cass }, summary };
}

// Call from animation loop after engine update
export function update(dt, t) {
  for (const site of _sites) {
    updateEnterprise(site, dt, t);
  }
  if (Math.floor(t) % 5 === 0) rollupKPI();
}

export function printHierarchy() {
  const ent = getEnterprise();
  const lines = [`Enterprise: ${ent.id} (${ent.name})`];

  for (const site of Object.values(ent.sites)) {
    lines.push(`  Site: ${site.id} — ${site.name}`);
    for (const area of Object.values(site.areas)) {
      lines.push(`    Area: ${area.id} — ${area.name} [${area.domain}]`);
      if (area.processSegments) {
        for (const seg of area.processSegments) {
          lines.push(`      Segment: ${seg.id} — ${seg.name} (${seg.duration}s)`);
        }
      }
      for (const wc of Object.values(area.workcenters)) {
        const lvl = wc.consciousnessLevel >= 0 ? `L${wc.consciousnessLevel} p=${wc.prime}` : 'cross-level';
        lines.push(`      WorkCenter: ${wc.id} — ${wc.name} (${lvl})`);
        for (const wu of Object.values(wc.workunits)) {
          const eqCount = Object.keys(wu.equipment).length;
          const cmCount = wu.controlModules ? Object.keys(wu.controlModules).length : 0;
          lines.push(`        WorkUnit: ${wu.id} — ${wu.name} [${eqCount} equip, ${cmCount} CM, ${wu.tags.length} tags]`);
          for (const eq of Object.values(wu.equipment)) {
            lines.push(`          Equipment: ${eq.id} — ${eq.name} (${eq.type})`);
          }
          if (wu.controlModules) {
            for (const cm of Object.values(wu.controlModules)) {
              const ioCount = (cm.io?.AI?.length||0) + (cm.io?.AO?.length||0) + (cm.io?.DI?.length||0) + (cm.io?.DO?.length||0);
              lines.push(`          ControlModule: ${cm.id} — ${cm.name} [${ioCount} I/O]`);
            }
          }
        }
      }
    }
  }
  return lines.join('\n');
}

export { getEnterprise, rollupKPI };
