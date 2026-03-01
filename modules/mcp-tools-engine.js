// ─── MCP Tools Engine ─── Virtual filesystem, tool definitions, repo management ───
// Provides MCP-style tool interface for in-browser LLM to manage files/repos

// ─── Virtual Filesystem ───
const fs = {
  files: new Map(),       // path → { content, created, modified, type }
  commits: [],            // { id, message, timestamp, snapshot }
  branch: 'main',
  commitCounter: 0
};

// ─── File Operations ───
export function createFile(path, content = '') {
  const type = guessType(path);
  fs.files.set(normPath(path), {
    content,
    created: Date.now(),
    modified: Date.now(),
    type
  });
  return { ok: true, path: normPath(path), type, size: content.length };
}

export function editFile(path, content) {
  const p = normPath(path);
  const file = fs.files.get(p);
  if (!file) return { ok: false, error: `File not found: ${p}` };
  file.content = content;
  file.modified = Date.now();
  return { ok: true, path: p, size: content.length };
}

export function patchFile(path, search, replace) {
  const p = normPath(path);
  const file = fs.files.get(p);
  if (!file) return { ok: false, error: `File not found: ${p}` };
  if (!file.content.includes(search)) return { ok: false, error: 'Search string not found in file' };
  file.content = file.content.replace(search, replace);
  file.modified = Date.now();
  return { ok: true, path: p, size: file.content.length };
}

export function readFile(path) {
  const p = normPath(path);
  const file = fs.files.get(p);
  if (!file) return { ok: false, error: `File not found: ${p}` };
  return { ok: true, path: p, content: file.content, type: file.type, size: file.content.length };
}

export function deleteFile(path) {
  const p = normPath(path);
  if (!fs.files.has(p)) return { ok: false, error: `File not found: ${p}` };
  fs.files.delete(p);
  return { ok: true, path: p };
}

export function listFiles(dirPath = '/') {
  const dir = normPath(dirPath);
  const entries = [];
  for (const [path, file] of fs.files) {
    if (dir === '/' || path.startsWith(dir + '/') || path === dir) {
      entries.push({
        path,
        type: file.type,
        size: file.content.length,
        modified: file.modified
      });
    }
  }
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return { ok: true, dir, files: entries, count: entries.length };
}

export function searchFiles(query, fileGlob = '*') {
  const results = [];
  const q = query.toLowerCase();
  for (const [path, file] of fs.files) {
    if (fileGlob !== '*' && !matchGlob(path, fileGlob)) continue;
    const lines = file.content.split('\n');
    lines.forEach((line, i) => {
      if (line.toLowerCase().includes(q)) {
        results.push({ path, line: i + 1, text: line.trim() });
      }
    });
  }
  return { ok: true, query, matches: results, count: results.length };
}

// ─── Repo / Git-like Operations ───
export function initRepo(name = 'untitled') {
  fs.files.clear();
  fs.commits = [];
  fs.branch = 'main';
  fs.commitCounter = 0;
  createFile('/README.md', `# ${name}\n\nCreated in WebLLM Sandbox.\n`);
  return commitChanges('Initial commit');
}

export function commitChanges(message) {
  const snapshot = {};
  for (const [path, file] of fs.files) {
    snapshot[path] = { content: file.content, type: file.type };
  }
  const id = (++fs.commitCounter).toString(16).padStart(6, '0');
  const commit = {
    id,
    message,
    timestamp: Date.now(),
    branch: fs.branch,
    fileCount: fs.files.size,
    snapshot
  };
  fs.commits.push(commit);
  return { ok: true, id, message, branch: fs.branch, fileCount: fs.files.size };
}

export function getLog(limit = 20) {
  const log = fs.commits.slice(-limit).reverse().map(c => ({
    id: c.id,
    message: c.message,
    branch: c.branch,
    fileCount: c.fileCount,
    time: new Date(c.timestamp).toLocaleTimeString()
  }));
  return { ok: true, branch: fs.branch, commits: log, total: fs.commits.length };
}

