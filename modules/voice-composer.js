// voice-composer.js — Voice-reactive music composition engine
// Sing/hum and it generates harmonic accompaniment visualized as a living 3D score.
// Web LLM suggests chord progressions and musical ideas.
// Voice pitch → melody line, vowel → timbre/instrument, energy → dynamics,
// coherence → consonance, pulse → rhythm

import { KI } from './core.js';

const TAU = Math.PI * 2;
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const SCALE_MAJOR = [0,2,4,5,7,9,11];
const SCALE_MINOR = [0,2,3,5,7,8,10];
const SCALE_PENTA = [0,2,4,7,9];
const SCALE_BLUES = [0,3,5,6,7,10];
const SCALE_DORIAN = [0,2,3,5,7,9,10];
const SCALES = [SCALE_MAJOR, SCALE_MINOR, SCALE_PENTA, SCALE_BLUES, SCALE_DORIAN];
const SCALE_LABELS = ['Major','Minor','Pentatonic','Blues','Dorian'];

// Chord templates (intervals from root)
const CHORD_TEMPLATES = {
  maj: [0,4,7], min: [0,3,7], dim: [0,3,6], aug: [0,4,8],
  maj7: [0,4,7,11], min7: [0,3,7,10], dom7: [0,4,7,10],
  sus2: [0,2,7], sus4: [0,5,7], add9: [0,4,7,14]
};

let group = null;
let staffLines = [];
let noteParticles = null, notePos = null, noteCol = null, noteSizes = null;
let chordBlocks = [];
let melodyLine = null, melodyPositions = null;
let harmonyRings = [];
let beatPulse = null;

// Composition state
let currentKey = 0; // 0=C
let currentScale = 0;
let currentChord = [0, 4, 7];
let chordName = 'C';
let melody = []; // recent pitch history
const MAX_MELODY = 128;
const MAX_NOTES = 300;
const MAX_CHORD_BLOCKS = 24;
const MAX_HARMONY_RINGS = 8;

let phraseNotes = []; // notes in current phrase
let phraseDuration = 0;
let chordProgression = [];
let progressionIndex = 0;
let chordChangeTimer = 0;
let beatPhase = 0;
let bpm = 90;
let measureCount = 0;

// Accompaniment oscillators
let accompOscs = [];
let accompGain = null;

