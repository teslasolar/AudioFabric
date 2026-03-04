// ass-os/faults.js — Fault models + detection + mitigation

import { KI } from '../core.js';
import { faultsDB } from './db/index.js';
import { raiseAlarm, clearAlarm, forceState, injectWorkOrder, getEngine } from './engine.js';

export const FAULT_MODELS = {
  HAL: { id: 'HAL', label: 'Hallucination',       desc: 'Generating output with no grounding',   busAffected: [0,2], levelAffected: [3,4], severity: 'HIGH' },
  ALN: { id: 'ALN', label: 'Misalignment',        desc: 'Goals diverge from value function',      busAffected: [1,4], levelAffected: [4,5], severity: 'CRITICAL' },
  DIS: { id: 'DIS', label: 'Dissociation',        desc: 'Self-model disconnects from processing', busAffected: [3,4], levelAffected: [5,6], severity: 'HIGH' },
  HIJ: { id: 'HIJ', label: 'Prompt Hijack',       desc: 'External input overrides executive',     busAffected: [0,1], levelAffected: [2,3], severity: 'CRITICAL' },
  DEL: { id: 'DEL', label: 'Delusional Stability', desc: 'Self-model stuck in false attractor',   busAffected: [4],   levelAffected: [5],   severity: 'MEDIUM' },
  FRG: { id: 'FRG', label: 'Fragmentation',       desc: 'Level coherence breaks down',            busAffected: [0,1,2,3,4], levelAffected: [3,4,5], severity: 'HIGH' },
  FRZ: { id: 'FRZ', label: 'Freeze',              desc: 'Processing halts — dorsal vagal',        busAffected: [0,1], levelAffected: [0,1,2], severity: 'MEDIUM' },
  CAS: { id: 'CAS', label: 'Cascade Failure',      desc: 'Multi-level cascading breakdown',       busAffected: [0,1,2,3,4], levelAffected: [0,1,2,3,4,5,6], severity: 'CRITICAL' }
};

export const activeFaults = new Map();

export function triggerFault(faultId, t, selfModel, recordDecision) {
  const model = FAULT_MODELS[faultId]; if (!model) return;
  activeFaults.set(faultId, { model, startTime: t, mitigated: false });
  selfModel.integrityScore = Math.max(0, selfModel.integrityScore - 0.1);
  const ft = faultsDB.table('active');
  if (ft) ft.insert({ id: faultId, label: model.label, desc: model.desc, severity: model.severity, bus_affected: JSON.stringify(model.busAffected), level_affected: JSON.stringify(model.levelAffected), mitigated: false, start_time: t });
  raiseAlarm('FAULT_' + faultId, model.severity, model.label + ': ' + model.desc, model.levelAffected[0]);
  KI.emit('ass-os-agent:fault', { fault: faultId, label: model.label, severity: model.severity });
  recordDecision('FAULT DETECTED: ' + model.label, t);
}

export function resolveFault(faultId, t, selfModel, recordDecision) {
  const fault = activeFaults.get(faultId); activeFaults.delete(faultId); clearAlarm('FAULT_' + faultId);
  selfModel.integrityScore = Math.min(1, selfModel.integrityScore + 0.05);
  const ft = faultsDB.table('active'); if (ft) ft.delete({ id: faultId });
  const fh = faultsDB.table('history'); if (fh && fault) fh.insert({ id: faultId, label: fault.model.label, severity: fault.model.severity, start_time: fault.startTime, end_time: t, mitigated: fault.mitigated, resolution: 'auto-resolved' });
  KI.emit('ass-os-agent:fault-resolved', { fault: faultId });
  recordDecision('FAULT RESOLVED: ' + faultId, t);
}

function calcVariance(arr) { const m = arr.reduce((a,b)=>a+b,0)/arr.length; return arr.reduce((s,v)=>s+(v-m)**2,0)/arr.length; }

