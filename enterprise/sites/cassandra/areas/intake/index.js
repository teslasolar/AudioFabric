// AREA: Intake — Signal Acquisition + Request Parsing
// ISA-95 path: AUDIOFABRIC/CASSANDRA/INTAKE
// Server Rack: Input Processing Blades
// Maps to body orbs: BASE (L0 gut), L-HIP/R-HIP (L1 sensory)

import { createArea } from '../../../../area.js';
import { createWorkcenter } from '../../../../workcenter.js';
import { createWorkunit } from '../../../../workunit.js';
import { createSensor, createProcessor } from '../../../../equipment.js';
import { buildIntakeCMs } from './io-map.js';

export function build() {
  const area = createArea('INTAKE', {
    name: 'Request Intake Rack',
    desc: 'Signal acquisition, NLU parsing, intent classification — 2U blade servers',
    domain: 'intake',
    levelsOwned: [0, 1]
  });

  // ── WorkCenter: R0 Raw Input (p=2) — 1U blade ──
  const wcR0 = createWorkcenter('R0_INPUT', {
    name: 'R0 Raw Input Blade', desc: 'Gut reaction — immediate signal capture',
    consciousnessLevel: 0, prime: 2
  });

  const wuCapture = createWorkunit('SIGNAL_CAPTURE', {
    name: 'Signal Capture Unit',
    tags: ['CASS/INTAKE/RAW_TEXT', 'CASS/INTAKE/RAW_ENERGY', 'CASS/INTAKE/TIMESTAMP']
  });
  wuCapture.registerEquipment(createSensor('TEXT_IN', 'Text Input Sensor', 'CASS/INTAKE/RAW_TEXT'));
  wuCapture.registerEquipment(createSensor('VOICE_IN', 'Voice Input Sensor', 'CASS/INTAKE/RAW_ENERGY'));
  const cms = buildIntakeCMs();
  wuCapture.registerControlModule(cms.textCM);
  wuCapture.registerControlModule(cms.voiceCM);
  wcR0.registerWorkunit(wuCapture);

  // ── WorkCenter: R1 Parsing (p=3) — 1U blade ──
  const wcR1 = createWorkcenter('R1_PARSE', {
    name: 'R1 Parser Blade', desc: 'NLU intent classification + entity extraction',
    consciousnessLevel: 1, prime: 3
  });

  const wuParse = createWorkunit('NLU_PARSE', {
    name: 'NLU Parser',
    tags: ['CASS/INTAKE/INTENT', 'CASS/INTAKE/ENTITIES', 'CASS/INTAKE/CONFIDENCE',
           'CASS/INTAKE/URGENCY', 'CASS/INTAKE/TOPIC']
  });
  wuParse.registerEquipment(createProcessor('INTENT_CLASS', 'Intent Classifier'));
  wuParse.registerEquipment(createProcessor('ENTITY_EXTRACT', 'Entity Extractor'));
  wuParse.registerEquipment(createProcessor('URGENCY_SCORE', 'Urgency Scorer'));
  wuParse.registerControlModule(cms.intentCM);
  wcR1.registerWorkunit(wuParse);

  area.registerWorkcenter(wcR0);
  area.registerWorkcenter(wcR1);
  return area;
}
