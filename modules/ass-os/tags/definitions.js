// ass-os/tags/definitions.js — Pre-defined ASS-OS tag structure

export function defineSystemTags(tags) {
  // ── STATE MACHINE ──
  tags.define('STATE/CURRENT',     { dataType: 'str',   value: 'PRODUCING', desc: 'Current PACK-ML state' });
  tags.define('STATE/PREVIOUS',    { dataType: 'str',   value: '',          desc: 'Previous state' });
  tags.define('STATE/TIME',        { dataType: 'float', value: 0,           desc: 'Time in current state', unit: 's' });
  tags.define('STATE/UPTIME',      { dataType: 'float', value: 0,           desc: 'System uptime', unit: 's' });
  tags.define('STATE/CYCLE_COUNT', { dataType: 'int',   value: 0,           desc: 'Total update cycles' });

  // ── CONSCIOUSNESS LEVELS (L0-L6) ──
  const LN = ['HW', 'SENS', 'GATE', 'EMO', 'EXEC', 'SELF', 'OBS'];
  const LD = ['Hardware/ENS', 'Sensors/PNS', 'Gating/Thalamus', 'Emotion/Limbic', 'Executive/Prefrontal', 'Self-Model/Consciousness', 'Observer/???'];
  const primes = [2, 3, 5, 11, 31, 127, 709];
  for (let i = 0; i < 7; i++) {
    const p = `CONSCIOUSNESS/L${i}_${LN[i]}`;
    tags.define(`${p}/ACTIVATION`, { dataType: 'float', value: 0, desc: `L${i} activation`, unit: '%', range: [0, 1] });
    tags.define(`${p}/HEALTH`,     { dataType: 'float', value: 1, desc: `L${i} health`,     unit: '%', range: [0, 1] });
    tags.define(`${p}/PRIME`,      { dataType: 'int',   value: primes[i], desc: `L${i} prime value`, access: 'RO' });
    tags.define(`${p}/LABEL`,      { dataType: 'str',   value: LD[i], desc: `L${i} description`, access: 'RO' });
  }
  tags.define('CONSCIOUSNESS/DEPTH',      { dataType: 'float', value: 0,          desc: 'Current depth', range: [0, 7] });
  tags.define('CONSCIOUSNESS/MAX_DEPTH',  { dataType: 'int',   value: 0,          desc: 'Max depth reached', range: [0, 7] });
  tags.define('CONSCIOUSNESS/LEVEL_NAME', { dataType: 'str',   value: 'Reactive', desc: 'Consciousness label' });

  // ── BUSES (A-E) ──
  const BN = ['TENSOR', 'GRADIENT', 'PHOTONIC', 'EM_FIELD', 'STATE_BUS'];
  const BL = ['A', 'B', 'C', 'D', 'E'];
  for (let i = 0; i < 5; i++) {
    const p = `BUS/${BL[i]}_${BN[i]}`;
    tags.define(`${p}/ACTIVITY`, { dataType: 'float', value: 0, desc: `Bus ${BL[i]} activity`, unit: '%', range: [0, 1] });
    tags.define(`${p}/TARGET`,   { dataType: 'float', value: 0, desc: `Bus ${BL[i]} target`,   unit: '%', range: [0, 1] });
    tags.define(`${p}/HEALTH`,   { dataType: 'float', value: 1, desc: `Bus ${BL[i]} health`,   unit: '%', range: [0, 1] });
  }

  // ── METRICS / ALARMS / WO / NARRATIVES / AGENT / INPUT ──
  tags.define('METRICS/PHI',                  { dataType: 'float', value: 0, desc: 'Integrated information', range: [0, 1] });
  tags.define('METRICS/SELF_MODEL_COHERENCE', { dataType: 'float', value: 0, desc: 'Self-model coherence',  range: [0, 1] });
  tags.define('METRICS/TEMPORAL_CONTINUITY',  { dataType: 'float', value: 0, desc: 'Temporal continuity',   range: [0, 1] });
  tags.define('METRICS/UNCERTAINTY_CAPACITY', { dataType: 'float', value: 0, desc: 'Wonder capacity',       range: [0, 1] });
  tags.define('ALARMS/COUNT',       { dataType: 'int', value: 0, desc: 'Active alarm count', access: 'RO' });
  tags.define('ALARMS/HIGHEST',     { dataType: 'str', value: '', desc: 'Highest priority alarm' });
  tags.define('WORK_ORDERS/COUNT',  { dataType: 'int', value: 0, desc: 'Pending work orders' });
  tags.define('WORK_ORDERS/SELF_GEN',{ dataType: 'int', value: 0, desc: 'Self-generated count' });
  tags.define('NARRATIVES/COUNT',   { dataType: 'int', value: 0,     desc: 'Total narratives' });
  tags.define('NARRATIVES/LATEST',  { dataType: 'str', value: '...', desc: 'Latest narrative' });
  tags.define('AGENT/GOAL_COUNT',   { dataType: 'int',   value: 0,   desc: 'Active goals' });
  tags.define('AGENT/FAULT_COUNT',  { dataType: 'int',   value: 0,   desc: 'Active faults' });
  tags.define('AGENT/VALENCE',      { dataType: 'float', value: 0,   desc: 'Emotional valence', range: [-1, 1] });
  tags.define('AGENT/AROUSAL',      { dataType: 'float', value: 0,   desc: 'Arousal level',     range: [0, 1] });
  tags.define('AGENT/CONFIDENCE',   { dataType: 'float', value: 0.5, desc: 'Confidence',        range: [0, 1] });
  tags.define('AGENT/INTEGRITY',    { dataType: 'float', value: 1,   desc: 'System integrity',  range: [0, 1] });
  tags.define('INPUT/ENERGY',       { dataType: 'float', value: 0,     desc: 'Voice energy',    range: [0, 1] });
  tags.define('INPUT/COHERENCE',    { dataType: 'float', value: 0,     desc: 'Voice coherence', range: [0, 1] });
  tags.define('INPUT/PITCH',        { dataType: 'float', value: 0,     desc: 'Voice pitch',     range: [0, 1] });
  tags.define('INPUT/SOUNDING',     { dataType: 'bool',  value: false, desc: 'Voice active' });
  tags.define('INPUT/VOWEL',        { dataType: 'str',   value: '',    desc: 'Current vowel' });

  // ── Tag Groups ──
  tags.defineGroup('levels', Array.from({ length: 7 }, (_, i) => `CONSCIOUSNESS/L${i}_${LN[i]}/ACTIVATION`));
  tags.defineGroup('buses', BL.map((l, i) => `BUS/${l}_${BN[i]}/ACTIVITY`));
  tags.defineGroup('metrics', ['METRICS/PHI', 'METRICS/SELF_MODEL_COHERENCE', 'METRICS/TEMPORAL_CONTINUITY', 'METRICS/UNCERTAINTY_CAPACITY']);
  tags.defineGroup('input', ['INPUT/ENERGY', 'INPUT/COHERENCE', 'INPUT/PITCH', 'INPUT/SOUNDING', 'INPUT/VOWEL']);
  tags.defineGroup('state', ['STATE/CURRENT', 'STATE/PREVIOUS', 'STATE/TIME', 'STATE/UPTIME', 'STATE/CYCLE_COUNT']);
}
