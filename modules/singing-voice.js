// singing-voice.js — Formant-based singing synthesizer
// Creates a synthetic singing voice that can respond melodically to the user
// Uses vowel formant pairs (F1/F2) through bandpass filters on a rich source oscillator
// Can sing melodies, harmonize with user pitch, echo phrases, and improvise
//
// Usage: init() then singPhrase('la la la', { key: 'C', tempo: 120 })
//   or harmonize(userPitch) to sing along in real-time

import { KI } from './core.js';

// Vowel formant frequencies (Hz) — F1, F2, F3 pairs for each vowel
const FORMANTS = {
  'aa': { f1: 730, f2: 1090, f3: 2440, label: 'ah' },
  'ee': { f1: 270, f2: 2290, f3: 3010, label: 'ee' },
  'eh': { f1: 530, f2: 1840, f3: 2480, label: 'eh' },
  'ih': { f1: 390, f2: 1990, f3: 2550, label: 'ih' },
  'oh': { f1: 570, f2: 840,  f3: 2410, label: 'oh' },
  'oo': { f1: 300, f2: 870,  f3: 2240, label: 'oo' },
  'uh': { f1: 640, f2: 1190, f3: 2390, label: 'uh' },
  'mm': { f1: 300, f2: 700,  f3: 2000, label: 'mm' }
};

// Scale/key definitions (semitone intervals from root)
const SCALES = {
  major:      [0, 2, 4, 5, 7, 9, 11],
  minor:      [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues:      [0, 3, 5, 6, 7, 10],
  dorian:     [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10]
};

// Note name to MIDI number mapping (octave 4)
const NOTE_MAP = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 };

// Convert MIDI note to Hz
function midiToHz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

// State
const state = {
  singing: false,
  currentNote: 0,       // current Hz
  targetNote: 0,
  currentVowel: 'aa',
  volume: 0,
  targetVolume: 0,
  vibratoDepth: 3,      // Hz
  vibratoRate: 5.5,      // Hz
  breathiness: 0.15,
  warmth: 0.7,
  harmonizing: false,
  harmony: 'third',      // third, fifth, octave, unison
  key: 'C',
  scale: 'pentatonic',
  tempo: 100,            // BPM
  phraseQueue: [],
  phraseIndex: 0,
  noteTimer: 0,
  emotion: 'neutral',    // affects timbre
  glide: 0.08,           // portamento speed (seconds)
  reverbMix: 0.3
};

// Audio nodes
let ctx = null;
let masterGain = null;
let sourceOsc = null;    // main pitch oscillator (sawtooth-ish)
let sourceOsc2 = null;   // second oscillator slightly detuned for richness
let noiseNode = null;    // breath noise
let noiseGain = null;
let formantFilters = []; // 3 bandpass filters for F1/F2/F3
let formantGains = [];
let vibratoOsc = null;
let vibratoGain = null;
let reverbNode = null;
let compressor = null;

export function init(opts = {}) {
  KI.on('audio:ready', ({ audioCtx }) => setup(audioCtx));

  // if audioCtx already exists
  if (KI.audioCtx) setup(KI.audioCtx);

  KI.register('singing-voice', {
    update, state,
    singPhrase, singNote, stopSinging, setVowel,
    harmonizeWith, setEmotion, setKey, setScale
  });
  KI.emit('singing-voice:ready');
}

