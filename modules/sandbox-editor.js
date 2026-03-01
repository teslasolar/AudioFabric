// sandbox-editor.js — Lightweight code editor with syntax highlighting, tabs, undo/redo
// Renders into a container element. No external deps — pure DOM + regex highlighting.

const THEMES = {
  keyword:  '#cc77ff',
  string:   '#88ddaa',
  comment:  '#556677',
  number:   '#ffaa44',
  tag:      '#ff6655',
  attr:     '#ffcc66',
  attrVal:  '#88ddaa',
  punct:    '#889',
  func:     '#66ccff',
  builtin:  '#ff88cc',
  default:  '#ccd'
};

// language-aware token patterns
const RULES = {
  javascript: [
    { re: /(\/\/.*$)/gm,                                cls: 'comment' },
    { re: /(\/\*[\s\S]*?\*\/)/g,                        cls: 'comment' },
    { re: /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g, cls: 'string' },
    { re: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|this|class|extends|import|export|from|default|async|await|yield|try|catch|finally|throw|typeof|instanceof|in|of|delete|void|true|false|null|undefined)\b/g, cls: 'keyword' },
    { re: /\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/gi,           cls: 'number' },
    { re: /\b(console|document|window|Math|Array|Object|String|Number|JSON|Promise|Map|Set|Date|RegExp|Error|fetch|setTimeout|setInterval|requestAnimationFrame|navigator)\b/g, cls: 'builtin' },
    { re: /(\w+)\s*(?=\()/g,                            cls: 'func' }
  ],
  html: [
    { re: /(&lt;!--[\s\S]*?--&gt;)/g,                  cls: 'comment' },
    { re: /(&lt;\/?)([\w-]+)/g,                         cls: 'tag', group: 2 },
    { re: /(\s)([\w-]+)(=)(&quot;[^&]*?&quot;|'[^']*?')/g, cls: 'attr', groups: { 2: 'attr', 4: 'attrVal' } },
    { re: /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g, cls: 'string' }
  ],
  css: [
    { re: /(\/\*[\s\S]*?\*\/)/g,                        cls: 'comment' },
    { re: /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g,    cls: 'string' },
    { re: /(#[\da-fA-F]{3,8})\b/g,                     cls: 'number' },
    { re: /\b(\d+\.?\d*(?:px|em|rem|vh|vw|%|s|ms|deg|fr)?)\b/g, cls: 'number' },
    { re: /(@[\w-]+|!important)/g,                      cls: 'keyword' },
    { re: /([\w-]+)\s*(?=\{)/g,                         cls: 'func' },
    { re: /\b(display|position|width|height|margin|padding|border|background|color|font|flex|grid|transform|transition|animation|opacity|z-index|overflow|top|left|right|bottom|align-items|justify-content|gap|box-shadow|text-shadow|border-radius)\b/g, cls: 'builtin' }
  ]
};

// ===== EDITOR STATE =====
const editors = new Map(); // id -> editorState
let activeEditorId = null;

function createEditorState(path, content, language) {
  return {
    path,
    content,
    language,
    scrollTop: 0,
    cursorPos: content.length,
    undoStack: [content],
    undoIdx: 0,
    dirty: false,
    selection: null
  };
}

// ===== SYNTAX HIGHLIGHTING =====
function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlight(code, language) {
  let html = escHtml(code);
  const rules = RULES[language] || RULES.javascript;

  // simple token-based highlighting via regex replacement
  // we mark tokens with sentinel chars then replace
  const tokens = [];
  let tokenIdx = 0;

  for (const rule of rules) {
    html = html.replace(rule.re, (...args) => {
      const fullMatch = args[0];
      if (rule.groups) {
        // multi-group rule
        let result = fullMatch;
        for (const [gIdx, cls] of Object.entries(rule.groups)) {
          const g = args[parseInt(gIdx)];
          if (g) result = result.replace(g, `<span style="color:${THEMES[cls]}">${g}</span>`);
        }
        return result;
      }
      const group = rule.group ? args[rule.group] : fullMatch;
      const colored = `<span style="color:${THEMES[rule.cls]}">${group}</span>`;
      return rule.group ? fullMatch.replace(group, colored) : colored;
    });
  }

  return html;
}

// ===== RENDER =====
function renderEditor(container, editorId) {
  const state = editors.get(editorId);
  if (!state) return;

  const lines = state.content.split('\n');
  const lang = state.language;

  // line numbers + code
  let gutterHtml = '';
  let codeHtml = '';
  for (let i = 0; i < lines.length; i++) {
    gutterHtml += `<div class="ed-ln">${i + 1}</div>`;
    codeHtml += `<div class="ed-line">${highlight(lines[i], lang) || '&nbsp;'}</div>`;
  }

  const editorEl = container.querySelector('.ed-body');
  if (!editorEl) return;

  const gutter = editorEl.querySelector('.ed-gutter');
  const code = editorEl.querySelector('.ed-code');
  if (gutter) gutter.innerHTML = gutterHtml;
  if (code) code.innerHTML = codeHtml;
}

// ===== PUBLIC API =====
export function init(container, options = {}) {
  container.innerHTML = `
    <div class="ed-tabs" id="ed-tabs"></div>
    <div class="ed-body" style="display:flex;flex:1;overflow:hidden;position:relative">
      <div class="ed-gutter" style="width:40px;text-align:right;padding:4px 6px 4px 0;
        color:#445;font-size:11px;line-height:1.65;user-select:none;overflow:hidden;
        background:rgba(0,0,0,0.15);border-right:1px solid rgba(255,255,255,0.04)"></div>
      <div class="ed-code-wrap" style="flex:1;overflow:auto;position:relative">
        <pre class="ed-code" style="margin:0;padding:4px 8px;font-size:12px;line-height:1.65;
          font-family:'Courier New',monospace;color:${THEMES.default};white-space:pre;
          min-height:100%"></pre>
        <textarea class="ed-input" spellcheck="false" autocomplete="off" autocorrect="off"
          style="position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;
          font-family:'Courier New',monospace;font-size:12px;line-height:1.65;padding:4px 8px;
          background:transparent;color:transparent;caret-color:${THEMES.default};border:none;
          resize:none;outline:none;white-space:pre;tab-size:2;overflow:auto"></textarea>
      </div>
    </div>
    <div class="ed-status" style="height:22px;display:flex;align-items:center;padding:0 8px;
      font-size:10px;color:#556;border-top:1px solid rgba(255,255,255,0.04);
      background:rgba(0,0,0,0.1);gap:12px;user-select:none">
      <span id="ed-lang"></span>
      <span id="ed-lines"></span>
      <span id="ed-size"></span>
      <span id="ed-dirty" style="color:#ffaa22"></span>
    </div>`;

  const textarea = container.querySelector('.ed-input');
  const codeWrap = container.querySelector('.ed-code-wrap');
  const gutter = container.querySelector('.ed-gutter');

  // sync scroll between textarea and display
  textarea.addEventListener('scroll', () => {
    codeWrap.querySelector('.ed-code').style.transform = `translateY(-${textarea.scrollTop}px)`;
    gutter.style.transform = `translateY(-${textarea.scrollTop}px)`;
  });

  // handle typing
  textarea.addEventListener('input', () => {
    if (!activeEditorId) return;
    const state = editors.get(activeEditorId);
    if (!state) return;
    state.content = textarea.value;
    state.dirty = true;
    // push to undo stack (debounced)
    clearTimeout(state._undoTimer);
    state._undoTimer = setTimeout(() => {
      state.undoStack = state.undoStack.slice(0, state.undoIdx + 1);
      state.undoStack.push(state.content);
      state.undoIdx = state.undoStack.length - 1;
      if (state.undoStack.length > 100) {
        state.undoStack = state.undoStack.slice(-80);
        state.undoIdx = state.undoStack.length - 1;
      }
    }, 500);
    renderEditor(container, activeEditorId);
    updateStatusBar(container);
    if (options.onChange) options.onChange(state.path, state.content);
  });

  // handle tab key
  textarea.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 2;
      textarea.dispatchEvent(new Event('input'));
    }
    // ctrl+z undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      const state = editors.get(activeEditorId);
      if (state && state.undoIdx > 0) {
        state.undoIdx--;
        state.content = state.undoStack[state.undoIdx];
        textarea.value = state.content;
        renderEditor(container, activeEditorId);
        updateStatusBar(container);
      }
    }
    // ctrl+shift+z or ctrl+y redo
    if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') ||
        ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
      e.preventDefault();
      const state = editors.get(activeEditorId);
      if (state && state.undoIdx < state.undoStack.length - 1) {
        state.undoIdx++;
        state.content = state.undoStack[state.undoIdx];
        textarea.value = state.content;
        renderEditor(container, activeEditorId);
        updateStatusBar(container);
      }
    }
  });

  return { openFile, closeFile, getContent, setContent, getOpenFiles, markClean };
}

