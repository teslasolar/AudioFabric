// voice-engine.js — Mic input, pitch detection, vowel/phoneme analysis
import { KI } from './core.js';

const SR = 44100, FFT = 2048;
let analyser, timeData, freqData;

export function init() {
  return navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    KI.stream = stream;
    KI.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SR });
    analyser = KI.audioCtx.createAnalyser();
    analyser.fftSize = FFT;
    analyser.smoothingTimeConstant = 0.8;
    KI.analyser = analyser;
    timeData = new Float32Array(FFT);
    freqData = new Float32Array(analyser.frequencyBinCount);
    KI.audioCtx.createMediaStreamSource(stream).connect(analyser);

    // calibrate noise floor
    setTimeout(() => {
      analyser.getFloatTimeDomainData(timeData);
      let r = 0;
      for (let i = 0; i < timeData.length; i++) r += timeData[i] * timeData[i];
      KI.voice.nf = Math.sqrt(r / timeData.length) * 1.5 + 0.005;
    }, 300);

    KI.register('voice-engine', { update: analyze });
    KI.emit('audio:ready', { audioCtx: KI.audioCtx, stream });
  });
}

function analyze() {
  analyser.getFloatTimeDomainData(timeData);
  analyser.getFloatFrequencyData(freqData);
  const v = KI.voice;
  let r = 0;
  for (let i = 0; i < timeData.length; i++) r += timeData[i] * timeData[i];
  r = Math.sqrt(r / timeData.length);
  v.prevRms = v.rms; v.rms = r;
  v.sounding = r > v.nf * 2;
  v.energy += (r - v.energy) * 0.1;
  v.prevF0 = v.f0;
  v.f0 = detectF0(timeData, SR);
  v.pn = Math.max(0, Math.min(1, (v.f0 - 80) / 720));
  if (v.f0 > 0 && v.prevF0 > 0) v.pDelta = v.f0 - v.prevF0;
  if (v.sounding) {
    v.sustain += 0.016;
    if (v.sustain > 0.3) v.coherence = Math.min(1, v.coherence + 0.01);
  } else {
    v.sustain = 0; v.coherence *= 0.97;
  }

  // formant analysis
  const bw = SR / (freqData.length * 2);
  const sm = new Float32Array(freqData.length);
  for (let i = 2; i < freqData.length - 2; i++)
    sm[i] = (freqData[i-2]+freqData[i-1]+freqData[i]+freqData[i+1]+freqData[i+2]) / 5;
  const peaks = [];
  const lo = Math.floor(200 / bw), hi = Math.min(Math.floor(3000 / bw), sm.length - 1);
  for (let i = lo+1; i < hi-1; i++)
    if (sm[i] > sm[i-1] && sm[i] > sm[i+1] && sm[i] > -60) peaks.push({ f: i*bw, m: sm[i] });
  peaks.sort((a, b) => b.m - a.m);
  let f1 = peaks.length >= 1 ? peaks[0].f : 0, f2 = 0;
  if (peaks.length >= 2) for (let i = 1; i < peaks.length; i++) if (Math.abs(peaks[i].f - f1) > 200) { f2 = peaks[i].f; break; }
  if (f1 > f2 && f2 > 0) { let t = f1; f1 = f2; f2 = t; }
  v.f1 = f1; v.f2 = f2; v.vowel = '';
  if (f1 > 0 && f2 > 0) {
    if (f1 < 400 && f2 > 2000) v.vowel = 'ee';
    else if (f1 > 400 && f1 < 650 && f2 > 1600) v.vowel = 'eh';
    else if (f1 > 600 && f2 > 900 && f2 < 1500) v.vowel = 'ah';
    else if (f1 > 350 && f1 < 600 && f2 < 1100) v.vowel = 'oh';
    else if (f1 < 400 && f2 < 1000) v.vowel = 'oo';
    else if (f1 < 350 && f2 < 1200) v.vowel = 'mm';
  }

  // onset detection
  const now = performance.now();
  if (r > v.lastAmp * 1.8 && r > v.nf * 2) v.onsets.push(now);
  v.lastAmp = r;
  while (v.onsets.length && now - v.onsets[0] > 2000) v.onsets.shift();
  v.pulseRate = v.onsets.length / 2;

  KI.emit('voice:analyzed', v);
}

function detectF0(buf, sr) {
  const sz = buf.length;
  let r = 0;
  for (let i = 0; i < sz; i++) r += buf[i] * buf[i];
  r = Math.sqrt(r / sz);
  if (r < KI.voice.nf) return 0;
  const mn = Math.floor(sr / 1000), mx = Math.floor(sr / 50);
  let bc = 0, bl = 0;
  for (let lag = mn; lag < mx && lag < sz; lag++) {
    let c = 0;
    for (let j = 0; j < sz - lag; j++) c += buf[j] * buf[j+lag];
    if (c > bc) { bc = c; bl = lag; }
  }
  return bl === 0 ? 0 : sr / bl;
}
