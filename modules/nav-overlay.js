// nav-overlay.js — Universal navigation overlay for all AudioFabric arenas
// Provides hamburger menu → sidebar with arena categories, player info, quick-switch

import { KI } from './core.js';

// Arena directory — all available experiences
const ARENAS = [
  // Portal
  { name: 'Hub', file: 'hub.html', cat: 'portal', desc: 'Main portal & launcher' },

  // Core Arenas
  { name: 'Ki Arena', file: 'ki-arena.html', cat: 'arena', desc: 'Original voice combat' },
  { name: 'Ki Arena v3', file: 'ki-arena-v3.html', cat: 'arena', desc: 'Enhanced combat v3' },
  { name: 'Ki Arena Ultra', file: 'ki-arena-ultra.html', cat: 'arena', desc: 'All features loaded' },
  { name: 'Ki Arena Plus', file: 'ki-arena-plus.html', cat: 'arena', desc: 'Kanji + elements' },
  { name: 'Stargate', file: 'ki-arena-stargate.html', cat: 'arena', desc: 'Portal activation' },
  { name: 'Hyperdimensional', file: 'ki-arena-plus-voice.html', cat: 'arena', desc: 'Full voice suite' },

  // Combat
  { name: 'Kamehameha', file: 'kamehameha.html', cat: 'combat', desc: 'Energy beam attack' },
  { name: 'Kamehameha Duel', file: 'kamehameha-duel.html', cat: 'combat', desc: 'P2P voice fighting' },
  { name: 'PvP Battle', file: 'pvp-battle.html', cat: 'combat', desc: 'Player vs player' },
  { name: 'Voice Duel', file: 'voice-duel.html', cat: 'combat', desc: 'Voice combat duel' },
  { name: 'Voice Royale', file: 'ki-arena-voice-royale-v2.html', cat: 'combat', desc: 'Battle royale' },

  // Bosses
  { name: 'Boss: Colossus', file: 'ki-arena-boss-colossus.html', cat: 'boss', desc: 'Giant boss fight' },
  { name: 'Boss: Elemental', file: 'ki-arena-boss-elemental.html', cat: 'boss', desc: 'Elemental boss' },
  { name: 'Boss: Void', file: 'ki-arena-boss-void.html', cat: 'boss', desc: 'Void dimension boss' },
  { name: 'Boss Rush', file: 'ki-arena-boss-rush.html', cat: 'boss', desc: 'Gauntlet mode' },

  // Music & Voice
  { name: 'Songbird', file: 'ki-arena-songbird.html', cat: 'music', desc: 'AI singing companion' },
  { name: 'Voice Trainer', file: 'ki-arena-voice-trainer.html', cat: 'music', desc: 'Vocal training' },
  { name: 'Sing Self', file: 'sing-self.html', cat: 'music', desc: 'Self-singing experience' },
  { name: 'Sing Universe', file: 'sing-universe.html', cat: 'music', desc: 'Cosmic singing' },
  { name: 'Jam Session', file: 'jam-session.html', cat: 'music', desc: 'Collaborative jam' },
  { name: 'Audio Gen', file: 'audio-gen.html', cat: 'music', desc: 'Sound generator' },

  // Worlds & Visuals
  { name: 'Voxel Craft', file: 'ki-arena-voxel-craft.html', cat: 'world', desc: 'Voice Minecraft + LLM' },
  { name: 'Voxel Wormhole', file: 'ki-arena-voxel-wormhole.html', cat: 'world', desc: 'Voxel portal' },
  { name: 'Genesis', file: 'ki-arena-genesis.html', cat: 'world', desc: 'Universe creation' },
  { name: 'Deep Recursion', file: 'ki-arena-deep-recursion.html', cat: 'world', desc: 'Fractal depths' },
  { name: 'Wrapped Geo', file: 'ki-arena-wrapped-geo.html', cat: 'world', desc: 'Shape morphing' },
  { name: 'Zen Garden', file: 'zen-garden.html', cat: 'world', desc: 'Meditation space' },

  // Social
  { name: 'Voice Room', file: 'voice-room.html', cat: 'social', desc: 'Voice chat room' },
  { name: 'Voice+ v2', file: 'ki-arena-voice-plus-v2.html', cat: 'social', desc: 'Enhanced voice chat' },

  // Knowledge
  { name: 'Periodic Table', file: 'periodic-table-arena.html', cat: 'knowledge', desc: 'Element explorer' },
  { name: 'D2R Runewords', file: 'd2r-runeword-arena.html', cat: 'knowledge', desc: 'Diablo II runes' },
  { name: 'Risk Arena', file: 'risk-arena.html', cat: 'knowledge', desc: 'Strategy game' },

  // AI
  { name: 'Web LLM', file: 'web-llm-arena.html', cat: 'ai', desc: 'AI chat assistant' },
  { name: 'Code Sandbox', file: 'web-llm-sandbox-v2.html', cat: 'ai', desc: 'AI code editor' },

  // Shields
  { name: 'Shield 127D', file: 'shield-127d.html', cat: 'shield', desc: '127-dimensional shield' },
  { name: 'Thomas Shield', file: 'thomas-shield.html', cat: 'shield', desc: 'Personal shield' },

  // Vagal
  { name: 'Vagal Engine', file: 'index.html', cat: 'vagal', desc: 'Phoneme engine' },
];

