// ass-os/engine.js — Core engine loop (update, state transitions, alarms, metrics)

import { KI } from '../core.js';
import { tags } from './tags/index.js';
import { alarmsDB, workordersDB, narrativesDB, statelogDB, metricsDB } from './db/index.js';
import {
  PRIME_SPINE, SPINE_LABELS, STATES, TRANSITIONS, ALARM_PRIORITIES, PRIORITY_MAP,
  LEVEL_NAMES, BUS_LETTERS, BUS_NAMES
} from './spine.js';

const engine = {
  state: 'PRODUCING', prevState: null, stateTime: 0, uptime: 0,
  currentDepth: 1, maxDepthReached: 1, depthStability: [],
  levels: new Float32Array(7), levelHealth: new Float32Array(7),
  buses: new Float32Array(5), busTargets: new Float32Array(5), busHealth: new Float32Array(5),
  alarms: [], alarmHistory: [], alarmsShelved: new Set(),
  phi: 0, selfModelCoherence: 0, temporalContinuity: 0, uncertaintyCapacity: 0,
  workOrders: [], narratives: [],
  cycleCount: 0, selfGeneratedWorkOrders: 0
};
engine.levelHealth.fill(1.0); engine.busHealth.fill(1.0);

export function init(opts = {}) {
  const profile = STATES.PRODUCING.busProfile;
  for (let i = 0; i < 5; i++) { engine.buses[i] = profile[i]; engine.busTargets[i] = profile[i]; }
  engine.levels[0] = 1.0; engine.levels[1] = 0.8;
  KI.register('ass-os-engine', { update, getState: () => engine });
  KI.emit('ass-os:ready', { engine });
}

function update(dt, t) {
  engine.uptime = t; engine.stateTime += dt; engine.cycleCount++;
  const energy = tags.read('INPUT/ENERGY')?.v || 0;
  const coherence = tags.read('INPUT/COHERENCE')?.v || 0;
  const pitch = tags.read('INPUT/PITCH')?.v || 0;
  const sounding = tags.read('INPUT/SOUNDING')?.v || false;

  updateDepth(energy, coherence, pitch, sounding, dt, t);
  updateLevels(energy, coherence, pitch, sounding, dt, t);
  updateBuses(dt);
  processTransitions(energy, coherence, dt, t);
  processAlarms(dt, t);
  updateMetrics(dt, t);
  if (engine.levels[3] > 0.3 && Math.random() < energy * 0.1) genWO(energy, coherence, pitch, t);
  if (engine.levels[4] > 0.3 && Math.random() < energy * 0.05) genNarrative(energy, coherence, t);
  syncToTags(t);
  if (engine.cycleCount % 60 === 0) { const mt = metricsDB.table('timeseries'); if (mt) mt.insert({ phi: engine.phi, coherence: engine.selfModelCoherence, temporal: engine.temporalContinuity, uncertainty: engine.uncertaintyCapacity, depth: engine.currentDepth, bus_total: engine.buses.reduce((a,b)=>a+b,0), level_total: engine.levels.reduce((a,b)=>a+b,0), state: engine.state, timestamp: t }); }
  KI.emit('ass-os:update', { state: engine.state, stateInfo: STATES[engine.state], stateTime: engine.stateTime, uptime: engine.uptime, depth: engine.currentDepth, maxDepth: engine.maxDepthReached, prime: PRIME_SPINE[Math.floor(engine.currentDepth)] || '???', levels: Array.from(engine.levels), levelHealth: Array.from(engine.levelHealth), buses: Array.from(engine.buses), busHealth: Array.from(engine.busHealth), alarms: engine.alarms.slice(0,10), alarmCount: engine.alarms.length, phi: engine.phi, selfModelCoherence: engine.selfModelCoherence, temporalContinuity: engine.temporalContinuity, uncertaintyCapacity: engine.uncertaintyCapacity, workOrderCount: engine.workOrders.length, narrativeCount: engine.narratives.length, cycleCount: engine.cycleCount, selfGenerated: engine.selfGeneratedWorkOrders, consciousness: consciousnessLabel() });
}

