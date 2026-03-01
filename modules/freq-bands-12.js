// freq-bands-12.js — 12-band frequency splitter for detailed spectral analysis
// Maps voice/audio into 12 frequency buckets with energy, color, and geometric tier
// Each band feeds into visuals like the stargate and geometric folder

import { KI } from './core.js';

// 12 bands spanning 20Hz to 8000Hz — each with unique color, shape tier, and element
export const BANDS = [
  { name: 'Sub-Rumble',  label: 'SUB',  minHz: 20,    maxHz: 60,    color: '#220044', hex: 0x220044, hue: 270, tier: 0, element: 'void',    shape: 'point' },
  { name: 'Deep-Bass',   label: 'DBAS', minHz: 60,    maxHz: 120,   color: '#6600cc', hex: 0x6600cc, hue: 270, tier: 1, element: 'earth',   shape: 'line' },
  { name: 'Bass',        label: 'BASS', minHz: 120,   maxHz: 200,   color: '#ff2244', hex: 0xff2244, hue: 350, tier: 2, element: 'fire',    shape: 'triangle' },
  { name: 'Low-Mid',     label: 'LMID', minHz: 200,   maxHz: 330,   color: '#ff6600', hex: 0xff6600, hue: 20,  tier: 3, element: 'lava',    shape: 'square' },
  { name: 'Mid',         label: 'MID',  minHz: 330,   maxHz: 500,   color: '#ffaa00', hex: 0xffaa00, hue: 40,  tier: 4, element: 'light',   shape: 'pentagon' },
  { name: 'Upper-Mid',   label: 'UMID', minHz: 500,   maxHz: 750,   color: '#ffdd00', hex: 0xffdd00, hue: 50,  tier: 5, element: 'thunder', shape: 'hexagon' },
  { name: 'Presence',    label: 'PRES', minHz: 750,   maxHz: 1100,  color: '#44ff44', hex: 0x44ff44, hue: 120, tier: 6, element: 'wind',    shape: 'cube' },
  { name: 'Brilliance',  label: 'BRIL', minHz: 1100,  maxHz: 1600,  color: '#00ddaa', hex: 0x00ddaa, hue: 165, tier: 7, element: 'water',   shape: 'octahedron' },
  { name: 'High',        label: 'HIGH', minHz: 1600,  maxHz: 2400,  color: '#0088ff', hex: 0x0088ff, hue: 210, tier: 8, element: 'ice',     shape: 'dodecahedron' },
  { name: 'Ultra-High',  label: 'ULHI', minHz: 2400,  maxHz: 3600,  color: '#4444ff', hex: 0x4444ff, hue: 240, tier: 9, element: 'plasma',  shape: 'icosahedron' },
  { name: 'Air',         label: 'AIR',  minHz: 3600,  maxHz: 5500,  color: '#aa44ff', hex: 0xaa44ff, hue: 270, tier: 10, element: 'aether', shape: 'tesseract' },
  { name: 'Shimmer',     label: 'SHIM', minHz: 5500,  maxHz: 8000,  color: '#ff44ff', hex: 0xff44ff, hue: 300, tier: 11, element: 'star',   shape: 'hypercube' }
];

const state = {
  energy: new Float32Array(12),       // current energy per band (0-1)
  smoothEnergy: new Float32Array(12), // smoothed energy
  peak: new Float32Array(12),         // peak hold per band
  peakDecay: new Float32Array(12),    // peak decay timers
  dominant: -1,                        // index of strongest band
  dominantTier: 0,                     // geometric tier of dominant band
  totalEnergy: 0,                      // sum of all bands
  spectralCentroid: 0,                 // weighted center frequency
  spectralSpread: 0,                   // spread around centroid
  geoLevel: 0,                         // 0-11 current geometric complexity level (smooth)
  geoLevelRaw: 0,                      // raw (unsmoothed)
  colorBlend: [0, 0, 0],              // blended RGB from all active bands
  history: [],                         // last 120 frames of dominant indices
  bandActivity: new Float32Array(12)   // how many frames each band has been active
};

export function init() {
  KI.register('freq-bands-12', {
    update, state, BANDS,
    getEnergy, getDominant, getGeoLevel, getColorBlend, getSpectralShape
  });
  KI.emit('freq-bands-12:ready');
}

