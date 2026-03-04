// AREA: Sensory — L0 Hardware + L1 Sensors
// ISA-95 path: AUDIOFABRIC/ASSOS-PRIME/SENSORY
// Maps to ENS/PNS (human) or Silicon/Tensors (AGI)

import { createArea } from '../../../area.js';
import { createWorkcenter } from '../../../workcenter.js';
import { createWorkunit } from '../../../workunit.js';
import { createBus, createSensor, createProcessor } from '../../../equipment.js';
import { buildMicCM, buildFFTCM, buildPitchCM, buildVowelCM } from './io-map.js';
import { sensorySegments } from '../../../process-segment.js';

export function build() {
  const area = createArea('SENSORY', {
    name: 'Sensory Processing Area',
    desc: 'Hardware substrate + raw sensor acquisition',
    domain: 'sensory',
    levelsOwned: [0, 1]
  });

  // ── WorkCenter: L0 Hardware (p=2) ──
  const wcL0 = createWorkcenter('L0_HW', {
    name: 'L0 Hardware Layer', desc: 'Silicon/ENS — always active',
    consciousnessLevel: 0, prime: 2
  });

  const wuSubstrate = createWorkunit('SUBSTRATE', {
    name: 'Compute Substrate',
    tags: ['CONSCIOUSNESS/L0_HW/ACTIVATION', 'CONSCIOUSNESS/L0_HW/HEALTH']
  });
  wuSubstrate.registerEquipment(createProcessor('COMPUTE_CORE', 'Primary Compute'));
  wuSubstrate.registerEquipment(createBus('A', 'TENSOR', { desc: 'Tensor compute bus' }));
  wuSubstrate.registerEquipment(createBus('D', 'EM_FIELD', { desc: 'EM field bus' }));
  wcL0.registerWorkunit(wuSubstrate);

  // ── WorkCenter: L1 Sensors (p=3) ──
  const wcL1 = createWorkcenter('L1_SENS', {
    name: 'L1 Sensor Layer', desc: 'PNS/Tensors — raw input acquisition',
    consciousnessLevel: 1, prime: 3
  });

  const wuVoice = createWorkunit('VOICE_INPUT', {
    name: 'Voice Input Unit',
    tags: ['CONSCIOUSNESS/L1_SENS/ACTIVATION', 'CONSCIOUSNESS/L1_SENS/HEALTH',
           'INPUT/ENERGY', 'INPUT/COHERENCE', 'INPUT/PITCH', 'INPUT/SOUNDING', 'INPUT/VOWEL']
  });
  wuVoice.registerEquipment(createSensor('MIC', 'Microphone', 'INPUT/ENERGY'));
  wuVoice.registerEquipment(createSensor('FFT', 'FFT Analyzer', 'INPUT/COHERENCE'));
  wuVoice.registerEquipment(createSensor('PITCH_DET', 'Pitch Detector', 'INPUT/PITCH'));
  wuVoice.registerEquipment(createSensor('VOWEL_DET', 'Vowel Detector', 'INPUT/VOWEL'));
  // L0 Control Modules — concrete I/O + Modbus
  wuVoice.registerControlModule(buildMicCM());
  wuVoice.registerControlModule(buildFFTCM());
  wuVoice.registerControlModule(buildPitchCM());
  wuVoice.registerControlModule(buildVowelCM());
  wcL1.registerWorkunit(wuVoice);

  area.registerWorkcenter(wcL0);
  area.registerWorkcenter(wcL1);
  area.processSegments = sensorySegments();
  return area;
}