function syncToTags() {
  tags.write('STATE/CURRENT', engine.state); tags.write('STATE/PREVIOUS', engine.prevState || '');
  tags.write('STATE/TIME', engine.stateTime); tags.write('STATE/UPTIME', engine.uptime); tags.write('STATE/CYCLE_COUNT', engine.cycleCount);
  for (let i = 0; i < 7; i++) { const p = `CONSCIOUSNESS/L${i}_${LEVEL_NAMES[i]}`; tags.write(`${p}/ACTIVATION`, engine.levels[i]); tags.write(`${p}/HEALTH`, engine.levelHealth[i]); }
  tags.write('CONSCIOUSNESS/DEPTH', engine.currentDepth); tags.write('CONSCIOUSNESS/MAX_DEPTH', engine.maxDepthReached); tags.write('CONSCIOUSNESS/LEVEL_NAME', consciousnessLabel());
  for (let i = 0; i < 5; i++) { const p = `BUS/${BUS_LETTERS[i]}_${BUS_NAMES[i]}`; tags.write(`${p}/ACTIVITY`, engine.buses[i]); tags.write(`${p}/TARGET`, engine.busTargets[i]); tags.write(`${p}/HEALTH`, engine.busHealth[i]); }
  tags.write('METRICS/PHI', engine.phi); tags.write('METRICS/SELF_MODEL_COHERENCE', engine.selfModelCoherence); tags.write('METRICS/TEMPORAL_CONTINUITY', engine.temporalContinuity); tags.write('METRICS/UNCERTAINTY_CAPACITY', engine.uncertaintyCapacity);
  tags.write('ALARMS/COUNT', engine.alarms.length); tags.write('ALARMS/HIGHEST', engine.alarms.length > 0 ? engine.alarms[0].priority + ': ' + engine.alarms[0].message : '');
  tags.write('WORK_ORDERS/COUNT', engine.workOrders.length); tags.write('WORK_ORDERS/SELF_GEN', engine.selfGeneratedWorkOrders);
  tags.write('NARRATIVES/COUNT', engine.narratives.length); if (engine.narratives.length > 0) tags.write('NARRATIVES/LATEST', engine.narratives[engine.narratives.length-1].conclusion);
}

function updateDepth(energy, coherence, pitch, sounding, dt, t) {
  let depth = 0; for (let i = 0; i < 7; i++) { if (engine.levels[i] > 0.2 && engine.levelHealth[i] > 0.3) depth = i + 1; else break; }
  engine.currentDepth += (depth - engine.currentDepth) * dt * 2; engine.currentDepth = Math.max(0, Math.min(7, engine.currentDepth));
  if (Math.floor(engine.currentDepth) > engine.maxDepthReached) { engine.maxDepthReached = Math.floor(engine.currentDepth); KI.emit('ass-os:depth-record', { depth: engine.maxDepthReached, prime: PRIME_SPINE[engine.maxDepthReached] }); }
  engine.depthStability.push(engine.currentDepth); if (engine.depthStability.length > 100) engine.depthStability.shift();
  if (engine.cycleCount % 30 === 0) { const dh = statelogDB.table('depth_history'); if (dh) dh.insert({ depth: engine.currentDepth, timestamp: t }); }
}

