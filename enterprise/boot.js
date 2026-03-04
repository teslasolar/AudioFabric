// enterprise/boot.js — Boot the full ISA-95 enterprise hierarchy
// Call boot() to instantiate: Enterprise → Site → Areas → WorkCenters → WorkUnits → Equipment

import { enterprise, registerSite, rollupKPI, getEnterprise } from './index.js';
import { build as buildAssosPrime, inventory } from './sites/assos-prime/index.js';

export function boot() {
  // Build and register the primary site
  const site = buildAssosPrime();
  registerSite(site);

  // Initial KPI rollup
  site.rollupKPI();
  rollupKPI();

  // Print hierarchy summary
  const inv = inventory(site);
  const summary = {
    enterprise: enterprise.id,
    site: site.id,
    areas: inv.areas.length,
    workcenters: inv.workcenters.length,
    workunits: inv.workunits.length,
    equipment: inv.equipment.length,
    tags: inv.tags.length
  };

  console.log('[Enterprise] Booted:', summary);
  return { enterprise, site, inventory: inv, summary };
}

export function printHierarchy() {
  const ent = getEnterprise();
  const lines = [`Enterprise: ${ent.id} (${ent.name})`];

  for (const site of Object.values(ent.sites)) {
    lines.push(`  Site: ${site.id} — ${site.name}`);
    for (const area of Object.values(site.areas)) {
      lines.push(`    Area: ${area.id} — ${area.name} [${area.domain}]`);
      for (const wc of Object.values(area.workcenters)) {
        const lvl = wc.consciousnessLevel >= 0 ? `L${wc.consciousnessLevel} p=${wc.prime}` : 'cross-level';
        lines.push(`      WorkCenter: ${wc.id} — ${wc.name} (${lvl})`);
        for (const wu of Object.values(wc.workunits)) {
          const eqCount = Object.keys(wu.equipment).length;
          lines.push(`        WorkUnit: ${wu.id} — ${wu.name} [${eqCount} equip, ${wu.tags.length} tags]`);
          for (const eq of Object.values(wu.equipment)) {
            lines.push(`          Equipment: ${eq.id} — ${eq.name} (${eq.type})`);
          }
        }
      }
    }
  }
  return lines.join('\n');
}

export { getEnterprise, rollupKPI, inventory };
