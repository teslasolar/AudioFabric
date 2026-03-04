// ass-os-db.js — KONOMI STANDARD In-Memory SQLite-like Database
// Provides persistent storage for UDT instances across separate "databases":
//   - alarms.db     → ISA-18.2 alarm instances + history
//   - workorders.db → Work order instances
//   - narratives.db → L4/L5 narrative instances
//   - statelog.db   → PACK-ML state transition history
//   - faults.db     → Fault model instances + history
//   - goals.db      → Agent goal instances
//   - metrics.db    → Consciousness metrics time-series
//   - tags.db       → Tag snapshot persistence
//
// Each DB supports: CREATE TABLE, INSERT, SELECT, UPDATE, DELETE, COUNT
// With WHERE clause, ORDER BY, LIMIT, and localStorage persistence.

import { KI } from './core.js';

// ═══════════════════════════════════════════════
// TABLE — single table within a database
// ═══════════════════════════════════════════════

class Table {
  constructor(name, schema, opts = {}) {
    this.name = name;
    this.schema = schema;         // { col: { type, required, default, primaryKey } }
    this.rows = [];
    this.autoIncrement = 0;
    this.maxRows = opts.maxRows || 10000;
    this.primaryKey = null;
    this.indexes = new Map();     // col → Map(value → Set(rowIndex))

    // Find primary key
    for (const [col, def] of Object.entries(schema)) {
      if (def.primaryKey) {
        this.primaryKey = col;
        this.indexes.set(col, new Map());
      }
      if (def.index) {
        this.indexes.set(col, new Map());
      }
    }
  }

  insert(row) {
    // Apply defaults
    const record = {};
    for (const [col, def] of Object.entries(this.schema)) {
      if (row[col] !== undefined) {
        record[col] = row[col];
      } else if (def.autoIncrement) {
        record[col] = ++this.autoIncrement;
      } else if (def.default !== undefined) {
        record[col] = typeof def.default === 'function' ? def.default() : def.default;
      } else if (def.required) {
        record[col] = null; // Missing required field
      }
    }

    // Enforce max rows (FIFO eviction)
    if (this.rows.length >= this.maxRows) {
      this._removeRow(0);
    }

    const idx = this.rows.length;
    this.rows.push(record);

    // Update indexes
    for (const [col, index] of this.indexes) {
      const val = record[col];
      if (!index.has(val)) index.set(val, new Set());
      index.get(val).add(idx);
    }

    return record;
  }

  select(where = null, opts = {}) {
    let results;

    // Use index if possible
    if (where && typeof where === 'object' && Object.keys(where).length === 1) {
      const [col, val] = Object.entries(where)[0];
      if (this.indexes.has(col)) {
        const index = this.indexes.get(col);
        const idxSet = index.get(val);
        results = idxSet ? Array.from(idxSet).map(i => this.rows[i]).filter(Boolean) : [];
      }
    }

    if (!results) {
      results = where ? this.rows.filter(r => r && this._matchWhere(r, where)) : this.rows.filter(Boolean);
    }

    // ORDER BY
    if (opts.orderBy) {
      const desc = opts.order === 'DESC';
      results.sort((a, b) => {
        const va = a[opts.orderBy], vb = b[opts.orderBy];
        if (va < vb) return desc ? 1 : -1;
        if (va > vb) return desc ? -1 : 1;
        return 0;
      });
    }

    // OFFSET
    if (opts.offset) {
      results = results.slice(opts.offset);
    }

    // LIMIT
    if (opts.limit) {
      results = results.slice(0, opts.limit);
    }

    // SELECT specific columns
    if (opts.columns) {
      results = results.map(r => {
        const out = {};
        for (const c of opts.columns) out[c] = r[c];
        return out;
      });
    }

    return results;
  }

  selectOne(where) {
    const results = this.select(where, { limit: 1 });
    return results[0] || null;
  }

  update(where, updates) {
    let count = 0;
    for (let i = 0; i < this.rows.length; i++) {
      if (this.rows[i] && this._matchWhere(this.rows[i], where)) {
        Object.assign(this.rows[i], updates);
        count++;
      }
    }
    return count;
  }

  delete(where) {
    let count = 0;
    for (let i = this.rows.length - 1; i >= 0; i--) {
      if (this.rows[i] && this._matchWhere(this.rows[i], where)) {
        this._removeRow(i);
        count++;
      }
    }
    return count;
  }

  count(where = null) {
    if (!where) return this.rows.filter(Boolean).length;
    return this.rows.filter(r => r && this._matchWhere(r, where)).length;
  }

