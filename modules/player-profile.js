// player-profile.js — Persistent player state across all arenas
// Stores name, scores, visited arenas, preferences in localStorage

import { KI } from './core.js';

const STORAGE_KEY = 'audiofabric_player';
const ARENA_HISTORY_KEY = 'audiofabric_arenas';

const profile = {
  name: '',
  totalScore: 0,
  highScores: {},     // { arenaName: score }
  visited: [],        // arena names visited
  visitCount: 0,
  created: 0,
  lastSeen: 0,
  preferences: {
    stars: 3000,
    aurora: true,
    particles: 800
  },
  achievements: []
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      Object.assign(profile, saved);
    }
  } catch (e) { /* ignore */ }
}

function save() {
  try {
    profile.lastSeen = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (e) { /* ignore */ }
}

function trackArena(name) {
  if (!profile.visited.includes(name)) {
    profile.visited.push(name);
  }
  profile.visitCount++;
  profile.lastSeen = Date.now();

  // Track in arena history
  try {
    const hist = JSON.parse(localStorage.getItem(ARENA_HISTORY_KEY) || '[]');
    hist.push({ name, time: Date.now() });
    // Keep last 100 entries
    if (hist.length > 100) hist.splice(0, hist.length - 100);
    localStorage.setItem(ARENA_HISTORY_KEY, JSON.stringify(hist));
  } catch (e) { /* ignore */ }

  save();
}

function updateScore(arenaName, score) {
  profile.totalScore += score;
  if (!profile.highScores[arenaName] || score > profile.highScores[arenaName]) {
    profile.highScores[arenaName] = score;
  }
  save();
}

function checkAchievements() {
  const earned = [];
  const a = profile.achievements;

  if (!a.includes('first-visit') && profile.visitCount >= 1) {
    a.push('first-visit'); earned.push('First Steps');
  }
  if (!a.includes('explorer-5') && profile.visited.length >= 5) {
    a.push('explorer-5'); earned.push('Explorer (5 arenas)');
  }
  if (!a.includes('explorer-10') && profile.visited.length >= 10) {
    a.push('explorer-10'); earned.push('Wanderer (10 arenas)');
  }
  if (!a.includes('explorer-20') && profile.visited.length >= 20) {
    a.push('explorer-20'); earned.push('Nomad (20 arenas)');
  }
  if (!a.includes('score-1k') && profile.totalScore >= 1000) {
    a.push('score-1k'); earned.push('Scorer (1000 pts)');
  }
  if (!a.includes('score-10k') && profile.totalScore >= 10000) {
    a.push('score-10k'); earned.push('Champion (10k pts)');
  }
  if (!a.includes('score-100k') && profile.totalScore >= 100000) {
    a.push('score-100k'); earned.push('Legend (100k pts)');
  }

  if (earned.length > 0) {
    save();
    for (const e of earned) {
      KI.emit('achievement', { name: e });
    }
  }
  return earned;
}

export function init() {
  load();

  // First time? Generate a name
  if (!profile.name) {
    profile.name = KI.genHash();
    profile.created = Date.now();
  }

  // Sync with KI player state
  KI.player.name = profile.name;
  KI.player.highScore = profile.totalScore;

  // Detect current arena from page title or URL
  const arenaName = document.title.replace(/^Ki Arena\s*[—–-]\s*/i, '').trim() ||
    window.location.pathname.split('/').pop().replace('.html', '') || 'unknown';
  trackArena(arenaName);

  // Listen for score updates
  KI.on('hit', (data) => {
    if (data.dmg > 0) {
      updateScore(arenaName, Math.round(data.dmg));
      checkAchievements();
    }
  });

  // Listen for name changes
  KI.on('broadcast', (data) => {
    if (data.type === 'nick') {
      profile.name = data.name;
      save();
    }
  });

  KI.register('player-profile', {
    profile,
    save,
    getName: () => profile.name,
    setName: (n) => { profile.name = n; KI.player.name = n; save(); },
    getVisited: () => profile.visited,
    getHighScores: () => profile.highScores,
    getTotalScore: () => profile.totalScore,
    getAchievements: () => profile.achievements
  });

  KI.emit('player-profile:ready', { name: profile.name, totalScore: profile.totalScore });
}
