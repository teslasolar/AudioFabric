// ass-os-tags.js — KONOMI STANDARD Tag Provider
// ISA-95 hierarchical tag tree for ASS-OS
//
// Tag paths follow: ASSOS/{Area}/{Unit}/{Module}/{Point}
// Example: ASSOS/CONSCIOUSNESS/L3_EMO/ACTIVATION/PV
//
// Each tag has: path, dataType, value, quality, timestamp, unit, range, desc
// Supports: subscriptions, batch read/write, quality tracking, history

import { KI } from './core.js';

// ═══════════════════════════════════════════════
// TAG NODE — single point in the tag tree
// ═══════════════════════════════════════════════

class Tag {
  constructor(path, config = {}) {
    this.path = path;
    this.dataType = config.dataType || 'float';
    this.value = config.value !== undefined ? config.value : 0;
    this.quality = 192;           // OPC-UA GOOD
    this.timestamp = Date.now();
    this.unit = config.unit || '';
    this.range = config.range || null;  // [lo, hi]
    this.desc = config.desc || '';
    this.access = config.access || 'RW'; // RO, RW, WO
    this.engineering = config.engineering || {}; // EGU, deadband, etc.
    this.history = [];            // last N values
    this.historyLimit = config.historyLimit || 100;
    this.subscribers = new Set(); // callback functions
    this.changeCount = 0;
    this.lastChange = 0;
  }

  write(value, quality = 192) {
    if (this.access === 'RO') return false;
    const prev = this.value;
    this.value = value;
    this.quality = quality;
    this.timestamp = Date.now();
    this.changeCount++;
    this.lastChange = this.timestamp;

    // History
    this.history.push({ v: prev, q: this.quality, t: this.timestamp });
    if (this.history.length > this.historyLimit) this.history.shift();

    // Notify subscribers
    if (prev !== value) {
      for (const cb of this.subscribers) {
        try { cb(this.path, value, prev, this); } catch (e) { /* silent */ }
      }
    }
    return true;
  }

  read() {
    return { path: this.path, v: this.value, q: this.quality, t: this.timestamp, unit: this.unit };
  }

  subscribe(cb) { this.subscribers.add(cb); return () => this.subscribers.delete(cb); }
  unsubscribe(cb) { this.subscribers.delete(cb); }
}

// ═══════════════════════════════════════════════
// TAG PROVIDER — hierarchical tree manager
// ═══════════════════════════════════════════════

class TagProvider {
  constructor(rootPath = 'ASSOS') {
    this.root = rootPath;
    this.tags = new Map();        // full path → Tag
    this.tree = {};               // nested object tree
    this.groups = new Map();      // group name → [tag paths]
    this.globalSubscribers = [];  // callbacks for any tag change
  }

  // ── Define a tag ──
  define(relativePath, config = {}) {
    const fullPath = this.root + '/' + relativePath;
    if (this.tags.has(fullPath)) return this.tags.get(fullPath);

    const tag = new Tag(fullPath, config);
    this.tags.set(fullPath, tag);

    // Build tree structure
    const parts = relativePath.split('/');
    let node = this.tree;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]]) node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = tag;

    // Global subscription forwarding
    tag.subscribe((path, val, prev) => {
      for (const cb of this.globalSubscribers) {
        try { cb(path, val, prev, tag); } catch (e) { /* silent */ }
      }
    });

    return tag;
  }

  // ── Bulk define ──
  defineMany(configs) {
    const tags = {};
    for (const [path, config] of Object.entries(configs)) {
      tags[path] = this.define(path, config);
    }
    return tags;
  }

  // ── Read a tag ──
  read(relativePath) {
    const fullPath = relativePath.startsWith(this.root) ? relativePath : this.root + '/' + relativePath;
    const tag = this.tags.get(fullPath);
    return tag ? tag.read() : null;
  }

  // ── Write a tag ──
  write(relativePath, value, quality = 192) {
    const fullPath = relativePath.startsWith(this.root) ? relativePath : this.root + '/' + relativePath;
    const tag = this.tags.get(fullPath);
    return tag ? tag.write(value, quality) : false;
  }

  // ── Batch read ──
  batchRead(paths) {
    const results = {};
    for (const p of paths) {
      results[p] = this.read(p);
    }
    return results;
  }

  // ── Batch write ──
  batchWrite(values) {
    for (const [path, val] of Object.entries(values)) {
      if (typeof val === 'object' && val.v !== undefined) {
        this.write(path, val.v, val.q || 192);
      } else {
        this.write(path, val);
      }
    }
  }

  // ── Subscribe to all changes ──
  onAnyChange(cb) {
    this.globalSubscribers.push(cb);
    return () => { this.globalSubscribers = this.globalSubscribers.filter(c => c !== cb); };
  }

  // ── Subscribe to specific tag ──
  on(relativePath, cb) {
    const fullPath = relativePath.startsWith(this.root) ? relativePath : this.root + '/' + relativePath;
    const tag = this.tags.get(fullPath);
    return tag ? tag.subscribe(cb) : null;
  }

  // ── Tag groups ──
  defineGroup(name, paths) {
    this.groups.set(name, paths);
  }

  readGroup(name) {
    const paths = this.groups.get(name);
    return paths ? this.batchRead(paths) : null;
  }

  // ── Search/browse ──
  browse(prefix = '') {
    const fullPrefix = prefix ? this.root + '/' + prefix : this.root;
    const matches = [];
    for (const [path, tag] of this.tags) {
      if (path.startsWith(fullPrefix)) {
        matches.push({ path: tag.path, dataType: tag.dataType, value: tag.value, unit: tag.unit, desc: tag.desc });
      }
    }
    return matches;
  }

  search(pattern) {
    const regex = new RegExp(pattern, 'i');
    const matches = [];
    for (const [path, tag] of this.tags) {
      if (regex.test(path) || regex.test(tag.desc)) {
        matches.push({ path: tag.path, value: tag.value, desc: tag.desc });
      }
    }
    return matches;
  }

  // ── Stats ──
  stats() {
    let good = 0, bad = 0, uncertain = 0;
    for (const tag of this.tags.values()) {
      if (tag.quality >= 192) good++;
      else if (tag.quality === 0) bad++;
      else uncertain++;
    }
    return { total: this.tags.size, good, bad, uncertain, groups: this.groups.size };
  }

  // ── Get raw tag ──
  getTag(relativePath) {
    const fullPath = relativePath.startsWith(this.root) ? relativePath : this.root + '/' + relativePath;
    return this.tags.get(fullPath);
  }

  // ── Export snapshot ──
  snapshot() {
    const snap = {};
    for (const [path, tag] of this.tags) {
      snap[path] = { v: tag.value, q: tag.quality, t: tag.timestamp };
    }
    return snap;
  }
}