function update(dt) {
  if (!KI.analyser) return;

  const freqData = new Float32Array(KI.analyser.frequencyBinCount);
  KI.analyser.getFloatFrequencyData(freqData);
  const sr = KI.audioCtx?.sampleRate || 44100;
  const binHz = sr / KI.analyser.fftSize;

  let maxE = 0, maxIdx = -1;
  let weightedSum = 0, totalE = 0;
  let r = 0, g = 0, b = 0;

  for (let i = 0; i < 12; i++) {
    const band = BANDS[i];
    const lo = Math.max(0, Math.floor(band.minHz / binHz));
    const hi = Math.min(Math.ceil(band.maxHz / binHz), freqData.length - 1);

    let sum = 0, count = 0;
    for (let b = lo; b <= hi; b++) {
      const db = freqData[b];
      if (db > -100) {
        sum += Math.pow(10, (db + 100) / 40); // normalize dB to 0-1 range
        count++;
      }
    }
    const raw = count > 0 ? Math.min(1, sum / count / 3) : 0;

    // smooth with attack/release
    if (raw > state.smoothEnergy[i]) {
      state.smoothEnergy[i] += (raw - state.smoothEnergy[i]) * 0.4; // fast attack
    } else {
      state.smoothEnergy[i] += (raw - state.smoothEnergy[i]) * 0.08; // slow release
    }
    state.energy[i] = state.smoothEnergy[i];

    // peak hold
    if (state.energy[i] > state.peak[i]) {
      state.peak[i] = state.energy[i];
      state.peakDecay[i] = 0.5; // hold for 0.5s
    } else {
      state.peakDecay[i] -= dt;
      if (state.peakDecay[i] <= 0) {
        state.peak[i] *= 0.95;
      }
    }

    // track dominant
    if (state.energy[i] > maxE) {
      maxE = state.energy[i];
      maxIdx = i;
    }

    // spectral centroid contribution
    const centerHz = (band.minHz + band.maxHz) / 2;
    weightedSum += centerHz * state.energy[i];
    totalE += state.energy[i];

    // color blend
    const hex = band.hex;
    const weight = state.energy[i];
    r += ((hex >> 16) & 0xff) / 255 * weight;
    g += ((hex >> 8) & 0xff) / 255 * weight;
    b += (hex & 0xff) / 255 * weight;

    // band activity counter
    if (state.energy[i] > 0.15) {
      state.bandActivity[i] = Math.min(10, state.bandActivity[i] + dt);
    } else {
      state.bandActivity[i] *= 0.95;
    }
  }

  state.dominant = maxIdx;
  state.dominantTier = maxIdx >= 0 ? BANDS[maxIdx].tier : 0;
  state.totalEnergy = totalE;
  state.spectralCentroid = totalE > 0.01 ? weightedSum / totalE : 0;

  // spectral spread
  if (totalE > 0.01) {
    let spread = 0;
    for (let i = 0; i < 12; i++) {
      const cHz = (BANDS[i].minHz + BANDS[i].maxHz) / 2;
      spread += Math.pow(cHz - state.spectralCentroid, 2) * state.energy[i];
    }
    state.spectralSpread = Math.sqrt(spread / totalE);
  }

  // geometric level — determined by how many bands are active + dominant tier
  let activeBands = 0;
  for (let i = 0; i < 12; i++) {
    if (state.energy[i] > 0.1) activeBands++;
  }
  state.geoLevelRaw = Math.min(11, Math.max(state.dominantTier, activeBands - 1));
  state.geoLevel += (state.geoLevelRaw - state.geoLevel) * 0.05; // smooth transitions

  // normalize color blend
  if (totalE > 0.01) {
    state.colorBlend[0] = Math.min(1, r / totalE);
    state.colorBlend[1] = Math.min(1, g / totalE);
    state.colorBlend[2] = Math.min(1, b / totalE);
  }

  // history
  state.history.push(maxIdx);
  if (state.history.length > 120) state.history.shift();

  KI.emit('freq-bands-12:update', {
    energy: state.energy,
    dominant: state.dominant,
    geoLevel: state.geoLevel,
    totalEnergy: state.totalEnergy,
    colorBlend: state.colorBlend,
    spectralCentroid: state.spectralCentroid
  });
}

// === PUBLIC API ===
export function getEnergy(bandIndex) {
  return bandIndex >= 0 && bandIndex < 12 ? state.energy[bandIndex] : 0;
}

export function getDominant() {
  return { index: state.dominant, band: BANDS[state.dominant] || null, energy: state.energy[state.dominant] || 0 };
}

export function getGeoLevel() {
  return state.geoLevel;
}

export function getColorBlend() {
  return state.colorBlend;
}

export function getSpectralShape() {
  // returns array of 12 energies for visualization
  return Array.from(state.energy);
}