function updateStatusBar(container) {
  const state = editors.get(activeEditorId);
  if (!state) return;
  const langEl = container.querySelector('#ed-lang');
  const linesEl = container.querySelector('#ed-lines');
  const sizeEl = container.querySelector('#ed-size');
  const dirtyEl = container.querySelector('#ed-dirty');
  if (langEl) langEl.textContent = state.language.toUpperCase();
  if (linesEl) linesEl.textContent = state.content.split('\n').length + ' lines';
  if (sizeEl) sizeEl.textContent = formatBytes(state.content.length);
  if (dirtyEl) dirtyEl.textContent = state.dirty ? 'modified' : '';
}

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  return (b / 1024).toFixed(1) + ' KB';
}

function detectLanguage(path) {
  const ext = path.split('.').pop().toLowerCase();
  if (['html', 'htm'].includes(ext)) return 'html';
  if (ext === 'css') return 'css';
  if (['js', 'mjs', 'jsx', 'ts', 'tsx'].includes(ext)) return 'javascript';
  if (ext === 'json') return 'javascript';
  return 'javascript';
}

// ===== TAB MANAGEMENT =====
export function openFile(path, content) {
  const lang = detectLanguage(path);
  if (!editors.has(path)) {
    editors.set(path, createEditorState(path, content, lang));
  } else {
    const state = editors.get(path);
    if (!state.dirty) {
      state.content = content;
      state.undoStack = [content];
      state.undoIdx = 0;
    }
  }
  activeEditorId = path;
  // update textarea + render
  const containers = document.querySelectorAll('.ed-input');
  containers.forEach(ta => { ta.value = content; });
  renderAllTabs();
}

