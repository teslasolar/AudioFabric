// sandbox-terminal.js — Simulated terminal with JS eval, sandbox commands, and output capture
// Runs in-browser: ls, cat, echo, clear, help, eval JS, run HTML in iframe, etc.
// Feeds into the MCP tools engine virtual filesystem.

import { listFiles, readFile, createFile, deleteFile, searchFiles, commitChanges,
         getLog, getDiff, getRepoState } from './mcp-tools-engine.js';

let container = null;
let outputEl = null;
let inputEl = null;
let history = [];
let historyIdx = -1;
let cwd = '/';
let onCommand = null;  // callback for external command hooks

const MOTD = [
  '┌─────────────────────────────────────────┐',
  '│  WebLLM Sandbox Terminal v2             │',
  '│  Type "help" for available commands     │',
  '└─────────────────────────────────────────┘'
];

// ===== COMMANDS =====
const COMMANDS = {
  help: {
    desc: 'Show available commands',
    run: () => [
      'COMMANDS:',
      '  help              Show this help',
      '  ls [dir]          List files',
      '  cat <file>        Show file contents',
      '  touch <file>      Create empty file',
      '  rm <file>         Delete file',
      '  echo <text>       Print text',
      '  grep <text>       Search across all files',
      '  status            Show repo status',
      '  log               Show commit history',
      '  diff              Show changes since last commit',
      '  commit <msg>      Commit all changes',
      '  eval <js>         Execute JavaScript',
      '  run <file.html>   Open HTML in preview',
      '  open <page>       Load AudioFabric page in preview',
      '  load <page>       Same as open',
      '  browse [cat]      List project pages (game/arena/music/...)',
      '  fetch <page>      Fetch source into editor',
      '  clear             Clear terminal',
      '  pwd               Print working directory',
      '  cd <dir>          Change directory',
      '  tree              Show file tree',
      '  wc <file>         Word/line count',
      '  head <file> [n]   Show first N lines',
      '  tail <file> [n]   Show last N lines',
      '  date              Show current date/time',
      '  whoami            Show current user'
    ]
  },

  ls: {
    desc: 'List files',
    run: (args) => {
      const dir = args[0] || cwd;
      const result = listFiles(dir);
      if (!result.ok) return ['Error: ' + result.error];
      if (result.files.length === 0) return ['(empty)'];
      return result.files.map(f => {
        const name = f.path.split('/').pop();
        const sizeStr = f.size < 1024 ? f.size + 'B' : (f.size / 1024).toFixed(1) + 'K';
        const typeIcon = f.type === 'html' ? '◇' : f.type === 'css' ? '◆' :
          f.type === 'javascript' ? '◊' : '▫';
        return `  ${typeIcon} ${name.padEnd(24)} ${sizeStr.padStart(8)}  ${f.type}`;
      });
    }
  },

  cat: {
    desc: 'Show file contents',
    run: (args) => {
      if (!args[0]) return ['Usage: cat <file>'];
      const path = resolvePath(args[0]);
      const result = readFile(path);
      if (!result.ok) return ['Error: ' + result.error];
      return result.content.split('\n');
    }
  },

  touch: {
    desc: 'Create empty file',
    run: (args) => {
      if (!args[0]) return ['Usage: touch <file>'];
      const path = resolvePath(args[0]);
      const result = createFile(path, '');
      return [result.ok ? `Created ${path}` : 'Error: ' + result.error];
    }
  },

  rm: {
    desc: 'Delete file',
    run: (args) => {
      if (!args[0]) return ['Usage: rm <file>'];
      const path = resolvePath(args[0]);
      const result = deleteFile(path);
      return [result.ok ? `Deleted ${path}` : 'Error: ' + result.error];
    }
  },

  echo: {
    desc: 'Print text',
    run: (args) => [args.join(' ')]
  },

  grep: {
    desc: 'Search files',
    run: (args) => {
      if (!args[0]) return ['Usage: grep <text> [glob]'];
      const result = searchFiles(args[0], args[1] || '*');
      if (!result.ok) return ['Error: ' + result.error];
      if (result.count === 0) return ['No matches found'];
      return result.matches.slice(0, 30).map(m =>
        `  ${m.path}:${m.line}: ${m.text.slice(0, 80)}`
      ).concat(result.count > 30 ? [`  ... and ${result.count - 30} more`] : []);
    }
  },

  status: {
    desc: 'Show repo status',
    run: () => {
      const state = getRepoState();
      const diff = getDiff();
      return [
        `Branch: ${state.branch}`,
        `Files:  ${state.fileCount}`,
        `Commits: ${state.commitCount}`,
        diff.changes.length > 0
          ? 'Changes: ' + diff.changes.map(c => `${c.status} ${c.path}`).join(', ')
          : 'Working tree clean'
      ];
    }
  },

  log: {
    desc: 'Show commit history',
    run: () => {
      const result = getLog(15);
      if (result.commits.length === 0) return ['No commits yet'];
      return result.commits.map(c => `  ${c.id} ${c.message} (${c.time})`);
    }
  },

  diff: {
    desc: 'Show changes',
    run: () => {
      const result = getDiff();
      if (result.changes.length === 0) return ['No changes since last commit'];
      return result.changes.map(c => `  ${c.status.padEnd(10)} ${c.path}`);
    }
  },

  commit: {
    desc: 'Commit changes',
    run: (args) => {
      const msg = args.join(' ') || 'Update';
      const result = commitChanges(msg);
      return [result.ok ? `Committed: ${result.id} — ${msg}` : 'Error: ' + result.error];
    }
  },

  eval: {
    desc: 'Execute JavaScript',
    run: (args) => {
      const code = args.join(' ');
      if (!code) return ['Usage: eval <javascript>'];
      try {
        const result = Function('"use strict"; return (' + code + ')')();
        return [String(result)];
      } catch (e) {
        return ['Error: ' + e.message];
      }
    }
  },

  run: {
    desc: 'Open HTML file in preview',
    run: (args) => {
      if (!args[0]) return ['Usage: run <file.html>'];
      if (onCommand) onCommand('run', args[0]);
      return [`Opening ${args[0]} in preview...`];
    }
  },

  open: {
    desc: 'Load an AudioFabric project page in preview',
    run: (args) => {
      if (!args[0]) return ['Usage: open <page.html>', 'Try: open kamehameha.html, open zen-garden.html'];
      if (onCommand) onCommand('open', args.join(' '));
      return [`Loading ${args.join(' ')} in preview...`];
    }
  },

  load: {
    desc: 'Load an AudioFabric project page in preview (alias for open)',
    run: (args) => {
      if (!args[0]) return ['Usage: load <page.html>'];
      if (onCommand) onCommand('open', args.join(' '));
      return [`Loading ${args.join(' ')} in preview...`];
    }
  },

  browse: {
    desc: 'List AudioFabric project pages',
    run: (args) => {
      if (onCommand) onCommand('browse', args[0] || '');
      return ['See project browser in sidebar'];
    }
  },

  fetch: {
    desc: 'Fetch source code of a project page into the editor',
    run: (args) => {
      if (!args[0]) return ['Usage: fetch <page.html>'];
      if (onCommand) onCommand('fetch', args.join(' '));
      return [`Fetching source of ${args.join(' ')}...`];
    }
  },

  clear: {
    desc: 'Clear terminal',
    run: () => {
      if (outputEl) outputEl.innerHTML = '';
      return [];
    }
  },

  pwd: {
    desc: 'Print working directory',
    run: () => [cwd]
  },

  cd: {
    desc: 'Change directory',
    run: (args) => {
      if (!args[0] || args[0] === '/') { cwd = '/'; return [cwd]; }
      if (args[0] === '..') {
        const parts = cwd.split('/').filter(Boolean);
        parts.pop();
        cwd = '/' + parts.join('/');
        return [cwd];
      }
      cwd = resolvePath(args[0]);
      return [cwd];
    }
  },

  tree: {
    desc: 'Show file tree',
    run: () => {
      const result = listFiles('/');
      if (result.files.length === 0) return ['(empty repo)'];
      const lines = ['.'];
      const sorted = result.files.map(f => f.path).sort();
      sorted.forEach((p, i) => {
        const parts = p.split('/').filter(Boolean);
        const indent = parts.length - 1;
        const prefix = i === sorted.length - 1 ? '└── ' : '├── ';
        const indentStr = '│   '.repeat(Math.max(0, indent));
        lines.push(indentStr + prefix + parts[parts.length - 1]);
      });
      lines.push('', `${result.count} file(s)`);
      return lines;
    }
  },

  wc: {
    desc: 'Word/line count',
    run: (args) => {
      if (!args[0]) return ['Usage: wc <file>'];
      const path = resolvePath(args[0]);
      const result = readFile(path);
      if (!result.ok) return ['Error: ' + result.error];
      const lines = result.content.split('\n').length;
      const words = result.content.split(/\s+/).filter(Boolean).length;
      const chars = result.content.length;
      return [`  ${lines} lines  ${words} words  ${chars} chars  ${path}`];
    }
  },

  head: {
    desc: 'Show first N lines',
    run: (args) => {
      if (!args[0]) return ['Usage: head <file> [n]'];
      const path = resolvePath(args[0]);
      const n = parseInt(args[1]) || 10;
      const result = readFile(path);
      if (!result.ok) return ['Error: ' + result.error];
      return result.content.split('\n').slice(0, n);
    }
  },

  tail: {
    desc: 'Show last N lines',
    run: (args) => {
      if (!args[0]) return ['Usage: tail <file> [n]'];
      const path = resolvePath(args[0]);
      const n = parseInt(args[1]) || 10;
      const result = readFile(path);
      if (!result.ok) return ['Error: ' + result.error];
      const lines = result.content.split('\n');
      return lines.slice(-n);
    }
  },

  date: {
    desc: 'Show date/time',
    run: () => [new Date().toLocaleString()]
  },

  whoami: {
    desc: 'Show user',
    run: () => ['sandbox-user@webllm-sandbox']
  }
};