function setup(audioCtx) {
  ctx = audioCtx;

  // compressor → output
  compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 12;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.1;
  compressor.connect(ctx.destination);

  // master gain
  masterGain = ctx.createGain();
  masterGain.gain.value = 0;
  masterGain.connect(compressor);

  // simple convolution-like reverb via delay feedback
  const reverbDelay = ctx.createDelay(0.5);
  reverbDelay.delayTime.value = 0.03;
  const reverbFeedback = ctx.createGain();
  reverbFeedback.gain.value = 0.25;
  const reverbFilter = ctx.createBiquadFilter();
  reverbFilter.type = 'lowpass';
  reverbFilter.frequency.value = 3000;
  const reverbGain = ctx.createGain();
  reverbGain.gain.value = state.reverbMix;

  masterGain.connect(reverbDelay);
  reverbDelay.connect(reverbFilter);
  reverbFilter.connect(reverbFeedback);
  reverbFeedback.connect(reverbDelay);
  reverbFilter.connect(reverbGain);
  reverbGain.connect(compressor);

  reverbNode = reverbGain;

  // source oscillator 1 — main voice (sawtooth for rich harmonics)
  sourceOsc = ctx.createOscillator();
  sourceOsc.type = 'sawtooth';
  sourceOsc.frequency.value = 220;

  // source oscillator 2 — slightly detuned for chorus
  sourceOsc2 = ctx.createOscillator();
  sourceOsc2.type = 'sawtooth';
  sourceOsc2.frequency.value = 220;
  sourceOsc2.detune.value = 7; // 7 cents detune

  // sub oscillator for warmth
  const subOsc = ctx.createOscillator();
  subOsc.type = 'sine';
  subOsc.frequency.value = 110;
  const subGain = ctx.createGain();
  subGain.gain.value = 0.08;
  subOsc.connect(subGain);
  subGain.connect(masterGain);
  subOsc.start();

  // store sub for frequency tracking
  state._subOsc = subOsc;

  // vibrato LFO
  vibratoOsc = ctx.createOscillator();
  vibratoOsc.type = 'sine';
  vibratoOsc.frequency.value = state.vibratoRate;
  vibratoGain = ctx.createGain();
  vibratoGain.gain.value = state.vibratoDepth;
  vibratoOsc.connect(vibratoGain);
  vibratoGain.connect(sourceOsc.frequency);
  vibratoGain.connect(sourceOsc2.frequency);
  vibratoOsc.start();

  // breath noise — filtered white noise mixed in
  const bufferSize = ctx.sampleRate * 2;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  noiseNode = ctx.createBufferSource();
  noiseNode.buffer = noiseBuffer;
  noiseNode.loop = true;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 2000;
  noiseFilter.Q.value = 0.5;
  noiseGain = ctx.createGain();
  noiseGain.gain.value = 0;
  noiseNode.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(masterGain);
  noiseNode.start();

  // mix both oscs
  const osc1Gain = ctx.createGain();
  osc1Gain.gain.value = 0.5;
  const osc2Gain = ctx.createGain();
  osc2Gain.gain.value = 0.3;
  sourceOsc.connect(osc1Gain);
  sourceOsc2.connect(osc2Gain);

  // 3 formant bandpass filters in parallel
  for (let i = 0; i < 3; i++) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 8 + i * 4; // tighter Q for higher formants
    const g = ctx.createGain();
    g.gain.value = [0.7, 0.4, 0.2][i]; // F1 loudest, F3 quietest
    osc1Gain.connect(bp);
    osc2Gain.connect(bp);
    bp.connect(g);
    g.connect(masterGain);
    formantFilters.push(bp);
    formantGains.push(g);
  }

  sourceOsc.start();
  sourceOsc2.start();
}

