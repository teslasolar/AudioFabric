// enterprise/controlmodule.js — ISA-88 ControlModule factory
// A ControlModule owns I/O points (AI/AO/DI/DO), PID loops, Modbus mappings.
// Leaf of equipment hierarchy — directly interfaces with physical process.

export function createControlModule(id, config = {}) {
  return {
    id,
    name: config.name || id,
    type: 'control_module',
    level: 0,
    state: 'Idle',
    mode: config.mode || 'Automatic',

    // I/O point definitions
    io: {
      AI: config.AI || [],  // Analog Inputs  [{id, name, tagPath, range, engUnit}]
      AO: config.AO || [],  // Analog Outputs [{id, name, tagPath, range, engUnit}]
      DI: config.DI || [],  // Discrete Inputs [{id, name, tagPath}]
      DO: config.DO || [],  // Discrete Outputs [{id, name, tagPath}]
    },

    // PID loops owned by this module
    pid: config.pid || [],  // [{id, pv, sp, cv, kp, ki, kd}]

    // Modbus register map
    modbus: config.modbus || [],  // [{register, type, desc}]

    tags: [],
    capability: config.capability || [],

    kpi: { activation: 0, health: 1, faults: 0 },

    // Collect all tag paths from I/O
    getTagPaths() {
      const paths = [...this.tags];
      for (const ch of ['AI', 'AO', 'DI', 'DO']) {
        for (const pt of this.io[ch]) if (pt.tagPath) paths.push(pt.tagPath);
      }
      for (const p of this.pid) {
        if (p.pv) paths.push(p.pv);
        if (p.sp) paths.push(p.sp);
        if (p.cv) paths.push(p.cv);
      }
      return paths;
    }
  };
}

// ── Convenience: Equipment Module (groups control modules) ──
export function createEquipmentModule(id, config = {}) {
  return {
    id,
    name: config.name || id,
    type: 'equipment_module',
    level: 0,
    state: 'Idle',
    controlModules: {},
    tags: config.tags || [],
    capability: config.capability || [],
    kpi: { activation: 0, health: 1 },

    registerCM(cm) {
      this.controlModules[cm.id] = cm;
      this.tags.push(...cm.getTagPaths());
      return cm;
    },

    getTagPaths() {
      const paths = [...this.tags];
      for (const cm of Object.values(this.controlModules)) {
        paths.push(...cm.getTagPaths());
      }
      return [...new Set(paths)];
    }
  };
}
