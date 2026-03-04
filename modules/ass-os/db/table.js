// ass-os/db/table.js — Single table within a database

export class Table {
  constructor(name, schema, opts = {}) {
    this.name = name;
    this.schema = schema;
    this.rows = [];
    this.autoIncrement = 0;
    this.maxRows = opts.maxRows || 10000;
    this.primaryKey = null;
    this.indexes = new Map();
    for (const [col, def] of Object.entries(schema)) {
      if (def.primaryKey) { this.primaryKey = col; this.indexes.set(col, new Map()); }
      if (def.index) this.indexes.set(col, new Map());
    }
  }

  insert(row) {
    const record = {};
    for (const [col, def] of Object.entries(this.schema)) {
      if (row[col] !== undefined) record[col] = row[col];
      else if (def.autoIncrement) record[col] = ++this.autoIncrement;
      else if (def.default !== undefined) record[col] = typeof def.default === 'function' ? def.default() : def.default;
      else if (def.required) record[col] = null;
    }
    if (this.rows.length >= this.maxRows) this._removeRow(0);
    const idx = this.rows.length;
    this.rows.push(record);
    for (const [col, index] of this.indexes) {
      const val = record[col];
      if (!index.has(val)) index.set(val, new Set());
      index.get(val).add(idx);
    }
    return record;
  }

  select(where = null, opts = {}) {
    let results;
    if (where && typeof where === 'object' && Object.keys(where).length === 1) {
      const [col, val] = Object.entries(where)[0];
      if (this.indexes.has(col) && typeof val !== 'object') {
        const idxSet = this.indexes.get(col).get(val);
        results = idxSet ? Array.from(idxSet).map(i => this.rows[i]).filter(Boolean) : [];
      }
    }
    if (!results) results = where ? this.rows.filter(r => r && this._matchWhere(r, where)) : this.rows.filter(Boolean);
    if (opts.orderBy) { const desc = opts.order === 'DESC'; results.sort((a, b) => { const va = a[opts.orderBy], vb = b[opts.orderBy]; return va < vb ? (desc ? 1 : -1) : va > vb ? (desc ? -1 : 1) : 0; }); }
    if (opts.offset) results = results.slice(opts.offset);
    if (opts.limit) results = results.slice(0, opts.limit);
    if (opts.columns) results = results.map(r => { const o = {}; for (const c of opts.columns) o[c] = r[c]; return o; });
    return results;
  }

  selectOne(where) { return this.select(where, { limit: 1 })[0] || null; }

  update(where, updates) {
    let count = 0;
    for (let i = 0; i < this.rows.length; i++) { if (this.rows[i] && this._matchWhere(this.rows[i], where)) { Object.assign(this.rows[i], updates); count++; } }
    return count;
  }

  delete(where) {
    let count = 0;
    for (let i = this.rows.length - 1; i >= 0; i--) { if (this.rows[i] && this._matchWhere(this.rows[i], where)) { this._removeRow(i); count++; } }
    return count;
  }

  count(where = null) { return where ? this.rows.filter(r => r && this._matchWhere(r, where)).length : this.rows.filter(Boolean).length; }
  clear() { this.rows = []; this.autoIncrement = 0; for (const idx of this.indexes.values()) idx.clear(); }
  last(n = 1) { return this.rows.filter(Boolean).slice(-n); }

  _matchWhere(row, where) {
    for (const [key, val] of Object.entries(where)) {
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        for (const [op, operand] of Object.entries(val)) {
          switch (op) {
            case '$gt':  if (!(row[key] > operand)) return false; break;
            case '$lt':  if (!(row[key] < operand)) return false; break;
            case '$gte': if (!(row[key] >= operand)) return false; break;
            case '$lte': if (!(row[key] <= operand)) return false; break;
            case '$ne':  if (row[key] === operand) return false; break;
            case '$in':  if (!operand.includes(row[key])) return false; break;
            case '$like': if (!new RegExp(operand.replace(/%/g, '.*'), 'i').test(row[key])) return false; break;
          }
        }
      } else { if (row[key] !== val) return false; }
    }
    return true;
  }

  _removeRow(idx) {
    const row = this.rows[idx]; if (!row) return;
    for (const [col, index] of this.indexes) { const s = index.get(row[col]); if (s) { s.delete(idx); if (s.size === 0) index.delete(row[col]); } }
    this.rows[idx] = null;
  }

  compact() {
    this.rows = this.rows.filter(Boolean);
    for (const [col, index] of this.indexes) { index.clear(); for (let i = 0; i < this.rows.length; i++) { const val = this.rows[i][col]; if (!index.has(val)) index.set(val, new Set()); index.get(val).add(i); } }
  }

  toJSON() { return { name: this.name, rows: this.rows.filter(Boolean), autoIncrement: this.autoIncrement }; }
  fromJSON(data) { this.rows = data.rows || []; this.autoIncrement = data.autoIncrement || this.rows.length; this.compact(); }
}
