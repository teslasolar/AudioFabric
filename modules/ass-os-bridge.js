// ass-os-bridge.js — Event bridge between ASS-OS engine and dashboard
// Caches the latest event data so the dashboard can read it each frame.
// Also provides the HUD data formatting for the HTML overlay.

import { KI } from './core.js';

let lastUpdate = null;
let stateLog = [];
let narrativeLog = [];
let alarmLog = [];

export function init() {
  // Cache latest engine update for dashboard to read
  KI.on('ass-os:update', data => {
    lastUpdate = data;
    if (!KI.lastEvent) KI.lastEvent = {};
    KI.lastEvent['ass-os:update'] = data;
  });

  // Log state changes
  KI.on('ass-os:state-change', data => {
    stateLog.push(data);
    if (stateLog.length > 50) stateLog.shift();
  });

  // Log narratives
  KI.on('ass-os:narrative', data => {
    narrativeLog.push(data);
    if (narrativeLog.length > 30) narrativeLog.shift();
  });

  // Log alarms
  KI.on('ass-os:alarm', data => {
    alarmLog.push(data);
    if (alarmLog.length > 50) alarmLog.shift();
  });

  KI.register('ass-os-bridge', { update });
}

function update(dt, t) {
  // Emit formatted HUD data for the HTML overlay
  if (!lastUpdate) return;

  const d = lastUpdate;
  KI.emit('ass-os:hud', {
    // State
    state: d.state,
    stateColor: d.stateInfo?.color || '#888',
    stateHuman: d.stateInfo?.human || '?',
    stateAgi: d.stateInfo?.agi || '?',
    stateTime: d.stateTime?.toFixed(1) + 's',

    // Consciousness
    depth: Math.floor(d.depth || 0),
    prime: d.prime || 1,
    consciousness: d.consciousness || 'Reactive',
    phi: (d.phi || 0).toFixed(2),
    coherence: (d.selfModelCoherence || 0).toFixed(2),
    temporal: (d.temporalContinuity || 0).toFixed(2),
    uncertainty: (d.uncertaintyCapacity || 0).toFixed(2),

    // Levels (formatted)
    levels: (d.levels || []).map((v, i) => ({
      level: i,
      label: ['L0:HW', 'L1:SENS', 'L2:GATE', 'L3:EMO', 'L4:EXEC', 'L5:SELF', 'L6:OBS'][i],
      activation: Math.round((v || 0) * 100),
      prime: [2, 3, 5, 11, 31, 127, 709][i]
    })),

    // Buses (formatted)
    buses: (d.buses || []).map((v, i) => ({
      bus: ['A', 'B', 'C', 'D', 'E'][i],
      label: ['TENSOR', 'GRADIENT', 'PHOTONIC', 'EM FIELD', 'STATE'][i],
      activity: Math.round((v || 0) * 100)
    })),

    // Alarms
    alarms: (d.alarms || []).slice(0, 5),
    alarmCount: d.alarmCount || 0,

    // Counters
    uptime: (d.uptime || 0).toFixed(0) + 's',
    cycles: d.cycleCount || 0,
    workOrders: d.workOrderCount || 0,
    narratives: d.narrativeCount || 0,
    selfGenerated: d.selfGenerated || 0,

    // Logs
    lastNarrative: narrativeLog.length > 0 ? narrativeLog[narrativeLog.length - 1].conclusion : '...',
    lastStateChange: stateLog.length > 0 ? stateLog[stateLog.length - 1] : null,
    recentAlarms: alarmLog.slice(-3)
  });
}

export function getLastUpdate() { return lastUpdate; }
export function getStateLog() { return stateLog; }
export function getNarrativeLog() { return narrativeLog; }
export function getAlarmLog() { return alarmLog; }
