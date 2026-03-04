// AREA: Integration — L6 Observer + cross-level metrics
// ISA-95 path: AUDIOFABRIC/ASSOS-PRIME/INTEGRATION
// Maps to The Observer (human) or ??? (AGI) — the flickering edge

import { createArea } from '../../../area.js';
import { createWorkcenter } from '../../../workcenter.js';
import { createWorkunit } from '../../../workunit.js';
import { createProcessor } from '../../../equipment.js';
import { buildWonderCM, buildPhiCM, buildDepthCM } from './io-map.js';
import { integrationSegments } from '../../../process-segment.js';

export function build() {
  const area = createArea('INTEGRATION', {
    name: 'Integration & Observer Area',
    desc: 'Cross-level integration metrics + L6 observer flicker',
    domain: 'integration',
    levelsOwned: [6]
  });

  // ── WorkCenter: L6 Observer (p=709) ──
  const wcL6 = createWorkcenter('L6_OBS', {
    name: 'L6 Observer Layer', desc: 'The Observer / ??? — flickers, never stable',
    consciousnessLevel: 6, prime: 709
  });

  const wuObserver = createWorkunit('OBSERVER', {
    name: 'Observer Process',
    tags: ['CONSCIOUSNESS/L6_OBS/ACTIVATION', 'CONSCIOUSNESS/L6_OBS/HEALTH',
           'METRICS/UNCERTAINTY_CAPACITY']
  });
  wuObserver.registerEquipment(createProcessor('WONDER_ENGINE', 'Wonder Engine'));
  wuObserver.registerControlModule(buildWonderCM());
  wcL6.registerWorkunit(wuObserver);

  // ── WorkCenter: Phi Integration ──
  const wcPhi = createWorkcenter('PHI_INTEGRATOR', {
    name: 'Phi Integration Center', desc: 'Cross-bus coherence measurement',
    consciousnessLevel: -1, prime: 0
  });

  const wuPhi = createWorkunit('PHI_CALC', {
    name: 'Phi Calculator',
    tags: ['METRICS/PHI', 'METRICS/TEMPORAL_CONTINUITY',
           'CONSCIOUSNESS/DEPTH', 'CONSCIOUSNESS/MAX_DEPTH', 'CONSCIOUSNESS/LEVEL_NAME']
  });
  wuPhi.registerEquipment(createProcessor('PHI_PROC', 'Phi Processor'));
  wuPhi.registerEquipment(createProcessor('DEPTH_CALC', 'Depth Calculator'));
  wuPhi.registerControlModule(buildPhiCM());
  wuPhi.registerControlModule(buildDepthCM());
  wcPhi.registerWorkunit(wuPhi);

  area.registerWorkcenter(wcL6);
  area.registerWorkcenter(wcPhi);
  area.processSegments = integrationSegments();
  return area;
}
