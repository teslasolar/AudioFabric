// vocal-ranges.js — Vocal range detection and classification for music practice
// Splits voice into ranges: Sub-Bass, Bass, Baritone, Tenor, Alto, Mezzo-Soprano, Soprano
// Each range has a color, power profile, and practice feedback

import { KI } from './core.js';

export const RANGES = [
  { name: 'Sub-Bass',  label: 'SUB',  minHz: 20,   maxHz: 100,  color: '#8844ff', hue: 270, power: 'ground',   mult: 1.2, practice: 'Chest resonance — feel it rumble' },
  { name: 'Bass',      label: 'BASS', minHz: 100,  maxHz: 200,  color: '#ff2244', hue: 350, power: 'heavy',    mult: 1.0, practice: 'Deep foundation — steady and warm' },
  { name: 'Baritone',  label: 'BARI', minHz: 200,  maxHz: 330,  color: '#ff8800', hue: 30,  power: 'balanced', mult: 1.0, practice: 'Mid-low range — rich and full' },
  { name: 'Tenor',     label: 'TENR', minHz: 330,  maxHz: 520,  color: '#ffcc00', hue: 48,  power: 'swift',    mult: 1.1, practice: 'Upper chest — bright and open' },
  { name: 'Alto',      label: 'ALTO', minHz: 520,  maxHz: 700,  color: '#44dd66', hue: 140, power: 'pierce',   mult: 1.3, practice: 'Head voice — clear and focused' },
  { name: 'Mezzo',     label: 'MEZZ', minHz: 700,  maxHz: 1000, color: '#44aaff', hue: 210, power: 'sharp',    mult: 1.5, practice: 'Upper register — controlled and light' },
  { name: 'Soprano',   label: 'SOPR', minHz: 1000, maxHz: 2000, color: '#cc44ff', hue: 285, power: 'critical', mult: 2.0, practice: 'High range — bright and piercing' }
];

const state = {
  activeRange: -1,
  rangeHistory: [],      // last 60 frames of range indices for visualization
  rangeSustain: new Array(RANGES.length).fill(0),  // sustain time per range
  rangeEnergy: new Array(RANGES.length).fill(0),   // energy per range band
  dominantRange: -1,
  f0Smooth: 0,
  practiceTarget: -1,    // if set, highlights a target range
  accuracy: 0,           // 0-1 how close to target
  streak: 0,
  bestStreak: 0
};

export function init() {
  KI.register('vocal-ranges', { update, state, RANGES, getActiveRange, setTarget, getAccuracy });
  KI.emit('vocal-ranges:ready');
}

function update(dt) {
  const v = KI.voice;

  // smooth f0
  if (v.f0 > 0) {
    state.f0Smooth += (v.f0 - state.f0Smooth) * 0.15;
  } else {
    state.f0Smooth *= 0.95;
  }

  // find active range from pitch
  let newRange = -1;
  if (v.sounding && state.f0Smooth > 20) {
    for (let i = 0; i < RANGES.length; i++) {
      if (state.f0Smooth >= RANGES[i].minHz && state.f0Smooth < RANGES[i].maxHz) {
        newRange = i;
        break;
      }
    }
  }

  // also compute energy per frequency band from FFT
  if (KI.analyser) {
    const freqData = new Float32Array(KI.analyser.frequencyBinCount);
    KI.analyser.getFloatFrequencyData(freqData);
    const sr = KI.audioCtx.sampleRate;
    const binHz = sr / (KI.analyser.fftSize);
    for (let r = 0; r < RANGES.length; r++) {
      const lo = Math.floor(RANGES[r].minHz / binHz);
      const hi = Math.min(Math.ceil(RANGES[r].maxHz / binHz), freqData.length - 1);
      let sum = 0, count = 0;
      for (let b = lo; b <= hi; b++) {
        const db = freqData[b];
        if (db > -100) { sum += Math.pow(10, db / 20); count++; }
      }
      const e = count > 0 ? sum / count : 0;
      state.rangeEnergy[r] += (e - state.rangeEnergy[r]) * 0.2;
    }
  }

  // update sustain per range
  if (newRange >= 0) {
    state.rangeSustain[newRange] += dt;
    // decay others slowly
    for (let i = 0; i < RANGES.length; i++) {
      if (i !== newRange) state.rangeSustain[i] *= 0.97;
    }
  } else {
    for (let i = 0; i < RANGES.length; i++) state.rangeSustain[i] *= 0.95;
  }

  state.activeRange = newRange;
  state.rangeHistory.push(newRange);
  if (state.rangeHistory.length > 120) state.rangeHistory.shift();

  // dominant range (most sustained)
  let best = -1, bestVal = 0;
  for (let i = 0; i < RANGES.length; i++) {
    if (state.rangeSustain[i] > bestVal) { bestVal = state.rangeSustain[i]; best = i; }
  }
  state.dominantRange = best;

  // practice target accuracy
  if (state.practiceTarget >= 0 && newRange >= 0) {
    if (newRange === state.practiceTarget) {
      state.accuracy = Math.min(1, state.accuracy + dt * 0.5);
      state.streak += dt;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
    } else {
      state.accuracy *= 0.95;
      state.streak = 0;
    }
  }

  KI.emit('vocal-ranges:update', {
    activeRange: newRange,
    dominantRange: state.dominantRange,
    rangeEnergy: state.rangeEnergy,
    rangeSustain: state.rangeSustain,
    f0: state.f0Smooth,
    accuracy: state.accuracy
  });
}

export function getActiveRange() { return state.activeRange; }
export function setTarget(rangeIndex) { state.practiceTarget = rangeIndex; state.accuracy = 0; state.streak = 0; }
export function getAccuracy() { return state.accuracy; }
