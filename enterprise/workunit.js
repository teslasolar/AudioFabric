// enterprise/workunit.js — ISA-95 WorkUnit / ISA-88 Unit
// A workunit is a single functional processing unit with equipment.
// Owns tags, alarms, and equipment modules.

export function createWorkunit(id, config = {}) {
  return {
    id,
    name: config.name || id,
    desc: config.desc || '',
    level: 1, // ISA-95 Level 1 — Direct control
    timescale: 'ms-sec',

    equipment: {},
    tags: config.tags || [],     // tag paths owned by this unit
    alarms: config.alarms || [], // alarm IDs relevant to this unit

    kpi: {
      activation: 0,
      health: 1,
      alarmsActive: 0,
      cycleTime: 0
    },

    state: 'IDLE',
    mode: 'Automatic', // Automatic|Manual|Semiauto

    controlModules: {},

    registerEquipment(eq) {
      this.equipment[eq.id] = eq;
      return eq;
    },

    registerControlModule(cm) {
      this.controlModules[cm.id] = cm;
      return cm;
    },

    getTagPaths() {
      const paths = [...this.tags];
      for (const eq of Object.values(this.equipment)) {
        if (eq.tags) paths.push(...eq.tags);
      }
      for (const cm of Object.values(this.controlModules)) {
        if (cm.getTagPaths) paths.push(...cm.getTagPaths());
      }
      return [...new Set(paths)];
    }
  };
}