export function getDiff() {
  if (fs.commits.length === 0) return { ok: true, changes: [], summary: 'No commits yet' };
  const last = fs.commits[fs.commits.length - 1].snapshot;
  const changes = [];
  // New or modified files
  for (const [path, file] of fs.files) {
    if (!last[path]) {
      changes.push({ path, status: 'added' });
    } else if (last[path].content !== file.content) {
      changes.push({ path, status: 'modified' });
    }
  }
  // Deleted files
  for (const path of Object.keys(last)) {
    if (!fs.files.has(path)) changes.push({ path, status: 'deleted' });
  }
  return { ok: true, changes, summary: `${changes.length} file(s) changed` };
}

export function checkout(commitId) {
  const commit = fs.commits.find(c => c.id === commitId);
  if (!commit) return { ok: false, error: `Commit not found: ${commitId}` };
  fs.files.clear();
  for (const [path, data] of Object.entries(commit.snapshot)) {
    fs.files.set(path, {
      content: data.content,
      type: data.type,
      created: commit.timestamp,
      modified: commit.timestamp
    });
  }
  return { ok: true, id: commitId, message: commit.message, fileCount: fs.files.size };
}

// ─── HTML Preview ───
export function getPreviewHTML(path) {
  const p = normPath(path);
  const file = fs.files.get(p);
  if (!file) return { ok: false, error: `File not found: ${p}` };
  if (file.type !== 'html') return { ok: false, error: `Not an HTML file: ${p}` };
  return { ok: true, path: p, html: file.content };
}

export function getPreviewableFiles() {
  const htmlFiles = [];
  for (const [path, file] of fs.files) {
    if (file.type === 'html') htmlFiles.push(path);
  }
  return { ok: true, files: htmlFiles };
}