function update(dt, t) {
  if (!ctx || !sourceOsc) return;
  const now = ctx.currentTime;
  const v = KI.voice;

  // harmonize mode — track user pitch
  if (state.harmonizing && v.sounding && v.f0 > 50) {
    const interval = { third: 4, fifth: 7, octave: 12, unison: 0, sixth: 9 }[state.harmony] || 4;
    const userMidi = 12 * Math.log2(v.f0 / 440) + 69;
    const harmonyMidi = userMidi + interval;
    state.targetNote = midiToHz(harmonyMidi);
    state.targetVolume = 0.12 + v.energy * 0.08;

    // match user vowel
    if (v.vowel && FORMANTS[v.vowel]) {
      state.currentVowel = v.vowel;
    }
  }

  // phrase playback
  if (state.phraseQueue.length > 0 && state.phraseIndex < state.phraseQueue.length) {
    state.noteTimer -= dt;
    if (state.noteTimer <= 0) {
      const note = state.phraseQueue[state.phraseIndex];
      if (note.rest) {
        state.targetVolume = 0;
      } else {
        state.targetNote = note.freq;
        state.targetVolume = note.volume || 0.15;
        if (note.vowel) state.currentVowel = note.vowel;
      }
      state.noteTimer = note.duration || (60 / state.tempo);
      state.phraseIndex++;

      if (state.phraseIndex >= state.phraseQueue.length) {
        // phrase done
        state.singing = false;
        state.targetVolume = 0;
        state.phraseQueue = [];
        KI.emit('singing-voice:phrase-end');
      }
    }
  }

  // smooth note glide (portamento)
  if (state.targetNote > 0) {
    state.currentNote += (state.targetNote - state.currentNote) * (1 - Math.exp(-dt / state.glide));
  }

  // smooth volume
  state.volume += (state.targetVolume - state.volume) * 0.1;

  // apply to oscillators
  sourceOsc.frequency.linearRampToValueAtTime(
    Math.max(50, state.currentNote), now + 0.02
  );
  sourceOsc2.frequency.linearRampToValueAtTime(
    Math.max(50, state.currentNote * 1.002), now + 0.02  // slight detune
  );
  if (state._subOsc) {
    state._subOsc.frequency.linearRampToValueAtTime(
      Math.max(25, state.currentNote * 0.5), now + 0.02
    );
  }

  masterGain.gain.linearRampToValueAtTime(state.volume, now + 0.02);

  // breath noise — increases with breathiness setting and at phrase boundaries
  noiseGain.gain.linearRampToValueAtTime(
    state.volume * state.breathiness * 0.15, now + 0.02
  );

  // vibrato — deeper when sustaining, shallower on fast notes
  const vibDepth = state.singing ? state.vibratoDepth * (1 + state.volume) : 0;
  vibratoGain.gain.linearRampToValueAtTime(vibDepth, now + 0.05);

  // update formant filters to match current vowel
  const vowelData = FORMANTS[state.currentVowel] || FORMANTS['aa'];
  const formantFreqs = [vowelData.f1, vowelData.f2, vowelData.f3];

  // emotion affects formant brightness and vibrato
  const emotionShift = {
    neutral: { bright: 1.0, vibRate: 5.5, vibDepth: 3 },
    happy:   { bright: 1.2, vibRate: 6.0, vibDepth: 4 },
    sad:     { bright: 0.8, vibRate: 4.5, vibDepth: 5 },
    excited: { bright: 1.3, vibRate: 6.5, vibDepth: 2 },
    gentle:  { bright: 0.9, vibRate: 5.0, vibDepth: 4 },
    playful: { bright: 1.1, vibRate: 7.0, vibDepth: 3 }
  }[state.emotion] || { bright: 1.0, vibRate: 5.5, vibDepth: 3 };

  vibratoOsc.frequency.linearRampToValueAtTime(emotionShift.vibRate, now + 0.1);

  for (let i = 0; i < 3; i++) {
    formantFilters[i].frequency.linearRampToValueAtTime(
      formantFreqs[i] * emotionShift.bright, now + 0.03
    );
  }

  // reverb amount
  if (reverbNode) {
    reverbNode.gain.linearRampToValueAtTime(state.reverbMix, now + 0.05);
  }
}

// === PUBLIC API ===

// Sing a single note
export function singNote(freq, vowel, duration, volume) {
  state.targetNote = freq;
  state.targetVolume = volume || 0.15;
  state.currentVowel = vowel || 'aa';
  state.singing = true;

  if (duration > 0) {
    setTimeout(() => {
      state.targetVolume = 0;
      state.singing = false;
    }, duration * 1000);
  }
}

// Stop singing
export function stopSinging() {
  state.singing = false;
  state.targetVolume = 0;
  state.harmonizing = false;
  state.phraseQueue = [];
  state.phraseIndex = 0;
}

// Set vowel
export function setVowel(vowel) {
  if (FORMANTS[vowel]) state.currentVowel = vowel;
}

// Harmonize with user's voice
export function harmonizeWith(interval) {
  state.harmony = interval || 'third';
  state.harmonizing = true;
  state.singing = true;
  state.targetVolume = 0.12;
}

// Set emotion (affects timbre)
export function setEmotion(emotion) {
  state.emotion = emotion;
}

// Set musical key
export function setKey(key) {
  state.key = key;
}

// Set scale
export function setScale(scale) {
  if (SCALES[scale]) state.scale = scale;
}

