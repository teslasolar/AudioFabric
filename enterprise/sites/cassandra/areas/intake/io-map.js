// INTAKE I/O Map — Server rack input blades
// Text/voice capture + NLU intent classification control modules

import { createControlModule } from '../../../../controlmodule.js';

export function buildIntakeCMs() {
  const textCM = createControlModule('CM_TEXT_IN', {
    name: 'Text Input Control',
    AI: [
      { id: 'TXT_LEN', name: 'Message Length', tagPath: 'CASS/INTAKE/TXT_LEN', range: [0, 4096], engUnit: 'chars' },
      { id: 'TXT_ENTROPY', name: 'Text Entropy', tagPath: 'CASS/INTAKE/TXT_ENTROPY', range: [0, 1], engUnit: 'ratio' },
    ],
    DI: [
      { id: 'TXT_READY', name: 'Text Ready', tagPath: 'CASS/INTAKE/TXT_READY' },
    ],
    modbus: [
      { register: 50001, type: 'INT16', desc: 'Message length' },
      { register: 50002, type: 'FLOAT32', desc: 'Text entropy' },
    ],
    capability: ['capture', 'buffer', 'tokenize'],
  });

  const voiceCM = createControlModule('CM_VOICE_IN', {
    name: 'Voice Input Control',
    AI: [
      { id: 'VOX_ENERGY', name: 'Voice Energy', tagPath: 'CASS/INTAKE/RAW_ENERGY', range: [0, 1], engUnit: 'ratio' },
      { id: 'VOX_PITCH', name: 'Voice Pitch', tagPath: 'CASS/INTAKE/VOX_PITCH', range: [20, 2000], engUnit: 'Hz' },
    ],
    DI: [
      { id: 'VOX_ACTIVE', name: 'Voice Active', tagPath: 'CASS/INTAKE/VOX_ACTIVE' },
    ],
    modbus: [
      { register: 50004, type: 'FLOAT32', desc: 'Voice energy' },
      { register: 50006, type: 'FLOAT32', desc: 'Voice pitch' },
    ],
    capability: ['capture', 'transcode', 'stt'],
  });

  const intentCM = createControlModule('CM_INTENT', {
    name: 'Intent Classifier Control',
    AI: [
      { id: 'INTENT_CONF', name: 'Intent Confidence', tagPath: 'CASS/INTAKE/CONFIDENCE', range: [0, 1], engUnit: 'ratio' },
      { id: 'URGENCY', name: 'Urgency Score', tagPath: 'CASS/INTAKE/URGENCY', range: [0, 10], engUnit: 'level' },
    ],
    AO: [
      { id: 'ROUTE_CMD', name: 'Route Command', tagPath: 'CASS/INTAKE/ROUTE_CMD', range: [0, 4], engUnit: 'area_id' },
    ],
    modbus: [
      { register: 50008, type: 'FLOAT32', desc: 'Intent confidence' },
      { register: 50010, type: 'FLOAT32', desc: 'Urgency' },
    ],
    capability: ['classify', 'route', 'prioritize'],
  });

  return { textCM, voiceCM, intentCM };
}
