// chat.js — Text chat overlay with message history
import { KI } from './core.js';

let chatBox, chatInput, chatMessages, isOpen = false;
const messages = [];
const MAX_MESSAGES = 100;

export function init(opts = {}) {
  // create chat UI
  const container = document.createElement('div');
  container.id = 'chatContainer';
  container.innerHTML = `
    <style>
      #chatContainer{position:fixed;bottom:10px;right:10px;z-index:100;width:320px;font-family:'Courier New',monospace}
      #chatToggle{background:#000a;border:1px solid #0ff4;color:#0ff;padding:6px 14px;cursor:pointer;
        font-size:11px;border-radius:6px;float:right}
      #chatToggle:hover{background:#0ff2}
      #chatBox{display:none;background:#000d;border:1px solid #0ff3;border-radius:8px;overflow:hidden;margin-top:4px}
      #chatBox.open{display:block}
      #chatMessages{height:200px;overflow-y:auto;padding:8px;font-size:11px}
      #chatMessages::-webkit-scrollbar{width:4px}
      #chatMessages::-webkit-scrollbar-thumb{background:#0ff4;border-radius:2px}
      .chat-msg{margin:3px 0;word-wrap:break-word}
      .chat-msg .name{color:#0ff;font-weight:bold}
      .chat-msg .text{color:#ddd}
      .chat-msg .time{color:#555;font-size:9px}
      .chat-msg.system{color:#ff0;font-style:italic}
      #chatInputRow{display:flex;border-top:1px solid #0ff2}
      #chatInput{flex:1;background:#0001;border:none;color:#fff;padding:8px;font-size:11px;
        font-family:'Courier New',monospace;outline:none}
      #chatInput::placeholder{color:#555}
      #chatSend{background:#0ff2;border:none;color:#0ff;padding:8px 12px;cursor:pointer;font-size:11px}
      #chatSend:hover{background:#0ff4}
    </style>
    <button id="chatToggle">CHAT [T]</button>
    <div id="chatBox">
      <div id="chatMessages"></div>
      <div id="chatInputRow">
        <input id="chatInput" placeholder="Type message..." maxlength="200" autocomplete="off">
        <button id="chatSend">Send</button>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  chatBox = document.getElementById('chatBox');
  chatInput = document.getElementById('chatInput');
  chatMessages = document.getElementById('chatMessages');

  document.getElementById('chatToggle').addEventListener('click', toggle);
  document.getElementById('chatSend').addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') sendMessage();
    if (e.key === 'Escape') toggle();
  });

  // global shortcut
  document.addEventListener('keydown', e => {
    if (e.key === 't' && !isOpen && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault(); toggle();
    }
  });

  // listen for incoming messages
  KI.on('chat:receive', receiveMessage);
  KI.on('rtc:data', data => {
    if (data.type === 'chat') receiveMessage(data);
  });

  KI.register('chat', { toggle, sendMessage, addSystemMessage });
  KI.emit('chat:ready');
}

export function toggle() {
  isOpen = !isOpen;
  chatBox.classList.toggle('open', isOpen);
  if (isOpen) chatInput.focus();
}

export function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';

  const msg = {
    type: 'chat',
    name: KI.player.name || 'Anon',
    text,
    time: Date.now()
  };

  addMessage(msg);
  KI.emit('chat:send', msg);

  // broadcast via whatever network modules are loaded
  KI.emit('broadcast', msg);
}

export function receiveMessage(msg) {
  if (msg.name === KI.player.name) return; // ignore own echo
  addMessage(msg);
}

export function addSystemMessage(text) {
  addMessage({ type: 'chat', name: '', text, time: Date.now(), system: true });
}

function addMessage(msg) {
  messages.push(msg);
  if (messages.length > MAX_MESSAGES) messages.shift();

  const div = document.createElement('div');
  div.className = 'chat-msg' + (msg.system ? ' system' : '');
  const timeStr = new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (msg.system) {
    div.innerHTML = `<span class="time">${timeStr}</span> ${escapeHtml(msg.text)}`;
  } else {
    div.innerHTML = `<span class="time">${timeStr}</span> <span class="name">${escapeHtml(msg.name)}:</span> <span class="text">${escapeHtml(msg.text)}</span>`;
  }
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // auto-show on new message
  if (!isOpen && !msg.system) {
    chatBox.classList.add('open');
    isOpen = true;
    setTimeout(() => { if (document.activeElement !== chatInput) { chatBox.classList.remove('open'); isOpen = false; } }, 5000);
  }
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
