// AREA: Autonomic — State machine + alarm management + bus orchestration
// ISA-95 path: AUDIOFABRIC/ASSOS-PRIME/AUTONOMIC
// Cross-cutting area: owns PACK-ML state, ISA-18.2 alarms, bus health

import { createArea } from '../../../area.js';
import { createWorkcenter } from '../../../workcenter.js';
import { createWorkunit } from '../../../workunit.js';
import { createProcessor, createBus } from '../../../equipment.js';
import { buildStateCM, buildAlarmCM, buildBusBalanceCM } from './io-map.js';
import { autonomicSegments } from '../../../process-segment.js';

export function build() {
  const area = createArea('AUTONOMIC', {
    name: 'Autonomic Control Area',
    desc: 'State machine, alarm mgmt, bus orchestration — the "nervous system"',
    domain: 'autonomic',
    levelsOwned: []
  });

  // ── WorkCenter: State Machine ──
  const wcState = createWorkcenter('STATE_MACHINE', {
    name: 'PACK-ML State Machine', desc: '8-state consciousness cycle',
    consciousnessLevel: -1, prime: 0
  });

  const wuState = createWorkunit('STATE_CTRL', {
    name: 'State Controller',
    tags: ['STATE/CURRENT', 'STATE/PREVIOUS', 'STATE/TIME', 'STATE/UPTIME', 'STATE/CYCLE_COUNT']
  });
  wuState.registerEquipment(createProcessor('STATE_ENGINE', 'State Engine'));
  wuState.registerControlModule(buildStateCM());
  wcState.registerWorkunit(wuState);

  // ── WorkCenter: Alarm Management ──
  const wcAlarm = createWorkcenter('ALARM_MGR', {
    name: 'ISA-18.2 Alarm Manager', desc: 'Alarm lifecycle: raise/ack/shelve/clear',
    consciousnessLevel: -1, prime: 0
  });

  const wuAlarm = createWorkunit('ALARM_CTRL', {
    name: 'Alarm Controller',
    tags: ['ALARMS/COUNT', 'ALARMS/HIGHEST']
  });
  wuAlarm.registerEquipment(createProcessor('ALARM_ENGINE', 'Alarm Engine'));
  wuAlarm.registerControlModule(buildAlarmCM());
  wcAlarm.registerWorkunit(wuAlarm);

  // ── WorkCenter: Bus Orchestration ──
  const wcBus = createWorkcenter('BUS_ORCH', {
    name: 'Bus Orchestrator', desc: '5-bus activity coordination',
    consciousnessLevel: -1, prime: 0
  });

  const wuBusCtrl = createWorkunit('BUS_CTRL', {
    name: 'Bus Controller',
    tags: []
  });
  wuBusCtrl.registerEquipment(createBus('C', 'PHOTONIC', { desc: 'Photonic/visual bus' }));
  wuBusCtrl.registerEquipment(createProcessor('BUS_BALANCE', 'Bus Balancer'));
  wuBusCtrl.registerControlModule(buildBusBalanceCM());
  wcBus.registerWorkunit(wuBusCtrl);

  area.registerWorkcenter(wcState);
  area.registerWorkcenter(wcAlarm);
  area.registerWorkcenter(wcBus);
  area.processSegments = autonomicSegments();
  return area;
}
