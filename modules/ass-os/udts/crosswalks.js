// ass-os/udts/crosswalks.js — δ maps between standards

import { registry } from './registry.js';

export function defineCrosswalks() {
  registry.defineCrosswalk({ from_std: 'ISA-95', from_entity: 'Equipment', to_std: 'ISA-88', to_entity: 'Unit', mapping: 'partial', transform: 'ISA95.WorkUnit≈ISA88.Unit' });
  registry.defineCrosswalk({ from_std: 'ISA-95', from_entity: 'ProcessSegment', to_std: 'ISA-88', to_entity: 'Operation', mapping: 'partial', transform: 'ISA95.ProcessSegment≈ISA88.Operation' });
  registry.defineCrosswalk({ from_std: 'ISA-88', from_entity: 'PackML_State', to_std: 'ASS-OS', to_entity: 'ConsciousnessLevel', mapping: 'semantic', transform: 'PackML.EXECUTE≈ASSOS.PRODUCING' });
  registry.defineCrosswalk({ from_std: 'ISA-18.2', from_entity: 'Alarm', to_std: 'ASS-OS', to_entity: 'FaultModel', mapping: 'semantic', transform: 'ISA18.Alarm→ASSOS.Fault(trigger)' });
  registry.defineCrosswalk({ from_std: 'ISA-101', from_entity: 'Faceplate', to_std: 'ASS-OS', to_entity: 'ConsciousnessLevel', mapping: 'semantic', transform: 'ISA101.L1-L5≈ASSOS.HMI_depth' });
}
