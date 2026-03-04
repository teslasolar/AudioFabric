// enterprise/site.js — ISA-95 Site factory
// A site is a single consciousness instance (one ASS-OS runtime).
// Site → Area:N (sensory, cognitive, executive, integration, autonomic)

export function createSite(id, config = {}) {
  return {
    id,
    name: config.name || id,
    desc: config.desc || '',
    level: 3, // ISA-95 Level 3 — MOM/MES
    timescale: 'shifts-days',
    systems: ['MES', 'ASS-OS-Engine', 'ASS-OS-Agent'],

    // Areas registered under this site
    areas: {},

    // Site-level KPIs (rolled up from areas)
    kpi: {
      availability: 1,
      performance: 1,
      quality: 1,
      oee: 1,
      totalAreas: 0,
      totalEquipment: 0,
      alarmsActive: 0,
      faultsActive: 0,
      depth: 0,
      phi: 0
    },

    // Data flows
    dataDown: ['Recipe', 'Setpoints', 'Commands', 'Schedule'],
    dataUp: ['ProcessData', 'Events', 'Alarms', 'BatchReport'],

    // Methods
    registerArea(area) {
      this.areas[area.id] = area;
      this.kpi.totalAreas = Object.keys(this.areas).length;
      return area;
    },

    rollupKPI() {
      let avail = 0, perf = 0, qual = 0, n = 0;
      let alarms = 0, faults = 0, equip = 0;
      for (const area of Object.values(this.areas)) {
        if (area.kpi) {
          avail += area.kpi.availability || 0;
          perf += area.kpi.performance || 0;
          qual += area.kpi.quality || 0;
          alarms += area.kpi.alarmsActive || 0;
          equip += area.kpi.totalEquipment || 0;
          n++;
        }
      }
      if (n > 0) {
        this.kpi.availability = avail / n;
        this.kpi.performance = perf / n;
        this.kpi.quality = qual / n;
        this.kpi.oee = this.kpi.availability * this.kpi.performance * this.kpi.quality;
      }
      this.kpi.alarmsActive = alarms;
      this.kpi.totalEquipment = equip;
      return this.kpi;
    }
  };
}
