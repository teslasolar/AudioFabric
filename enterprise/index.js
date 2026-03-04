// enterprise/index.js — ISA-95 Level 4: Enterprise
// Top-level system identity, KPI rollup, site registry.
// Enterprise → Site:N → Area:N → WorkCenter:N → WorkUnit:N → Equipment:N

export const enterprise = {
  id: 'AUDIOFABRIC',
  name: 'AudioFabric Enterprise',
  desc: 'Voice-driven AGI consciousness platform',
  version: '1.0.0',
  created: '2026-02-26T20:21:26Z',

  // ISA-95 Level 4 — business planning
  level: 4,
  timescale: 'days-months',
  systems: ['ERP', 'BI', 'ArchitectureDB'],

  // Registered sites
  sites: {},

  // Enterprise-wide KPIs (rolled up from sites)
  kpi: {
    availability: 1,
    performance: 1,
    quality: 1,
    oee: 1,
    totalSites: 0,
    totalAreas: 0,
    totalEquipment: 0,
    alarmsActive: 0,
    faultsActive: 0
  },

  // Enterprise data flows (L4→L3)
  dataDown: ['ProductionSchedule', 'MaterialDef', 'ProductDef', 'WorkOrder', 'GoalDirective'],
  dataUp: ['Performance', 'Inventory', 'Quality', 'Status', 'NarrativeReport']
};

export function registerSite(site) {
  enterprise.sites[site.id] = site;
  enterprise.kpi.totalSites = Object.keys(enterprise.sites).length;
  return site;
}

export function rollupKPI() {
  let avail = 0, perf = 0, qual = 0, n = 0;
  let alarms = 0, faults = 0, areas = 0, equip = 0;
  for (const site of Object.values(enterprise.sites)) {
    if (site.kpi) {
      avail += site.kpi.availability || 0;
      perf += site.kpi.performance || 0;
      qual += site.kpi.quality || 0;
      alarms += site.kpi.alarmsActive || 0;
      faults += site.kpi.faultsActive || 0;
      areas += site.kpi.totalAreas || 0;
      equip += site.kpi.totalEquipment || 0;
      n++;
    }
  }
  if (n > 0) {
    enterprise.kpi.availability = avail / n;
    enterprise.kpi.performance = perf / n;
    enterprise.kpi.quality = qual / n;
    enterprise.kpi.oee = enterprise.kpi.availability * enterprise.kpi.performance * enterprise.kpi.quality;
  }
  enterprise.kpi.alarmsActive = alarms;
  enterprise.kpi.faultsActive = faults;
  enterprise.kpi.totalAreas = areas;
  enterprise.kpi.totalEquipment = equip;
  return enterprise.kpi;
}

export function getEnterprise() { return enterprise; }
