// AREA: Memory — Conversation History + Knowledge Store
// ISA-95 path: AUDIOFABRIC/CASSANDRA/MEMORY
// Server Rack: NVMe Storage Array + Redis Cache Blades
// The file cabinets — everything she remembers

import { createArea } from '../../../../area.js';
import { createWorkcenter } from '../../../../workcenter.js';
import { createWorkunit } from '../../../../workunit.js';
import { createProcessor } from '../../../../equipment.js';
import { buildMemoryCMs } from './io-map.js';

export function build() {
  const area = createArea('MEMORY', {
    name: 'Memory Storage Rack',
    desc: 'Conversation history, knowledge base, context window — NVMe + Redis blades',
    domain: 'memory',
    levelsOwned: []
  });

  // ── WorkCenter: Short-Term Memory (Redis) ──
  const wcSTM = createWorkcenter('STM_CACHE', {
    name: 'Short-Term Memory Cache', desc: 'Active conversation context — Redis blade',
    consciousnessLevel: -1, prime: 0
  });

  const wuContext = createWorkunit('CONTEXT_WINDOW', {
    name: 'Context Window Manager',
    tags: ['CASS/MEM/CONTEXT_SIZE', 'CASS/MEM/CONTEXT_TOKENS', 'CASS/MEM/TURN_COUNT',
           'CASS/MEM/CACHE_HIT_RATE']
  });
  wuContext.registerEquipment(createProcessor('CTX_MGR', 'Context Window Manager'));
  wuContext.registerEquipment(createProcessor('REDIS_0', 'Redis Cache Blade 0'));
  const cms = buildMemoryCMs();
  wuContext.registerControlModule(cms.contextCM);
  wcSTM.registerWorkunit(wuContext);

  // ── WorkCenter: Long-Term Memory (NVMe) ──
  const wcLTM = createWorkcenter('LTM_STORE', {
    name: 'Long-Term Memory Store', desc: 'Persistent knowledge + history — NVMe array',
    consciousnessLevel: -1, prime: 0
  });

  const wuHistory = createWorkunit('CONV_HISTORY', {
    name: 'Conversation History Store',
    tags: ['CASS/MEM/TOTAL_CONVS', 'CASS/MEM/TOTAL_TOKENS', 'CASS/MEM/DISK_USE']
  });
  wuHistory.registerEquipment(createProcessor('NVME_0', 'NVMe Blade 0 — History'));
  wuHistory.registerEquipment(createProcessor('NVME_1', 'NVMe Blade 1 — Knowledge'));
  wuHistory.registerEquipment(createProcessor('EMBEDDER', 'Embedding Engine'));
  wuHistory.registerControlModule(cms.storageCM);
  wcLTM.registerWorkunit(wuHistory);

  const wuKnowledge = createWorkunit('KNOWLEDGE_BASE', {
    name: 'Knowledge Base',
    tags: ['CASS/MEM/KB_ENTRIES', 'CASS/MEM/KB_DOMAINS', 'CASS/MEM/VECTOR_DIM']
  });
  wuKnowledge.registerEquipment(createProcessor('VECTOR_DB', 'Vector Database'));
  wuKnowledge.registerEquipment(createProcessor('RAG_ENGINE', 'RAG Retrieval Engine'));
  wuKnowledge.registerControlModule(cms.ragCM);
  wcLTM.registerWorkunit(wuKnowledge);

  area.registerWorkcenter(wcSTM);
  area.registerWorkcenter(wcLTM);
  return area;
}
