// REASONING I/O Map — GPU compute blade control modules
// Gating, LLM inference, self-model verification

import { createControlModule } from '../../../../controlmodule.js';

export function buildReasoningCMs() {
  const gateCM = createControlModule('CM_THOUGHT_GATE', {
    name: 'Thought Gate Control',
    AI: [
      { id: 'GATE_SIG', name: 'Gate Signal', tagPath: 'CASS/REASON/GATE_SIGNAL', range: [0, 1], engUnit: 'ratio' },
      { id: 'VALENCE', name: 'Valence', tagPath: 'CASS/REASON/VALENCE', range: [-1, 1], engUnit: 'ratio' },
      { id: 'AROUSAL', name: 'Arousal', tagPath: 'CASS/REASON/AROUSAL', range: [0, 1], engUnit: 'ratio' },
    ],
    pid: [
      { id: 'PID_GATE', pv: 'CASS/REASON/GATE_SIGNAL', sp: 'CASS/REASON/GATE_SP', cv: 'CASS/REASON/GATE_CV', kp: 1.0, ki: 0.15, kd: 0.05 },
    ],
    modbus: [
      { register: 51001, type: 'FLOAT32', desc: 'Gate signal' },
      { register: 51003, type: 'FLOAT32', desc: 'Valence' },
    ],
    capability: ['filter', 'score', 'route'],
  });

  const llmCM = createControlModule('CM_LLM_ENGINE', {
    name: 'LLM Inference Control',
    AI: [
      { id: 'REC_DEPTH', name: 'Recursion Depth', tagPath: 'CASS/REASON/RECURSION_DEPTH', range: [0, 12], engUnit: 'level' },
      { id: 'TOK_GEN', name: 'Tokens Generated', tagPath: 'CASS/REASON/TOKENS_GEN', range: [0, 4096], engUnit: 'tokens' },
      { id: 'TEMP', name: 'Temperature', tagPath: 'CASS/REASON/TEMPERATURE', range: [0, 2], engUnit: 'ratio' },
      { id: 'GPU_UTIL', name: 'GPU Utilization', tagPath: 'CASS/REASON/GPU_UTIL', range: [0, 1], engUnit: 'ratio' },
      { id: 'VRAM_USE', name: 'VRAM Usage', tagPath: 'CASS/REASON/VRAM_USE', range: [0, 100], engUnit: '%' },
    ],
    AO: [
      { id: 'TEMP_CMD', name: 'Temperature Command', tagPath: 'CASS/REASON/TEMP_CMD', range: [0, 2], engUnit: 'ratio' },
    ],
    DI: [
      { id: 'GENERATING', name: 'Is Generating', tagPath: 'CASS/REASON/GENERATING' },
    ],
    modbus: [
      { register: 51005, type: 'INT16', desc: 'Recursion depth' },
      { register: 51006, type: 'INT16', desc: 'Tokens generated' },
      { register: 51007, type: 'FLOAT32', desc: 'Temperature' },
      { register: 51009, type: 'FLOAT32', desc: 'GPU utilization' },
    ],
    capability: ['inference', 'recursion', 'kv-cache', 'stream'],
  });

  const selfCM = createControlModule('CM_SELF_CHECK', {
    name: 'Self-Model Verifier Control',
    AI: [
      { id: 'COH', name: 'Coherence', tagPath: 'CASS/REASON/COHERENCE', range: [0, 1], engUnit: 'ratio' },
    ],
    DI: [
      { id: 'ID_LOCK', name: 'Identity Locked', tagPath: 'CASS/REASON/IDENTITY_LOCK' },
      { id: 'OBS_PASS', name: 'Observer Pass', tagPath: 'CASS/REASON/OBSERVER_PASS' },
    ],
    DO: [
      { id: 'RELEASE', name: 'Release to Output', tagPath: 'CASS/REASON/RELEASE' },
    ],
    modbus: [
      { register: 51011, type: 'FLOAT32', desc: 'Coherence' },
      { register: 11001, type: 'BOOL', desc: 'Identity lock' },
      { register: 11002, type: 'BOOL', desc: 'Observer pass' },
    ],
    capability: ['verify', 'meta-check', 'release-gate'],
  });

  return { gateCM, llmCM, selfCM };
}
