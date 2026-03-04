// ass-os/tags/provider.js — Hierarchical tag tree manager

import { Tag } from './tag.js';

export class TagProvider {
  constructor(rootPath = 'ASSOS') {
    this.root = rootPath;
    this.tags = new Map();
    this.tree = {};
    this.groups = new Map();
    this.globalSubscribers = [];
  }

  define(relativePath, config = {}) {
    const fullPath = this.root + '/' + relativePath;
    if (this.tags.has(fullPath)) return this.tags.get(fullPath);
    const tag = new Tag(fullPath, config);
    this.tags.set(fullPath, tag);
    const parts = relativePath.split('/');
    let node = this.tree;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]]) node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = tag;
    tag.subscribe((path, val, prev) => {
      for (const cb of this.globalSubscribers) { try { cb(path, val, prev, tag); } catch (e) {} }
    });
    return tag;
  }

  defineMany(configs) {
    const tags = {};
    for (const [path, config] of Object.entries(configs)) tags[path] = this.define(path, config);
    return tags;
  }

  _fullPath(p) { return p.startsWith(this.root) ? p : this.root + '/' + p; }

  read(relativePath) { const tag = this.tags.get(this._fullPath(relativePath)); return tag ? tag.read() : null; }
  write(relativePath, value, quality = 192) { const tag = this.tags.get(this._fullPath(relativePath)); return tag ? tag.write(value, quality) : false; }

  batchRead(paths) { const r = {}; for (const p of paths) r[p] = this.read(p); return r; }
  batchWrite(values) { for (const [path, val] of Object.entries(values)) {
    if (typeof val === 'object' && val.v !== undefined) this.write(path, val.v, val.q || 192);
    else this.write(path, val);
  }}

  onAnyChange(cb) { this.globalSubscribers.push(cb); return () => { this.globalSubscribers = this.globalSubscribers.filter(c => c !== cb); }; }
  on(relativePath, cb) { const tag = this.tags.get(this._fullPath(relativePath)); return tag ? tag.subscribe(cb) : null; }

  defineGroup(name, paths) { this.groups.set(name, paths); }
  readGroup(name) { const paths = this.groups.get(name); return paths ? this.batchRead(paths) : null; }

  browse(prefix = '') {
    const fp = prefix ? this.root + '/' + prefix : this.root;
    const m = [];
    for (const [path, tag] of this.tags) if (path.startsWith(fp)) m.push({ path: tag.path, dataType: tag.dataType, value: tag.value, unit: tag.unit, desc: tag.desc });
    return m;
  }

  search(pattern) {
    const re = new RegExp(pattern, 'i'); const m = [];
    for (const [, tag] of this.tags) if (re.test(tag.path) || re.test(tag.desc)) m.push({ path: tag.path, value: tag.value, desc: tag.desc });
    return m;
  }

  getTag(relativePath) { return this.tags.get(this._fullPath(relativePath)); }

  stats() {
    let good = 0, bad = 0, uncertain = 0;
    for (const tag of this.tags.values()) { if (tag.quality >= 192) good++; else if (tag.quality === 0) bad++; else uncertain++; }
    return { total: this.tags.size, good, bad, uncertain, groups: this.groups.size };
  }

  snapshot() { const s = {}; for (const [path, tag] of this.tags) s[path] = { v: tag.value, q: tag.quality, t: tag.timestamp }; return s; }
}
