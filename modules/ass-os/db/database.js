// ass-os/db/database.js — Collection of tables with persistence

import { Table } from './table.js';

export class Database {
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

  save() {
    try {
      const data = { name: this.name, version: this.version, tables: {} };
      for (const [name, table] of this.tables) data.tables[name] = table.toJSON();
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
    for (const [name, table] of this.tables) s.tables[name] = { rows: table.count(), maxRows: table.maxRows };
    return s;
  }
}