  clear() {
    this.rows = [];
    this.autoIncrement = 0;
    for (const index of this.indexes.values()) index.clear();
  }

  last(n = 1) {
    const valid = this.rows.filter(Boolean);
    return valid.slice(-n);
  }

  _matchWhere(row, where) {
    for (const [key, val] of Object.entries(where)) {
      // Support operators: { col: { $gt, $lt, $gte, $lte, $ne, $in, $like } }
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        for (const [op, operand] of Object.entries(val)) {
          switch (op) {
            case '$gt':   if (!(row[key] > operand)) return false; break;
            case '$lt':   if (!(row[key] < operand)) return false; break;
            case '$gte':  if (!(row[key] >= operand)) return false; break;
            case '$lte':  if (!(row[key] <= operand)) return false; break;
            case '$ne':   if (row[key] === operand) return false; break;
            case '$in':   if (!operand.includes(row[key])) return false; break;
            case '$like':
              if (!new RegExp(operand.replace(/%/g, '.*'), 'i').test(row[key])) return false;
              break;
          }
        }
      } else {
        if (row[key] !== val) return false;
      }
    }
    return true;
  }

  _removeRow(idx) {
    const row = this.rows[idx];
    if (!row) return;
    for (const [col, index] of this.indexes) {
      const val = row[col];
      const s = index.get(val);
      if (s) { s.delete(idx); if (s.size === 0) index.delete(val); }
    }
    this.rows[idx] = null; // Tombstone
  }

  // Compact (remove tombstones, rebuild indexes)
  compact() {
    this.rows = this.rows.filter(Boolean);
    for (const [col, index] of this.indexes) {
      index.clear();
      for (let i = 0; i < this.rows.length; i++) {
        const val = this.rows[i][col];
        if (!index.has(val)) index.set(val, new Set());
        index.get(val).add(i);
      }
    }
  }

  toJSON() {
    return { name: this.name, rows: this.rows.filter(Boolean), autoIncrement: this.autoIncrement };
  }

  fromJSON(data) {
    this.rows = data.rows || [];
    this.autoIncrement = data.autoIncrement || this.rows.length;
    this.compact(); // Rebuild indexes
  }
}

// ═══════════════════════════════════════════════
// DATABASE — collection of tables
// ═══════════════════════════════════════════════

class Database {
  constructor(name) {
    this.name = name;
    this.tables = new Map();
    this.version = 1;
  }

  createTable(name, schema, opts = {}) {
    if (this.tables.has(name)) return this.tables.get(name);
    const table = new Table(name, schema, opts);
    this.tables.set(name, table);
    return table;
  }

  table(name) { return this.tables.get(name); }
  dropTable(name) { this.tables.delete(name); }
  listTables() { return Array.from(this.tables.keys()); }

