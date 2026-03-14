// COMMS I/O Map — Output blade + NIC control modules
// Response synthesis, TTS, tool execution

import { createControlModule } from '../../../../controlmodule.js';

export function buildCommsCMs() {
  const synthCM = createControlModule('CM_RESP_SYNTH', {
    name: 'Response Synthesizer Control',
    AI: [
      { id: 'RESP_LEN', name: 'Response Length', tagPath: 'CASS/COMMS/RESP_LENGTH', range: [0, 4096], engUnit: 'tokens' },
      { id: 'RESP_TONE', name: 'Response Tone', tagPath: 'CASS/COMMS/RESP_TONE', range: [0, 1], engUnit: 'ratio' },
    ],
    DI: [
      { id: 'RESP_READY', name: 'Response Ready', tagPath: 'CASS/COMMS/RESP_READY' },
      { id: 'STREAMING', name: 'Stream Active', tagPath: 'CASS/COMMS/STREAM_ACTIVE' },
    ],
    DO: [
      { id: 'SEND_CMD', name: 'Send Command', tagPath: 'CASS/COMMS/SEND_CMD' },
    ],
    modbus: [
      { register: 54001, type: 'INT16', desc: 'Response length' },
      { register: 54002, type: 'FLOAT32', desc: 'Tone warmth' },
    ],
    capability: ['format', 'tone-control', 'stream'],
  });

  const ttsCM = createControlModule('CM_TTS', {
    name: 'TTS Engine Control',
    AI: [
      { id: 'TTS_RATE', name: 'Speech Rate', tagPath: 'CASS/COMMS/TTS_RATE', range: [0.5, 2.0], engUnit: 'x' },
      { id: 'TTS_PITCH', name: 'Speech Pitch', tagPath: 'CASS/COMMS/TTS_PITCH', range: [0.5, 2.0], engUnit: 'x' },
    ],
    DI: [
      { id: 'TTS_ACTIVE', name: 'TTS Active', tagPath: 'CASS/COMMS/TTS_ACTIVE' },
    ],
    AO: [
      { id: 'VOLUME', name: 'Output Volume', tagPath: 'CASS/COMMS/VOLUME', range: [0, 1], engUnit: 'ratio' },
    ],
    modbus: [
      { register: 54004, type: 'FLOAT32', desc: 'Speech rate' },
      { register: 54006, type: 'FLOAT32', desc: 'Speech pitch' },
    ],
    capability: ['synthesize', 'prosody', 'ssml'],
  });

  const toolCM = createControlModule('CM_TOOL_EXEC', {
    name: 'Tool Executor Control',
    AI: [
      { id: 'TOOL_CNT', name: 'Tool Calls', tagPath: 'CASS/COMMS/TOOL_CALLS', range: [0, 100], engUnit: 'count' },
      { id: 'TOOL_OK', name: 'Success Count', tagPath: 'CASS/COMMS/TOOL_SUCCESS', range: [0, 100], engUnit: 'count' },
      { id: 'TOOL_ERR', name: 'Error Count', tagPath: 'CASS/COMMS/TOOL_ERRORS', range: [0, 100], engUnit: 'count' },
    ],
    DO: [
      { id: 'EXEC_CMD', name: 'Execute Tool', tagPath: 'CASS/COMMS/EXEC_CMD' },
    ],
    modbus: [
      { register: 54008, type: 'INT16', desc: 'Tool call count' },
      { register: 54009, type: 'INT16', desc: 'Success count' },
      { register: 54010, type: 'INT16', desc: 'Error count' },
    ],
    capability: ['dispatch', 'api-call', 'file-ops', 'webhook'],
  });

  return { synthCM, ttsCM, toolCM };
}
