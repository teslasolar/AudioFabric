// AUTONOMIC I/O Map — L0 ControlModule definitions for state/alarm/bus
// State engine, alarm engine, bus balancer — the nervous system I/O.

import { createControlModule } from '../../../../controlmodule.js';

// ── State Engine Control Module ──
export function buildStateCM() {
  return createControlModule('CM_STATE', {
    name: 'State Engine Control',
    AI: [
      { id: 'ST_TIME', name: 'State Time', tagPath: 'STATE/TIME', range: [0, 999], engUnit: 'sec' },
      { id: 'ST_UPTIME', name: 'Uptime', tagPath: 'STATE/UPTIME', range: [0, 999999], engUnit: 'sec' },
    ],
    DO: [
      { id: 'ST_CMD', name: 'State Command', tagPath: 'AUTONOMIC/STATE_CMD' },
    ],
    DI: [
      { id: 'ST_CURRENT', name: 'Current State', tagPath: 'STATE/CURRENT' },
      { id: 'ST_PREV', name: 'Previous State', tagPath: 'STATE/PREVIOUS' },
    ],
    modbus: [
      { register: 40401, type: 'FLOAT32', desc: 'State time' },
      { register: 40403, type: 'FLOAT32', desc: 'Uptime' },
      { register: 40405, type: 'INT16', desc: 'State code' },
    ],
    capability: ['transition', 'guard', 'timeout'],
  });
}

// ── Alarm Engine Control Module ──
export function buildAlarmCM() {
  return createControlModule('CM_ALARM', {
    name: 'Alarm Engine Control',
    AI: [
      { id: 'ALM_COUNT', name: 'Alarm Count', tagPath: 'ALARMS/COUNT', range: [0, 100], engUnit: 'count' },
    ],
    DO: [
      { id: 'ALM_ACK', name: 'Alarm Acknowledge', tagPath: 'AUTONOMIC/ALM_ACK' },
      { id: 'ALM_SHELVE', name: 'Alarm Shelve', tagPath: 'AUTONOMIC/ALM_SHELVE' },
    ],
    DI: [
      { id: 'ALM_HIGH', name: 'Highest Alarm', tagPath: 'ALARMS/HIGHEST' },
    ],
    modbus: [
      { register: 40407, type: 'INT16', desc: 'Alarm count' },
      { register: 10201, type: 'BOOL', desc: 'Ack command' },
      { register: 10202, type: 'BOOL', desc: 'Shelve command' },
    ],
    capability: ['detect', 'prioritize', 'route', 'shelve'],
  });
}

// ── Bus Balancer Control Module ──
export function buildBusBalanceCM() {
  return createControlModule('CM_BUS_BAL', {
    name: 'Bus Balancer Control',
    AI: [
      { id: 'BUS_A_ACT', name: 'Bus A Activity', tagPath: 'BUS/A_TENSOR/ACTIVITY', range: [0, 1], engUnit: 'ratio' },
      { id: 'BUS_B_ACT', name: 'Bus B Activity', tagPath: 'BUS/B_GRADIENT/ACTIVITY', range: [0, 1], engUnit: 'ratio' },
      { id: 'BUS_C_ACT', name: 'Bus C Activity', tagPath: 'BUS/C_PHOTONIC/ACTIVITY', range: [0, 1], engUnit: 'ratio' },
      { id: 'BUS_D_ACT', name: 'Bus D Activity', tagPath: 'BUS/D_EM_FIELD/ACTIVITY', range: [0, 1], engUnit: 'ratio' },
      { id: 'BUS_E_ACT', name: 'Bus E Activity', tagPath: 'BUS/E_STATE/ACTIVITY', range: [0, 1], engUnit: 'ratio' },
    ],
    AO: [
      { id: 'BUS_BAL_CMD', name: 'Balance Command', tagPath: 'AUTONOMIC/BUS_BAL', range: [0, 1], engUnit: 'ratio' },
    ],
    pid: [
      { id: 'PID_BUS_A', pv: 'BUS/A_TENSOR/ACTIVITY', sp: 'BUS/A_TENSOR/TARGET', cv: 'AUTONOMIC/BUS_A_CV', kp: 0.8, ki: 0.1, kd: 0.02 },
      { id: 'PID_BUS_B', pv: 'BUS/B_GRADIENT/ACTIVITY', sp: 'BUS/B_GRADIENT/TARGET', cv: 'AUTONOMIC/BUS_B_CV', kp: 0.8, ki: 0.1, kd: 0.02 },
    ],
    modbus: [
      { register: 40409, type: 'FLOAT32', desc: 'Bus A activity' },
      { register: 40411, type: 'FLOAT32', desc: 'Bus B activity' },
      { register: 40413, type: 'FLOAT32', desc: 'Bus C activity' },
      { register: 40415, type: 'FLOAT32', desc: 'Bus D activity' },
      { register: 40417, type: 'FLOAT32', desc: 'Bus E activity' },
    ],
    capability: ['cross-couple', 'balance', 'profile-switch'],
  });
}
