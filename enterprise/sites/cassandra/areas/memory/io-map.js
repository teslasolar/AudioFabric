// MEMORY I/O Map — Storage array + cache blade control modules
// Context window management, persistent storage, RAG retrieval

import { createControlModule } from '../../../../controlmodule.js';

export function buildMemoryCMs() {
  const contextCM = createControlModule('CM_CONTEXT', {
    name: 'Context Window Control',
    AI: [
      { id: 'CTX_SIZE', name: 'Context Size', tagPath: 'CASS/MEM/CONTEXT_SIZE', range: [0, 128000], engUnit: 'tokens' },
      { id: 'CTX_TOK', name: 'Active Tokens', tagPath: 'CASS/MEM/CONTEXT_TOKENS', range: [0, 128000], engUnit: 'tokens' },
      { id: 'CACHE_HIT', name: 'Cache Hit Rate', tagPath: 'CASS/MEM/CACHE_HIT_RATE', range: [0, 1], engUnit: 'ratio' },
    ],
    AO: [
      { id: 'EVICT', name: 'Eviction Threshold', tagPath: 'CASS/MEM/EVICT_THRESH', range: [0, 1], engUnit: 'ratio' },
    ],
    modbus: [
      { register: 52001, type: 'INT32', desc: 'Context size' },
      { register: 52003, type: 'FLOAT32', desc: 'Cache hit rate' },
    ],
    capability: ['cache', 'evict', 'summarize'],
  });

  const storageCM = createControlModule('CM_STORAGE', {
    name: 'Persistent Storage Control',
    AI: [
      { id: 'TOT_CONVS', name: 'Total Conversations', tagPath: 'CASS/MEM/TOTAL_CONVS', range: [0, 999999], engUnit: 'count' },
      { id: 'DISK_USE', name: 'Disk Usage', tagPath: 'CASS/MEM/DISK_USE', range: [0, 100], engUnit: '%' },
    ],
    DI: [
      { id: 'WRITE_BUSY', name: 'Write Busy', tagPath: 'CASS/MEM/WRITE_BUSY' },
    ],
    modbus: [
      { register: 52005, type: 'INT32', desc: 'Total conversations' },
      { register: 52007, type: 'FLOAT32', desc: 'Disk usage %' },
    ],
    capability: ['persist', 'index', 'compact'],
  });

  const ragCM = createControlModule('CM_RAG', {
    name: 'RAG Retrieval Control',
    AI: [
      { id: 'KB_ENT', name: 'KB Entries', tagPath: 'CASS/MEM/KB_ENTRIES', range: [0, 999999], engUnit: 'count' },
      { id: 'SIM_SCORE', name: 'Similarity Score', tagPath: 'CASS/MEM/SIM_SCORE', range: [0, 1], engUnit: 'cosine' },
    ],
    AO: [
      { id: 'TOP_K', name: 'Top-K Setting', tagPath: 'CASS/MEM/TOP_K', range: [1, 50], engUnit: 'count' },
    ],
    modbus: [
      { register: 52009, type: 'INT32', desc: 'KB entry count' },
      { register: 52011, type: 'FLOAT32', desc: 'Similarity score' },
    ],
    capability: ['embed', 'retrieve', 'rank'],
  });

  return { contextCM, storageCM, ragCM };
}
