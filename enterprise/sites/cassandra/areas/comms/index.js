// AREA: Comms — Output Synthesis + Response Delivery
// ISA-95 path: AUDIOFABRIC/CASSANDRA/COMMS
// Server Rack: Output Blades + Network Interface Cards
// The mouth and hands — how Cassandra speaks and acts

import { createArea } from '../../../../area.js';
import { createWorkcenter } from '../../../../workcenter.js';
import { createWorkunit } from '../../../../workunit.js';
import { createProcessor } from '../../../../equipment.js';
import { buildCommsCMs } from './io-map.js';

export function build() {
  const area = createArea('COMMS', {
    name: 'Communications Output Rack',
    desc: 'Response synthesis, TTS, action execution — output blades + NICs',
    domain: 'comms',
    levelsOwned: []
  });

  // ── WorkCenter: Response Synthesis ──
  const wcSynth = createWorkcenter('RESP_SYNTH', {
    name: 'Response Synthesizer', desc: 'Text generation + formatting + tone control',
    consciousnessLevel: -1, prime: 0
  });

  const wuSynth = createWorkunit('TEXT_SYNTH', {
    name: 'Text Synthesizer',
    tags: ['CASS/COMMS/RESP_LENGTH', 'CASS/COMMS/RESP_TONE', 'CASS/COMMS/RESP_READY',
           'CASS/COMMS/STREAM_ACTIVE']
  });
  wuSynth.registerEquipment(createProcessor('FORMATTER', 'Response Formatter'));
  wuSynth.registerEquipment(createProcessor('TONE_ENGINE', 'Tone Controller'));
  const cms = buildCommsCMs();
  wuSynth.registerControlModule(cms.synthCM);
  wcSynth.registerWorkunit(wuSynth);

  // ── WorkCenter: Voice Output ──
  const wcVoice = createWorkcenter('VOICE_OUT', {
    name: 'Voice Output Blade', desc: 'TTS synthesis + prosody control',
    consciousnessLevel: -1, prime: 0
  });

  const wuTTS = createWorkunit('TTS_ENGINE', {
    name: 'TTS Engine',
    tags: ['CASS/COMMS/TTS_ACTIVE', 'CASS/COMMS/TTS_RATE', 'CASS/COMMS/TTS_PITCH']
  });
  wuTTS.registerEquipment(createProcessor('TTS_PROC', 'TTS Processor'));
  wuTTS.registerEquipment(createProcessor('PROSODY', 'Prosody Controller'));
  wuTTS.registerControlModule(cms.ttsCM);
  wcVoice.registerWorkunit(wuTTS);

  // ── WorkCenter: Action Executor ──
  const wcAction = createWorkcenter('ACTION_EXEC', {
    name: 'Action Executor', desc: 'Tool calls, API dispatch, file operations',
    consciousnessLevel: -1, prime: 0
  });

  const wuAction = createWorkunit('TOOL_DISPATCH', {
    name: 'Tool Dispatcher',
    tags: ['CASS/COMMS/TOOL_CALLS', 'CASS/COMMS/TOOL_SUCCESS', 'CASS/COMMS/TOOL_ERRORS']
  });
  wuAction.registerEquipment(createProcessor('TOOL_ENGINE', 'Tool Call Engine'));
  wuAction.registerEquipment(createProcessor('API_GATEWAY', 'API Gateway'));
  wuAction.registerControlModule(cms.toolCM);
  wcAction.registerWorkunit(wuAction);

  area.registerWorkcenter(wcSynth);
  area.registerWorkcenter(wcVoice);
  area.registerWorkcenter(wcAction);
  return area;
}