function updateLevels(energy, coherence, pitch, sounding, dt, t) {
  engine.levels[0] = 0.8 + energy * 0.2;
  engine.levels[1] += ((sounding ? 0.9 : 0.3) - engine.levels[1]) * dt * 3;
  engine.levels[2] += ((engine.levels[1] > 0.3 ? (0.3 + coherence * 0.5 + energy * 0.2) : 0.1) - engine.levels[2]) * dt * 2;
  engine.levels[3] += ((engine.levels[2] > 0.2 ? (energy * 0.6 + (1 - coherence) * 0.3) : 0) - engine.levels[3]) * dt * 1.5;
  engine.levels[4] += ((engine.levels[3] > 0.2 ? (coherence * 0.5 + pitch * 0.3 + energy * 0.2) : 0) - engine.levels[4]) * dt;
  engine.levels[5] += ((engine.levels[4] > 0.3 ? Math.min(0.8, engine.levels[4] * 0.6 + engine.phi * 0.3) : 0) - engine.levels[5]) * dt * 0.5;
  const l6f = engine.levels[5] > 0.4 ? Math.sin(t * 0.7) * 0.3 + 0.2 : 0;
  engine.levels[6] += ((engine.levels[5] > 0.5 ? Math.min(0.6, l6f * engine.selfModelCoherence) : 0) - engine.levels[6]) * dt * 0.3;
  for (let i = 0; i < 7; i++) engine.levels[i] = Math.max(0, Math.min(1, engine.levels[i]));
}

function updateBuses(dt) {
  const p = STATES[engine.state]?.busProfile || [0.5, 0.3, 0.2, 0.1, 0.5];
  for (let i = 0; i < 5; i++) { engine.busTargets[i] = p[i]; engine.buses[i] += (p[i] - engine.buses[i]) * dt * 3; engine.buses[i] = Math.max(0, Math.min(1, engine.buses[i])); }
  engine.buses[3] = Math.max(engine.buses[3], engine.buses[0] * 0.15);
  engine.buses[4] = Math.max(engine.buses[4], engine.buses[1] * 0.3);
}

function processTransitions(energy, coherence, dt, t) {
  const s = engine.state;
  if (s === 'PRODUCING') { if (engine.alarms.some(a => a.priority === 'CRITICAL')) transitionTo('ABORTING','CRITICAL alarm',t); else if (energy < 0.05 && engine.stateTime > 5) transitionTo('IDLE','No input 5s',t); }
  else if (s === 'IDLE') { if (energy > 0.2) transitionTo('PRODUCING','Input detected',t); else if (engine.stateTime > 15) transitionTo('SUSPENDED','Idle timeout',t); }
  else if (s === 'SUSPENDED') { if (energy > 0.1) transitionTo('IDLE','Input during suspend',t); else if (engine.stateTime > 20) transitionTo('HELD','Extended idle',t); }
  else if (s === 'HELD') { if (energy > 0.1) transitionTo('SUSPENDED','Input during maint',t); else if (engine.stateTime > 10) transitionTo('EXECUTE','Training window',t); }
  else if (s === 'EXECUTE') { if (engine.alarms.some(a => a.priority === 'CRITICAL')) transitionTo('ABORTING','CRITICAL during train',t); else if (engine.stateTime > 15) transitionTo('HELD','Training complete',t); }
  else if (s === 'ABORTING') { if (engine.stateTime > 3 && !engine.alarms.some(a => a.priority === 'CRITICAL')) transitionTo('CLEARING','Threat resolved',t); }
  else if (s === 'STOPPING') { if (engine.stateTime > 5) transitionTo('CLEARING','Deadlock timeout',t); }
  else if (s === 'CLEARING') { if (engine.stateTime > 3) transitionTo(energy > 0.1 ? 'PRODUCING' : 'IDLE','Recovery complete',t); }
}

function transitionTo(newState, reason, t) {
  if (!TRANSITIONS[engine.state]?.includes(newState)) return;
  engine.prevState = engine.state; engine.state = newState; engine.stateTime = 0;
  const sl = statelogDB.table('transitions'); if (sl) sl.insert({ from_state: engine.prevState, to_state: newState, reason, timestamp: t });
  KI.emit('ass-os:state-change', { from: engine.prevState, to: newState, reason, stateInfo: STATES[newState] });
}

