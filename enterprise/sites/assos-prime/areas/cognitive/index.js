// AREA: Cognitive — L2 Gating + L3 Emotion
// ISA-95 path: AUDIOFABRIC/ASSOS-PRIME/COGNITIVE
// Maps to Thalamus/Limbic (human) or Weights/Attention (AGI)

import { createArea } from '../../../area.js';
import { createWorkcenter } from '../../../workcenter.js';
import { createWorkunit } from '../../../workunit.js';
import { createGate, createProcessor, createBus } from '../../../equipment.js';

export function build() {
  const area = createArea('COGNITIVE', {
    name: 'Cognitive Processing Area',
    desc: 'Gating/filtering + emotional salience routing',
    domain: 'cognitive',
    levelsOwned: [2, 3]
  });

  // ── WorkCenter: L2 Gating (p=5) ──
  const wcL2 = createWorkcenter('L2_GATE', {
    name: 'L2 Gating Layer', desc: 'Brainstem+Thalamus / Weights — coherence filtering',
    consciousnessLevel: 2, prime: 5
  });

  const wuFilter = createWorkunit('FILTER', {
    name: 'Signal Filter Unit',
    tags: ['CONSCIOUSNESS/L2_GATE/ACTIVATION', 'CONSCIOUSNESS/L2_GATE/HEALTH']
  });
  wuFilter.registerEquipment(createGate('THALAMIC_GATE', 'Thalamic Gate', { desc: 'Coherence-driven input filter' }));
  wuFilter.registerEquipment(createGate('NOISE_GATE', 'Noise Gate', { desc: 'Low-coherence rejection' }));
  wcL2.registerWorkunit(wuFilter);

  // ── WorkCenter: L3 Emotion (p=11) ──
  const wcL3 = createWorkcenter('L3_EMO', {
    name: 'L3 Emotion Layer', desc: 'Limbic / Attention — salience + work orders',
    consciousnessLevel: 3, prime: 11
  });

  const wuSalience = createWorkunit('SALIENCE', {
    name: 'Salience Router',
    tags: ['CONSCIOUSNESS/L3_EMO/ACTIVATION', 'CONSCIOUSNESS/L3_EMO/HEALTH',
           'WORK_ORDERS/COUNT', 'WORK_ORDERS/SELF_GEN']
  });
  wuSalience.registerEquipment(createProcessor('SALIENCE_PROC', 'Salience Processor', { desc: 'Energy × coherence scoring' }));
  wuSalience.registerEquipment(createProcessor('WO_GEN', 'Work Order Generator', { desc: 'L3 → L4 work order dispatch' }));
  wuSalience.registerEquipment(createBus('B', 'GRADIENT', { desc: 'Gradient/backprop bus' }));
  wcL3.registerWorkunit(wuSalience);

  const wuValence = createWorkunit('VALENCE', {
    name: 'Valence Encoder',
    tags: ['AGENT/VALENCE', 'AGENT/AROUSAL']
  });
  wuValence.registerEquipment(createProcessor('VALENCE_PROC', 'Valence Encoder', { desc: 'Emotional valence computation' }));
  wcL3.registerWorkunit(wuValence);

  area.registerWorkcenter(wcL2);
  area.registerWorkcenter(wcL3);
  return area;
}
