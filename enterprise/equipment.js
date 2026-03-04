// enterprise/equipment.js — ISA-95 Equipment / ISA-88 EquipmentModule + ControlModule
// Leaf-level: a bus, sensor, actuator, or processing element.

export function createEquipment(id, config = {}) {
  return {
    id,
    name: config.name || id,
    desc: config.desc || '',
    type: config.type || 'generic', // bus|sensor|actuator|processor|gate|model
    level: 0, // ISA-95 Level 0 — Physical process

    tags: config.tags || [],
    capability: config.capability || [],
    state: 'Idle', // Idle|Running|Faulted|Maintenance|Offline
    mode: 'Automatic',

    io: config.io || [], // control module I/O points

    kpi: {
      activation: 0,
      health: 1,
      mtbf: 0,
      mttr: 0
    }
  };
}

// ── Convenience factories ──

export function createBus(letter, name, config = {}) {
  return createEquipment(`BUS_${letter}`, {
    name: `Bus ${letter}: ${name}`,
    type: 'bus',
    tags: [`BUS/${letter}_${name}/ACTIVITY`, `BUS/${letter}_${name}/TARGET`, `BUS/${letter}_${name}/HEALTH`],
    capability: ['data-transport', 'cross-coupling'],
    ...config
  });
}

export function createSensor(id, name, tagPath, config = {}) {
  return createEquipment(id, {
    name, type: 'sensor',
    tags: [tagPath],
    capability: ['measure'],
    io: [{ name: 'PV', type: 'AI', path: tagPath }],
    ...config
  });
}

export function createProcessor(id, name, config = {}) {
  return createEquipment(id, {
    name, type: 'processor',
    capability: ['compute', 'transform'],
    ...config
  });
}

export function createGate(id, name, config = {}) {
  return createEquipment(id, {
    name, type: 'gate',
    capability: ['filter', 'route', 'inhibit'],
    ...config
  });
}
