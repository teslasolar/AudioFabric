// web-llm-engine.js — Browser-local LLM via WebGPU + voice emotion analysis
// Wraps @mlc-ai/web-llm for in-browser inference (no server needed)
// Reads voice inflection, pitch, energy, vowels to detect emotion
// Feeds emotion context into LLM prompts for emotionally-aware responses
// Uses SpeechSynthesis API for text-to-speech output

// Available small models (sorted by VRAM requirement)
export const MODELS = [
  { id: 'SmolLM2-135M-Instruct-q0f32-MLC', label: 'SmolLM2 135M', vram: 719, speed: 'fastest' },
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 0.5B', vram: 945, speed: 'fast' },
  { id: 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC', label: 'Qwen2.5 0.5B (f32)', vram: 1078, speed: 'fast' },
  { id: 'gemma-2-2b-it-q4f16_1-MLC-1k', label: 'Gemma2 2B (1k)', vram: 1583, speed: 'medium' },
  { id: 'gemma-2-2b-it-q4f32_1-MLC-1k', label: 'Gemma2 2B f32 (1k)', vram: 1885, speed: 'medium' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama3.2 1B', vram: 1506, speed: 'medium' },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Llama3.2 3B', vram: 2893, speed: 'slower' }
];

let engine = null;
let webllm = null;
let loadState = 'idle'; // idle | loading | ready | error
let loadProgress = 0;
let loadMessage = '';
let conversationHistory = [];
let onProgress = null;
let onReady = null;
let onError = null;

// ─── WEBGPU CHECK ───
export async function checkWebGPU() {
  if (!navigator.gpu) return { supported: false, reason: 'WebGPU not available in this browser' };
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { supported: false, reason: 'No WebGPU adapter found' };
    const info = await adapter.requestAdapterInfo?.() || {};
    return {
      supported: true,
      vendor: info.vendor || 'unknown',
      architecture: info.architecture || 'unknown',
      description: info.description || 'WebGPU available'
    };
  } catch (e) {
    return { supported: false, reason: e.message };
  }
}

// ─── LOAD WEBLLM ───
export async function loadWebLLM() {
  if (webllm) return webllm;
  webllm = await import('https://esm.run/@mlc-ai/web-llm');
  return webllm;
}

// ─── INIT ENGINE ───
export async function initEngine(modelId, callbacks = {}) {
  onProgress = callbacks.onProgress || null;
  onReady = callbacks.onReady || null;
  onError = callbacks.onError || null;

  loadState = 'loading';
  loadProgress = 0;
  loadMessage = 'Loading WebLLM...';

  try {
    const wllm = await loadWebLLM();

    loadMessage = `Loading model: ${modelId}`;
    if (onProgress) onProgress(0, loadMessage);

    engine = await wllm.CreateMLCEngine(modelId, {
      initProgressCallback: (report) => {
        loadProgress = report.progress || 0;
        loadMessage = report.text || 'Loading...';
        if (onProgress) onProgress(loadProgress, loadMessage);
      }
    });

    loadState = 'ready';
    loadMessage = 'Model ready';
    conversationHistory = [];
    if (onReady) onReady(modelId);
    return engine;
  } catch (e) {
    loadState = 'error';
    loadMessage = `Error: ${e.message}`;
    if (onError) onError(e);
    throw e;
  }
}

// ─── EMOTION ANALYSIS ───
// Takes raw voice metrics and produces an emotion profile
export function analyzeEmotion(voiceData) {
  const {
    rms = 0,        // volume (0-1)
    f0 = 0,         // fundamental frequency Hz
    pDelta = 0,     // pitch change since last frame
    sustain = 0,    // how long sustained voicing (seconds)
    coherence = 0,  // vocal coherence (0-1)
    vowel = '',     // detected vowel (ee, eh, ah, oh, oo, mm)
    pulseRate = 0,  // onset rate per second
    energy = 0      // smoothed energy
  } = voiceData;

  // derive emotions from vocal features
  const intensity = Math.min(1, rms * 5);       // how loud
  const pitch = f0 > 0 ? Math.min(1, (f0 - 80) / 400) : 0.5; // relative pitch height
  const pitchVariance = Math.min(1, Math.abs(pDelta) / 50);   // pitch movement
  const steadiness = coherence;                   // how steady the voice is
  const tempo = Math.min(1, pulseRate / 6);       // speech rate

  // emotion mapping
  let emotions = {};

  // excitement = high pitch + high variance + high intensity
  emotions.excitement = Math.min(1, (pitch * 0.3 + pitchVariance * 0.4 + intensity * 0.3));

  // calm = low pitch variance + moderate intensity + high steadiness
  emotions.calm = Math.min(1, (1 - pitchVariance) * 0.4 + steadiness * 0.4 + (1 - tempo) * 0.2);

  // anger = high intensity + low pitch + fast tempo
  emotions.anger = Math.min(1, intensity * 0.4 + (1 - pitch) * 0.2 + tempo * 0.3 + pitchVariance * 0.1);

  // sadness = low intensity + low pitch + slow tempo + high sustain
  emotions.sadness = Math.min(1, (1 - intensity) * 0.3 + (1 - pitch) * 0.3 + (1 - tempo) * 0.2 + (sustain > 0.5 ? 0.2 : 0));

  // joy = high pitch + moderate intensity + moderate variance
  emotions.joy = Math.min(1, pitch * 0.4 + intensity * 0.2 + pitchVariance * 0.2 + (vowel === 'ah' || vowel === 'ee' ? 0.2 : 0));

  // curiosity = rising pitch (positive pDelta) + moderate everything
  emotions.curiosity = Math.min(1, (pDelta > 10 ? 0.5 : 0) + pitchVariance * 0.2 + (1 - intensity) * 0.15 + 0.15);

  // find dominant emotion
  let dominant = 'neutral';
  let maxScore = 0.3; // threshold
  for (const [emotion, score] of Object.entries(emotions)) {
    if (score > maxScore) { maxScore = score; dominant = emotion; }
  }

  return {
    emotions,
    dominant,
    intensity,
    pitch,
    pitchVariance,
    steadiness,
    tempo,
    vowel,
    description: buildEmotionDescription(dominant, intensity, pitch)
  };
}

