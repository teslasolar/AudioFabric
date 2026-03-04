// enterprise/workcenter.js — ISA-95 WorkCenter / ISA-88 ProcessCell
// A workcenter owns a consciousness level and its associated equipment.
// Maps to ISA-88 ProcessCell for batch coordination.

export function createWorkcenter(id, config = {}) {
  return {
    id,
    name: config.name || id,
    desc: config.desc || '',
    level: config.isaLevel || 2,
    consciousnessLevel: config.consciousnessLevel, // L0-L6
    prime: config.prime || 1,

    workunits: {},

    kpi: {
      availability: 1,
      alarmsActive: 0,
      totalEquipment: 0,
      activation: 0,
      health: 1
    },

    state: 'IDLE', // PackML unit state

    registerWorkunit(wu) {
      this.workunits[wu.id] = wu;
      this.kpi.totalEquipment += Object.keys(wu.equipment || {}).length;
      return wu;
    },

    rollupKPI() {
      let act = 0, hp = 0, n = 0, alarms = 0;
      for (const wu of Object.values(this.workunits)) {
        if (wu.kpi) {
          act += wu.kpi.activation || 0;
          hp += wu.kpi.health || 0;
          alarms += wu.kpi.alarmsActive || 0;
          n++;
        }
      }
      if (n > 0) { this.kpi.activation = act / n; this.kpi.health = hp / n; }
      this.kpi.alarmsActive = alarms;
      return this.kpi;
    }
  };
}
