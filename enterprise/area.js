// enterprise/area.js — ISA-95 Area factory
// An area groups related workcenters under a functional domain.
// Area → WorkCenter:N → WorkUnit:N → Equipment:N

export function createArea(id, config = {}) {
  return {
    id,
    name: config.name || id,
    desc: config.desc || '',
    level: 2, // ISA-95 Level 2 — Control/Supervision
    timescale: 'sec-hours',
    systems: ['SCADA', 'HMI', 'ASS-OS-Bridge'],
    domain: config.domain || 'general', // sensory|cognitive|executive|integration|autonomic
    levelsOwned: config.levelsOwned || [],

    workcenters: {},

    kpi: {
      availability: 1,
      performance: 1,
      quality: 1,
      alarmsActive: 0,
      totalEquipment: 0
    },

    dataDown: ['Setpoints', 'Commands'],
    dataUp: ['Measurements', 'Status', 'Alarms'],

    registerWorkcenter(wc) {
      this.workcenters[wc.id] = wc;
      return wc;
    },

    rollupKPI() {
      let avail = 0, n = 0, alarms = 0, equip = 0;
      for (const wc of Object.values(this.workcenters)) {
        if (wc.kpi) {
          avail += wc.kpi.availability || 0;
          alarms += wc.kpi.alarmsActive || 0;
          equip += wc.kpi.totalEquipment || 0;
          n++;
        }
      }
      if (n > 0) this.kpi.availability = avail / n;
      this.kpi.alarmsActive = alarms;
      this.kpi.totalEquipment = equip;
      return this.kpi;
    }
  };
}
