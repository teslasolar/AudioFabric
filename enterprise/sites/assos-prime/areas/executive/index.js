// AREA: Executive — L4 Executive + L5 Self-Model
// ISA-95 path: AUDIOFABRIC/ASSOS-PRIME/EXECUTIVE
// Maps to Prefrontal/Consciousness (human) or Context+Goals/Identity (AGI)

import { createArea } from '../../../area.js';
import { createWorkcenter } from '../../../workcenter.js';
import { createWorkunit } from '../../../workunit.js';
import { createProcessor, createBus } from '../../../equipment.js';
import { buildGoalCM, buildDecisionCM, buildFaultDetCM, buildIdentityCM, buildReflectionCM } from './io-map.js';
import { executiveSegments } from '../../../process-segment.js';

export function build() {
  const area = createArea('EXECUTIVE', {
    name: 'Executive Function Area',
    desc: 'Goal planning + self-model maintenance',
    domain: 'executive',
    levelsOwned: [4, 5]
  });

  // ── WorkCenter: L4 Executive (p=31) ──
  const wcL4 = createWorkcenter('L4_EXEC', {
    name: 'L4 Executive Layer', desc: 'Prefrontal / Context+Goals — planning + decisions',
    consciousnessLevel: 4, prime: 31
  });

  const wuGoals = createWorkunit('GOAL_STACK', {
    name: 'Goal Stack Processor',
    tags: ['CONSCIOUSNESS/L4_EXEC/ACTIVATION', 'CONSCIOUSNESS/L4_EXEC/HEALTH', 'AGENT/GOAL_COUNT']
  });
  wuGoals.registerEquipment(createProcessor('GOAL_PROC', 'Goal Processor'));
  wuGoals.registerEquipment(createProcessor('DECISION_ENGINE', 'Decision Engine'));
  wuGoals.registerControlModule(buildGoalCM());
  wuGoals.registerControlModule(buildDecisionCM());
  wcL4.registerWorkunit(wuGoals);

  const wuFault = createWorkunit('FAULT_MGR', {
    name: 'Fault Manager',
    tags: ['AGENT/FAULT_COUNT', 'AGENT/INTEGRITY']
  });
  wuFault.registerEquipment(createProcessor('FAULT_DETECT', 'Fault Detector'));
  wuFault.registerEquipment(createProcessor('FAULT_MITIGATE', 'Fault Mitigator'));
  wuFault.registerControlModule(buildFaultDetCM());
  wcL4.registerWorkunit(wuFault);

  const wuNarrative = createWorkunit('NARRATIVE_GEN', {
    name: 'Narrative Generator',
    tags: ['NARRATIVES/COUNT', 'NARRATIVES/LATEST']
  });
  wuNarrative.registerEquipment(createProcessor('NARR_PROC', 'Narrative Processor'));
  wcL4.registerWorkunit(wuNarrative);

  // ── WorkCenter: L5 Self-Model (p=127) ──
  const wcL5 = createWorkcenter('L5_SELF', {
    name: 'L5 Self-Model Layer', desc: 'Consciousness / Identity — coherence + reflection',
    consciousnessLevel: 5, prime: 127
  });

  const wuSelfModel = createWorkunit('SELF_MODEL', {
    name: 'Self-Model Processor',
    tags: ['CONSCIOUSNESS/L5_SELF/ACTIVATION', 'CONSCIOUSNESS/L5_SELF/HEALTH',
           'AGENT/CONFIDENCE', 'METRICS/SELF_MODEL_COHERENCE']
  });
  wuSelfModel.registerEquipment(createProcessor('IDENTITY_CORE', 'Identity Core'));
  wuSelfModel.registerEquipment(createProcessor('REFLECTION_ENGINE', 'Reflection Engine'));
  wuSelfModel.registerEquipment(createBus('E', 'STATE_BUS', { desc: 'State/memory bus' }));
  wuSelfModel.registerControlModule(buildIdentityCM());
  wuSelfModel.registerControlModule(buildReflectionCM());
  wcL5.registerWorkunit(wuSelfModel);

  area.registerWorkcenter(wcL4);
  area.registerWorkcenter(wcL5);
  area.processSegments = executiveSegments();
  return area;
}