// ===== PATH HELPERS =====
function resolvePath(p) {
  if (p.startsWith('/')) return p;
  const base = cwd === '/' ? '' : cwd;
  return base + '/' + p;
}

// ===== EXECUTE =====
function execute(line) {
  const trimmed = line.trim();
  if (!trimmed) return [];

  // save to history
  if (history[history.length - 1] !== trimmed) history.push(trimmed);
  if (history.length > 200) history = history.slice(-150);
  historyIdx = history.length;

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  if (COMMANDS[cmd]) {
    return COMMANDS[cmd].run(args);
  }

  // try as JS eval fallback
  try {
    const result = Function('"use strict"; return (' + trimmed + ')')();
    return ['→ ' + String(result)];
  } catch (e) {
    return [`Unknown command: ${cmd}. Type "help" for commands.`];
  }
}

// ===== RENDER OUTPUT =====
function printLines(lines, className) {
  if (!outputEl) return;
  for (const line of lines) {
    const div = document.createElement('div');
    div.className = 'term-line' + (className ? ' ' + className : '');
    div.textContent = line;
    outputEl.appendChild(div);
  }
  outputEl.scrollTop = outputEl.scrollHeight;
}

function printPrompt(cmd) {
  if (!outputEl) return;
  const div = document.createElement('div');
  div.className = 'term-line term-prompt';
  div.innerHTML = `<span class="term-user">sandbox</span>:<span class="term-cwd">${escHtml(cwd)}</span>$ ${escHtml(cmd)}`;
  outputEl.appendChild(div);
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ===== PUBLIC API =====
export function init(containerEl, options = {}) {
  container = containerEl;
  onCommand = options.onCommand || null;

  container.innerHTML = `
    <div class="term-output" id="term-output"></div>
    <div class="term-input-row">
      <span class="term-prompt-label"><span class="term-user">sandbox</span>:<span class="term-cwd">/</span>$&nbsp;</span>
      <input type="text" class="term-input" id="term-input" spellcheck="false" autocomplete="off" autocorrect="off" />
    </div>`;

  outputEl = container.querySelector('#term-output');
  inputEl = container.querySelector('#term-input');

  // MOTD
  printLines(MOTD, 'term-motd');

  // input handling
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const cmd = inputEl.value;
      printPrompt(cmd);
      const output = execute(cmd);
      printLines(output);
      inputEl.value = '';
      updatePromptLabel();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIdx > 0) { historyIdx--; inputEl.value = history[historyIdx] || ''; }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx < history.length - 1) { historyIdx++; inputEl.value = history[historyIdx] || ''; }
      else { historyIdx = history.length; inputEl.value = ''; }
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      autocomplete();
    }
    if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      outputEl.innerHTML = '';
    }
  });

  // click to focus
  container.addEventListener('click', () => inputEl.focus());

  return { execute: runCommand, print: printLines, focus: () => inputEl.focus() };
}

function updatePromptLabel() {
  const label = container.querySelector('.term-prompt-label .term-cwd');
  if (label) label.textContent = cwd;
}

function autocomplete() {
  const val = inputEl.value;
  const parts = val.split(/\s+/);
  const last = parts[parts.length - 1];

  if (parts.length === 1) {
    // command autocomplete
    const matches = Object.keys(COMMANDS).filter(c => c.startsWith(last));
    if (matches.length === 1) {
      inputEl.value = matches[0] + ' ';
    } else if (matches.length > 1) {
      printLines(matches.map(m => '  ' + m));
    }
  } else {
    // file autocomplete
    const result = listFiles('/');
    const matches = result.files.filter(f => f.path.includes(last) || f.path.split('/').pop().startsWith(last));
    if (matches.length === 1) {
      parts[parts.length - 1] = matches[0].path;
      inputEl.value = parts.join(' ');
    } else if (matches.length > 1) {
      printLines(matches.map(f => '  ' + f.path));
    }
  }
}

// external command execution
export function runCommand(cmd) {
  printPrompt(cmd);
  const output = execute(cmd);
  printLines(output);
  return output;
}

export function print(text, className) {
  printLines(Array.isArray(text) ? text : [text], className);
}