// Sing a text phrase as a melody
// text: "la la la" or "do re mi" or any words
// Each syllable gets a note from the current scale
export function singPhrase(text, opts = {}) {
  const key = opts.key || state.key;
  const scale = opts.scale || state.scale;
  const tempo = opts.tempo || state.tempo;
  const octave = opts.octave || 4;
  const emotion = opts.emotion || state.emotion;

  state.emotion = emotion;
  state.tempo = tempo;

  // parse text into syllables
  const syllables = textToSyllables(text);
  const scaleNotes = SCALES[scale] || SCALES.pentatonic;
  const rootMidi = (NOTE_MAP[key] || 60) + (octave - 4) * 12;
  const beatDuration = 60 / tempo;

  // generate melody — walks the scale with some contour
  const melody = generateMelody(syllables.length, scaleNotes, rootMidi, emotion);

  // build phrase queue
  state.phraseQueue = syllables.map((syl, i) => {
    const m = melody[i];
    return {
      freq: midiToHz(m.midi),
      vowel: syllableToVowel(syl),
      duration: m.beats * beatDuration,
      volume: m.volume,
      rest: m.rest || false
    };
  });

  state.phraseIndex = 0;
  state.noteTimer = 0;
  state.singing = true;

  KI.emit('singing-voice:phrase-start', { text, syllableCount: syllables.length });
}

// === TEXT → MELODY HELPERS ===

function textToSyllables(text) {
  // simple syllable splitting: split on spaces, then break long words
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w);
  const syllables = [];
  for (const word of words) {
    // rough syllable split by vowel clusters
    const parts = word.match(/[^aeiou]*[aeiou]+[^aeiou]*/gi) || [word];
    syllables.push(...parts);
  }
  return syllables.length > 0 ? syllables : ['la'];
}

function syllableToVowel(syl) {
  // map syllable's primary vowel to a formant vowel
  const vowelMatch = syl.match(/[aeiou]+/i);
  if (!vowelMatch) return 'mm';
  const v = vowelMatch[0].toLowerCase();
  if (v.includes('ee') || v.includes('ea') || v === 'e') return 'ee';
  if (v.includes('oo') || v.includes('ew')) return 'oo';
  if (v.includes('oh') || v === 'o') return 'oh';
  if (v.includes('ah') || v === 'a') return 'aa';
  if (v.includes('i')) return 'ih';
  if (v.includes('u')) return 'uh';
  return 'eh';
}

function generateMelody(noteCount, scaleNotes, rootMidi, emotion) {
  const notes = [];
  let pos = Math.floor(scaleNotes.length / 2); // start in middle of scale
  const range = scaleNotes.length;

  // emotion affects melodic contour
  const contour = {
    neutral: { jump: 2, restChance: 0.1, accentEvery: 4 },
    happy:   { jump: 3, restChance: 0.05, accentEvery: 2 },
    sad:     { jump: 1, restChance: 0.15, accentEvery: 3 },
    excited: { jump: 3, restChance: 0.02, accentEvery: 2 },
    gentle:  { jump: 1, restChance: 0.1, accentEvery: 4 },
    playful: { jump: 3, restChance: 0.08, accentEvery: 3 }
  }[emotion] || { jump: 2, restChance: 0.1, accentEvery: 4 };

  for (let i = 0; i < noteCount; i++) {
    // occasional rest
    if (Math.random() < contour.restChance && i > 0) {
      notes.push({ midi: rootMidi, beats: 0.5, volume: 0, rest: true });
      continue;
    }

    // step or jump along scale
    const step = Math.floor(Math.random() * contour.jump * 2 + 1) - contour.jump;
    pos = Math.max(0, Math.min(range * 2 - 1, pos + step));

    // wrap through octaves
    const octaveOffset = Math.floor(pos / range) * 12;
    const scaleIdx = pos % range;
    const midi = rootMidi + scaleNotes[scaleIdx] + octaveOffset;

    // rhythm: alternating long/short with accents
    const isAccent = (i % contour.accentEvery) === 0;
    const beats = isAccent ? 1.5 : (Math.random() < 0.3 ? 0.5 : 1);
    const volume = isAccent ? 0.18 : 0.12 + Math.random() * 0.04;

    notes.push({ midi, beats, volume });
  }

  return notes;
}

// Sing a response to text from the LLM — converts reply words into a melody
export function singResponse(text, opts = {}) {
  // pick emotion-appropriate scale and tempo
  const emotion = opts.emotion || state.emotion;
  const scaleMap = {
    happy: 'major', sad: 'minor', excited: 'pentatonic',
    gentle: 'dorian', playful: 'mixolydian', neutral: 'pentatonic'
  };
  const tempoMap = {
    happy: 120, sad: 72, excited: 140,
    gentle: 84, playful: 110, neutral: 100
  };

  singPhrase(text, {
    scale: scaleMap[emotion] || 'pentatonic',
    tempo: tempoMap[emotion] || 100,
    octave: 4,
    emotion
  });
}
