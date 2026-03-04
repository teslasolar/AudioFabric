// ass-os-engine.js — Thin re-export from ass-os/engine.js + spine.js
export { PRIME_SPINE, SPINE_LABELS, SPINE_HUMAN, SPINE_AGI, GROWTH_RATIOS, STATES, TRANSITIONS, ALARM_PRIORITIES } from './ass-os/spine.js';
export { init, getEngine, getState, getLevels, getBuses, getAlarms, getDepth, getPhi, forceState, injectWorkOrder, raiseAlarm, clearAlarm, shelveAlarm } from './ass-os/engine.js';