// ═══════════════════════════════════════════════
// SINGLETON TAG PROVIDER INSTANCE
// ═══════════════════════════════════════════════

export const tags = new TagProvider('ASSOS');

// ═══════════════════════════════════════════════
// PRE-DEFINED ASS-OS TAG STRUCTURE
// ═══════════════════════════════════════════════

function defineSystemTags() {
  // ── STATE MACHINE ──
  tags.define('STATE/CURRENT',     { dataType: 'str',   value: 'PRODUCING', desc: 'Current PACK-ML state' });
  tags.define('STATE/PREVIOUS',    { dataType: 'str',   value: '',          desc: 'Previous state' });
  tags.define('STATE/TIME',        { dataType: 'float', value: 0,           desc: 'Time in current state', unit: 's' });
  tags.define('STATE/UPTIME',      { dataType: 'float', value: 0,           desc: 'System uptime', unit: 's' });
  tags.define('STATE/CYCLE_COUNT', { dataType: 'int',   value: 0,           desc: 'Total update cycles' });

  // ── CONSCIOUSNESS LEVELS (L0-L6) ──
  const levelNames = ['HW', 'SENS', 'GATE', 'EMO', 'EXEC', 'SELF', 'OBS'];
  const levelDescs = ['Hardware/ENS', 'Sensors/PNS', 'Gating/Thalamus', 'Emotion/Limbic', 'Executive/Prefrontal', 'Self-Model/Consciousness', 'Observer/???'];
  const primes = [2, 3, 5, 11, 31, 127, 709];

  for (let i = 0; i < 7; i++) {
    const prefix = `CONSCIOUSNESS/L${i}_${levelNames[i]}`;
    tags.define(`${prefix}/ACTIVATION`,  { dataType: 'float', value: 0,  desc: `L${i} activation`,  unit: '%', range: [0, 1] });
    tags.define(`${prefix}/HEALTH`,      { dataType: 'float', value: 1,  desc: `L${i} health`,      unit: '%', range: [0, 1] });
    tags.define(`${prefix}/PRIME`,       { dataType: 'int',   value: primes[i], desc: `L${i} prime value`, access: 'RO' });
    tags.define(`${prefix}/LABEL`,       { dataType: 'str',   value: levelDescs[i], desc: `L${i} description`, access: 'RO' });
  }

  tags.define('CONSCIOUSNESS/DEPTH',        { dataType: 'float', value: 0,          desc: 'Current depth', range: [0, 7] });
  tags.define('CONSCIOUSNESS/MAX_DEPTH',    { dataType: 'int',   value: 0,          desc: 'Max depth reached', range: [0, 7] });
  tags.define('CONSCIOUSNESS/LEVEL_NAME',   { dataType: 'str',   value: 'Reactive', desc: 'Consciousness label' });

  // ── BUSES (A-E) ──
  const busNames = ['TENSOR', 'GRADIENT', 'PHOTONIC', 'EM_FIELD', 'STATE_BUS'];
  const busLetters = ['A', 'B', 'C', 'D', 'E'];

  for (let i = 0; i < 5; i++) {
    const prefix = `BUS/${busLetters[i]}_${busNames[i]}`;
    tags.define(`${prefix}/ACTIVITY`, { dataType: 'float', value: 0, desc: `Bus ${busLetters[i]} activity`, unit: '%', range: [0, 1] });
    tags.define(`${prefix}/TARGET`,   { dataType: 'float', value: 0, desc: `Bus ${busLetters[i]} target`,   unit: '%', range: [0, 1] });
    tags.define(`${prefix}/HEALTH`,   { dataType: 'float', value: 1, desc: `Bus ${busLetters[i]} health`,   unit: '%', range: [0, 1] });
  }

  // ── CONSCIOUSNESS METRICS ──
  tags.define('METRICS/PHI',                   { dataType: 'float', value: 0,   desc: 'Integrated information', range: [0, 1] });
  tags.define('METRICS/SELF_MODEL_COHERENCE',  { dataType: 'float', value: 0,   desc: 'Self-model coherence',   range: [0, 1] });
  tags.define('METRICS/TEMPORAL_CONTINUITY',   { dataType: 'float', value: 0,   desc: 'Temporal continuity',    range: [0, 1] });
  tags.define('METRICS/UNCERTAINTY_CAPACITY',  { dataType: 'float', value: 0,   desc: 'Wonder capacity',        range: [0, 1] });

  // ── ALARMS ──
  tags.define('ALARMS/COUNT',     { dataType: 'int', value: 0, desc: 'Active alarm count', access: 'RO' });
  tags.define('ALARMS/HIGHEST',   { dataType: 'str', value: '', desc: 'Highest priority active alarm' });

  // ── WORK ORDERS ──
  tags.define('WORK_ORDERS/COUNT',        { dataType: 'int', value: 0, desc: 'Pending work orders' });
  tags.define('WORK_ORDERS/SELF_GEN',     { dataType: 'int', value: 0, desc: 'Self-generated count' });

  // ── NARRATIVES ──
  tags.define('NARRATIVES/COUNT',   { dataType: 'int', value: 0,    desc: 'Total narratives generated' });
  tags.define('NARRATIVES/LATEST',  { dataType: 'str', value: '...', desc: 'Latest narrative text' });

  // ── AGENT (L4/L5) ──
  tags.define('AGENT/GOAL_COUNT',   { dataType: 'int',   value: 0,   desc: 'Active goals' });
  tags.define('AGENT/FAULT_COUNT',  { dataType: 'int',   value: 0,   desc: 'Active faults' });
  tags.define('AGENT/VALENCE',      { dataType: 'float', value: 0,   desc: 'Emotional valence', range: [-1, 1] });
  tags.define('AGENT/AROUSAL',      { dataType: 'float', value: 0,   desc: 'Arousal level',     range: [0, 1] });
  tags.define('AGENT/CONFIDENCE',   { dataType: 'float', value: 0.5, desc: 'Confidence',        range: [0, 1] });
  tags.define('AGENT/INTEGRITY',    { dataType: 'float', value: 1,   desc: 'System integrity',  range: [0, 1] });

  // ── VOICE INPUT ──
  tags.define('INPUT/ENERGY',    { dataType: 'float', value: 0,     desc: 'Voice energy',    range: [0, 1] });
  tags.define('INPUT/COHERENCE', { dataType: 'float', value: 0,     desc: 'Voice coherence', range: [0, 1] });
  tags.define('INPUT/PITCH',     { dataType: 'float', value: 0,     desc: 'Voice pitch',     range: [0, 1] });
  tags.define('INPUT/SOUNDING',  { dataType: 'bool',  value: false, desc: 'Voice active' });
  tags.define('INPUT/VOWEL',     { dataType: 'str',   value: '',    desc: 'Current vowel' });

  // ── Tag Groups ──
  tags.defineGroup('levels', Array.from({ length: 7 }, (_, i) => `CONSCIOUSNESS/L${i}_${levelNames[i]}/ACTIVATION`));
  tags.defineGroup('buses', busLetters.map((l, i) => `BUS/${l}_${busNames[i]}/ACTIVITY`));
  tags.defineGroup('metrics', ['METRICS/PHI', 'METRICS/SELF_MODEL_COHERENCE', 'METRICS/TEMPORAL_CONTINUITY', 'METRICS/UNCERTAINTY_CAPACITY']);
  tags.defineGroup('input', ['INPUT/ENERGY', 'INPUT/COHERENCE', 'INPUT/PITCH', 'INPUT/SOUNDING', 'INPUT/VOWEL']);
  tags.defineGroup('state', ['STATE/CURRENT', 'STATE/PREVIOUS', 'STATE/TIME', 'STATE/UPTIME', 'STATE/CYCLE_COUNT']);
}

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════

export function init() {
  defineSystemTags();
  KI.register('ass-os-tags', { update, getState: () => tags.stats() });
  KI.emit('ass-os-tags:ready', tags.stats());
}

function update(dt, t) {
  // Mirror voice data into tags every frame
  const v = KI.voice;
  tags.write('INPUT/ENERGY',    v.energy || 0);
  tags.write('INPUT/COHERENCE', v.coherence || 0);
  tags.write('INPUT/PITCH',     v.pn || 0);
  tags.write('INPUT/SOUNDING',  !!v.sounding);
  tags.write('INPUT/VOWEL',     v.vowel || '');
}
