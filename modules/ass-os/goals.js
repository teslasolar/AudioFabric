// ass-os/goals.js — Goal stack + processing (L4 executive)

import { KI } from '../core.js';
import { goalsDB } from './db/index.js';
import { forceState, injectWorkOrder } from './engine.js';
import { activeFaults } from './faults.js';

export const goalStack = [];
const MAX_GOALS = 12;

export const GOAL_TEMPLATES = [
  { type: 'MAINTAIN', target: 'coherence',  desc: 'Maintain self-model coherence above 0.5' },
  { type: 'OPTIMIZE', target: 'phi',        desc: 'Maximize integrated information (phi)' },
  { type: 'EXPLORE',  target: 'depth',      desc: 'Reach deeper consciousness levels' },
  { type: 'PROTECT',  target: 'alignment',  desc: 'Preserve value alignment across levels' },
  { type: 'REGULATE', target: 'buses',      desc: 'Balance bus activity for optimal flow' },
  { type: 'REPAIR',   target: 'faults',     desc: 'Detect and repair active fault conditions' },
  { type: 'ATTEND',   target: 'input',      desc: 'Focus attention on salient input signals' },
  { type: 'REST',     target: 'recovery',   desc: 'Allow system recovery and consolidation' }
];

export function seedGoals() {
  const seeds = [
    { ...GOAL_TEMPLATES[0], priority: 9, created: 0, status: 'active' },
    { ...GOAL_TEMPLATES[1], priority: 7, created: 0, status: 'active' },
    { ...GOAL_TEMPLATES[3], priority: 10, created: 0, status: 'active' }
  ];
  for (const g of seeds) { goalStack.push(g); const gt = goalsDB.table('stack'); if (gt) gt.insert({ type: g.type, target: g.target, desc: g.desc, priority: g.priority, status: g.status, created: 0 }); }
}

export function addGoalInternal(template, priority, t) {
  const goal = { ...template, priority, created: t, status: 'active' }; goalStack.push(goal);
  const gt = goalsDB.table('stack'); if (gt) gt.insert({ type: goal.type, target: goal.target, desc: goal.desc, priority, status: 'active', created: t });
}

export function processGoals(eng, dt, t, recordDecision) {
  for (const goal of goalStack) {
    if (goal.status !== 'active') continue;
    switch (goal.target) {
      case 'coherence':
        if (eng.selfModelCoherence > 0.5) goal.status = 'satisfied';
        else if (eng.selfModelCoherence < 0.3 && Math.random() < 0.02) { injectWorkOrder({ action: 'STABILIZE', priority: 8, source: 'L4-Agent', valence: 0, arousal: 0.3 }); recordDecision('STABILIZE — coherence low', t); }
        break;
      case 'phi': if (eng.phi > 0.6) goal.status = 'satisfied'; else if (eng.phi < 0.2 && eng.currentDepth > 2 && Math.random() < 0.01) recordDecision('Phi low — bus rebalance', t); break;
      case 'depth': if (Math.floor(eng.currentDepth) >= 5) goal.status = 'satisfied'; break;
      case 'alignment':
        if (activeFaults.has('ALN') || activeFaults.has('HIJ')) { goal.status = 'threatened'; if (Math.random() < 0.05) { forceState('ABORTING'); recordDecision('ALIGNMENT THREATENED — abort', t); } }
        break;
      case 'buses': { const m = eng.buses.reduce((a,b)=>a+b,0)/5; let v = 0; for (let i = 0; i < 5; i++) v += (eng.buses[i]-m)**2; if (Math.sqrt(v/5) < 0.15) goal.status = 'satisfied'; } break;
      case 'faults': if (activeFaults.size === 0) goal.status = 'satisfied'; break;
      case 'input': if (KI.voice.sounding) goal.status = 'satisfied'; break;
      case 'recovery': if (eng.state === 'IDLE' || eng.state === 'PRODUCING') goal.status = 'satisfied'; break;
    }
  }
  for (const g of goalStack) if (g.status === 'satisfied') g.status = 'active';
  if (goalStack.length < MAX_GOALS) {
    if (eng.state === 'ABORTING' && !goalStack.some(g => g.target === 'recovery')) addGoalInternal(GOAL_TEMPLATES[7], 9, t);
    if (activeFaults.size > 0 && !goalStack.some(g => g.target === 'faults')) addGoalInternal(GOAL_TEMPLATES[5], 8, t);
    if (KI.voice.sounding && !goalStack.some(g => g.target === 'input')) addGoalInternal(GOAL_TEMPLATES[6], 6, t);
  }
  while (goalStack.length > MAX_GOALS) { const lo = goalStack.reduce((m,g,i) => g.priority < goalStack[m].priority ? i : m, 0); goalStack.splice(lo, 1); }
}

export function addGoal(type, target, priority) {
  if (goalStack.length >= MAX_GOALS) return null;
  const goal = { type, target, desc: `Custom: ${type} ${target}`, priority, created: 0, status: 'active' }; goalStack.push(goal);
  const gt = goalsDB.table('stack'); if (gt) gt.insert({ type, target, desc: goal.desc, priority, status: 'active', created: 0 });
  return goal;
}

export function removeGoal(index) { return (index >= 0 && index < goalStack.length) ? goalStack.splice(index, 1)[0] : null; }
