// AREA: Reasoning — 12-Recursion Thought Engine
// ISA-95 path: AUDIOFABRIC/CASSANDRA/REASONING
// Server Rack: GPU Compute Blades (the big iron)
// Maps to body orbs: CORE (L2 gate), L-CHEST (L4 exec), HEAD (L5 self)

import { createArea } from '../../../../area.js';
import { createWorkcenter } from '../../../../workcenter.js';
import { createWorkunit } from '../../../../workunit.js';
import { createProcessor } from '../../../../equipment.js';
import { buildReasoningCMs } from './io-map.js';

export function build() {
  const area = createArea('REASONING', {
    name: 'Reasoning Compute Rack',
    desc: '12-recursion thought engine — 4U GPU blades, the heavy iron',
    domain: 'reasoning',
    levelsOwned: [2, 3, 4, 5, 6]
  });

  // ── WorkCenter: R2-R3 Gating + Affect (p=5) — 2U blade ──
  const wcGate = createWorkcenter('R2_R3_GATE', {
    name: 'R2-R3 Gate/Affect Blade', desc: 'Coherence gating + emotional valence scoring',
    consciousnessLevel: 2, prime: 5
  });

  const wuGate = createWorkunit('THOUGHT_GATE', {
    name: 'Thought Gate Unit',
    tags: ['CASS/REASON/GATE_SIGNAL', 'CASS/REASON/VALENCE', 'CASS/REASON/AROUSAL']
  });
  wuGate.registerEquipment(createProcessor('GATE_PROC', 'Coherence Gate Processor'));
  wuGate.registerEquipment(createProcessor('VALENCE_PROC', 'Valence Encoder'));
  const cms = buildReasoningCMs();
  wuGate.registerControlModule(cms.gateCM);
  wcGate.registerWorkunit(wuGate);

  // ── WorkCenter: R4 Executive (p=31) — 4U GPU blade ──
  const wcExec = createWorkcenter('R4_EXEC', {
    name: 'R4 Executive GPU Blade', desc: 'LLM inference — main reasoning engine',
    consciousnessLevel: 4, prime: 31
  });

  const wuInference = createWorkunit('LLM_INFERENCE', {
    name: 'LLM Inference Engine',
    tags: ['CASS/REASON/RECURSION_DEPTH', 'CASS/REASON/TOKENS_GEN', 'CASS/REASON/TEMPERATURE',
           'CASS/REASON/THOUGHT_CHAIN', 'CASS/REASON/FINAL_RESPONSE']
  });
  wuInference.registerEquipment(createProcessor('GPU_0', 'GPU Blade 0 — Primary Inference'));
  wuInference.registerEquipment(createProcessor('GPU_1', 'GPU Blade 1 — Recursion Parallel'));
  wuInference.registerEquipment(createProcessor('KV_CACHE', 'KV Cache Manager'));
  wuInference.registerControlModule(cms.llmCM);
  wcExec.registerWorkunit(wuInference);

  // ── WorkCenter: R5-R6 Self/Observer (p=127) — 1U blade ──
  const wcSelf = createWorkcenter('R5_R6_SELF', {
    name: 'R5-R6 Self/Observer Blade', desc: 'Identity verification + observer meta-check',
    consciousnessLevel: 5, prime: 127
  });

  const wuSelf = createWorkunit('SELF_CHECK', {
    name: 'Self-Model Verifier',
    tags: ['CASS/REASON/COHERENCE', 'CASS/REASON/IDENTITY_LOCK', 'CASS/REASON/OBSERVER_PASS']
  });
  wuSelf.registerEquipment(createProcessor('IDENTITY_CORE', 'Identity Verifier'));
  wuSelf.registerEquipment(createProcessor('OBSERVER', 'Observer Meta-Check'));
  wuSelf.registerControlModule(cms.selfCM);
  wcSelf.registerWorkunit(wuSelf);

  area.registerWorkcenter(wcGate);
  area.registerWorkcenter(wcExec);
  area.registerWorkcenter(wcSelf);
  return area;
}
