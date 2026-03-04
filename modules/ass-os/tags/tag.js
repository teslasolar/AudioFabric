// ass-os/tags/tag.js — Single tag point in the hierarchy

export class Tag {
  constructor(path, config = {}) {
    this.path = path;
    this.dataType = config.dataType || 'float';
    this.value = config.value !== undefined ? config.value : 0;
    this.quality = 192;           // OPC-UA GOOD
    this.timestamp = Date.now();
    this.unit = config.unit || '';
    this.range = config.range || null;
    this.desc = config.desc || '';
    this.access = config.access || 'RW';
    this.history = [];
    this.historyLimit = config.historyLimit || 100;
    this.subscribers = new Set();
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
    this.history.push({ v: prev, q: this.quality, t: this.timestamp });
    if (this.history.length > this.historyLimit) this.history.shift();
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