export function closeFile(path) {
  editors.delete(path);
  if (activeEditorId === path) {
    const keys = [...editors.keys()];
    activeEditorId = keys.length > 0 ? keys[keys.length - 1] : null;
  }
  renderAllTabs();
}

export function getContent(path) {
  const state = editors.get(path || activeEditorId);
  return state ? state.content : null;
}

export function setContent(path, content) {
  const state = editors.get(path);
  if (state) {
    state.content = content;
    state.undoStack.push(content);
    state.undoIdx = state.undoStack.length - 1;
    if (path === activeEditorId) {
      const ta = document.querySelector('.ed-input');
      if (ta) ta.value = content;
      const container = ta?.closest('[class]')?.parentElement;
      if (container) renderEditor(container, path);
    }
  }
}

export function getOpenFiles() {
  return [...editors.keys()];
}

export function markClean(path) {
  const state = editors.get(path || activeEditorId);
  if (state) state.dirty = false;
}

function renderAllTabs() {
  const tabBar = document.getElementById('ed-tabs');
  if (!tabBar) return;
  tabBar.innerHTML = '';
  for (const [path, state] of editors) {
    const tab = document.createElement('div');
    tab.className = 'ed-tab' + (path === activeEditorId ? ' active' : '');
    const name = path.split('/').pop();
    tab.innerHTML = `<span class="ed-tab-name">${name}</span>${state.dirty ? '<span class="ed-tab-dot"></span>' : ''}<span class="ed-tab-close">&times;</span>`;
    tab.querySelector('.ed-tab-name').onclick = () => {
      activeEditorId = path;
      const ta = document.querySelector('.ed-input');
      if (ta) ta.value = state.content;
      renderAllTabs();
      const container = ta?.closest('.ed-body')?.parentElement;
      if (container) {
        renderEditor(container, path);
        updateStatusBar(container);
      }
    };
    tab.querySelector('.ed-tab-close').onclick = (e) => { e.stopPropagation(); closeFile(path); };
    tabBar.appendChild(tab);
  }
}

export function getActiveFile() { return activeEditorId; }