const CATEGORIES = {
  portal:    { label: 'PORTAL',    color: '#0ff' },
  arena:     { label: 'ARENAS',    color: '#0f8' },
  combat:    { label: 'COMBAT',    color: '#f44' },
  boss:      { label: 'BOSSES',    color: '#f80' },
  music:     { label: 'MUSIC',     color: '#f0f' },
  world:     { label: 'WORLDS',    color: '#4af' },
  social:    { label: 'SOCIAL',    color: '#ff0' },
  knowledge: { label: 'KNOWLEDGE', color: '#8f8' },
  ai:        { label: 'AI',        color: '#a8f' },
  shield:    { label: 'SHIELDS',   color: '#fa0' },
  vagal:     { label: 'VAGAL',     color: '#0ff' }
};

let navOpen = false;

export function init() {
  buildNav();
  bindKeys();

  KI.register('nav-overlay', {
    ARENAS, CATEGORIES,
    open: () => toggleNav(true),
    close: () => toggleNav(false),
    toggle: () => toggleNav(!navOpen),
    getArenas: () => ARENAS,
    navigate: navigateTo
  });

  KI.emit('nav-overlay:ready');
}

function buildNav() {
  // Hamburger trigger
  const trigger = document.createElement('div');
  trigger.id = 'af-nav-trigger';
  trigger.innerHTML = '<span></span><span></span><span></span>';
  trigger.addEventListener('click', () => toggleNav(!navOpen));
  document.body.appendChild(trigger);

  // Nav panel
  const nav = document.createElement('div');
  nav.id = 'af-nav';

  // Player badge
  const pp = KI.get('player-profile');
  const pName = pp ? pp.getName() : (KI.player.name || '???');
  const pScore = pp ? pp.getTotalScore() : 0;
  const visited = pp ? pp.getVisited().length : 0;

  nav.innerHTML = `
    <div class="af-player-badge">
      <div class="af-avatar">${pName.charAt(0).toUpperCase()}</div>
      <div>
        <div class="af-pname">${escHtml(pName)}</div>
        <div class="af-pstat">${pScore.toLocaleString()} pts &middot; ${visited} arenas visited</div>
      </div>
    </div>
  `;

  // Detect current page
  const currentFile = window.location.pathname.split('/').pop() || 'index.html';

  // Build sections by category
  const catOrder = ['portal', 'arena', 'combat', 'boss', 'music', 'world', 'social', 'knowledge', 'ai', 'shield', 'vagal'];
  for (const cat of catOrder) {
    const arenas = ARENAS.filter(a => a.cat === cat);
    if (arenas.length === 0) continue;

    const section = document.createElement('div');
    section.className = 'af-nav-section';

    const catInfo = CATEGORIES[cat];
    section.innerHTML = `<h3 style="color:${catInfo.color}">${catInfo.label}</h3>`;

    for (const arena of arenas) {
      const item = document.createElement('a');
      item.className = 'af-nav-item' + (arena.file === currentFile ? ' active' : '');
      item.href = arena.file;
      item.innerHTML = `${escHtml(arena.name)}<div class="af-nav-sub">${escHtml(arena.desc)}</div>`;
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(arena.file);
      });
      section.appendChild(item);
    }
    nav.appendChild(section);
  }

  document.body.appendChild(nav);

  // Toast container
  if (!document.getElementById('af-toast')) {
    const toast = document.createElement('div');
    toast.id = 'af-toast';
    document.body.appendChild(toast);
  }

  // Achievement toasts
  KI.on('achievement', (data) => {
    showToast('Achievement: ' + data.name);
  });
}

function toggleNav(open) {
  navOpen = open;
  const nav = document.getElementById('af-nav');
  const trigger = document.getElementById('af-nav-trigger');
  if (nav) nav.classList.toggle('open', open);
  if (trigger) trigger.classList.toggle('open', open);
}

function navigateTo(file) {
  // Save current state before leaving
  const pp = KI.get('player-profile');
  if (pp) pp.save();

  // Smooth transition
  document.body.style.transition = 'opacity 0.3s';
  document.body.style.opacity = '0';
  setTimeout(() => { window.location.href = file; }, 300);
}

function bindKeys() {
  document.addEventListener('keydown', (e) => {
    // ESC closes nav
    if (e.key === 'Escape' && navOpen) {
      toggleNav(false);
      e.preventDefault();
    }
    // Tab toggles nav (when not in input)
    if (e.key === 'Tab' && !e.target.closest('input,textarea,select')) {
      e.preventDefault();
      toggleNav(!navOpen);
    }
  });

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (navOpen && !e.target.closest('#af-nav,#af-nav-trigger')) {
      toggleNav(false);
    }
  });
}

function showToast(text) {
  const container = document.getElementById('af-toast');
  if (!container) return;
  const item = document.createElement('div');
  item.className = 'af-toast-item';
  item.textContent = text;
  container.appendChild(item);
  setTimeout(() => item.remove(), 3000);
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
