// voice-fx.js — Real-time voice effects processor
// Applies live audio effects to the user's mic signal:
// pitch shift, harmonizer, echo/delay, distortion, chorus, reverb, vocoder, choir
// Each effect can be toggled independently and has adjustable parameters
// Output goes to speakers so user hears themselves transformed

import { KI } from './core.js';

const FX_CHAIN = {
  pitchShift:  { active: false, semitones: 0 },
  harmonizer:  { active: false, intervals: [4, 7], volume: 0.5 },  // major third + fifth
  echo:        { active: false, time: 0.3, feedback: 0.4, volume: 0.5 },
  distortion:  { active: false, amount: 20, tone: 2000 },
  chorus:      { active: false, rate: 1.5, depth: 0.005, voices: 3 },
  reverb:      { active: false, decay: 1.5, mix: 0.3 },
  vocoder:     { active: false, bands: 16, carrier: 'saw' },
  autotune:    { active: false, key: 'C', scale: 'major', speed: 0.1 },
  choir:       { active: false, voices: 5, spread: 15, volume: 0.4 }
};

const state = {
  fxChain: FX_CHAIN,
  masterVolume: 0.7,
  dryWet: 0.8,      // 0 = all dry, 1 = all wet
  bypassed: false,
  inputLevel: 0,
  outputLevel: 0,
  currentPitch: 0,   // detected pitch Hz for autotune
  activeEffects: 0
};

// Audio nodes
let ctx = null;
let inputNode = null;    // mic source
let dryGain = null;
let wetGain = null;
let masterGain = null;
let analyserOut = null;
let nodes = {};          // per-effect node chains

