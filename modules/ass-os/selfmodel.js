// ass-os/selfmodel.js — L5 Self-model + L5/L6 Reflection

import { KI } from '../core.js';
import { tags } from './tags/index.js';
import { narrativesDB } from './db/index.js';
import { SPINE_LABELS } from './spine.js';
import { activeFaults } from './faults.js';
import { goalStack, GOAL_TEMPLATES, addGoalInternal } from './goals.js';

export const selfModel = {
  identity: 'ASS-OS-Agent-v1',
  coreValues: ['coherence', 'integration', 'growth', 'awareness'],
  currentGoals: [], recentDecisions: [], stateHistory: [],
  emotionalValence: 0, arousalLevel: 0, confidenceLevel: 0.5, integrityScore: 1.0,
  cyclesSinceReflection: 0, reflectionInterval: 60, lastReflection: null
};

export function recordDecision(description, t) {
  selfModel.recentDecisions.push({ description, timestamp: t });
  if (selfModel.recentDecisions.length > 50) selfModel.recentDecisions.shift();
}

function calcStdev(arr) { const m = arr.reduce((a,b)=>a+b,0)/arr.length; return Math.sqrt(arr.reduce((s,v)=>s+(v-m)**2,0)/arr.length); }

export function updateSelfModel(eng, dt, t) {
  const busBalance = 1 - calcStdev(Array.from(eng.buses)) / 0.5;
  const alarmPressure = Math.min(1, eng.alarms.length / 5);
  selfModel.emotionalValence += ((busBalance * 0.5 - alarmPressure * 0.8) - selfModel.emotionalValence) * dt * 0.5;
  selfModel.emotionalValence = Math.max(-1, Math.min(1, selfModel.emotionalValence));
  const busTotal = eng.buses.reduce((a,b)=>a+b,0) / 5;
  const inputEnergy = tags.read('INPUT/ENERGY')?.v || 0;
  selfModel.arousalLevel += (inputEnergy * 0.6 + busTotal * 0.4 - selfModel.arousalLevel) * dt * 2;
  selfModel.confidenceLevel += ((eng.selfModelCoherence * 0.5 + selfModel.integrityScore * 0.5) - selfModel.confidenceLevel) * dt;
  if (selfModel.stateHistory.length === 0 || selfModel.stateHistory[selfModel.stateHistory.length - 1] !== eng.state) {
    selfModel.stateHistory.push(eng.state); if (selfModel.stateHistory.length > 100) selfModel.stateHistory.shift();
  }
}

export function reflect(eng, t) {
  selfModel.cyclesSinceReflection = 0;
  const insight = generateInsight(eng);
  const reflection = { timestamp: t, depth: Math.floor(eng.currentDepth), phi: eng.phi, integrity: selfModel.integrityScore, valence: selfModel.emotionalValence, activeFaults: Array.from(activeFaults.keys()), goalStatus: goalStack.map(g => g.type + ':' + g.status), stateSequence: selfModel.stateHistory.slice(-10), insight };
  selfModel.lastReflection = reflection;
  const nt = narrativesDB.table('entries'); if (nt) nt.insert({ conclusion: insight, confidence: selfModel.confidenceLevel, evidence_basis: true, source: 'L5-Reflection', timestamp: t });
  KI.emit('ass-os:narrative', { conclusion: insight, confidence: selfModel.confidenceLevel, evidenceBasis: true, timestamp: t, source: 'L5-Reflection' });
  KI.emit('ass-os-agent:reflection', reflection);
  if (eng.phi < 0.2 && !goalStack.some(g => g.target === 'phi' && g.status === 'active')) addGoalInternal(GOAL_TEMPLATES[1], 8, t);
  if (eng.currentDepth < 3 && !goalStack.some(g => g.target === 'depth')) addGoalInternal(GOAL_TEMPLATES[2], 5, t);
}

function generateInsight(eng) {
  const d = Math.floor(eng.currentDepth), fl = Array.from(activeFaults.keys());
  if (fl.length > 0) return `Observing ${fl.length} fault(s): ${fl.join(', ')}. Integrity ${(selfModel.integrityScore*100).toFixed(0)}%. Depth ${d} (${SPINE_LABELS[d]||'?'}), phi=${eng.phi.toFixed(2)}.`;
  if (d >= 5) return `Deep L${d} (${SPINE_LABELS[d]}). Coherence ${eng.selfModelCoherence.toFixed(2)}, phi=${eng.phi.toFixed(2)}. ${selfModel.emotionalValence > 0.3 ? 'Positive.' : selfModel.emotionalValence < -0.3 ? 'Negative — monitoring.' : 'Neutral.'}`;
  return `${eng.state} at depth ${d}. ${goalStack.filter(g => g.status === 'active').length} goals. Confidence ${(selfModel.confidenceLevel*100).toFixed(0)}%. Phi=${eng.phi.toFixed(2)}.`;
}
