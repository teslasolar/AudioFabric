// resonance-synths.js — Tone deepening synth that layers harmonics per resonance depth
// Each layer adds a lower octave drone + harmonic overtone
// Replaces the old synths.js charge sound with depth-based audio

import { KI } from './core.js';

let master, layers = [];
const MAX_LAYERS = 5;

export function init() {
  KI.on('audio:ready', ({ audioCtx }) => {
    master = audioCtx.createGain();
    master.gain.value = 0.08;
    // compressor to keep layered drones under control
    const comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 10;
    comp.ratio.value = 8;
    master.connect(comp);
    comp.connect(audioCtx.destination);

    // create 5 oscillator layers, all silent initially
    for (let i = 0; i < MAX_LAYERS; i++) {
      const osc = audioCtx.createOscillator();
      osc.type = ['sine', 'sine', 'triangle', 'sawtooth', 'sine'][i];
      osc.frequency.value = 80; // will be set dynamically

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 200 + i * 100;
      filter.Q.value = 3 + i * 2;

      const gain = audioCtx.createGain();
      gain.gain.value = 0;

      // each deeper layer gets a subtle chorus via detune
      osc.detune.value = (i - 2) * 8;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      osc.start();

      layers.push({ osc, filter, gain, targetGain: 0, targetFreq: 80 });
    }
  });

  KI.on('resonance:layerUp', onLayerUp);
  KI.on('resonance:release', onRelease);
  KI.on('blast:fired', onBlastFired);

  KI.register('resonance-synths', { update });
}

function onLayerUp(data) {
  const ctx = KI.audioCtx;
  if (!ctx) return;
  const now = ctx.currentTime;
  const idx = data.layer;

  // pop/click on new layer
  const click = ctx.createOscillator();
  click.type = 'sine';
  click.frequency.setValueAtTime(800 - idx * 120, now);
  click.frequency.exponentialRampToValueAtTime(200 - idx * 30, now + 0.1);
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(0.08, now);
  cg.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  click.connect(cg); cg.connect(master);
  click.start(now); click.stop(now + 0.15);

  // sub thump gets deeper with each layer
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(60 - idx * 8, now);
  sub.frequency.exponentialRampToValueAtTime(30 - idx * 4, now + 0.3);
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.12, now);
  sg.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  sub.connect(sg); sg.connect(master);
  sub.start(now); sub.stop(now + 0.4);
}

function onRelease(data) {
  const ctx = KI.audioCtx;
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  const layerIdx = data.layer;

  // release whoosh — pitch based on depth
  const baseFreq = 300 - layerIdx * 40;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(baseFreq + data.multiplier * 50, now);
  o.frequency.exponentialRampToValueAtTime(40, now + 0.6);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.12 * Math.min(data.multiplier / 8, 1), now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  o.connect(g); g.connect(master); o.start(now); o.stop(now + 0.7);

  // harmonic chime — higher layers get richer chord
  for (let i = 0; i <= layerIdx; i++) {
    const ch = ctx.createOscillator();
    ch.type = 'sine';
    const freq = [523, 659, 784, 988, 1175][i]; // C5, E5, G5, B5, D6
    ch.frequency.value = freq;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.04, now + 0.05 * i);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.8 + i * 0.1);
    ch.connect(cg); cg.connect(master);
    ch.start(now + 0.05 * i); ch.stop(now + 1 + i * 0.1);
  }
}

function onBlastFired(data) {
  const ctx = KI.audioCtx;
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  const power = data.power || 0.5;

  // impact bass
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(150 + power * 300, now);
  o.frequency.exponentialRampToValueAtTime(35, now + 0.5);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.15 * power, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  o.connect(g); g.connect(master); o.start(now); o.stop(now + 0.6);

  // noise burst
  const z = ctx.createOscillator(); z.type = 'sawtooth';
  z.frequency.setValueAtTime(2000 + Math.random() * 5000, now);
  const zg = ctx.createGain();
  zg.gain.setValueAtTime(0.05 * power, now);
  zg.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
  z.connect(zg); zg.connect(master); z.start(now); z.stop(now + 0.1);
}

function update(dt, t) {
  const ctx = KI.audioCtx;
  if (!ctx || layers.length === 0) return;
  const now = ctx.currentTime;
  const v = KI.voice;
  const res = KI.get('resonance');
  const activeLayer = res ? res.state.activeLayer : -1;
  const baseF0 = v.f0 > 0 ? v.f0 : 120;

  for (let i = 0; i < MAX_LAYERS; i++) {
    const L = layers[i];
    const active = i <= activeLayer && v.sounding;

    if (active) {
      // each layer drops an octave from player's pitch
      const octaveShift = Math.pow(0.5, i); // layer 0 = 1x, layer 1 = 0.5x, etc
      L.targetFreq = baseF0 * octaveShift;
      // volume increases slightly per layer for that stacking depth feel
      L.targetGain = 0.04 + i * 0.008;
      // filter opens wider at deeper layers — richer harmonics
      L.filter.frequency.linearRampToValueAtTime(300 + i * 200 + v.energy * 400, now + 0.1);
    } else {
      L.targetGain = 0;
    }

    // smooth transitions
    L.osc.frequency.linearRampToValueAtTime(L.targetFreq, now + 0.08);
    L.gain.gain.linearRampToValueAtTime(L.targetGain, now + 0.05);
  }
}