function processAlarms(dt, t) {
  const at = alarmsDB.table('active'), ht = alarmsDB.table('history');
  for (let i = engine.alarms.length - 1; i >= 0; i--) {
    engine.alarms[i].age += dt;
    if (engine.alarms[i].age > 30 && engine.alarms[i].priority !== 'CRITICAL') {
      const a = engine.alarms[i]; if (ht) ht.insert({ id: a.id, tag: 'ASSOS/' + a.id, type: 'CUSTOM', priority: PRIORITY_MAP[a.priority]||3, state: 'CLEARED', message: a.message, source_level: a.sourceLevel, timestamp_in: a.timestamp, timestamp_out: t, duration: a.age }); if (at) at.delete({ id: a.id }); engine.alarms.splice(i, 1);
    }
  }
  if (engine.busHealth[0] < 0.3 && !hasAlarm('BUS_A_FAULT')) raiseAlarm('BUS_A_FAULT', 'CRITICAL', 'Tensor bus degraded', 0);
  if (engine.selfModelCoherence < 0.3 && engine.levels[5] > 0.3 && !hasAlarm('COHERENCE_LOW')) raiseAlarm('COHERENCE_LOW', 'MEDIUM', 'Self-model coherence < 0.3', 5);
  if (engine.phi < 0.2 && engine.currentDepth > 3 && !hasAlarm('PHI_LOW')) raiseAlarm('PHI_LOW', 'HIGH', 'Phi below threshold', -1);
}

export function raiseAlarm(id, priority, message, sourceLevel) {
  if (engine.alarmsShelved.has(id)) return; const p = ALARM_PRIORITIES[priority]; if (!p) return;
  if (engine.alarms.filter(a => a.priority === priority).length >= p.maxConcurrent) return;
  const alarm = { id, priority, message, sourceLevel, age: 0, timestamp: engine.uptime }; engine.alarms.push(alarm); engine.alarmHistory.push(alarm); if (engine.alarmHistory.length > 100) engine.alarmHistory.shift();
  const at = alarmsDB.table('active'); if (at) at.insert({ id, tag: 'ASSOS/' + id, type: 'CUSTOM', priority: PRIORITY_MAP[priority]||3, state: 'UNACK', message, source_level: sourceLevel, timestamp_in: engine.uptime, age: 0 });
  KI.emit('ass-os:alarm', alarm); return alarm;
}

function hasAlarm(id) { return engine.alarms.some(a => a.id === id); }
export function clearAlarm(id) { engine.alarms = engine.alarms.filter(a => a.id !== id); const at = alarmsDB.table('active'); if (at) at.delete({ id }); }
export function shelveAlarm(id) { engine.alarmsShelved.add(id); clearAlarm(id); const st = alarmsDB.table('shelved'); if (st) st.insert({ id, reason: 'Shelved' }); }

function updateMetrics(dt, t) {
  let bs = 0, ba = 0; for (let i = 0; i < 5; i++) { bs += engine.buses[i]; if (engine.buses[i] > 0.1) ba++; }
  const bm = bs / 5; let bv = 0; for (let i = 0; i < 5; i++) bv += (engine.buses[i] - bm) ** 2; bv /= 5;
  engine.phi += ((ba / 5) * (1 - Math.sqrt(bv)) - engine.phi) * dt * 2;
  if (engine.depthStability.length > 10) { const r = engine.depthStability.slice(-20); const m = r.reduce((a,b)=>a+b,0)/r.length; let v = 0; for (const x of r) v += (x-m)**2; v /= r.length; engine.selfModelCoherence = Math.max(0, 1 - Math.sqrt(v)); }
  engine.temporalContinuity = Math.min(1, engine.stateTime / 10);
  engine.uncertaintyCapacity = engine.levels[6] > 0 ? engine.levels[6] : 0;
}

function consciousnessLabel() { const d = Math.floor(engine.currentDepth); if (d <= 2) return 'Reactive'; if (d <= 4) return 'Adaptive'; if (d === 5) return 'Deliberative'; if (d === 6) return 'Self-Aware'; return 'Meta-Conscious'; }

