// synths.js — Audio synthesis for charge sounds, blast sounds, impact sounds
import { KI } from './core.js';

let master, cOsc, cGain, zOsc, zGain;

export function init() {
  KI.on('audio:ready', ({ audioCtx }) => {
    master = audioCtx.createGain();
    master.gain.value = 0.1;
    master.connect(audioCtx.destination);

    cOsc = audioCtx.createOscillator(); cOsc.type = 'sine'; cOsc.frequency.value = 80;
    const cf = audioCtx.createBiquadFilter(); cf.type = 'lowpass'; cf.frequency.value = 400; cf.Q.value = 5;
    cGain = audioCtx.createGain(); cGain.gain.value = 0;
    cOsc.connect(cf); cf.connect(cGain); cGain.connect(master); cOsc.start();

    zOsc = audioCtx.createOscillator(); zOsc.type = 'sawtooth'; zOsc.frequency.value = 2000;
    const zf = audioCtx.createBiquadFilter(); zf.type = 'bandpass'; zf.frequency.value = 3000; zf.Q.value = 1;
    zGain = audioCtx.createGain(); zGain.gain.value = 0;
    zOsc.connect(zf); zf.connect(zGain); zGain.connect(master); zOsc.start();
  });

  KI.on('blast:fired', ({ type, power }) => triggerBlastSound(type, power));
  KI.register('synths', { update });
}

function update() {
  const ctx = KI.audioCtx;
  if (!ctx || !cOsc) return;
  const now = ctx.currentTime, cl = KI.voice.chargeLevel;
  cOsc.frequency.linearRampToValueAtTime(80 + cl * 400, now + 0.1);
  cGain.gain.linearRampToValueAtTime(KI.voice.sounding ? cl * 0.12 : 0, now + 0.1);
  const zv = (cl > 0.2 && KI.voice.sounding) ? (Math.random() < cl * 0.4 ? cl * 0.06 : 0) : 0;
  zGain.gain.linearRampToValueAtTime(zv, now + 0.02);
  zOsc.frequency.linearRampToValueAtTime(1500 + Math.random() * 3000, now + 0.05);
}

function triggerBlastSound(type, power) {
  const ctx = KI.audioCtx;
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(200 + power * 600, now);
  o.frequency.exponentialRampToValueAtTime(50, now + 0.5);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.15 * power, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  o.connect(g); g.connect(master); o.start(now); o.stop(now + 0.6);

  const z = ctx.createOscillator(); z.type = 'sawtooth';
  z.frequency.setValueAtTime(3000 + Math.random() * 4000, now);
  const zg = ctx.createGain();
  zg.gain.setValueAtTime(0.06 * power, now);
  zg.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  z.connect(zg); zg.connect(master); z.start(now); z.stop(now + 0.1);
}
