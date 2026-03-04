// ass-os/db/schemas.js — CREATE TABLE schemas for all ASS-OS databases

export function createSchemas(dbs) {
  const { alarmsDB, workordersDB, narrativesDB, statelogDB, faultsDB, goalsDB, metricsDB, tagsDB } = dbs;

  alarmsDB.createTable('active', {
    id: { type: 'str', primaryKey: true }, tag: { type: 'str', required: true, index: true },
    type: { type: 'str', required: true }, priority: { type: 'int', required: true, index: true },
    state: { type: 'str', required: true, default: 'UNACK' }, message: { type: 'str', required: true },
    consequence: { type: 'str' }, response: { type: 'str' }, source_level: { type: 'int' },
    setpoint: { type: 'float' }, deadband: { type: 'float', default: 0 },
    timestamp_in: { type: 'float', default: () => Date.now() }, timestamp_ack: { type: 'float' },
    ack_user: { type: 'str' }, age: { type: 'float', default: 0 }
  }, { maxRows: 200 });

  alarmsDB.createTable('history', {
    rowid: { type: 'int', autoIncrement: true, primaryKey: true }, id: { type: 'str', index: true },
    tag: { type: 'str' }, type: { type: 'str' }, priority: { type: 'int', index: true },
    state: { type: 'str' }, message: { type: 'str' }, source_level: { type: 'int' },
    timestamp_in: { type: 'float' }, timestamp_out: { type: 'float' }, duration: { type: 'float' }
  }, { maxRows: 1000 });

  alarmsDB.createTable('shelved', {
    id: { type: 'str', primaryKey: true }, reason: { type: 'str' },
    shelved_at: { type: 'float', default: () => Date.now() }, shelve_until: { type: 'float' }
  }, { maxRows: 100 });

  workordersDB.createTable('orders', {
    rowid: { type: 'int', autoIncrement: true, primaryKey: true },
    action: { type: 'str', required: true, index: true }, priority: { type: 'int', required: true },
    valence: { type: 'float', default: 0 }, arousal: { type: 'float', default: 0 },
    salience: { type: 'float', default: 0 }, l4_override: { type: 'bool', default: true },
    source: { type: 'str', default: 'L3', index: true }, status: { type: 'str', default: 'pending', index: true },
    timestamp: { type: 'float', default: 0 }
  }, { maxRows: 500 });

  narrativesDB.createTable('entries', {
    rowid: { type: 'int', autoIncrement: true, primaryKey: true },
    conclusion: { type: 'str', required: true }, confidence: { type: 'float', default: 0.5 },
    evidence_basis: { type: 'bool', default: false }, source: { type: 'str', default: 'L4', index: true },
    timestamp: { type: 'float', default: 0 }
  }, { maxRows: 500 });

  statelogDB.createTable('transitions', {
    rowid: { type: 'int', autoIncrement: true, primaryKey: true },
    from_state: { type: 'str', required: true, index: true }, to_state: { type: 'str', required: true, index: true },
    reason: { type: 'str' }, timestamp: { type: 'float', default: 0 }
  }, { maxRows: 1000 });

  statelogDB.createTable('depth_history', {
    rowid: { type: 'int', autoIncrement: true, primaryKey: true },
    depth: { type: 'float', required: true }, timestamp: { type: 'float', default: 0 }
  }, { maxRows: 2000 });

  faultsDB.createTable('active', {
    id: { type: 'str', primaryKey: true }, label: { type: 'str', required: true }, desc: { type: 'str' },
    severity: { type: 'str', required: true, index: true }, bus_affected: { type: 'str' },
    level_affected: { type: 'str' }, mitigated: { type: 'bool', default: false },
    start_time: { type: 'float', default: 0 }
  }, { maxRows: 50 });

  faultsDB.createTable('history', {
    rowid: { type: 'int', autoIncrement: true, primaryKey: true }, id: { type: 'str', index: true },
    label: { type: 'str' }, severity: { type: 'str' }, start_time: { type: 'float' },
    end_time: { type: 'float' }, mitigated: { type: 'bool' }, resolution: { type: 'str' }
  }, { maxRows: 500 });

  goalsDB.createTable('stack', {
    rowid: { type: 'int', autoIncrement: true, primaryKey: true },
    type: { type: 'str', required: true, index: true }, target: { type: 'str', required: true },
    desc: { type: 'str' }, priority: { type: 'int', required: true },
    status: { type: 'str', default: 'active', index: true }, created: { type: 'float', default: 0 }
  }, { maxRows: 50 });

  metricsDB.createTable('timeseries', {
    rowid: { type: 'int', autoIncrement: true, primaryKey: true },
    phi: { type: 'float' }, coherence: { type: 'float' }, temporal: { type: 'float' },
    uncertainty: { type: 'float' }, depth: { type: 'float' }, bus_total: { type: 'float' },
    level_total: { type: 'float' }, state: { type: 'str' }, timestamp: { type: 'float', default: 0 }
  }, { maxRows: 5000 });

  metricsDB.createTable('kpi', {
    id: { type: 'str', primaryKey: true }, availability: { type: 'float', default: 1 },
    performance: { type: 'float', default: 1 }, quality: { type: 'float', default: 1 },
    oee: { type: 'float', default: 1 }, alarm_rate: { type: 'float', default: 0 },
    mtbf: { type: 'float', default: 0 }, mttr: { type: 'float', default: 0 },
    updated: { type: 'float', default: 0 }
  }, { maxRows: 10 });

  tagsDB.createTable('snapshots', {
    rowid: { type: 'int', autoIncrement: true, primaryKey: true },
    tag_path: { type: 'str', required: true, index: true }, value: { type: 'any' },
    quality: { type: 'int', default: 192 }, timestamp: { type: 'float', default: 0 }
  }, { maxRows: 10000 });
}
