// d2r-audio.js — Rune tone synthesis engine
// Each rune = a musical note. Runewords = arpeggios/chords.
// Runes mapped chromatically C2→G#4 (33 semitones across ~3 octaves).
// Low runes = deep bass, high runes = bright treble.
// Tier affects timbre: low=sine, mid=triangle, high=sawtooth, ultra=complex

import { RUNES, RUNE_MAP } from './d2r-runes.js';

let ctx = null;
let masterGain = null;
let reverbNode = null;
let initialized = false;

export function init() {
  if (initialized) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.3;

  // simple convolution-free reverb using delay feedback
  const delay = ctx.createDelay(0.5);
  delay.delayTime.value = 0.15;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.3;
  const wetGain = ctx.createGain();
  wetGain.gain.value = 0.25;
  masterGain.connect(ctx.destination);
  masterGain.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wetGain);
  wetGain.connect(ctx.destination);
  reverbNode = masterGain;
  initialized = true;
}

function ensureCtx() {
  if (!initialized) init();
  if (ctx.state === 'suspended') ctx.resume();
}

// get waveform type based on rune tier
function tierWave(tier) {
  return { low: 'sine', mid: 'triangle', high: 'sawtooth', ultra: 'square' }[tier] || 'sine';
}

// play a single rune tone
export function playRune(runeName, duration = 0.6, volume = 0.4) {
  ensureCtx();
  const rune = RUNE_MAP[runeName];
  if (!rune) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = tierWave(rune.tier);
  osc.frequency.value = rune.freq;

  // filter brightness by tier
  filter.type = 'lowpass';
  filter.frequency.value = rune.tier === 'ultra' ? 6000 :
    rune.tier === 'high' ? 4000 : rune.tier === 'mid' ? 2500 : 1500;
  filter.Q.value = 2;

  // envelope
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(volume * 0.6, now + duration * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(reverbNode);

  osc.start(now);
  osc.stop(now + duration + 0.05);

  // add sub-octave for ultra runes
  if (rune.tier === 'ultra') {
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.value = rune.freq / 2;
    subGain.gain.setValueAtTime(0, now);
    subGain.gain.linearRampToValueAtTime(volume * 0.3, now + 0.03);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 1.2);
    sub.connect(subGain);
    subGain.connect(reverbNode);
    sub.start(now);
    sub.stop(now + duration * 1.2 + 0.05);
  }

  return { rune, duration };
}

// play a runeword as an arpeggio (each rune in sequence)
export function playRunewordArpeggio(runeNames, noteLength = 0.35, gap = 0.15) {
  ensureCtx();
  const totalPerNote = noteLength + gap;
  runeNames.forEach((name, i) => {
    setTimeout(() => playRune(name, noteLength, 0.35), i * totalPerNote * 1000);
  });
  return runeNames.length * totalPerNote;
}

// play a runeword as a chord (all runes simultaneously)
export function playRunewordChord(runeNames, duration = 1.2) {
  ensureCtx();
  const vol = 0.25 / Math.sqrt(runeNames.length);
  runeNames.forEach(name => playRune(name, duration, vol));
  return duration;
}

// play a rune with element-specific effects
export function playRuneElemental(runeName, duration = 0.8) {
  ensureCtx();
  const rune = RUNE_MAP[runeName];
  if (!rune) return;

  playRune(runeName, duration, 0.3);

  const now = ctx.currentTime;
  // element-specific harmonic overlay
  const elementFreqMult = {
    fire: 1.5, lightning: 2, cold: 0.75, poison: 1.33,
    holy: 1.25, death: 0.667, chaos: 1.414, earth: 0.5
  };
  const mult = elementFreqMult[rune.element] || 1;
  if (mult !== 1) {
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = rune.freq * mult;
    g2.gain.setValueAtTime(0, now);
    g2.gain.linearRampToValueAtTime(0.08, now + 0.05);
    g2.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.8);
    osc2.connect(g2);
    g2.connect(reverbNode);
    osc2.start(now);
    osc2.stop(now + duration + 0.05);
  }
}

// ambient drone based on a rune tier
export function startDrone(runeName) {
  ensureCtx();
  const rune = RUNE_MAP[runeName];
  if (!rune) return null;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.value = rune.freq / 2;
  gain.gain.value = 0.06;

  lfo.type = 'sine';
  lfo.frequency.value = 0.5;
  lfoGain.gain.value = 3;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);

  osc.connect(gain);
  gain.connect(reverbNode);
  osc.start();
  lfo.start();

  return {
    stop() {
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      setTimeout(() => { osc.stop(); lfo.stop(); }, 600);
    },
    rune
  };
}

export function getContext() { return ctx; }