  // Persistence to localStorage
  save() {
    try {
      const data = { name: this.name, version: this.version, tables: {} };
      for (const [name, table] of this.tables) {
        data.tables[name] = table.toJSON();
      }
      localStorage.setItem('assosdb_' + this.name, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  }

  load() {
    try {
      const raw = localStorage.getItem('assosdb_' + this.name);
      if (!raw) return false;
      const data = JSON.parse(raw);
      for (const [name, tableData] of Object.entries(data.tables)) {
        const table = this.tables.get(name);
        if (table) table.fromJSON(tableData);
      }
      return true;
    } catch (e) { return false; }
  }

  stats() {
    const s = { name: this.name, tables: {} };
    for (const [name, table] of this.tables) {
      s.tables[name] = { rows: table.count(), maxRows: table.maxRows };
    }
    return s;
  }
}

// ═══════════════════════════════════════════════
// ASS-OS DATABASE INSTANCES
// ═══════════════════════════════════════════════

// Each "database" is a separate logical unit (like separate .db files)

export const alarmsDB = new Database('alarms');
export const workordersDB = new Database('workorders');
export const narrativesDB = new Database('narratives');
export const statelogDB = new Database('statelog');
export const faultsDB = new Database('faults');
export const goalsDB = new Database('goals');
export const metricsDB = new Database('metrics');
export const tagsDB = new Database('tags');

// ═══════════════════════════════════════════════
// TABLE SCHEMAS (CREATE TABLE equivalents)
// ═══════════════════════════════════════════════

function createSchemas() {
  // ── alarms.db ──
  alarmsDB.createTable('active', {
    id:          { type: 'str',   primaryKey: true },
    tag:         { type: 'str',   required: true, index: true },
    type:        { type: 'str',   required: true },
    priority:    { type: 'int',   required: true, index: true },
    state:       { type: 'str',   required: true, default: 'UNACK' },
    message:     { type: 'str',   required: true },
    consequence: { type: 'str' },
    response:    { type: 'str' },
    source_level:{ type: 'int' },
    setpoint:    { type: 'float' },
    deadband:    { type: 'float', default: 0 },
    timestamp_in:{ type: 'float', default: () => Date.now() },
    timestamp_ack:{ type: 'float' },
    ack_user:    { type: 'str' },
    age:         { type: 'float', default: 0 }
  }, { maxRows: 200 });

  alarmsDB.createTable('history', {
    rowid:       { type: 'int',   autoIncrement: true, primaryKey: true },
    id:          { type: 'str',   index: true },
    tag:         { type: 'str' },
    type:        { type: 'str' },
    priority:    { type: 'int',   index: true },
    state:       { type: 'str' },
    message:     { type: 'str' },
    source_level:{ type: 'int' },
    timestamp_in:{ type: 'float' },
    timestamp_out:{ type: 'float' },
    duration:    { type: 'float' }
  }, { maxRows: 1000 });

  alarmsDB.createTable('shelved', {
    id:          { type: 'str',   primaryKey: true },
    reason:      { type: 'str' },
    shelved_at:  { type: 'float', default: () => Date.now() },
    shelve_until:{ type: 'float' }
  }, { maxRows: 100 });

  // ── workorders.db ──
  workordersDB.createTable('orders', {
    rowid:      { type: 'int',   autoIncrement: true, primaryKey: true },
    action:     { type: 'str',   required: true, index: true },
    priority:   { type: 'int',   required: true },
    valence:    { type: 'float', default: 0 },
    arousal:    { type: 'float', default: 0 },
    salience:   { type: 'float', default: 0 },
    l4_override:{ type: 'bool',  default: true },
    source:     { type: 'str',   default: 'L3', index: true },
    status:     { type: 'str',   default: 'pending', index: true },
    timestamp:  { type: 'float', default: 0 }
  }, { maxRows: 500 });

  // ── narratives.db ──
  narrativesDB.createTable('entries', {
    rowid:          { type: 'int',   autoIncrement: true, primaryKey: true },
    conclusion:     { type: 'str',   required: true },
    confidence:     { type: 'float', default: 0.5 },
    evidence_basis: { type: 'bool',  default: false },
    source:         { type: 'str',   default: 'L4', index: true },
    timestamp:      { type: 'float', default: 0 }
  }, { maxRows: 500 });

  // ── statelog.db ──
  statelogDB.createTable('transitions', {
    rowid:     { type: 'int',   autoIncrement: true, primaryKey: true },
    from_state:{ type: 'str',   required: true, index: true },
    to_state:  { type: 'str',   required: true, index: true },
    reason:    { type: 'str' },
    timestamp: { type: 'float', default: 0 }
  }, { maxRows: 1000 });

  statelogDB.createTable('depth_history', {
    rowid:     { type: 'int',   autoIncrement: true, primaryKey: true },
    depth:     { type: 'float', required: true },
    timestamp: { type: 'float', default: 0 }
  }, { maxRows: 2000 });

  // ── faults.db ──
  faultsDB.createTable('active', {
    id:         { type: 'str',   primaryKey: true },
    label:      { type: 'str',   required: true },
    desc:       { type: 'str' },
    severity:   { type: 'str',   required: true, index: true },
    bus_affected: { type: 'str' },  // JSON array
    level_affected:{ type: 'str' }, // JSON array
    mitigated:  { type: 'bool',  default: false },
    start_time: { type: 'float', default: 0 }
  }, { maxRows: 50 });

  faultsDB.createTable('history', {
    rowid:      { type: 'int',   autoIncrement: true, primaryKey: true },
    id:         { type: 'str',   index: true },
    label:      { type: 'str' },
    severity:   { type: 'str' },
    start_time: { type: 'float' },
    end_time:   { type: 'float' },
    mitigated:  { type: 'bool' },
    resolution: { type: 'str' }
  }, { maxRows: 500 });

  // ── goals.db ──
  goalsDB.createTable('stack', {
    rowid:    { type: 'int',  autoIncrement: true, primaryKey: true },
    type:     { type: 'str',  required: true, index: true },
    target:   { type: 'str',  required: true },
    desc:     { type: 'str' },
    priority: { type: 'int',  required: true },
    status:   { type: 'str',  default: 'active', index: true },
    created:  { type: 'float', default: 0 }
  }, { maxRows: 50 });

  // ── metrics.db ──
  metricsDB.createTable('timeseries', {
    rowid:       { type: 'int',   autoIncrement: true, primaryKey: true },
    phi:         { type: 'float' },
    coherence:   { type: 'float' },
    temporal:    { type: 'float' },
    uncertainty: { type: 'float' },
    depth:       { type: 'float' },
    bus_total:   { type: 'float' },
    level_total: { type: 'float' },
    state:       { type: 'str' },
    timestamp:   { type: 'float', default: 0 }
  }, { maxRows: 5000 });

  metricsDB.createTable('kpi', {
    id:           { type: 'str',   primaryKey: true },
    availability: { type: 'float', default: 1 },
    performance:  { type: 'float', default: 1 },
    quality:      { type: 'float', default: 1 },
    oee:          { type: 'float', default: 1 },
    alarm_rate:   { type: 'float', default: 0 },
    mtbf:         { type: 'float', default: 0 },
    mttr:         { type: 'float', default: 0 },
    updated:      { type: 'float', default: 0 }
  }, { maxRows: 10 });

  // ── tags.db ──
  tagsDB.createTable('snapshots', {
    rowid:     { type: 'int',   autoIncrement: true, primaryKey: true },
    tag_path:  { type: 'str',   required: true, index: true },
    value:     { type: 'any' },
    quality:   { type: 'int',   default: 192 },
    timestamp: { type: 'float', default: 0 }
  }, { maxRows: 10000 });
}

// ═══════════════════════════════════════════════
// CONVENIENCE API
// ═══════════════════════════════════════════════

export function allDBs() {
  return { alarmsDB, workordersDB, narrativesDB, statelogDB, faultsDB, goalsDB, metricsDB, tagsDB };
}

export function allStats() {
  return {
    alarms:     alarmsDB.stats(),
    workorders: workordersDB.stats(),
    narratives: narrativesDB.stats(),
    statelog:   statelogDB.stats(),
    faults:     faultsDB.stats(),
    goals:      goalsDB.stats(),
    metrics:    metricsDB.stats(),
    tags:       tagsDB.stats()
  };
}

export function saveAll() {
  let ok = 0;
  for (const db of Object.values(allDBs())) {
    if (db.save()) ok++;
  }
  return ok;
}

export function loadAll() {
  let ok = 0;
  for (const db of Object.values(allDBs())) {
    if (db.load()) ok++;
  }
  return ok;
}

// ═══════════════════════════════════════════════
// ALARM METRICS (ISA-18.2 KPI calculations)
// ═══════════════════════════════════════════════

export function calculateAlarmMetrics() {
  const active = alarmsDB.table('active');
  const history = alarmsDB.table('history');
  if (!active || !history) return null;

  const now = Date.now();
  const activeCount = active.count();

  // Alarm rate (per hour, last hour)
  const oneHourAgo = now - 3600000;
  const recentAlarms = history.select({ timestamp_in: { $gte: oneHourAgo } });
  const alarmRate = recentAlarms.length;

  // Flood detection (>10 in 10 min)
  const tenMinAgo = now - 600000;
  const floodAlarms = history.select({ timestamp_in: { $gte: tenMinAgo } });
  const isFlood = floodAlarms.length > 10;

  // Stale alarms (active > 24hr)
  const staleAlarms = active.select({ age: { $gt: 86400 } });

  // Priority distribution
  const byPriority = {};
  for (let p = 1; p <= 4; p++) {
    byPriority['P' + p] = active.count({ priority: p });
  }

  return {
    activeCount, alarmRate, isFlood,
    staleCount: staleAlarms.length,
    byPriority,
    totalHistorical: history.count()
  };
}

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════

let metricsTimer = 0;

export function init() {
  createSchemas();

  // Try to load persisted data
  loadAll();

  // Seed KPI record if empty
  const kpi = metricsDB.table('kpi');
  if (kpi.count() === 0) {
    kpi.insert({ id: 'ASSOS_OEE', availability: 1, performance: 1, quality: 1, oee: 1, alarm_rate: 0, mtbf: 0, mttr: 0, updated: Date.now() });
  }

  KI.register('ass-os-db', { update, getState: allStats });
  KI.emit('ass-os-db:ready', allStats());
}

function update(dt, t) {
  // Periodic metrics snapshot (every 2 seconds)
  metricsTimer += dt;
  if (metricsTimer > 2) {
    metricsTimer = 0;
    // Emit DB stats for any listeners
    KI.emit('ass-os-db:stats', allStats());
  }

  // Auto-save every 30 seconds
  if (Math.floor(t) % 30 === 0 && Math.floor(t) !== Math.floor(t - dt)) {
    saveAll();
  }
}