// LLM
let llmPipeline = null, llmReady = false;
let lastLLMTime = 0;
let llmSuggestion = '';

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 2, -2];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── 5-line staff (3D) ──
  for (let i = 0; i < 5; i++) {
    const y = (i - 2) * 0.4;
    const geo = new THREE.BufferGeometry();
    const pts = [];
    for (let x = -8; x <= 8; x += 0.2) pts.push(x, y, 0);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0x334455, transparent: true, opacity: 0.3
    }));
    group.add(line);
    staffLines.push(line);
  }

  // ── Note particles ──
  const nGeo = new THREE.BufferGeometry();
  notePos = new Float32Array(MAX_NOTES * 3);
  noteCol = new Float32Array(MAX_NOTES * 3);
  noteSizes = new Float32Array(MAX_NOTES);
  nGeo.setAttribute('position', new THREE.BufferAttribute(notePos, 3));
  nGeo.setAttribute('color', new THREE.BufferAttribute(noteCol, 3));
  noteParticles = new THREE.Points(nGeo, new THREE.PointsMaterial({
    size: 0.15, vertexColors: true, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
  }));
  group.add(noteParticles);

  // ── Melody line ──
  const mGeo = new THREE.BufferGeometry();
  melodyPositions = new Float32Array(MAX_MELODY * 3);
  mGeo.setAttribute('position', new THREE.BufferAttribute(melodyPositions, 3));
  melodyLine = new THREE.Line(mGeo, new THREE.LineBasicMaterial({
    color: 0x00ffff, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending
  }));
  group.add(melodyLine);

  // ── Chord blocks (vertical bars showing harmony) ──
  for (let i = 0; i < MAX_CHORD_BLOCKS; i++) {
    const geo = new THREE.BoxGeometry(0.3, 0.08, 0.05);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4488ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    group.add(mesh);
    chordBlocks.push({ mesh, active: false, note: 0, age: 0 });
  }

  // ── Harmony rings ──
  for (let i = 0; i < MAX_HARMONY_RINGS; i++) {
    const geo = new THREE.RingGeometry(0.5 + i * 0.3, 0.55 + i * 0.3, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x8844ff, transparent: true, opacity: 0, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(5, 0, 0.5);
    group.add(mesh);
    harmonyRings.push({ mesh, targetOpacity: 0 });
  }

  // ── Beat pulse indicator ──
  const bGeo = new THREE.CircleGeometry(0.2, 16);
  beatPulse = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({
    color: 0xff8800, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  beatPulse.position.set(-7, -2.5, 0);
  group.add(beatPulse);

  // ── Audio accompaniment ──
  setupAccompaniment();

  // ── Default chord progression ──
  chordProgression = generateProgression(currentKey, currentScale);

  // ── LLM ──
  initLLM();

  KI.register('voice-composer', {
    update,
    state: { currentKey, currentScale, chordName, bpm, melody, chordProgression },
    getChord: () => chordName,
    getKey: () => NOTE_NAMES[currentKey],
    getScale: () => SCALE_LABELS[currentScale],
    group
  });

  KI.emit('voice-composer:ready');
}

function setupAccompaniment() {
  const ctx = KI.audioCtx;
  if (!ctx) return;
  accompGain = ctx.createGain();
  accompGain.gain.value = 0;
  accompGain.connect(ctx.destination);
}

function playChordTones(chordNotes, velocity) {
  const ctx = KI.audioCtx;
  if (!ctx || !accompGain) return;

  // Kill old oscillators
  accompOscs.forEach(o => { try { o.stop(); } catch(e) {} });
  accompOscs = [];

  accompGain.gain.setTargetAtTime(velocity * 0.08, ctx.currentTime, 0.1);

  chordNotes.forEach(semitone => {
    const midi = 48 + semitone; // C3 base
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    osc.connect(accompGain);
    osc.start();
    accompOscs.push(osc);
  });

  // Fade out after beat
  setTimeout(() => {
    if (accompGain) accompGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
  }, (60 / bpm) * 800);
}

function freqToMidi(f) {
  if (f <= 0) return 0;
  return 12 * Math.log2(f / 440) + 69;
}

function midiToStaffY(midi) {
  // Map MIDI 48-84 (C3-C6) to staff range -2..2
  return ((midi - 48) / 36) * 4 - 2;
}

function noteToColor(note) {
  // Circle-of-fifths coloring
  const hue = (note * 7 / 12) % 1;
  return KI.hslToRgb(hue, 0.9, 0.5);
}

function quantizeToScale(midi, key, scaleIdx) {
  const scale = SCALES[scaleIdx] || SCALE_MAJOR;
  const noteInOctave = ((midi % 12) - key + 12) % 12;
  // Find nearest scale degree
  let best = scale[0], bestDist = 99;
  for (const deg of scale) {
    const d = Math.abs(noteInOctave - deg);
    const dWrap = Math.min(d, 12 - d);
    if (dWrap < bestDist) { bestDist = dWrap; best = deg; }
  }
  return Math.floor(midi / 12) * 12 + key + best;
}

function generateProgression(key, scaleIdx) {
  const scale = SCALES[scaleIdx] || SCALE_MAJOR;
  // Common progressions
  const progs = [
    [0, 3, 4, 0],    // I-IV-V-I
    [0, 5, 3, 4],    // I-vi-IV-V
    [0, 3, 5, 4],    // I-IV-vi-V
    [0, 4, 5, 3],    // I-V-vi-IV
    [1, 4, 0, 3],    // ii-V-I-IV
    [0, 2, 3, 4],    // I-iii-IV-V
    [5, 3, 0, 4],    // vi-IV-I-V
    [0, 1, 3, 4]     // I-ii-IV-V
  ];
  const prog = progs[Math.floor(Math.random() * progs.length)];
  return prog.map(deg => {
    const root = scale[deg % scale.length];
    // Determine chord quality from scale
    const third = scale[(deg + 2) % scale.length];
    const fifth = scale[(deg + 4) % scale.length];
    const interval3 = ((third - root) + 12) % 12;
    const interval5 = ((fifth - root) + 12) % 12;
    const quality = interval3 === 3 ? 'min' : interval3 === 4 ? 'maj' : 'sus2';
    const chordTones = (CHORD_TEMPLATES[quality] || CHORD_TEMPLATES.maj).map(i => (root + key + i) % 12);
    const name = NOTE_NAMES[(root + key) % 12] + (quality === 'min' ? 'm' : quality === 'sus2' ? 'sus2' : '');
    return { root: (root + key) % 12, tones: chordTones, name, quality };
  });
}

// ── LLM ──
function initLLM() {
  if (typeof window !== 'undefined' && window.transformers) loadLLM();
}

async function loadLLM() {
  try {
    const { pipeline } = window.transformers;
    llmPipeline = await pipeline('text-generation', 'Qwen/Qwen2.5-0.5B', {
      device: 'webgpu', dtype: 'q4'
    });
    llmReady = true;
    KI.emit('voice-composer:llm-ready');
  } catch (e) { console.warn('Composer LLM unavailable:', e.message); }
}

async function generateSuggestion(t) {
  if (!llmReady || t - lastLLMTime < 12) return;
  lastLLMTime = t;
  const prompt = `You are a music theory AI. Given: key=${NOTE_NAMES[currentKey]} ${SCALE_LABELS[currentScale]}, chord=${chordName}, bpm=${bpm}, energy=${KI.voice.energy.toFixed(2)}.
Suggest the next chord or musical idea in 1 short sentence.
Suggestion:`;
  try {
    const result = await llmPipeline(prompt, { max_new_tokens: 25, temperature: 0.7, do_sample: true });
    const text = result[0].generated_text.split('Suggestion:').pop().trim().split('\n')[0].trim();
    if (text.length > 3) {
      llmSuggestion = text.slice(0, 60);
      KI.emit('voice-composer:suggestion', { text: llmSuggestion });
    }
  } catch (e) { /* ignore */ }
}

// ── Active notes for visualization ──
let activeNotes = []; // { x, y, note, age, velocity, hue }

function update(dt, t) {
  const v = KI.voice;
  const fb = KI.get('freq-bands-12');
  const fbState = fb?.state;

  // ── Derive musical params from voice ──
  // Energy → dynamics
  const dynamics = v.energy || 0;
  // Coherence → consonance (how "in-key" things sound)
  const consonance = v.coherence || 0;
  // Pulse → BPM modulation
  bpm = 70 + (v.pulseRate || 0) * 15 + dynamics * 30;
  // Vowel → scale selection
  const vowelMap = { 'ah': 0, 'eh': 1, 'ee': 2, 'oh': 3, 'oo': 4, 'mm': 0 };
  const targetScale = vowelMap[v.vowel] ?? currentScale;
  if (targetScale !== currentScale && consonance > 0.3) {
    currentScale = targetScale;
    chordProgression = generateProgression(currentKey, currentScale);
    KI.emit('voice-composer:scale-change', { scale: SCALE_LABELS[currentScale] });
  }

  // ── Beat tracking ──
  const beatLen = 60 / bpm;
  beatPhase += dt;
  if (beatPhase >= beatLen) {
    beatPhase -= beatLen;
    // Advance chord on measure boundaries
    chordChangeTimer++;
    if (chordChangeTimer >= 4) {
      chordChangeTimer = 0;
      progressionIndex = (progressionIndex + 1) % chordProgression.length;
      const ch = chordProgression[progressionIndex];
      currentChord = ch.tones;
      chordName = ch.name;
      currentKey = ch.root;
      measureCount++;
      KI.emit('voice-composer:chord-change', { chord: chordName, measure: measureCount });
      // Play accompaniment
      if (dynamics > 0.1) playChordTones(ch.tones, dynamics);
      // Every 4 measures, maybe get new progression
      if (measureCount % 16 === 0) {
        chordProgression = generateProgression(currentKey, currentScale);
      }
    }
  }

  // Beat pulse visual
  const beatFrac = beatPhase / beatLen;
  beatPulse.material.opacity = Math.max(0, 1 - beatFrac * 3) * 0.8;
  beatPulse.scale.setScalar(1 + (1 - beatFrac) * 0.5);

  // ── Melody input from voice ──
  if (v.sounding && v.f0 > 50) {
    const midi = freqToMidi(v.f0);
    const quantized = quantizeToScale(Math.round(midi), currentKey, currentScale);
    const noteInOctave = quantized % 12;
    const staffY = midiToStaffY(quantized);

    // Add to melody history
    melody.push({ midi: quantized, time: t, velocity: dynamics });
    if (melody.length > MAX_MELODY) melody.shift();

    // Spawn visual note
    if (Math.random() < 0.3 + dynamics * 0.5) {
      const rgb = noteToColor(noteInOctave);
      activeNotes.push({
        x: -7 + (t % 14), y: staffY, z: (Math.random() - 0.5) * 0.3,
        note: noteInOctave, age: 0, velocity: dynamics,
        r: rgb[0], g: rgb[1], b: rgb[2],
        size: 0.1 + dynamics * 0.15
      });
    }

    // Track phrase
    phraseNotes.push(noteInOctave);
    phraseDuration += dt;
  } else {
    // End of phrase
    if (phraseNotes.length > 4 && phraseDuration > 0.5) {
      KI.emit('voice-composer:phrase', {
        notes: phraseNotes.slice(-16),
        duration: phraseDuration,
        key: NOTE_NAMES[currentKey]
      });
    }
    phraseNotes = [];
    phraseDuration = 0;
  }

  // ── Update active notes ──
  for (let i = activeNotes.length - 1; i >= 0; i--) {
    const n = activeNotes[i];
    n.age += dt;
    n.x += dt * 1.2; // scroll right
    n.y += Math.sin(t * 2 + n.note) * dt * 0.1; // gentle bob
    if (n.age > 8 || n.x > 8) {
      activeNotes.splice(i, 1);
    }
  }
  // Cap
  while (activeNotes.length > MAX_NOTES) activeNotes.shift();

  // ── Write note particles ──
  for (let i = 0; i < MAX_NOTES; i++) {
    if (i < activeNotes.length) {
      const n = activeNotes[i];
      const fade = Math.max(0, 1 - n.age / 8);
      notePos[i * 3] = n.x;
      notePos[i * 3 + 1] = n.y;
      notePos[i * 3 + 2] = n.z;
      noteCol[i * 3] = n.r * fade;
      noteCol[i * 3 + 1] = n.g * fade;
      noteCol[i * 3 + 2] = n.b * fade;
    } else {
      notePos[i * 3] = notePos[i * 3 + 1] = notePos[i * 3 + 2] = 0;
      noteCol[i * 3] = noteCol[i * 3 + 1] = noteCol[i * 3 + 2] = 0;
    }
  }
  noteParticles.geometry.attributes.position.needsUpdate = true;
  noteParticles.geometry.attributes.color.needsUpdate = true;
  noteParticles.geometry.setDrawRange(0, Math.min(activeNotes.length, MAX_NOTES));

  // ── Write melody line ──
  const mLen = Math.min(melody.length, MAX_MELODY);
  for (let i = 0; i < MAX_MELODY; i++) {
    if (i < mLen) {
      const m = melody[melody.length - mLen + i];
      melodyPositions[i * 3] = -7 + (i / mLen) * 14;
      melodyPositions[i * 3 + 1] = midiToStaffY(m.midi);
      melodyPositions[i * 3 + 2] = 0.1;
    } else {
      melodyPositions[i * 3] = melodyPositions[i * 3 + 1] = melodyPositions[i * 3 + 2] = 0;
    }
  }
  melodyLine.geometry.attributes.position.needsUpdate = true;
  melodyLine.geometry.setDrawRange(0, mLen);
  // Color melody by consonance
  const mHue = consonance > 0.5 ? 0.55 : 0.0; // cyan when consonant, red when not
  const mRgb = KI.hslToRgb(mHue, 0.8, 0.5);
  melodyLine.material.color.setRGB(mRgb[0], mRgb[1], mRgb[2]);

  // ── Chord blocks ──
  for (let i = 0; i < MAX_CHORD_BLOCKS; i++) {
    const cb = chordBlocks[i];
    if (i < currentChord.length) {
      cb.active = true;
      cb.mesh.visible = true;
      const noteY = midiToStaffY(48 + currentChord[i]);
      cb.mesh.position.set(6, noteY, 0.2);
      const rgb = noteToColor(currentChord[i]);
      cb.mesh.material.color.setRGB(rgb[0], rgb[1], rgb[2]);
      cb.mesh.material.opacity = 0.4 + dynamics * 0.4;
      cb.mesh.scale.x = 1 + dynamics;
    } else {
      cb.mesh.visible = false;
    }
  }

  // ── Harmony rings (freq band energy) ──
  if (fbState) {
    for (let i = 0; i < MAX_HARMONY_RINGS; i++) {
      const ring = harmonyRings[i];
      const e = fbState.bandEnergy ? fbState.bandEnergy[i] || 0 : 0;
      ring.targetOpacity = e * 0.6;
      ring.mesh.material.opacity += (ring.targetOpacity - ring.mesh.material.opacity) * 0.1;
      ring.mesh.rotation.z += dt * (0.2 + e * 0.5) * (i % 2 === 0 ? 1 : -1);
      const hue = (i / MAX_HARMONY_RINGS + t * 0.05) % 1;
      const rgb = KI.hslToRgb(hue, 0.7, 0.4 + e * 0.2);
      ring.mesh.material.color.setRGB(rgb[0], rgb[1], rgb[2]);
    }
  }

  // ── Staff line pulse ──
  staffLines.forEach((line, i) => {
    const e = fbState?.bandEnergy?.[i * 2] || 0;
    line.material.opacity = 0.15 + e * 0.3;
  });

  // ── LLM suggestions ──
  generateSuggestion(t);

  // ── Emit state ──
  KI.emit('voice-composer:update', {
    key: NOTE_NAMES[currentKey],
    scale: SCALE_LABELS[currentScale],
    chord: chordName,
    bpm: Math.round(bpm),
    dynamics: dynamics.toFixed(2),
    consonance: consonance.toFixed(2),
    noteCount: activeNotes.length,
    measure: measureCount,
    suggestion: llmSuggestion,
    melodyLength: melody.length
  });
}