// ─── AudioFabric Project Registry ───
// Real HTML pages from the AudioFabric project that can be loaded in the preview iframe
export const PROJECT_PAGES = [
  { file: 'index.html',                 name: 'Audio Fabric Main',        cat: 'core',    desc: 'Vagal phoneme engine — the original' },
  { file: 'kamehameha.html',            name: 'Kamehameha',               cat: 'game',    desc: 'Voice-powered energy beam (single player)' },
  { file: 'kamehameha-duel.html',       name: 'Kamehameha Duel',          cat: 'game',    desc: 'P2P voice beam fighting with automatch' },
  { file: 'voice-duel.html',            name: 'Voice Duel',               cat: 'game',    desc: '1v1 voice combat with resonance layers' },
  { file: 'pvp-battle.html',            name: 'PvP Battle',               cat: 'game',    desc: 'Player vs player voice battle' },
  { file: 'ki-arena-ultra.html',        name: 'Ki Arena Ultra',           cat: 'arena',   desc: 'HD multiplayer ki arena' },
  { file: 'ki-arena-royale.html',       name: 'Ki Arena Royale',          cat: 'arena',   desc: 'Battle royale mode' },
  { file: 'ki-arena-plus-voice.html',   name: 'Ki Arena + Voice',         cat: 'arena',   desc: 'Arena with voice chat' },
  { file: 'ki-arena-plus-chat.html',    name: 'Ki Arena + Chat',          cat: 'arena',   desc: 'Arena with text chat' },
  { file: 'ki-arena-boss-colossus.html',name: 'Boss: Colossus',           cat: 'boss',    desc: 'Giant boss fight' },
  { file: 'ki-arena-boss-elemental.html',name:'Boss: Elemental',          cat: 'boss',    desc: 'Elemental boss fight' },
  { file: 'ki-arena-boss-rush.html',    name: 'Boss Rush',                cat: 'boss',    desc: 'Sequential boss rush mode' },
  { file: 'ki-arena-boss-void.html',    name: 'Boss: Void',               cat: 'boss',    desc: 'Void boss fight' },
  { file: 'ki-arena.html',              name: 'Ki Arena (Original)',       cat: 'arena',   desc: 'Original ki arena' },
  { file: 'ki-arena-v2.html',           name: 'Ki Arena v2',              cat: 'arena',   desc: 'Ki arena second version' },
  { file: 'ki-arena-v3.html',           name: 'Ki Arena v3',              cat: 'arena',   desc: 'Ki arena third version' },
  { file: 'ki-arena-plus.html',         name: 'Ki Arena Plus',            cat: 'arena',   desc: 'Enhanced ki arena' },
  { file: 'voice-room.html',            name: 'Voice Room',               cat: 'social',  desc: 'Multiplayer voice hang space' },
  { file: 'jam-session.html',           name: 'Jam Session',              cat: 'music',   desc: 'Collaborative music jamming' },
  { file: 'sing-self.html',             name: 'Sing Self',                cat: 'music',   desc: 'Solo singing visualization' },
  { file: 'sing-universe.html',         name: 'Sing Universe',            cat: 'music',   desc: 'Universal singing experience' },
  { file: 'audio-gen.html',             name: 'Audio Gen',                cat: 'music',   desc: 'Audio generation playground' },
  { file: 'zen-garden.html',            name: 'Zen Garden',               cat: 'relax',   desc: 'Meditative voice garden' },
  { file: 'web-llm-arena.html',         name: 'WebLLM Arena',             cat: 'ai',      desc: 'LLM-powered arena experience' },
  { file: 'web-llm-sandbox.html',       name: 'WebLLM Sandbox v1',        cat: 'ai',      desc: 'Voice-powered code builder (original)' },
  { file: 'web-llm-sandbox-v2.html',    name: 'WebLLM Sandbox v2',        cat: 'ai',      desc: 'Enhanced code builder with editor+terminal' },
  { file: 'risk-arena.html',            name: 'Risk Arena',               cat: 'game',    desc: 'Risk-style strategic arena' },
  { file: 'd2r-runeword-arena.html',    name: 'D2R Runeword Arena',       cat: 'game',    desc: 'Diablo 2 runeword voice game' },
  { file: 'periodic-table-arena.html',  name: 'Periodic Table Arena',     cat: 'game',    desc: 'Chemistry elements battle arena' },
  { file: 'gcp-shield.html',            name: 'GCP Shield',               cat: 'visual',  desc: 'Geometric shield visualization' },
  { file: 'thomas-shield.html',         name: 'Thomas Shield',            cat: 'visual',  desc: 'Shield visual effect' },
  { file: 'shield-127d.html',           name: 'Shield 127D',              cat: 'visual',  desc: '127-dimensional shield display' }
];

export function listProjectPages(category) {
  let pages = PROJECT_PAGES;
  if (category) pages = pages.filter(p => p.cat === category);
  return {
    ok: true,
    pages: pages.map(p => ({ file: p.file, name: p.name, category: p.cat, description: p.desc })),
    count: pages.length,
    categories: [...new Set(PROJECT_PAGES.map(p => p.cat))]
  };
}

export function loadProjectPage(filename) {
  const page = PROJECT_PAGES.find(p => p.file === filename || p.name.toLowerCase() === filename.toLowerCase());
  if (!page) return { ok: false, error: `Project page not found: ${filename}. Use list_project to see available pages.` };
  return { ok: true, file: page.file, name: page.name, url: './' + page.file, description: page.desc };
}

