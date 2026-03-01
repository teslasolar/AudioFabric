// periodic-audio.js — Element sonification engine
// Each element's atomic number maps to a chromatic note (Z=1 → C1, Z=118 → A#10)
// Properties modulate the sound: electronegativity→filter, density→timbre, phase→envelope
// Category determines waveform family

import { ELEMENTS, BY_Z, BY_SYMBOL, CATEGORIES } from './periodic-elements.js';

let ctx = null;
let masterGain = null;
let initialized = false;

export function init() {
  if (initialized) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.3;

  // reverb via delay feedback
  const delay = ctx.createDelay(0.5);
  delay.delayTime.value = 0.12;
  const fb = ctx.createGain();
  fb.gain.value = 0.25;
  const wet = ctx.createGain();
  wet.gain.value = 0.2;
  masterGain.connect(ctx.destination);
  masterGain.connect(delay);
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(wet);
  wet.connect(ctx.destination);
  initialized = true;
}

function ensureCtx() {
  if (!initialized) init();
  if (ctx.state === 'suspended') ctx.resume();
}

// category → waveform
function categoryWave(cat) {
  const map = {
    'alkali-metal': 'sawtooth', 'alkaline-earth': 'triangle',
    'transition-metal': 'square', 'post-transition': 'triangle',
    'metalloid': 'sawtooth', 'nonmetal': 'sine',
    'noble-gas': 'sine', 'lanthanide': 'square',
    'actinide': 'sawtooth', 'unknown': 'sine'
  };
  return map[cat] || 'sine';
}

// phase → envelope shape
function phaseEnvelope(phase, duration) {
  if (phase === 'g') return { attack: 0.08, sustain: duration * 0.3, release: duration * 0.6 }; // airy
  if (phase === 'l') return { attack: 0.03, sustain: duration * 0.5, release: duration * 0.4 }; // fluid
  return { attack: 0.01, sustain: duration * 0.6, release: duration * 0.3 }; // solid, punchy
}

// play a single element tone
export function playElement(zOrSymbol, duration = 0.8, volume = 0.4) {
  ensureCtx();
  const el = typeof zOrSymbol === 'number' ? BY_Z[zOrSymbol] : BY_SYMBOL[zOrSymbol];
  if (!el) return null;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = categoryWave(el.category);
  osc.frequency.value = el.freq;

  // electronegativity → filter cutoff (higher EN = brighter)
  const en = el.electronegativity || 1.5;
  filter.type = 'lowpass';
  filter.frequency.value = 800 + en * 1200;
  filter.Q.value = 1 + en * 0.5;

  // phase-based envelope
  const env = phaseEnvelope(el.phase, duration);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + env.attack);
  gain.gain.setValueAtTime(volume * 0.9, now + env.attack + env.sustain);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + duration + 0.05);

  // density → sub-harmonic (heavier elements get bass layer)
  const dens = el.density || 0;
  if (dens > 5) {
    const sub = ctx.createOscillator();
    const sg = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.value = el.freq / 2;
    const subVol = Math.min(0.2, (dens / 25) * 0.15);
    sg.gain.setValueAtTime(0, now);
    sg.gain.linearRampToValueAtTime(subVol, now + 0.03);
    sg.gain.exponentialRampToValueAtTime(0.001, now + duration * 1.1);
    sub.connect(sg);
    sg.connect(masterGain);
    sub.start(now);
    sub.stop(now + duration * 1.1 + 0.05);
  }

  // noble gases get shimmer (amplitude modulation)
  if (el.category === 'noble-gas') {
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 6 + el.z * 0.3;
    lfoG.gain.value = volume * 0.15;
    lfo.connect(lfoG);
    lfoG.connect(gain.gain);
    lfo.start(now);
    lfo.stop(now + duration + 0.05);
  }

  // radioactive elements (z>=84) get tremolo
  if (el.z >= 84) {
    const trem = ctx.createOscillator();
    const tremG = ctx.createGain();
    trem.type = 'sine';
    trem.frequency.value = 3 + (el.z - 84) * 0.2;
    tremG.gain.value = volume * 0.3;
    trem.connect(tremG);
    tremG.connect(gain.gain);
    trem.start(now);
    trem.stop(now + duration + 0.05);
  }

  return { element: el, duration };
}

// play a sequence of elements (like spelling a compound)
export function playSequence(symbols, noteLen = 0.4, gap = 0.1) {
  ensureCtx();
  const total = noteLen + gap;
  symbols.forEach((sym, i) => {
    setTimeout(() => playElement(sym, noteLen, 0.3), i * total * 1000);
  });
  return symbols.length * total;
}

// play elements as a chord
export function playChord(symbols, duration = 1.5) {
  ensureCtx();
  const vol = 0.2 / Math.sqrt(symbols.length);
  symbols.forEach(sym => playElement(sym, duration, vol));
  return duration;
}

// play an entire period as a scale
export function playPeriodScale(period, noteLen = 0.3) {
  const els = ELEMENTS.filter(e => e.period === period).sort((a, b) => a.z - b.z);
  return playSequence(els.map(e => e.symbol), noteLen, 0.08);
}

// play an entire group as a descending sequence
export function playGroupSequence(group, noteLen = 0.4) {
  const els = ELEMENTS.filter(e => e.group === group).sort((a, b) => a.z - b.z);
  return playSequence(els.map(e => e.symbol), noteLen, 0.12);
}

// ambient drone on an element
export function startDrone(zOrSymbol) {
  ensureCtx();
  const el = typeof zOrSymbol === 'number' ? BY_Z[zOrSymbol] : BY_SYMBOL[zOrSymbol];
  if (!el) return null;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const lfo = ctx.createOscillator();
  const lfoG = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.value = el.freq / 2;
  gain.gain.value = 0.05;

  lfo.type = 'sine';
  lfo.frequency.value = 0.3;
  lfoG.gain.value = 2;
  lfo.connect(lfoG);
  lfoG.connect(osc.frequency);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(); lfo.start();

  return {
    element: el,
    stop() {
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      setTimeout(() => { osc.stop(); lfo.stop(); }, 600);
    }
  };
}

// sonify a property range (e.g., play all elements by melting point ascending)
export function playByProperty(prop, noteLen = 0.15) {
  const sorted = ELEMENTS.filter(e => e[prop] != null).sort((a, b) => a[prop] - b[prop]);
  const subset = sorted.filter((_, i) => i % Math.ceil(sorted.length / 20) === 0); // max 20 tones
  return playSequence(subset.map(e => e.symbol), noteLen, 0.05);
}

export function getContext() { return ctx; }
