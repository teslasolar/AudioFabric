// ╔══════════════════════════════════════════════════════════════════╗
// ║  THOMAS SHIELD — 127D Voice + Music                              ║
// ║  fold(voice) = 2 · 3 · 5 · 7 · 11 · 13 · 17 = 510,510         ║
// ║                                                                   ║
// ║  The mic hears EVERYTHING: your voice + the speakers.             ║
// ║  Sing with your tracks. The shield responds to the room.          ║
// ╚══════════════════════════════════════════════════════════════════╝

'use strict';

var PHI = (1 + Math.sqrt(5)) / 2;
var TAU = Math.PI * 2;
var GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
var PRIMES = [2, 3, 5, 7, 11, 13, 17];
var DIM_COUNT = 127;
var PARTICLE_COUNT = 12000;
var FFT_SIZE = 2048;
var SAMPLE_RATE = 44100;

// ===== SHIELD RINGS =====
var SHIELD_RINGS = [
  { name: 'GROUND',    prime: 2,  color: '#ff2244', hex: 0xff2244, baseRadius: 1.0,  integrity: 0, target: 0, regen: 0.001 },
  { name: 'SENSORY',   prime: 3,  color: '#ff8800', hex: 0xff8800, baseRadius: 1.45, integrity: 0, target: 0, regen: 0.001 },
  { name: 'GATE',      prime: 5,  color: '#ffcc00', hex: 0xffcc00, baseRadius: 1.90, integrity: 0, target: 0, regen: 0.001 },
  { name: 'AFFECT',    prime: 7,  color: '#44ff66', hex: 0x44ff66, baseRadius: 2.35, integrity: 0, target: 0, regen: 0.001 },
  { name: 'EXECUTIVE', prime: 11, color: '#00ccff', hex: 0x00ccff, baseRadius: 2.80, integrity: 0, target: 0, regen: 0.001 },
  { name: 'IDENTITY',  prime: 13, color: '#8855ff', hex: 0x8855ff, baseRadius: 3.25, integrity: 0, target: 0, regen: 0.001 },
  { name: 'OBSERVER',  prime: 17, color: '#cc44ff', hex: 0xcc44ff, baseRadius: 3.70, integrity: 0, target: 0, regen: 0.001 },
];

var SHIELD_MODES = {
  VOICE:      { label: 'Voice',      targets: null },
  STANDBY:    { label: 'Standby',    targets: [0.30,0.30,0.30,0.30,0.30,0.30,0.30] },
  ALERT:      { label: 'Alert',      targets: [0.85,0.85,0.85,0.85,0.85,0.85,0.85] },
  PRIME_LOCK: { label: 'Prime Lock', targets: [1/PHI,1/(PHI*PHI),1/PHI,1/(PHI*PHI),1/PHI,1/(PHI*PHI),1/PHI] },
  FORTRESS:   { label: 'Fortress',   targets: [1,1,1,1,1,1,1] },
  BLOOM:      { label: 'Bloom',      targets: [0.16,0.30,0.44,0.58,0.72,0.86,1.00] },
  COLLAPSE:   { label: 'Collapse',   targets: [0,0,0,0,0,0,0] },
};

var BUS_POWER = [
  { name: 'BUS-a', feeds: [0,1], power: 0 },
  { name: 'BUS-b', feeds: [1,2], power: 0 },
  { name: 'BUS-g', feeds: [2,3], power: 0 },
  { name: 'BUS-d', feeds: [3,4], power: 0 },
  { name: 'BUS-e', feeds: [4,5], power: 0 },
  { name: 'BUS-z', feeds: [5,6], power: 0 },
];

// ===== STATE =====
var currentMode = 'VOICE';
var foldState = 1.0, foldTarget = 1.0;
var bloomCascadeActive = false, bloomCascadeTime = 0;
var breachActive = false, breachRing = -1;
var startTime = Date.now();
var animFrame = 0;
var controls = { rotation: 0.30, expansion: 0.50, dimFold: 127, phiPhase: 0.62, density: 0.80 };

// Audio
var audioCtx, analyser, micStream, micSource, timeData, freqData;
var oscillators = [], oscGains = [], masterGain;

var voice = {
  ringActivity: new Float32Array(7), ringSmoothed: new Float32Array(7),
  mode: 'SILENT', f0: 0, spectralCentroid: 0, formants: { f1: 0, f2: 0 },
  rms: 0, noiseFloor: 0.008, isSounding: false, soundStartTime: 0,
  silenceStartTime: Date.now(), silenceDuration: 0, pulseRate: 0,
  onsetTimes: [], lastAmplitude: 0, amplitudeHistory: [],
  breathPhase: 'exhale', breathCycleStart: 0, inhaleTime: 0, exhaleTime: 0,
  exhaleRatio: 1.0, breathCount: 0, breathStartTime: 0, breathRate: 0,
  currentVowel: '', vowelHistory: new Set(), vowelHistoryTimer: null,
  sweep: 0, vagalTone: 0, coherence: 0, psiLevel: 0
};

// Three.js
var scene, camera, renderer, orbGroup;
var shieldMeshes = { core: null, rings: [], particles: null, toroidals: [], dimThreads: [] };
var orbitState = { theta: Math.PI/4, phi: Math.PI/3, radius: 14, autoRotate: true, lastInteraction: 0 };
var isDragging = false, dragPrevX = 0, dragPrevY = 0;
var dimEnergy = new Float32Array(DIM_COUNT);
var dimPhase = new Float32Array(DIM_COUNT);
for (var _i = 0; _i < DIM_COUNT; _i++) { dimEnergy[_i] = 0.1; dimPhase[_i] = Math.random() * TAU; }
var waveformCtx = null;

// ===== LOCAL MEDIA STATE =====
var localMediaEl = null; // current <audio> or <video> element
var localMediaSource = null; // MediaElementSourceNode
var musicAnalyser = null; // dedicated analyser for music (clean, no mic)
var musicTimeData = null;
var musicFreqData = null;
var musicMode = false; // true when music is actively playing through local source
var musicOrb = null; // second 3D orb for music visualization
var musicRings = []; // music-driven frequency rings
var musicRMS = 0, musicBass = 0, musicMid = 0, musicHi = 0;

// ===== AI + MCP STATE =====
var aiEngine = null;
var aiMessages = [];
var aiLoading = false;
var mcpTools = [];

var MCP_DEFAULTS = [
  { name: 'set_ring_intensity', description: 'Set a shield ring intensity', params: { ring: 'number 0-6', intensity: 'number 0-1' }, handler: 'SHIELD_RINGS[{ring}].target = {intensity}' },
  { name: 'play_tone', description: 'Play a tone at given frequency', params: { freq: 'number', duration: 'number seconds' }, handler: 'playMcpTone({freq}, {duration})' },
  { name: 'set_mode', description: 'Set shield mode', params: { mode: 'string' }, handler: 'activateMode("{mode}")' },
  { name: 'set_expansion', description: 'Set shield expansion', params: { value: 'number 0-1' }, handler: 'controls.expansion = {value}; document.getElementById("sl-expansion").value = {value}*100' },
  { name: 'set_rotation', description: 'Set rotation speed', params: { value: 'number 0-1' }, handler: 'controls.rotationSpeed = {value}; document.getElementById("sl-rotation").value = {value}*100' }
];

// ===== YOUTUBE STATE =====
var ytPlayer = null;
var ytReady = false;
var ytLoop = false;
var ytVideoHidden = false;
var playlist = []; // { id, title, type:'yt'|'local', blob? }
var plIndex = -1;