// ─── MCP Tool Definitions (for LLM system prompt) ───
export const TOOLS = [
  {
    name: 'create_file',
    description: 'Create a new file in the virtual repo. Use this to create HTML, CSS, JS, or any text file.',
    parameters: {
      path: { type: 'string', description: 'File path, e.g. /index.html or /src/app.js', required: true },
      content: { type: 'string', description: 'Full file content', required: true }
    }
  },
  {
    name: 'edit_file',
    description: 'Replace the entire content of an existing file.',
    parameters: {
      path: { type: 'string', description: 'File path to edit', required: true },
      content: { type: 'string', description: 'New file content (replaces existing)', required: true }
    }
  },
  {
    name: 'patch_file',
    description: 'Find and replace a specific string in a file. Use for targeted edits.',
    parameters: {
      path: { type: 'string', description: 'File path', required: true },
      search: { type: 'string', description: 'Exact string to find', required: true },
      replace: { type: 'string', description: 'Replacement string', required: true }
    }
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file.',
    parameters: {
      path: { type: 'string', description: 'File path to read', required: true }
    }
  },
  {
    name: 'delete_file',
    description: 'Delete a file from the repo.',
    parameters: {
      path: { type: 'string', description: 'File path to delete', required: true }
    }
  },
  {
    name: 'list_files',
    description: 'List all files in the repo or a specific directory.',
    parameters: {
      path: { type: 'string', description: 'Directory path (default: /)', required: false }
    }
  },
  {
    name: 'search_files',
    description: 'Search for text across all files.',
    parameters: {
      query: { type: 'string', description: 'Search text', required: true },
      glob: { type: 'string', description: 'File pattern filter, e.g. *.html', required: false }
    }
  },
  {
    name: 'commit',
    description: 'Save a snapshot of the current repo state with a message.',
    parameters: {
      message: { type: 'string', description: 'Commit message', required: true }
    }
  },
  {
    name: 'log',
    description: 'Show commit history.',
    parameters: {}
  },
  {
    name: 'diff',
    description: 'Show changes since last commit.',
    parameters: {}
  },
  {
    name: 'preview',
    description: 'Open/refresh an HTML file in the preview iframe.',
    parameters: {
      path: { type: 'string', description: 'Path to HTML file to preview', required: true }
    }
  },
  {
    name: 'list_project',
    description: 'List all AudioFabric project pages (real HTML apps) that can be loaded in the preview. Optionally filter by category: game, arena, boss, music, social, ai, visual, relax, core.',
    parameters: {
      category: { type: 'string', description: 'Filter by category (optional)', required: false }
    }
  },
  {
    name: 'load_page',
    description: 'Load a real AudioFabric project page into the preview iframe by filename. This loads the actual app (e.g. kamehameha.html, voice-duel.html, zen-garden.html).',
    parameters: {
      file: { type: 'string', description: 'Filename of the project page, e.g. kamehameha.html', required: true }
    }
  },
  {
    name: 'load_url',
    description: 'Load any URL into the preview iframe. Can be a relative path to a local file or an external URL.',
    parameters: {
      url: { type: 'string', description: 'URL or relative path to load', required: true }
    }
  },
  {
    name: 'fetch_page',
    description: 'Fetch the source code of a real AudioFabric project page so you can read, learn from, or remix it.',
    parameters: {
      file: { type: 'string', description: 'Filename to fetch source of, e.g. kamehameha.html', required: true }
    }
  }
];

// ─── Tool Execution Router ───
export function executeTool(name, args = {}) {
  switch (name) {
    case 'create_file': return createFile(args.path, args.content || '');
    case 'edit_file':   return editFile(args.path, args.content);
    case 'patch_file':  return patchFile(args.path, args.search, args.replace);
    case 'read_file':   return readFile(args.path);
    case 'delete_file': return deleteFile(args.path);
    case 'list_files':  return listFiles(args.path || '/');
    case 'search_files':return searchFiles(args.query, args.glob || '*');
    case 'commit':      return commitChanges(args.message);
    case 'log':         return getLog(args.limit);
    case 'diff':        return getDiff();
    case 'preview':     return getPreviewHTML(args.path);
    case 'list_project':return listProjectPages(args.category);
    case 'load_page':   return loadProjectPage(args.file);
    case 'load_url':    return { ok: true, url: args.url, action: 'load_url' };
    case 'fetch_page':  return loadProjectPage(args.file); // caller handles actual fetch
    default: return { ok: false, error: `Unknown tool: ${name}` };
  }
}

// ─── Parse Tool Calls from LLM Output ───
// Robust parser that handles many messy formats from small local models
const TOOL_NAMES = ['create_file','edit_file','patch_file','read_file','delete_file','list_files','search_files','commit','log','diff','preview','list_project','load_page','load_url','fetch_page'];

