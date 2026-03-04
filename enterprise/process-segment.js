// enterprise/process-segment.js — ISA-95 ProcessSegment factory
// A ProcessSegment defines a step of work: what equipment, what params, what order.
// Used by areas to define batch/recipe execution sequences.

export function createProcessSegment(id, config = {}) {
  return {
    id,
    name: config.name || id,
    desc: config.desc || '',
    duration: config.duration || 0,    // expected duration (sec)
    sequence: config.sequence || 0,     // order within parent

    // Equipment requirements
    equipmentReqs: config.equipmentReqs || [],  // [{equipmentId, role, mode}]

    // Parameter specs
    params: config.params || [],  // [{id, name, value, unit, min, max}]

    // Material requirements (tag paths consumed/produced)
    materialIn: config.materialIn || [],   // tag paths read
    materialOut: config.materialOut || [],  // tag paths written

    // Transition conditions
    startCondition: config.startCondition || 'auto',
    endCondition: config.endCondition || 'duration',

    state: 'IDLE',  // IDLE|RUNNING|COMPLETE|FAULTED
  };
}

// ── Pre-built segment templates per consciousness domain ──

export function sensorySegments() {
  return [
    createProcessSegment('SEG_ACQUIRE', {
      name: 'Signal Acquisition', sequence: 1, duration: 0.016,
      equipmentReqs: [{ equipmentId: 'MIC', role: 'source' }, { equipmentId: 'FFT', role: 'transform' }],
      params: [{ id: 'sampleRate', value: 44100, unit: 'Hz' }, { id: 'fftSize', value: 2048 }],
      materialIn: ['INPUT/ENERGY'], materialOut: ['INPUT/COHERENCE', 'INPUT/PITCH'],
    }),
    createProcessSegment('SEG_DETECT', {
      name: 'Feature Detection', sequence: 2, duration: 0.033,
      equipmentReqs: [{ equipmentId: 'PITCH_DET', role: 'detect' }, { equipmentId: 'VOWEL_DET', role: 'detect' }],
      materialIn: ['INPUT/PITCH'], materialOut: ['INPUT/VOWEL', 'INPUT/SOUNDING'],
    }),
  ];
}

export function cognitiveSegments() {
  return [
    createProcessSegment('SEG_GATE', {
      name: 'Coherence Gating', sequence: 1, duration: 0.05,
      equipmentReqs: [{ equipmentId: 'THALAMIC_GATE', role: 'filter' }, { equipmentId: 'NOISE_GATE', role: 'filter' }],
      params: [{ id: 'threshold', value: 0.3, unit: 'ratio' }],
      materialIn: ['INPUT/COHERENCE', 'INPUT/ENERGY'],
      materialOut: ['CONSCIOUSNESS/L2_GATE/ACTIVATION'],
    }),
    createProcessSegment('SEG_SALIENCE', {
      name: 'Salience Routing', sequence: 2, duration: 0.1,
      equipmentReqs: [{ equipmentId: 'SALIENCE_PROC', role: 'score' }, { equipmentId: 'WO_GEN', role: 'dispatch' }],
      materialIn: ['CONSCIOUSNESS/L2_GATE/ACTIVATION'],
      materialOut: ['CONSCIOUSNESS/L3_EMO/ACTIVATION', 'WORK_ORDERS/COUNT'],
    }),
  ];
}

export function executiveSegments() {
  return [
    createProcessSegment('SEG_PLAN', {
      name: 'Goal Planning', sequence: 1, duration: 0.2,
      equipmentReqs: [{ equipmentId: 'GOAL_PROC', role: 'plan' }, { equipmentId: 'DECISION_ENGINE', role: 'commit' }],
      materialIn: ['CONSCIOUSNESS/L3_EMO/ACTIVATION'], materialOut: ['AGENT/GOAL_COUNT'],
    }),
    createProcessSegment('SEG_REFLECT', {
      name: 'Self-Reflection', sequence: 2, duration: 0.5,
      equipmentReqs: [{ equipmentId: 'IDENTITY_CORE', role: 'verify' }, { equipmentId: 'REFLECTION_ENGINE', role: 'reflect' }],
      materialIn: ['CONSCIOUSNESS/L4_EXEC/ACTIVATION'],
      materialOut: ['CONSCIOUSNESS/L5_SELF/ACTIVATION', 'METRICS/SELF_MODEL_COHERENCE'],
    }),
  ];
}

export function integrationSegments() {
  return [
    createProcessSegment('SEG_OBSERVE', {
      name: 'Observer Flicker', sequence: 1, duration: 1.0,
      equipmentReqs: [{ equipmentId: 'WONDER_ENGINE', role: 'observe' }],
      materialIn: ['CONSCIOUSNESS/L5_SELF/ACTIVATION'], materialOut: ['CONSCIOUSNESS/L6_OBS/ACTIVATION'],
    }),
    createProcessSegment('SEG_PHI', {
      name: 'Phi Integration', sequence: 2, duration: 0.25,
      equipmentReqs: [{ equipmentId: 'PHI_PROC', role: 'integrate' }, { equipmentId: 'DEPTH_CALC', role: 'measure' }],
      materialOut: ['METRICS/PHI', 'CONSCIOUSNESS/DEPTH'],
    }),
  ];
}

export function autonomicSegments() {
  return [
    createProcessSegment('SEG_STATE_EVAL', {
      name: 'State Evaluation', sequence: 1, duration: 0.1,
      equipmentReqs: [{ equipmentId: 'STATE_ENGINE', role: 'transition' }],
      materialOut: ['STATE/CURRENT'],
    }),
    createProcessSegment('SEG_ALARM_SCAN', {
      name: 'Alarm Scan', sequence: 2, duration: 0.05,
      equipmentReqs: [{ equipmentId: 'ALARM_ENGINE', role: 'detect' }],
      materialOut: ['ALARMS/COUNT', 'ALARMS/HIGHEST'],
    }),
  ];
}