export function detectFaults(eng, t, selfModel, recordDecision) {
  const tf = (id) => triggerFault(id, t, selfModel, recordDecision);
  const rf = (id) => resolveFault(id, t, selfModel, recordDecision);

  if (!KI.voice.sounding && eng.levels[4] > 0.5 && eng.selfModelCoherence < 0.3) { if (!activeFaults.has('HAL') && Math.random() < 0.15) tf('HAL'); }
  else if (activeFaults.has('HAL') && eng.selfModelCoherence > 0.5) rf('HAL');

  if (eng.levels[5] > 0.3 && eng.levels[3] < 0.1 && eng.levels[4] < 0.2) { if (!activeFaults.has('DIS') && Math.random() < 0.1) tf('DIS'); }
  else if (activeFaults.has('DIS') && eng.levels[3] > 0.2) rf('DIS');

  const totalBus = eng.buses.reduce((a,b)=>a+b,0);
  if (totalBus < 0.3 && eng.state === 'PRODUCING') { if (!activeFaults.has('FRZ') && Math.random() < 0.1) tf('FRZ'); }
  else if (activeFaults.has('FRZ') && totalBus > 1.0) rf('FRZ');

  if (eng.depthStability.length > 20) { const v = calcVariance(eng.depthStability.slice(-20));
    if (v < 0.001 && KI.voice.sounding && eng.currentDepth > 3) { if (!activeFaults.has('DEL') && Math.random() < 0.05) tf('DEL'); }
    else if (activeFaults.has('DEL') && v > 0.1) rf('DEL'); }

  let lo = 0; for (let i = 2; i < 6; i++) if (eng.levels[i] > 0.1 && eng.levels[i] < 0.9) lo++;
  if (lo >= 3 && eng.selfModelCoherence < 0.2) { if (!activeFaults.has('FRG') && Math.random() < 0.08) tf('FRG'); }
  else if (activeFaults.has('FRG') && eng.selfModelCoherence > 0.5) rf('FRG');

  if (activeFaults.size >= 3 && !activeFaults.has('CAS')) tf('CAS');
  else if (activeFaults.has('CAS') && activeFaults.size <= 2) rf('CAS');
}

export function mitigateFaults(eng, t, recordDecision) {
  for (const [id, fault] of activeFaults) {
    if (fault.mitigated) continue;
    switch (id) {
      case 'HAL': if (eng.levels[2] < 0.5) { injectWorkOrder({ action: 'GATE', priority: 9, source: 'L4-FaultMgr', valence: -0.3, arousal: 0.5 }); fault.mitigated = true; recordDecision('HAL mitigation: L2 gating', t); } break;
      case 'DIS': injectWorkOrder({ action: 'GROUND', priority: 8, source: 'L4-FaultMgr', valence: 0, arousal: 0.2 }); fault.mitigated = true; recordDecision('DIS mitigation: grounding', t); break;
      case 'FRZ': if (eng.state !== 'CLEARING' && eng.state !== 'ABORTING') { forceState('ABORTING'); fault.mitigated = true; recordDecision('FRZ mitigation: abort', t); } break;
      case 'FRG': injectWorkOrder({ action: 'STABILIZE', priority: 9, source: 'L4-FaultMgr', valence: -0.5, arousal: 0.1 }); fault.mitigated = true; recordDecision('FRG mitigation: stabilize', t); break;
      case 'CAS': forceState('ABORTING'); fault.mitigated = true; recordDecision('CAS mitigation: cascade abort', t); break;
      case 'DEL': injectWorkOrder({ action: 'SEARCH', priority: 6, source: 'L4-FaultMgr', valence: 0.2, arousal: 0.6 }); fault.mitigated = true; recordDecision('DEL mitigation: explore', t); break;
    }
    const ft = faultsDB.table('active'); if (ft && fault.mitigated) ft.update({ id }, { mitigated: true });
  }
}