export function parseToolCalls(text) {
  const calls = [];
  let m;

  // ═══ PRIMARY: ```create /path\ncontent\n``` format (what we teach in system prompt)
  const createRe = /```\s*create\s+(\/[\w\-\.\/]+)\s*\n([\s\S]*?)```/gi;
  while ((m = createRe.exec(text)) !== null) {
    calls.push({ name: 'create_file', args: { path: m[1].trim(), content: m[2].trimEnd() } });
  }
  const editRe = /```\s*edit\s+(\/[\w\-\.\/]+)\s*\n([\s\S]*?)```/gi;
  while ((m = editRe.exec(text)) !== null) {
    calls.push({ name: 'edit_file', args: { path: m[1].trim(), content: m[2].trimEnd() } });
  }
  const deleteRe = /```\s*delete\s+(\/[\w\-\.\/]+)\s*```/gi;
  while ((m = deleteRe.exec(text)) !== null) {
    calls.push({ name: 'delete_file', args: { path: m[1].trim() } });
  }
  const commitRe = /```\s*commit\s+([\s\S]*?)```/gi;
  while ((m = commitRe.exec(text)) !== null) {
    calls.push({ name: 'commit', args: { message: m[1].trim() } });
  }
  const listRe = /```\s*list\s*```/gi;
  while (listRe.exec(text) !== null) {
    calls.push({ name: 'list_files', args: { path: '/' } });
  }
  // ```load kamehameha.html``` or ```open kamehameha.html```
  const loadRe = /```\s*(?:load|open)\s+([\w\-\.\/]+\.html?)\s*```/gi;
  while ((m = loadRe.exec(text)) !== null) {
    calls.push({ name: 'load_page', args: { file: m[1].trim() } });
  }
  // ```fetch kamehameha.html```
  const fetchRe = /```\s*fetch\s+([\w\-\.\/]+\.html?)\s*```/gi;
  while ((m = fetchRe.exec(text)) !== null) {
    calls.push({ name: 'fetch_page', args: { file: m[1].trim() } });
  }
  // ```browse``` or ```browse game```
  const browseRe = /```\s*(?:browse|project)\s*(\w*)\s*```/gi;
  while ((m = browseRe.exec(text)) !== null) {
    calls.push({ name: 'list_project', args: { category: m[1].trim() || undefined } });
  }
  // ```url https://...```
  const urlRe = /```\s*url\s+(https?:\/\/[^\s`]+)\s*```/gi;
  while ((m = urlRe.exec(text)) !== null) {
    calls.push({ name: 'load_url', args: { url: m[1].trim() } });
  }
  if (calls.length > 0) return calls;

  // ═══ FALLBACK 1: <tool_call>JSON</tool_call>
  const tagRe = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  while ((m = tagRe.exec(text)) !== null) {
    try { calls.push(JSON.parse(m[1].trim())); } catch(e) {}
  }
  if (calls.length > 0) return calls;

  // ═══ FALLBACK 2: ```json\n{...}\n``` or ```tool\n{...}\n```
  const jsonFenceRe = /```(?:tool|json)?\s*\n([\s\S]*?)\n```/g;
  while ((m = jsonFenceRe.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (parsed.name) calls.push(parsed);
    } catch(e) {}
  }
  if (calls.length > 0) return calls;

  // Pattern 3: {"name":"tool_name",...} on a line
  const jsonLineRe = /\{[^{}]*"name"\s*:\s*"(\w+)"[^{}]*\}/g;
  while ((m = jsonLineRe.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(m[0]);
      if (parsed.name && TOOL_NAMES.includes(parsed.name)) calls.push(parsed);
    } catch(e) {}
  }
  if (calls.length > 0) return calls;

  // Pattern 4: Fuzzy XML — <path>...</path> <content>...</content> near a tool name
  // This is what small models commonly produce
  for (const toolName of TOOL_NAMES) {
    if (!text.includes(toolName)) continue;

    // Find any <path> or path= or path: values
    const pathMatch = text.match(/<path>\s*([\s\S]*?)\s*<\/path>/i)
      || text.match(/path\s*[:=]\s*["']([^"']+)["']/i)
      || text.match(/path\s*[:=]\s*(\S+\.(?:html|js|css|json|md|txt|py|ts))/i)
      || text.match(/["'](\/[^\s"']+\.(?:html|js|css|json|md|txt|py|ts))["']/);

    if (toolName === 'create_file' || toolName === 'edit_file') {
      // Extract content from <content>...</content> or content= or code fences
      const contentMatch = text.match(/<content>([\s\S]*?)<\/content>/i)
        || text.match(/content\s*[:=]\s*"([\s\S]*?)(?:"\s*$|"\s*\n)/im);

      // Also try to grab everything between code fences as content
      const fenceContent = text.match(/```(?:html|css|js|javascript)?\s*\n([\s\S]*?)\n```/);

      const path = pathMatch ? pathMatch[1].trim() : null;
      const content = contentMatch ? contentMatch[1]
        : fenceContent ? fenceContent[1]
        : null;

      if (path && content !== null) {
        calls.push({ name: toolName, args: { path, content } });
      } else if (path) {
        calls.push({ name: toolName, args: { path, content: '' } });
      }
    } else if (toolName === 'delete_file' || toolName === 'read_file' || toolName === 'preview') {
      const path = pathMatch ? pathMatch[1].trim() : null;
      if (path) calls.push({ name: toolName, args: { path } });
    } else if (toolName === 'commit') {
      const msgMatch = text.match(/message\s*[:=]\s*["']([^"']+)["']/i)
        || text.match(/<message>([\s\S]*?)<\/message>/i)
        || text.match(/commit\s*[:=]\s*["']([^"']+)["']/i);
      const message = msgMatch ? msgMatch[1] : 'Auto-commit';
      calls.push({ name: 'commit', args: { message } });
    } else if (toolName === 'list_files') {
      const path = pathMatch ? pathMatch[1].trim() : '/';
      calls.push({ name: 'list_files', args: { path } });
    } else if (toolName === 'search_files') {
      const queryMatch = text.match(/query\s*[:=]\s*["']([^"']+)["']/i)
        || text.match(/<query>([\s\S]*?)<\/query>/i);
      if (queryMatch) calls.push({ name: 'search_files', args: { query: queryMatch[1] } });
    } else if (toolName === 'log' || toolName === 'diff') {
      calls.push({ name: toolName, args: {} });
    }
    if (calls.length > 0) break; // take first matched tool
  }
  if (calls.length > 0) return calls;

  // Pattern 5: Model just writes ```html\n...\n``` with a file path mentioned nearby
  const htmlFenceRe = /```(?:html|htm)\s*\n([\s\S]*?)\n```/g;
  while ((m = htmlFenceRe.exec(text)) !== null) {
    // Look for a filename near the fence
    const before = text.slice(Math.max(0, m.index - 200), m.index);
    const pathHint = before.match(/["'`](\/?\w[\w\-\.\/]*\.html)["'`]/i)
      || before.match(/(\/?\w[\w\-\.\/]*\.html)/i);
    const path = pathHint ? pathHint[1] : '/index.html';
    calls.push({ name: 'create_file', args: { path: path.startsWith('/') ? path : '/' + path, content: m[1] } });
  }
  if (calls.length > 0) return calls;

  // Pattern 6: Last resort — "create/make FILE" + any code fence
  const anyPath = text.match(/(?:create|make|write|save|here'?s?)\s+(?:a\s+)?(?:new\s+)?(?:file\s+)?(?:called\s+|named\s+)?["'`]?(\/?[\w\-\.\/]+\.(?:html|js|css|json|md|txt))["'`]?/i);
  const anyFence = text.match(/```\w*\s*\n([\s\S]*?)\n```/);
  if (anyPath && anyFence) {
    const p = anyPath[1].startsWith('/') ? anyPath[1] : '/' + anyPath[1];
    calls.push({ name: 'create_file', args: { path: p, content: anyFence[1] } });
  }

  return calls;
}

