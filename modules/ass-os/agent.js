// ass-os/agent.js — Executive Agent loop (L4/L5)

import { KI } from '../core.js';
import { tags } from './tags/index.js';
import { getEngine, forceState, injectWorkOrder } from './engine.js';
import { FAULT_MODELS, activeFaults, detectFaults, mitigateFaults, triggerFault } from './faults.js';
import { goalStack, GOAL_TEMPLATES, seedGoals, processGoals, addGoal, removeGoal } from './goals.js';
import { selfModel, recordDecision, updateSelfModel, reflect } from './selfmodel.js';

let faultCheckTimer = 0;

export function init() {
  seedGoals();
  selfModel.currentGoals = goalStack.slice();
  KI.on('ass-os:work-order', handleWorkOrder);
  KI.on('ass-os:alarm', handleAlarm);
  KI.on('ass-os:state-change', handleStateChange);
  KI.register('ass-os-agent', { update });
  KI.emit('ass-os-agent:ready', { goals: goalStack.length, faultModels: Object.keys(FAULT_MODELS).length });
}

function update(dt, t) {
  const eng = getEngine(); if (!eng || eng.levels[4] < 0.15) return;
  selfModel.cyclesSinceReflection++;
  processGoals(eng, dt, t, recordDecision);
  faultCheckTimer += dt;
  if (faultCheckTimer > 1.0) { faultCheckTimer = 0; detectFaults(eng, t, selfModel, recordDecision); mitigateFaults(eng, t, recordDecision); }
  if (eng.levels[5] > 0.2) updateSelfModel(eng, dt, t);
  if (selfModel.cyclesSinceReflection >= selfModel.reflectionInterval && eng.levels[5] > 0.3) reflect(eng, t);
  tags.write('AGENT/GOAL_COUNT', goalStack.length); tags.write('AGENT/FAULT_COUNT', activeFaults.size);
  tags.write('AGENT/VALENCE', selfModel.emotionalValence); tags.write('AGENT/AROUSAL', selfModel.arousalLevel);
  tags.write('AGENT/CONFIDENCE', selfModel.confidenceLevel); tags.write('AGENT/INTEGRITY', selfModel.integrityScore);
  KI.emit('ass-os-agent:update', { goals: goalStack.map(g => ({ type: g.type, target: g.target, priority: g.priority, status: g.status })), goalCount: goalStack.length, activeFaults: Array.from(activeFaults.entries()).map(([id,f]) => ({ id, label: f.model.label, severity: f.model.severity, mitigated: f.mitigated })), faultCount: activeFaults.size, selfModel: { valence: selfModel.emotionalValence.toFixed(2), arousal: selfModel.arousalLevel.toFixed(2), confidence: selfModel.confidenceLevel.toFixed(2), integrity: selfModel.integrityScore.toFixed(2), decisions: selfModel.recentDecisions.length, lastReflection: selfModel.lastReflection } });
}

function handleWorkOrder(wo) {
  if (wo.l4Override === false && wo.priority < 5) { KI.emit('ass-os-agent:veto', { workOrder: wo, reason: 'Below threshold' }); return; }
  if (wo.action === 'ALERT' && wo.priority >= 7 && !goalStack.some(g => g.target === 'faults'))
    goalStack.push({ ...GOAL_TEMPLATES[5], priority: wo.priority, created: wo.timestamp, status: 'active' });
}

function handleAlarm(alarm) {
  selfModel.emotionalValence -= alarm.priority === 'CRITICAL' ? 0.3 : alarm.priority === 'HIGH' ? 0.15 : 0.05;
  selfModel.emotionalValence = Math.max(-1, selfModel.emotionalValence);
}

function handleStateChange(data) { recordDecision(`State: ${data.from} → ${data.to} (${data.reason})`, data.timestamp || 0); }

// Public API
export function getGoals() { return goalStack; }
export function getSelfModel() { return selfModel; }
export function getActiveFaults() { return activeFaults; }
export function getFaultModels() { return FAULT_MODELS; }
export { addGoal, removeGoal };

export function injectFault(faultId) {
  if (FAULT_MODELS[faultId] && !activeFaults.has(faultId)) { triggerFault(faultId, getEngine()?.uptime || 0, selfModel, recordDecision); return true; }
  return false;
}
