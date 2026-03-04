// SENSORY I/O Map — L0 ControlModule definitions for hardware + sensors
// Each control module maps to concrete I/O points with Modbus registers.

import { createControlModule, createEquipmentModule } from '../../../../controlmodule.js';

// ── Compute Substrate Control ──
export function buildSubstrateCM() {
  return createEquipmentModule('EM_SUBSTRATE', {
    name: 'Substrate Equipment Module',
    capability: ['compute', 'bus-drive'],
    tags: ['CONSCIOUSNESS/L0_HW/ACTIVATION', 'CONSCIOUSNESS/L0_HW/HEALTH'],
  });
}

// ── Microphone Control Module ──
export function buildMicCM() {
  return createControlModule('CM_MIC', {
    name: 'Microphone Control',
    AI: [
      { id: 'MIC_RAW', name: 'Raw Audio Level', tagPath: 'INPUT/ENERGY', range: [0, 1], engUnit: 'ratio' },
      { id: 'MIC_RMS', name: 'RMS Level', tagPath: 'INPUT/MIC_RMS', range: [0, 1], engUnit: 'ratio' },
    ],
    DI: [
      { id: 'MIC_ACTIVE', name: 'Mic Active', tagPath: 'INPUT/SOUNDING' },
    ],
    modbus: [
      { register: 40001, type: 'FLOAT32', desc: 'Raw energy' },
      { register: 40003, type: 'FLOAT32', desc: 'RMS level' },
      { register: 10001, type: 'BOOL', desc: 'Mic active' },
    ],
    capability: ['measure', 'stream'],
  });
}

// ── FFT Analyzer Control Module ──
export function buildFFTCM() {
  return createControlModule('CM_FFT', {
    name: 'FFT Analyzer Control',
    AI: [
      { id: 'FFT_COH', name: 'Spectral Coherence', tagPath: 'INPUT/COHERENCE', range: [0, 1], engUnit: 'ratio' },
      { id: 'FFT_BW', name: 'Bandwidth', tagPath: 'INPUT/FFT_BW', range: [0, 22050], engUnit: 'Hz' },
    ],
    pid: [
      { id: 'PID_SMOOTH', pv: 'INPUT/COHERENCE', sp: 'INPUT/COH_SP', cv: 'INPUT/COH_CV', kp: 0.5, ki: 0.1, kd: 0.01 },
    ],
    modbus: [
      { register: 40005, type: 'FLOAT32', desc: 'Coherence' },
      { register: 40007, type: 'FLOAT32', desc: 'Bandwidth' },
    ],
    capability: ['analyze', 'transform'],
  });
}

// ── Pitch Detector Control Module ──
export function buildPitchCM() {
  return createControlModule('CM_PITCH', {
    name: 'Pitch Detector Control',
    AI: [
      { id: 'PITCH_HZ', name: 'Fundamental Freq', tagPath: 'INPUT/PITCH', range: [20, 2000], engUnit: 'Hz' },
      { id: 'PITCH_CONF', name: 'Pitch Confidence', tagPath: 'INPUT/PITCH_CONF', range: [0, 1], engUnit: 'ratio' },
    ],
    modbus: [
      { register: 40009, type: 'FLOAT32', desc: 'Pitch Hz' },
      { register: 40011, type: 'FLOAT32', desc: 'Pitch confidence' },
    ],
    capability: ['detect'],
  });
}

// ── Vowel Detector Control Module ──
export function buildVowelCM() {
  return createControlModule('CM_VOWEL', {
    name: 'Vowel Detector Control',
    AI: [
      { id: 'VOWEL_F1', name: 'Formant 1', tagPath: 'INPUT/VOWEL_F1', range: [200, 900], engUnit: 'Hz' },
      { id: 'VOWEL_F2', name: 'Formant 2', tagPath: 'INPUT/VOWEL_F2', range: [800, 2500], engUnit: 'Hz' },
    ],
    DO: [
      { id: 'VOWEL_CLASS', name: 'Vowel Classification', tagPath: 'INPUT/VOWEL' },
    ],
    modbus: [
      { register: 40013, type: 'FLOAT32', desc: 'Formant 1' },
      { register: 40015, type: 'FLOAT32', desc: 'Formant 2' },
    ],
    capability: ['classify'],
  });
}