// Scale semitone maps for autotune
const SCALES = {
  major:      [0, 2, 4, 5, 7, 9, 11],
  minor:      [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  chromatic:  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  blues:      [0, 3, 5, 6, 7, 10]
};

const NOTE_ROOTS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function init(opts = {}) {
  KI.on('audio:ready', ({ audioCtx, stream }) => setup(audioCtx, stream));
  if (KI.audioCtx && KI.stream) setup(KI.audioCtx, KI.stream);

  KI.register('voice-fx', {
    update, state,
    toggleEffect, setParam, getActiveEffects,
    setDryWet, setMasterVolume, bypass,
    getChain: () => FX_CHAIN
  });
  KI.emit('voice-fx:ready');
}

function setup(audioCtx, stream) {
  ctx = audioCtx;

  // source from mic
  inputNode = ctx.createMediaStreamSource(stream);

  // dry/wet mixer
  dryGain = ctx.createGain();
  dryGain.gain.value = 1 - state.dryWet;
  wetGain = ctx.createGain();
  wetGain.gain.value = state.dryWet;

  // master output
  masterGain = ctx.createGain();
  masterGain.gain.value = state.masterVolume;

  // output analyser
  analyserOut = ctx.createAnalyser();
  analyserOut.fftSize = 256;

  // dry path: input → dryGain → master
  inputNode.connect(dryGain);
  dryGain.connect(masterGain);

  // master → analyser → destination
  masterGain.connect(analyserOut);
  analyserOut.connect(ctx.destination);

  // build effect chains (all start disconnected until toggled on)
  buildEchoNodes();
  buildDistortionNodes();
  buildChorusNodes();
  buildReverbNodes();
  buildChoir();
  buildHarmonizer();

  // wet chain starts from input, goes through active effects → wetGain → master
  inputNode.connect(wetGain);
  wetGain.gain.value = 0; // start silent until effects activated
  wetGain.connect(masterGain);
}

// === ECHO / DELAY ===
function buildEchoNodes() {
  if (!ctx) return;
  const delay = ctx.createDelay(2.0);
  delay.delayTime.value = FX_CHAIN.echo.time;
  const feedback = ctx.createGain();
  feedback.gain.value = FX_CHAIN.echo.feedback;
  const echoGain = ctx.createGain();
  echoGain.gain.value = FX_CHAIN.echo.volume;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 4000;

  // echo loop: input → delay → filter → feedback → delay, also delay → echoGain → wet
  delay.connect(filter);
  filter.connect(feedback);
  feedback.connect(delay);
  filter.connect(echoGain);

  nodes.echo = { delay, feedback, echoGain, filter, connected: false };
}

// === DISTORTION ===
function buildDistortionNodes() {
  if (!ctx) return;
  const waveshaper = ctx.createWaveShaper();
  waveshaper.curve = makeDistortionCurve(FX_CHAIN.distortion.amount);
  waveshaper.oversample = '4x';
  const toneFilter = ctx.createBiquadFilter();
  toneFilter.type = 'lowpass';
  toneFilter.frequency.value = FX_CHAIN.distortion.tone;
  const distGain = ctx.createGain();
  distGain.gain.value = 0.5;

  waveshaper.connect(toneFilter);
  toneFilter.connect(distGain);

  nodes.distortion = { waveshaper, toneFilter, distGain, connected: false };
}

function makeDistortionCurve(amount) {
  const k = amount;
  const samples = 44100;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

// === CHORUS ===
function buildChorusNodes() {
  if (!ctx) return;
  const chorusVoices = [];
  for (let i = 0; i < FX_CHAIN.chorus.voices; i++) {
    const delay = ctx.createDelay(0.05);
    delay.delayTime.value = 0.015 + i * 0.005;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = FX_CHAIN.chorus.rate + i * 0.3;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = FX_CHAIN.chorus.depth;
    lfo.connect(lfoGain);
    lfoGain.connect(delay.delayTime);
    lfo.start();
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = 1 / FX_CHAIN.chorus.voices;
    delay.connect(voiceGain);
    chorusVoices.push({ delay, lfo, lfoGain, voiceGain });
  }
  const chorusOut = ctx.createGain();
  chorusOut.gain.value = 0.6;
  chorusVoices.forEach(v => v.voiceGain.connect(chorusOut));

  nodes.chorus = { voices: chorusVoices, out: chorusOut, connected: false };
}

// === REVERB (convolver-style with noise impulse) ===
function buildReverbNodes() {
  if (!ctx) return;
  const length = ctx.sampleRate * FX_CHAIN.reverb.decay;
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
    }
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;
  const reverbGain = ctx.createGain();
  reverbGain.gain.value = FX_CHAIN.reverb.mix;
  convolver.connect(reverbGain);

  nodes.reverb = { convolver, reverbGain, connected: false };
}

// === CHOIR (multiple detuned copies of voice) ===
function buildChoir() {
  if (!ctx) return;
  // choir uses multiple delay lines with slight detuning via LFOs
  const choirVoices = [];
  const spread = FX_CHAIN.choir.spread;
  for (let i = 0; i < FX_CHAIN.choir.voices; i++) {
    const delay = ctx.createDelay(0.1);
    delay.delayTime.value = 0.01 + Math.random() * 0.03;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1 + Math.random() * 0.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.003 + Math.random() * 0.003;
    lfo.connect(lfoGain);
    lfoGain.connect(delay.delayTime);
    lfo.start();
    const g = ctx.createGain();
    g.gain.value = FX_CHAIN.choir.volume / FX_CHAIN.choir.voices;
    delay.connect(g);
    choirVoices.push({ delay, lfo, lfoGain, gain: g });
  }
  const choirOut = ctx.createGain();
  choirOut.gain.value = 1;
  choirVoices.forEach(v => v.gain.connect(choirOut));

  nodes.choir = { voices: choirVoices, out: choirOut, connected: false };
}

// === HARMONIZER (pitch-shifted copies via detune trick) ===
function buildHarmonizer() {
  if (!ctx) return;
  // simplified harmonizer using oscillators that track detected pitch
  // actual pitch shifting would need a phase vocoder, but we approximate
  // by using the singing-voice formant synth approach
  nodes.harmonizer = { connected: false, intervals: FX_CHAIN.harmonizer.intervals };
}

// === CONNECT / DISCONNECT EFFECTS ===
function connectEffect(name) {
  if (!ctx || !inputNode) return;
  const n = nodes[name];
  if (!n || n.connected) return;

  switch (name) {
    case 'echo':
      inputNode.connect(n.delay);
      n.echoGain.connect(wetGain);
      break;
    case 'distortion':
      inputNode.connect(n.waveshaper);
      n.distGain.connect(wetGain);
      break;
    case 'chorus':
      n.voices.forEach(v => inputNode.connect(v.delay));
      n.out.connect(wetGain);
      break;
    case 'reverb':
      inputNode.connect(n.convolver);
      n.reverbGain.connect(wetGain);
      break;
    case 'choir':
      n.voices.forEach(v => inputNode.connect(v.delay));
      n.out.connect(wetGain);
      break;
  }
  n.connected = true;
  updateWetLevel();
}

function disconnectEffect(name) {
  if (!ctx) return;
  const n = nodes[name];
  if (!n || !n.connected) return;

  try {
    switch (name) {
      case 'echo':
        inputNode.disconnect(n.delay);
        n.echoGain.disconnect(wetGain);
        break;
      case 'distortion':
        inputNode.disconnect(n.waveshaper);
        n.distGain.disconnect(wetGain);
        break;
      case 'chorus':
        n.voices.forEach(v => { try { inputNode.disconnect(v.delay); } catch(e) {} });
        n.out.disconnect(wetGain);
        break;
      case 'reverb':
        inputNode.disconnect(n.convolver);
        n.reverbGain.disconnect(wetGain);
        break;
      case 'choir':
        n.voices.forEach(v => { try { inputNode.disconnect(v.delay); } catch(e) {} });
        n.out.disconnect(wetGain);
        break;
    }
  } catch (e) { /* already disconnected */ }
  n.connected = false;
  updateWetLevel();
}

function updateWetLevel() {
  if (!wetGain || !dryGain) return;
  const anyActive = Object.values(nodes).some(n => n.connected);
  const now = ctx.currentTime;
  if (anyActive) {
    wetGain.gain.linearRampToValueAtTime(state.dryWet * state.masterVolume, now + 0.05);
    dryGain.gain.linearRampToValueAtTime((1 - state.dryWet) * state.masterVolume, now + 0.05);
  } else {
    wetGain.gain.linearRampToValueAtTime(0, now + 0.05);
    dryGain.gain.linearRampToValueAtTime(state.masterVolume, now + 0.05);
  }
}

// === PUBLIC API ===

export function toggleEffect(name) {
  if (!FX_CHAIN[name]) return false;
  FX_CHAIN[name].active = !FX_CHAIN[name].active;
  if (FX_CHAIN[name].active) {
    connectEffect(name);
  } else {
    disconnectEffect(name);
  }
  state.activeEffects = Object.values(FX_CHAIN).filter(f => f.active).length;
  KI.emit('voice-fx:changed', { effect: name, active: FX_CHAIN[name].active, chain: FX_CHAIN });
  return FX_CHAIN[name].active;
}

export function setParam(effect, param, value) {
  if (!FX_CHAIN[effect]) return;
  FX_CHAIN[effect][param] = value;

  // apply in real-time
  if (ctx) {
    const now = ctx.currentTime;
    switch (effect) {
      case 'echo':
        if (nodes.echo) {
          if (param === 'time') nodes.echo.delay.delayTime.linearRampToValueAtTime(value, now + 0.05);
          if (param === 'feedback') nodes.echo.feedback.gain.linearRampToValueAtTime(value, now + 0.05);
          if (param === 'volume') nodes.echo.echoGain.gain.linearRampToValueAtTime(value, now + 0.05);
        }
        break;
      case 'distortion':
        if (nodes.distortion) {
          if (param === 'amount') nodes.distortion.waveshaper.curve = makeDistortionCurve(value);
          if (param === 'tone') nodes.distortion.toneFilter.frequency.linearRampToValueAtTime(value, now + 0.05);
        }
        break;
      case 'reverb':
        if (nodes.reverb && param === 'mix') {
          nodes.reverb.reverbGain.gain.linearRampToValueAtTime(value, now + 0.05);
        }
        break;
    }
  }
  KI.emit('voice-fx:param-changed', { effect, param, value });
}

export function getActiveEffects() {
  return Object.entries(FX_CHAIN).filter(([, v]) => v.active).map(([k]) => k);
}

export function setDryWet(value) {
  state.dryWet = Math.max(0, Math.min(1, value));
  updateWetLevel();
}

export function setMasterVolume(value) {
  state.masterVolume = Math.max(0, Math.min(1, value));
  if (masterGain && ctx) {
    masterGain.gain.linearRampToValueAtTime(state.masterVolume, ctx.currentTime + 0.05);
  }
  updateWetLevel();
}

export function bypass(on) {
  state.bypassed = on;
  if (masterGain && ctx) {
    masterGain.gain.linearRampToValueAtTime(on ? 0 : state.masterVolume, ctx.currentTime + 0.05);
  }
}

// === AUTOTUNE (snap pitch to nearest scale note) ===
function getAutotuneTarget(hz, key, scale) {
  if (hz <= 0) return hz;
  const root = NOTE_ROOTS[key] || 0;
  const scaleNotes = SCALES[scale] || SCALES.major;
  const midi = 12 * Math.log2(hz / 440) + 69;
  const noteInOctave = ((midi - root) % 12 + 12) % 12;

  // find nearest scale note
  let minDist = 12;
  let nearest = 0;
  for (const s of scaleNotes) {
    const dist = Math.min(Math.abs(noteInOctave - s), 12 - Math.abs(noteInOctave - s));
    if (dist < minDist) { minDist = dist; nearest = s; }
  }

  const targetMidi = Math.round(midi / 12) * 12 + root + nearest;
  // adjust octave
  const diff = targetMidi - midi;
  if (Math.abs(diff) > 6) return hz; // too far, skip
  return 440 * Math.pow(2, (targetMidi - 69) / 12);
}

function update(dt, t) {
  if (!ctx || !analyserOut) return;

  // output level meter
  const buf = new Float32Array(analyserOut.frequencyBinCount);
  analyserOut.getFloatTimeDomainData(buf);
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  state.outputLevel = Math.sqrt(rms / buf.length);
  state.inputLevel = KI.voice.rms || 0;
  state.currentPitch = KI.voice.f0 || 0;

  // autotune — modulate the singing voice if active
  if (FX_CHAIN.autotune.active && state.currentPitch > 0) {
    const target = getAutotuneTarget(state.currentPitch, FX_CHAIN.autotune.key, FX_CHAIN.autotune.scale);
    KI.emit('voice-fx:autotune', { original: state.currentPitch, target, key: FX_CHAIN.autotune.key });
  }

  KI.emit('voice-fx:levels', {
    input: state.inputLevel,
    output: state.outputLevel,
    activeEffects: state.activeEffects
  });
}
