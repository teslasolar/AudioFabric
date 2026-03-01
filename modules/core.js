// core.js — Shared event bus + state for all modules
// Every module imports KI and uses it to share state & events

export const KI = {
  // === SHARED STATE ===
  voice: {
    rms: 0, f0: 0, pn: 0, f1: 0, f2: 0, vowel: '', sounding: false,
    nf: 0.01, energy: 0, coherence: 0, sustain: 0, prevF0: 0, pDelta: 0,
    prevRms: 0, lastAmp: 0, onsets: [], pulseRate: 0, chargeLevel: 0
  },
  player: { name: '', score: 0, combo: 0, lastHitTime: 0, highScore: 0 },
  target: { hp: 1000, maxHP: 1000, mesh: null },
  scene: null, camera: null, renderer: null, clock: null,
  audioCtx: null, analyser: null, stream: null,
  W: 0, H: 0,
  running: false,

  // === MODULE REGISTRY ===
  _modules: {},
  _listeners: {},
  _updateFns: [],

  register(name, mod) {
    this._modules[name] = mod;
    if (mod.update) this._updateFns.push(mod.update);
  },

  get(name) { return this._modules[name]; },

  // === EVENT BUS ===
  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  },

  off(event, fn) {
    const arr = this._listeners[event];
    if (arr) this._listeners[event] = arr.filter(f => f !== fn);
  },

  emit(event, data) {
    const arr = this._listeners[event];
    if (arr) arr.forEach(fn => { try { fn(data); } catch (e) { console.warn('KI event error:', event, e); } });
  },

  // === MAIN LOOP HOOK ===
  runUpdates(dt, t) {
    this._updateFns.forEach(fn => { try { fn(dt, t); } catch (e) { console.warn('KI update error:', e); } });
  },

  // === UTILS ===
  hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) { r = g = b = l; } else {
      const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q-p)*6*t; if (t < 1/2) return q; if (t < 2/3) return p + (q-p)*(2/3-t)*6; return p; };
      const q = l < 0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
      r = hue2rgb(p, q, h+1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h-1/3);
    }
    return [r, g, b];
  },

  genHash() { return 'W-' + Math.random().toString(36).slice(2, 8).toUpperCase(); }
};
