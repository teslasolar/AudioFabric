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
    default: return { ok: false, error: `Unknown tool: ${name}` };
  }
}

// ─── Parse Tool Calls from LLM Output ───
// Expects format: <tool_call>{"name":"...","args":{...}}</tool_call>
export function parseToolCalls(text) {
  const calls = [];
  // Pattern 1: <tool_call>JSON</tool_call>
  const tagRe = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  let m;
  while ((m = tagRe.exec(text)) !== null) {
    try { calls.push(JSON.parse(m[1].trim())); } catch(e) { /* skip malformed */ }
  }
  // Pattern 2: ```tool\nJSON\n```
  const fenceRe = /```tool\s*\n([\s\S]*?)\n```/g;
  while ((m = fenceRe.exec(text)) !== null) {
    try { calls.push(JSON.parse(m[1].trim())); } catch(e) {}
  }
  // Pattern 3: {"name":"tool_name","args":{}} on its own line
  if (calls.length === 0) {
    const lineRe = /^\s*\{"name"\s*:\s*"(\w+)"\s*,\s*"args"\s*:\s*(\{[\s\S]*?\})\s*\}\s*$/gm;
    while ((m = lineRe.exec(text)) !== null) {
      try { calls.push({ name: m[1], args: JSON.parse(m[2]) }); } catch(e) {}
    }
  }
  return calls;
}

// ─── Build System Prompt Describing Available Tools ───
export function buildToolSystemPrompt() {
  let prompt = `You are a code assistant working in a virtual repository sandbox. You can create, edit, and manage files using tools.

AVAILABLE TOOLS:
When you want to use a tool, output it in this format:
<tool_call>{"name": "tool_name", "args": {"param": "value"}}</tool_call>

You can use multiple tool calls in one response. After each tool call, you will receive the result before continuing.

Tools:\n`;
  for (const tool of TOOLS) {
    prompt += `\n- ${tool.name}: ${tool.description}\n`;
    if (tool.parameters && Object.keys(tool.parameters).length > 0) {
      prompt += `  Parameters:\n`;
      for (const [k, v] of Object.entries(tool.parameters)) {
        prompt += `    - ${k} (${v.type}${v.required ? ', required' : ', optional'}): ${v.description}\n`;
      }
    }
  }
  prompt += `\nIMPORTANT RULES:
1. Always use tool calls to modify files — never just describe what to do
2. Create complete, working HTML files with inline CSS and JS
3. After creating/editing an HTML file, use the preview tool to show it
4. Use commit after meaningful changes
5. Be creative and make visually impressive things
6. When the user asks you to build something, START BUILDING immediately with tool calls
7. You can create multiple files and preview them in iframes
8. Keep responses concise — let the code speak for itself\n`;
  return prompt;
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