function buildEmotionDescription(dominant, intensity, pitch) {
  const intLabel = intensity > 0.7 ? 'very' : intensity > 0.4 ? 'moderately' : 'slightly';
  const pitchLabel = pitch > 0.6 ? 'high-pitched' : pitch > 0.3 ? 'mid-range' : 'low-pitched';
  return `${intLabel} ${dominant}, ${pitchLabel} voice`;
}

// ─── CHAT WITH EMOTION CONTEXT ───
export async function chat(userText, emotionProfile = null, options = {}) {
  if (!engine || loadState !== 'ready') throw new Error('Engine not ready');

  // build system prompt with emotion awareness
  let systemPrompt = `You are a friendly, emotionally-aware AI assistant running locally in the user's browser via WebGPU. You can sense the user's vocal emotion and inflection in real-time. Keep responses concise (2-3 sentences) unless asked for more detail. Be warm and responsive to the user's emotional state.`;

  if (emotionProfile) {
    systemPrompt += `\n\nCurrent voice analysis of the user:
- Dominant emotion: ${emotionProfile.dominant}
- Intensity: ${(emotionProfile.intensity * 100).toFixed(0)}%
- Voice pitch: ${emotionProfile.pitch > 0.6 ? 'high' : emotionProfile.pitch > 0.3 ? 'medium' : 'low'}
- Speech tempo: ${emotionProfile.tempo > 0.6 ? 'fast' : emotionProfile.tempo > 0.3 ? 'moderate' : 'slow'}
- Vocal steadiness: ${(emotionProfile.steadiness * 100).toFixed(0)}%
- Detected vowel sound: ${emotionProfile.vowel || 'none'}
- Description: ${emotionProfile.description}

Subtly acknowledge or respond to their emotional state when appropriate. If they sound excited, match their energy. If they sound calm, be measured. If they sound sad, be gentle and supportive.`;
  }

  // manage conversation history (keep last 10 exchanges)
  if (conversationHistory.length > 20) {
    conversationHistory = conversationHistory.slice(-10);
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userText }
  ];

  const stream = options.stream !== false;

  if (stream) {
    const chunks = await engine.chat.completions.create({
      messages,
      temperature: 0.8,
      max_tokens: 256,
      stream: true,
      stream_options: { include_usage: true }
    });

    let reply = '';
    const onChunk = options.onChunk || null;

    for await (const chunk of chunks) {
      const delta = chunk.choices[0]?.delta?.content || '';
      reply += delta;
      if (onChunk) onChunk(delta, reply);
    }

    // update history
    conversationHistory.push({ role: 'user', content: userText });
    conversationHistory.push({ role: 'assistant', content: reply });

    return reply;
  } else {
    const response = await engine.chat.completions.create({
      messages,
      temperature: 0.8,
      max_tokens: 256
    });

    const reply = response.choices[0].message.content;
    conversationHistory.push({ role: 'user', content: userText });
    conversationHistory.push({ role: 'assistant', content: reply });
    return reply;
  }
}

// ─── TEXT-TO-SPEECH ───
let currentUtterance = null;
let ttsVoice = null;

export function initTTS() {
  const synth = window.speechSynthesis;
  // pick a good voice
  const loadVoices = () => {
    const voices = synth.getVoices();
    ttsVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) ||
               voices.find(v => v.lang.startsWith('en') && v.localService) ||
               voices.find(v => v.lang.startsWith('en')) ||
               voices[0];
  };
  loadVoices();
  synth.addEventListener('voiceschanged', loadVoices);
}

export function speak(text, options = {}) {
  const synth = window.speechSynthesis;
  if (currentUtterance) synth.cancel();

  const utt = new SpeechSynthesisUtterance(text);
  if (ttsVoice) utt.voice = ttsVoice;
  utt.rate = options.rate || 1.0;
  utt.pitch = options.pitch || 1.0;
  utt.volume = options.volume || 0.8;
  utt.onend = options.onEnd || null;
  currentUtterance = utt;
  synth.speak(utt);
  return utt;
}

export function stopSpeaking() {
  window.speechSynthesis.cancel();
  currentUtterance = null;
}

export function isSpeaking() {
  return window.speechSynthesis.speaking;
}

// ─── CLEAR HISTORY ───
export function clearHistory() {
  conversationHistory = [];
}

// ─── STATE GETTERS ───
export function getState() {
  return { loadState, loadProgress, loadMessage };
}

export function isReady() { return loadState === 'ready'; }
export function getEngine() { return engine; }
export function getHistory() { return [...conversationHistory]; }
