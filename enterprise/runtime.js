// enterprise/runtime.js — Wire enterprise hierarchy to ASS-OS runtime
// Binds equipment/workunit/workcenter update loops to the tag provider.
// Called after boot() to make the hierarchy live.

import { tags } from '../modules/ass-os/tags/index.js';
import { getEngine } from '../modules/ass-os/engine.js';

let wiredSites = new Set();

export function wireRuntime(site) {
  if (wiredSites.has(site.id)) return;
  wiredSites.add(site.id);

  // Walk hierarchy, bind each node
  for (const area of Object.values(site.areas)) {
    wireArea(area);
    for (const wc of Object.values(area.workcenters)) {
      wireWorkcenter(wc);
      for (const wu of Object.values(wc.workunits)) {
        wireWorkunit(wu, wc);
        for (const eq of Object.values(wu.equipment)) {
          wireEquipment(eq, wu, wc);
        }
      }
    }
  }
  console.log(`[Runtime] ${site.id} hierarchy wired to ASS-OS tags`);
}

function wireArea(area) {
  area.update = function (dt, t) {
    this.rollupKPI();
  };
}

function wireWorkcenter(wc) {
  wc.update = function (dt, t) {
    const eng = getEngine();
    const lvl = this.consciousnessLevel;

    // Sync activation from engine levels
    if (lvl >= 0 && lvl < 7) {
      this.kpi.activation = eng.levels[lvl];
      this.kpi.health = eng.levelHealth[lvl];
    }

    // Sync state from engine
    this.state = eng.state;
    this.rollupKPI();
  };
}

function wireWorkunit(wu, wc) {
  wu.update = function (dt, t) {
    // Read owned tags → update local KPI
    let act = 0, hp = 1, n = 0;
    for (const path of this.tags) {
      const val = tags.read(path);
      if (val && typeof val.v === 'number') {
        if (path.includes('ACTIVATION')) { act = val.v; n++; }
        if (path.includes('HEALTH')) { hp = val.v; }
      }
    }
    this.kpi.activation = n > 0 ? act : 0;
    this.kpi.health = hp;

    // Count active alarms mentioning this unit
    const eng = getEngine();
    this.kpi.alarmsActive = eng.alarms.filter(
      a => a.sourceLevel === wc.consciousnessLevel
    ).length;
  };
}

function wireEquipment(eq, wu, wc) {
  eq.update = function (dt, t) {
    // Equipment reads its own I/O tags
    for (const io of this.io || []) {
      if (io.path) {
        const val = tags.read(io.path);
        if (val) io.lastValue = val.v;
      }
    }
    // Mirror workcenter state
    this.state = wc.state === 'PRODUCING' ? 'Running' : 'Idle';
  };
}

// ── Master update: call from animation loop ──
export function updateEnterprise(site, dt, t) {
  if (!wiredSites.has(site.id)) return;
  for (const area of Object.values(site.areas)) {
    for (const wc of Object.values(area.workcenters)) {
      if (wc.update) wc.update(dt, t);
      for (const wu of Object.values(wc.workunits)) {
        if (wu.update) wu.update(dt, t);
        for (const eq of Object.values(wu.equipment)) {
          if (eq.update) eq.update(dt, t);
        }
      }
    }
    if (area.update) area.update(dt, t);
  }
  site.rollupKPI();
}