// ─── Build System Prompt Describing Available Tools ───
export function buildToolSystemPrompt() {
  return `You are a code assistant in a browser sandbox. You create and edit files using code blocks.

TO CREATE A FILE, write a code block with the filename on the first line:

\`\`\`create /hello.html
<!DOCTYPE html>
<html>
<head><title>Hello</title></head>
<body><h1>Hello World</h1></body>
</html>
\`\`\`

TO EDIT A FILE, write a code block with "edit" and the filename:

\`\`\`edit /hello.html
<!DOCTYPE html>
<html>
<head><title>Updated</title></head>
<body><h1>Updated Page</h1></body>
</html>
\`\`\`

TO DELETE: \`\`\`delete /file.txt\`\`\`
TO COMMIT: \`\`\`commit Added hello page\`\`\`
TO LIST FILES: \`\`\`list\`\`\`

TO LOAD AN AUDIOFABRIC PAGE into the preview iframe: \`\`\`load kamehameha.html\`\`\`
TO BROWSE ALL PROJECT PAGES: \`\`\`browse\`\`\` or \`\`\`browse game\`\`\` (filter by category)
TO FETCH SOURCE CODE of a project page: \`\`\`fetch voice-duel.html\`\`\`
TO LOAD ANY URL: \`\`\`url https://example.com\`\`\`

AVAILABLE PROJECT CATEGORIES: game, arena, boss, music, social, ai, visual, relax, core
NOTABLE PAGES: kamehameha.html (voice beam), kamehameha-duel.html (P2P fight), voice-duel.html (1v1),
  ki-arena-ultra.html (multiplayer arena), zen-garden.html (meditative), jam-session.html (music),
  web-llm-arena.html (AI arena), sing-universe.html (singing)

RULES:
1. ALWAYS use code blocks to create files — never just describe what you would do
2. Write COMPLETE HTML files with inline CSS and JS
3. Be creative and make visually impressive things
4. When asked to build something, START IMMEDIATELY with a code block
5. Keep explanations short — let the code speak
6. You can create multiple files in one response
7. You can load existing AudioFabric project pages into the preview to demo them
8. You can fetch source code of any project page to learn from or remix it

EXAMPLE - if user says "make a red button page":

Sure! Here's a page with a red button:

\`\`\`create /button.html
<!DOCTYPE html>
<html>
<head><style>body{display:flex;justify-content:center;align-items:center;height:100vh;background:#111}button{background:red;color:white;padding:20px 40px;border:none;border-radius:8px;font-size:24px;cursor:pointer}button:hover{background:#ff4444}</style></head>
<body><button onclick="alert('Clicked!')">Click Me</button></body>
</html>
\`\`\`
`;
}

// ─── Get State Summary ───
export function getRepoState() {
  return {
    branch: fs.branch,
    fileCount: fs.files.size,
    commitCount: fs.commits.length,
    files: [...fs.files.keys()],
    lastCommit: fs.commits.length > 0 ? fs.commits[fs.commits.length - 1] : null
  };
}

export function getAllFiles() { return fs.files; }

// ─── Helpers ───
function normPath(p) {
  let n = p.replace(/\\/g, '/').replace(/\/+/g, '/');
  if (!n.startsWith('/')) n = '/' + n;
  if (n.length > 1 && n.endsWith('/')) n = n.slice(0, -1);
  return n;
}

function guessType(path) {
  const ext = path.split('.').pop().toLowerCase();
  const map = {
    html: 'html', htm: 'html', css: 'css', js: 'javascript', mjs: 'javascript',
    json: 'json', md: 'markdown', txt: 'text', svg: 'svg', xml: 'xml',
    py: 'python', ts: 'typescript', jsx: 'javascript', tsx: 'typescript'
  };
  return map[ext] || 'text';
}

function matchGlob(path, pattern) {
  const re = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
  return re.test(path) || re.test(path.split('/').pop());
}