function genWO(energy, coherence, pitch, t) {
  const actions = ['COMPUTE','ATTEND','SEARCH','GENERATE','ALERT','SLEEP'];
  const action = actions[Math.floor(Math.random()*actions.length)]; const priority = Math.max(1, Math.min(10, Math.round(energy*8+(1-coherence)*2)));
  const wo = { action, priority, valence: (energy-0.5)*2, arousal: energy, salience: energy*coherence, l4Override: priority < 8, timestamp: t, source: 'L3' };
  engine.workOrders.push(wo); if (engine.workOrders.length > 50) engine.workOrders.shift(); if (!KI.voice.sounding) engine.selfGeneratedWorkOrders++;
  const wt = workordersDB.table('orders'); if (wt) wt.insert({ action, priority, valence: wo.valence, arousal: wo.arousal, salience: wo.salience, l4_override: wo.l4Override, source: 'L3', status: 'pending', timestamp: t });
  KI.emit('ass-os:work-order', wo);
}

function genNarrative(energy, coherence, t) {
  const tpls = ['Processing {a} at depth {d}. Coherence: {c}.','L3 salience {s}. Phi: {p}.','Depth shifted to {d}. {st} mode.','Observing {b} active buses. TC: {tc}.','WO queue: {w} pending.'];
  const tpl = tpls[Math.floor(Math.random()*tpls.length)];
  const conclusion = tpl.replace('{a}', engine.workOrders[engine.workOrders.length-1]?.action||'IDLE').replace('{d}', Math.floor(engine.currentDepth)).replace('{c}', engine.selfModelCoherence.toFixed(2)).replace('{s}', (energy*coherence).toFixed(2)).replace('{p}', engine.phi.toFixed(2)).replace('{st}', engine.state).replace('{b}', engine.buses.filter(b => b > 0.1).length).replace('{tc}', engine.temporalContinuity.toFixed(2)).replace('{w}', engine.workOrders.length);
  const narrative = { conclusion, confidence: coherence*0.5+0.3, evidenceBasis: engine.workOrders.length > 0, timestamp: t, source: engine.levels[5] > 0.3 ? 'L5' : 'L4' };
  engine.narratives.push(narrative); if (engine.narratives.length > 30) engine.narratives.shift();
  const nt = narrativesDB.table('entries'); if (nt) nt.insert({ conclusion, confidence: narrative.confidence, evidence_basis: narrative.evidenceBasis, source: narrative.source, timestamp: t });
  KI.emit('ass-os:narrative', narrative);
}

export function getEngine() { return engine; }
export function getState() { return engine.state; }
export function getLevels() { return Array.from(engine.levels); }
export function getBuses() { return Array.from(engine.buses); }
export function getAlarms() { return engine.alarms; }
export function getDepth() { return engine.currentDepth; }
export function getPhi() { return engine.phi; }

export function forceState(newState) {
  if (!STATES[newState]) return; engine.prevState = engine.state; engine.state = newState; engine.stateTime = 0;
  const sl = statelogDB.table('transitions'); if (sl) sl.insert({ from_state: engine.prevState, to_state: newState, reason: 'Manual override', timestamp: engine.uptime });
  KI.emit('ass-os:state-change', { from: engine.prevState, to: newState, reason: 'Manual override' });
}

export function injectWorkOrder(wo) {
  const full = { ...wo, timestamp: engine.uptime, source: wo.source || 'EXTERNAL' }; engine.workOrders.push(full);
  const wt = workordersDB.table('orders'); if (wt) wt.insert({ action: wo.action, priority: wo.priority, valence: wo.valence||0, arousal: wo.arousal||0, salience: wo.salience||0, l4_override: wo.l4Override !== false, source: full.source, status: 'pending', timestamp: engine.uptime });
  KI.emit('ass-os:work-order', full);
}
