// arena-assembler.js — Quick HTML assembly function for Ki Arena pages
// Generates complete, runnable HTML from a module selection config
// Usage: import { assemble } from './arena-assembler.js';
//        const html = assemble({ title: 'My Arena', modules: ['scene','voice','stargate'], room: 'TEST' });

// All available modules and their import paths + init calls
const MODULE_CATALOG = {
  'scene':        { path: './modules/scene.js',          import: 'Scene',      init: "Scene.init({ stars: %%STARS%% });", default: { stars: 3000 } },
  'voice':        { path: './modules/voice-engine.js',   import: 'VoiceEngine', init: "await VoiceEngine.init();", async: true },
  'kanji':        { path: './modules/kanji.js',          import: 'Kanji',      init: "Kanji.init();" },
  'ki-blasts':    { path: './modules/ki-blasts.js',      import: 'KiBlasts',   init: "KiBlasts.init();" },
  'vortex':       { path: './modules/vortex.js',         import: 'Vortex',     init: "Vortex.init({ count: %%VORTEX_COUNT%%, particleSize: %%PARTICLE_SIZE%% });", default: { VORTEX_COUNT: 800, PARTICLE_SIZE: 0.12 } },
  'emoji':        { path: './modules/emoji-system.js',   import: 'EmojiSystem', init: "EmojiSystem.init();" },
  'fx':           { path: './modules/fx.js',             import: 'FX',         init: "FX.init({ aurora: %%AURORA%% });", default: { AURORA: true } },
  'synths':       { path: './modules/synths.js',         import: 'Synths',     init: "Synths.init();" },
  'mqtt':         { path: './modules/mqtt-net.js',       import: 'MqttNet',    init: "MqttNet.init({ room: '%%ROOM%%' });", default: { ROOM: 'DEFAULT' } },
  'webrtc':       { path: './modules/webrtc-net.js',     import: 'WebRTCNet',  init: "WebRTCNet.init({ room: '%%ROOM%%' });", default: { ROOM: 'DEFAULT' } },
  'presence':     { path: './modules/presence.js',       import: 'Presence',   init: "Presence.init();" },
  'camera':       { path: './modules/camera.js',         import: 'Camera',     init: "Camera.init();" },
  'screen-share': { path: './modules/screen-share.js',   import: 'ScreenShare', init: "ScreenShare.init();" },
  'chat':         { path: './modules/chat.js',           import: 'Chat',       init: "Chat.init();" },
  'resonance':    { path: './modules/resonance.js',      import: 'Resonance',  init: "Resonance.init();" },
  'vocal-ranges': { path: './modules/vocal-ranges.js',   import: 'VocalRanges', init: "VocalRanges.init();" },
  'automatch':    { path: './modules/automatch.js',      import: 'Automatch',  init: "Automatch.init({ room: '%%ROOM%%' });", default: { ROOM: 'DEFAULT' } },
  'freq-bands-12':{ path: './modules/freq-bands-12.js',  import: 'FreqBands',  init: "FreqBands.init();" },
  'geo-folder':   { path: './modules/geo-folder.js',     import: 'GeoFolder',  init: "GeoFolder.init({ position: %%GEO_POS%%, scale: %%GEO_SCALE%% });", default: { GEO_POS: '[0,3,-2]', GEO_SCALE: 1.5 } },
  'stargate':     { path: './modules/stargate.js',       import: 'Stargate',   init: "Stargate.init({ position: %%GATE_POS%%, radius: %%GATE_RADIUS%% });", default: { GATE_POS: '[0,3,-8]', GATE_RADIUS: 4 } },
  'hd-scene':     { path: './modules/hd-scene.js',       import: 'HDScene',    init: "HDScene.init();" },
  'hd-fx':        { path: './modules/hd-fx.js',          import: 'HDFX',       init: "HDFX.init();" },
  'hd-vortex':    { path: './modules/hd-vortex.js',      import: 'HDVortex',   init: "HDVortex.init();" },
  'voice-chat':   { path: './modules/voice-chat.js',     import: 'VoiceChat',  init: "VoiceChat.init();" },
  'singing-voice':{ path: './modules/singing-voice.js',   import: 'SingingVoice', init: "SingingVoice.init();" },
  'resonance-synths': { path: './modules/resonance-synths.js', import: 'ResSynths', init: "ResSynths.init();" },
  'voice-fx':       { path: './modules/voice-fx.js',         import: 'VoiceFX',    init: "VoiceFX.init();" },
  'prime-recursion':{ path: './modules/prime-recursion.js',  import: 'PrimeRecursion', init: "PrimeRecursion.init({ position: %%PRIME_POS%%, scale: %%PRIME_SCALE%% });", default: { PRIME_POS: '[4,5,-1]', PRIME_SCALE: 1 } },
  'deep-fractal':   { path: './modules/deep-fractal.js',     import: 'DeepFractal',    init: "DeepFractal.init({ position: %%FRACTAL_POS%%, scale: %%FRACTAL_SCALE%% });", default: { FRACTAL_POS: '[-4,4,-2]', FRACTAL_SCALE: 1 } },
  'sound-landscape':{ path: './modules/sound-landscape.js',   import: 'SoundLandscape', init: "SoundLandscape.init({ position: %%LANDSCAPE_POS%%, scale: %%LANDSCAPE_SCALE%% });", default: { LANDSCAPE_POS: '[0,0.5,5]', LANDSCAPE_SCALE: 0.9 } },
  'wrapped-geo':    { path: './modules/wrapped-geo.js',       import: 'WrappedGeo',     init: "WrappedGeo.init({ position: %%WRAPPED_POS%%, scale: %%WRAPPED_SCALE%% });", default: { WRAPPED_POS: '[0,3.5,-1]', WRAPPED_SCALE: 1.5 } },
  'voxel-wormhole': { path: './modules/voxel-wormhole.js',    import: 'VoxelWormhole',  init: "VoxelWormhole.init({ position: %%VOXEL_POS%%, scale: %%VOXEL_SCALE%% });", default: { VOXEL_POS: '[0,0.5,-3]', VOXEL_SCALE: 1.2 } },
  'genesis':        { path: './modules/genesis.js',            import: 'Genesis',        init: "Genesis.init({ position: %%GENESIS_POS%%, scale: %%GENESIS_SCALE%% });", default: { GENESIS_POS: '[0,3,-2]', GENESIS_SCALE: 1.5 } },
  'voxel-world':    { path: './modules/voxel-world.js',        import: 'VoxelWorld',     init: "VoxelWorld.init({ position: %%VOXWORLD_POS%% });", default: { VOXWORLD_POS: '[0,0.5,-3]' } }
};

// Pre-defined arena presets
export const PRESETS = {
  minimal: {
    title: 'Ki Arena Minimal',
    modules: ['scene', 'voice', 'ki-blasts', 'fx', 'synths'],
    stars: 1500
  },
  standard: {
    title: 'Ki Arena Standard',
    modules: ['scene', 'voice', 'kanji', 'ki-blasts', 'vortex', 'fx', 'synths', 'mqtt', 'webrtc', 'presence'],
    stars: 3000
  },
  ultra: {
    title: 'Ki Arena Ultra',
    modules: ['scene', 'voice', 'kanji', 'ki-blasts', 'vortex', 'emoji', 'fx', 'synths', 'mqtt', 'webrtc', 'presence', 'camera', 'screen-share', 'chat'],
    stars: 4000, VORTEX_COUNT: 1500
  },
  stargate: {
    title: 'Ki Arena Stargate',
    modules: ['scene', 'voice', 'kanji', 'ki-blasts', 'vortex', 'fx', 'synths', 'mqtt', 'webrtc', 'presence', 'chat', 'freq-bands-12', 'geo-folder', 'stargate'],
    stars: 5000, VORTEX_COUNT: 1200
  },
  voicechat: {
    title: 'Ki Arena Voice Chat',
    modules: ['scene', 'voice', 'kanji', 'ki-blasts', 'vortex', 'fx', 'synths', 'mqtt', 'webrtc', 'presence', 'camera', 'chat', 'vocal-ranges'],
    stars: 3000
  },
  duel: {
    title: 'Ki Arena Duel',
    modules: ['scene', 'voice', 'kanji', 'ki-blasts', 'vortex', 'fx', 'synths', 'webrtc', 'automatch', 'vocal-ranges', 'resonance'],
    stars: 3000
  },
  hyperdimensional: {
    title: 'Ki Arena Hyperdimensional',
    modules: ['scene', 'voice', 'kanji', 'ki-blasts', 'vortex', 'emoji', 'fx', 'synths', 'mqtt', 'webrtc', 'presence', 'camera', 'chat', 'freq-bands-12', 'geo-folder', 'stargate', 'resonance', 'vocal-ranges'],
    stars: 6000, VORTEX_COUNT: 2000, AURORA: true
  },
  voiceplus: {
    title: 'Ki Arena Voice+ v2',
    modules: ['scene', 'voice', 'kanji', 'ki-blasts', 'vortex', 'emoji', 'fx', 'synths', 'resonance', 'mqtt', 'webrtc', 'presence', 'chat', 'voice-chat', 'freq-bands-12', 'geo-folder', 'singing-voice'],
    stars: 4000, VORTEX_COUNT: 1000, AURORA: true
  },
  songbird: {
    title: 'Songbird — Singing AI Companion',
    modules: ['scene', 'voice', 'kanji', 'vortex', 'fx', 'synths', 'resonance', 'freq-bands-12', 'geo-folder', 'singing-voice'],
    stars: 3000, VORTEX_COUNT: 800
  },
  voicefull: {
    title: 'Ki Arena Voice Full',
    modules: ['scene', 'voice', 'kanji', 'ki-blasts', 'vortex', 'emoji', 'fx', 'synths', 'resonance', 'resonance-synths', 'mqtt', 'webrtc', 'presence', 'camera', 'screen-share', 'chat', 'voice-chat', 'freq-bands-12', 'geo-folder', 'stargate', 'singing-voice', 'vocal-ranges'],
    stars: 5000, VORTEX_COUNT: 1500, AURORA: true
  },
  voicetrainer: {
    title: 'Ki Arena Voice Trainer',
    modules: ['scene', 'voice', 'vortex', 'fx', 'synths', 'resonance', 'freq-bands-12', 'geo-folder', 'singing-voice', 'voice-fx'],
    stars: 3000, VORTEX_COUNT: 800
  },
  voiceroyale: {
    title: 'Ki Arena Voice Royale v2',
    modules: ['scene', 'voice', 'kanji', 'ki-blasts', 'vortex', 'emoji', 'fx', 'synths', 'resonance', 'freq-bands-12', 'geo-folder', 'stargate', 'voice-chat', 'voice-fx', 'mqtt', 'webrtc', 'presence', 'chat'],
    stars: 5000, VORTEX_COUNT: 1200, AURORA: true
  },
  deeprecursion: {
    title: 'Ki Arena Deep Recursion',
    modules: ['scene', 'voice', 'kanji', 'ki-blasts', 'vortex', 'fx', 'synths', 'resonance', 'freq-bands-12', 'geo-folder', 'prime-recursion', 'deep-fractal', 'sound-landscape', 'mqtt', 'webrtc', 'presence', 'chat'],
    stars: 5000, VORTEX_COUNT: 1200, AURORA: true
  },
  wrappedgeo: {
    title: 'Ki Arena Wrapped Geometry',
    modules: ['scene', 'voice', 'kanji', 'ki-blasts', 'vortex', 'fx', 'synths', 'resonance', 'freq-bands-12', 'wrapped-geo', 'mqtt', 'webrtc', 'presence', 'chat'],
    stars: 4000, VORTEX_COUNT: 800, AURORA: true
  },
  voxelwormhole: {
    title: 'Ki Arena Voxel Wormhole',
    modules: ['scene', 'voice', 'kanji', 'ki-blasts', 'vortex', 'fx', 'synths', 'resonance', 'freq-bands-12', 'voxel-wormhole', 'mqtt', 'webrtc', 'presence', 'chat'],
    stars: 4000, VORTEX_COUNT: 600, AURORA: true
  },
  genesis: {
    title: 'Ki Arena Genesis',
    modules: ['scene', 'voice', 'kanji', 'ki-blasts', 'vortex', 'fx', 'synths', 'resonance', 'freq-bands-12', 'genesis', 'mqtt', 'webrtc', 'presence', 'chat'],
    stars: 5000, VORTEX_COUNT: 800, AURORA: true
  },
  voxelcraft: {
    title: 'Ki Arena Voxel Craft',
    modules: ['scene', 'voice', 'kanji', 'ki-blasts', 'vortex', 'fx', 'synths', 'resonance', 'freq-bands-12', 'geo-folder', 'voxel-world', 'mqtt', 'webrtc', 'presence', 'chat'],
    stars: 4000, VORTEX_COUNT: 600, AURORA: true, GEO_POS: '[0,6,-5]', GEO_SCALE: 1.0
  }
};

// === HUD TEMPLATES ===
const HUD_STYLES = `
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;color:#fff;font-family:'Courier New',monospace;overflow:hidden}
canvas{position:fixed;top:0;left:0;width:100%;height:100%}
#nick{font-size:11px;color:#0f0;cursor:pointer;pointer-events:auto;text-decoration:underline dotted #0f04}
#nick:hover{color:#ff0}
#hud{position:fixed;top:0;left:0;right:0;z-index:50;display:none;padding:10px 16px;
  background:linear-gradient(180deg,rgba(0,0,0,0.7),transparent);pointer-events:none}
#hud.on{display:flex;justify-content:space-between;align-items:flex-start}
.hud-l,.hud-r{display:flex;flex-direction:column;gap:2px}
.hud-r{align-items:flex-end;text-align:right}
#score{font-size:28px;color:#ff0;text-shadow:0 0 10px #f80}
#combo{font-size:16px;color:#f80}
#blastType{font-size:14px;color:#4af}
#charge{font-size:12px;color:#0f0}
#room{font-size:11px;color:#0ff}
#peers{font-size:11px;color:#088}
#tierHUD{position:fixed;right:16px;bottom:16px;z-index:55;text-align:right;pointer-events:none;opacity:0.8}
#tierName{font-size:16px;color:#4af;text-shadow:0 0 8px #4af}
#tierShape{font-size:11px;color:#888}
#bandViz{position:fixed;left:50%;bottom:8px;transform:translateX(-50%);z-index:55;
  display:flex;gap:3px;pointer-events:none;align-items:flex-end;height:60px}
.band-bar{width:14px;background:#111;border:1px solid #fff1;border-radius:3px 3px 0 0;
  position:relative;overflow:hidden;transition:height 0.08s}
.band-fill{position:absolute;bottom:0;left:0;right:0;border-radius:2px;transition:height 0.08s}
.band-label{position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);font-size:7px;color:#666;white-space:nowrap}
#dmgLayer{position:fixed;inset:0;z-index:60;pointer-events:none}
.dmg{position:absolute;font-weight:bold;text-shadow:0 0 8px currentColor;
  animation:dmgUp 1.2s ease-out forwards;pointer-events:none}
@keyframes dmgUp{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-120px) scale(1.8)}}
#cmt{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:70;
  background:rgba(0,0,0,0.8);border:1px solid #ff0;border-radius:12px;padding:8px 20px;
  font-size:16px;color:#ff0;text-shadow:0 0 10px #f80;text-align:center;
  max-width:500px;opacity:0;transition:opacity 0.3s;pointer-events:none}
#cmt.show{opacity:1}
#modBadges{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:55;
  display:flex;gap:6px;pointer-events:none;flex-wrap:wrap;justify-content:center;max-width:80%}
.mod-badge{background:#0002;border:1px solid #0ff3;border-radius:4px;padding:2px 8px;
  font-size:9px;color:#0ff8}
.mod-badge.active{color:#0f0;border-color:#0f04}
#gateStatus{position:fixed;left:16px;bottom:16px;z-index:55;pointer-events:none;opacity:0.7}
#gateActivation{font-size:12px;color:#4af}
#chevronStatus{font-size:9px;color:#666}
`;

const HUD_HTML = `
<canvas id="c"></canvas>
<div id="hud">
  <div class="hud-l"><div id="score">0</div><div id="combo"></div><div id="blastType">&mdash;</div><div id="charge"></div></div>
  <div class="hud-r"><div id="nick" onclick="changeNick()" title="Click to change name"></div>
    <div id="room"></div><div id="peers"></div></div>
</div>
<div id="tierHUD"><div id="tierName"></div><div id="tierShape"></div></div>
<div id="bandViz"></div>
<div id="dmgLayer"></div>
<div id="cmt"></div>
<div id="modBadges"></div>
<div id="gateStatus"><div id="gateActivation"></div><div id="chevronStatus"></div></div>
`;

// === ASSEMBLE FUNCTION ===
export function assemble(config = {}) {
  const preset = config.preset ? { ...PRESETS[config.preset], ...config } : config;
  const {
    title = 'Ki Arena',
    modules = ['scene', 'voice', 'ki-blasts', 'fx'],
    room = 'DEFAULT',
    stars = 3000,
    extraStyles = '',
    extraHTML = '',
    extraScript = ''
  } = preset;

  // Build params object from config for template replacement
  const params = {
    ROOM: room,
    STARS: stars,
    VORTEX_COUNT: preset.VORTEX_COUNT || 800,
    PARTICLE_SIZE: preset.PARTICLE_SIZE || 0.12,
    AURORA: preset.AURORA !== undefined ? preset.AURORA : true,
    GEO_POS: preset.GEO_POS || '[0,3,-2]',
    GEO_SCALE: preset.GEO_SCALE || 1.5,
    GATE_POS: preset.GATE_POS || '[0,3,-8]',
    GATE_RADIUS: preset.GATE_RADIUS || 4,
    ...preset
  };

  // Generate imports
  const imports = ["import { KI } from './modules/core.js';"];
  const inits = [];
  const badges = [];

  for (const modName of modules) {
    const mod = MODULE_CATALOG[modName];
    if (!mod) continue;

    imports.push(`import * as ${mod.import} from '${mod.path}';`);

    // resolve template params in init string
    let initCall = mod.init;
    for (const [key, val] of Object.entries(params)) {
      initCall = initCall.replace(new RegExp(`%%${key}%%`, 'g'), String(val));
    }
    // fill remaining with defaults
    if (mod.default) {
      for (const [key, val] of Object.entries(mod.default)) {
        initCall = initCall.replace(new RegExp(`%%${key}%%`, 'g'), String(val));
      }
    }

    if (mod.async) {
      inits.push(`  try { ${initCall} showBadge('${modName}'); } catch(e) { console.warn('${modName}:', e); }`);
    } else {
      inits.push(`  ${initCall} showBadge('${modName}');`);
    }
  }

  const hasFreqBands = modules.includes('freq-bands-12');
  const hasGeoFolder = modules.includes('geo-folder');
  const hasStargate = modules.includes('stargate');

  // Build the HUD wiring script
  const hudWiring = `
// === HUD WIRING ===
KI.player.name = KI.genHash();
document.getElementById('nick').textContent = KI.player.name;
document.getElementById('room').textContent = '${room}';
window.changeNick = function() {
  const n = prompt('Nickname (max 16):', KI.player.name);
  if (n && n.trim()) {
    KI.player.name = n.trim().slice(0, 16);
    document.getElementById('nick').textContent = KI.player.name;
    KI.emit('broadcast', { type: 'nick', name: KI.player.name, score: KI.player.score });
  }
};

KI.on('hit', data => {
  document.getElementById('score').textContent = KI.player.score.toLocaleString();
  document.getElementById('combo').textContent = KI.player.combo > 1 ? KI.player.combo + 'x COMBO' : '';
});

KI.on('charge:update', data => {
  document.getElementById('blastType').textContent = data.blastType?.name || '';
  document.getElementById('charge').textContent = data.chargeLevel > 0.05 ? 'CHARGE: ' + Math.round(data.chargeLevel * 100) + '%' : '';
});

${hasFreqBands ? `
// === 12-BAND VISUALIZER ===
function buildBandViz() {
  const cont = document.getElementById('bandViz');
  if (!cont) return;
  const fb = KI.get('freq-bands-12');
  if (!fb) return;
  fb.BANDS.forEach((band, i) => {
    const bar = document.createElement('div');
    bar.className = 'band-bar';
    bar.id = 'band-' + i;
    bar.style.height = '60px';
    bar.innerHTML = '<div class="band-fill" style="background:' + band.color + ';height:0%"></div>' +
      '<div class="band-label">' + band.label + '</div>';
    cont.appendChild(bar);
  });
}
KI.on('freq-bands-12:ready', buildBandViz);
KI.on('freq-bands-12:update', data => {
  for (let i = 0; i < 12; i++) {
    const fill = document.querySelector('#band-' + i + ' .band-fill');
    if (fill) fill.style.height = (data.energy[i] * 100) + '%';
  }
});
` : ''}

${hasGeoFolder ? `
// === GEO TIER HUD ===
KI.on('geo-folder:tier-change', data => {
  document.getElementById('tierName').textContent = data.name;
  document.getElementById('tierShape').textContent = 'Tier ' + data.tier;
});
` : ''}

${hasStargate ? `
// === GATE STATUS HUD ===
KI.on('stargate:update', data => {
  const pct = Math.round(data.activation * 100);
  document.getElementById('gateActivation').textContent = data.locked ? 'GATE LOCKED' : 'Gate: ' + pct + '%';
  const lit = data.chevronLit.filter(c => c > 0.5).length;
  document.getElementById('chevronStatus').textContent = lit + '/12 chevrons';
});
` : ''}

function showBadge(name) {
  const b = document.createElement('div');
  b.className = 'mod-badge active';
  b.textContent = name.toUpperCase();
  document.getElementById('modBadges').appendChild(b);
}

function showDmg(amount) {
  const el = document.createElement('div'); el.className = 'dmg';
  el.textContent = Math.round(amount);
  el.style.color = '#ff0';
  el.style.fontSize = (18 + Math.min(amount / 10, 30)) + 'px';
  el.style.left = (window.innerWidth/2 + (Math.random()-0.5)*120) + 'px';
  el.style.top = (window.innerHeight/2 - 60 + (Math.random()-0.5)*40) + 'px';
  document.getElementById('dmgLayer').appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

let cmtTimeout = null;
function showCmt(text) {
  if (cmtTimeout) return;
  const el = document.getElementById('cmt');
  el.textContent = text.slice(0, 80);
  el.classList.add('show');
  cmtTimeout = setTimeout(() => { el.classList.remove('show'); cmtTimeout = null; }, 3000);
}

KI.on('hit', data => { if (data.dmg > 200) showDmg(data.dmg); });
KI.on('ko', () => showCmt('TARGET DESTROYED!'));
`;

  // Assemble the full HTML
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)}</title>
<style>
${HUD_STYLES}
${extraStyles}
</style>
</head>
<body>
${HUD_HTML}
${extraHTML}

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
<script src="https://unpkg.com/mqtt/dist/mqtt.min.js"><\/script>
<script type="module">
${imports.join('\n')}

${hudWiring}

// === BOOT ===
async function boot() {
  document.getElementById('hud').classList.add('on');

${inits.join('\n')}

  // Main loop
  KI.running = true;
  const clock = KI.clock;
  function animate() {
    if (!KI.running) return;
    requestAnimationFrame(animate);
    const dt = clock.getDelta(), t = clock.elapsedTime;
    KI.runUpdates(dt, t);
    KI.renderer.render(KI.scene, KI.camera);
  }
  animate();
  console.log('%c ${escHtml(title).toUpperCase()} BOOTED ', 'background:#000;color:#0f0;font-size:20px;padding:10px');
}

${extraScript}

window.addEventListener('load', boot);
<\/script>
</body>
</html>`;
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// === QUICK GENERATORS ===
export function makeStargate(room, opts = {}) {
  return assemble({ preset: 'stargate', room, ...opts });
}

export function makeUltra(room, opts = {}) {
  return assemble({ preset: 'ultra', room, ...opts });
}

export function makeHyper(room, opts = {}) {
  return assemble({ preset: 'hyperdimensional', room, ...opts });
}

export function makeDuel(room, opts = {}) {
  return assemble({ preset: 'duel', room, ...opts });
}

export function makeMinimal(room, opts = {}) {
  return assemble({ preset: 'minimal', room, ...opts });
}

export function makeVoicePlus(room, opts = {}) {
  return assemble({ preset: 'voiceplus', room, ...opts });
}

export function makeSongbird(room, opts = {}) {
  return assemble({ preset: 'songbird', room, ...opts });
}

export function makeVoiceFull(room, opts = {}) {
  return assemble({ preset: 'voicefull', room, ...opts });
}

export function makeVoiceTrainer(room, opts = {}) {
  return assemble({ preset: 'voicetrainer', room, ...opts });
}

export function makeVoiceRoyale(room, opts = {}) {
  return assemble({ preset: 'voiceroyale', room, ...opts });
}

export function makeDeepRecursion(room, opts = {}) {
  return assemble({ preset: 'deeprecursion', room, ...opts });
}

export function makeWrappedGeo(room, opts = {}) {
  return assemble({ preset: 'wrappedgeo', room, ...opts });
}

export function makeVoxelWormhole(room, opts = {}) {
  return assemble({ preset: 'voxelwormhole', room, ...opts });
}

export function makeGenesis(room, opts = {}) {
  return assemble({ preset: 'genesis', room, ...opts });
}

export function makeVoxelCraft(room, opts = {}) {
  return assemble({ preset: 'voxelcraft', room, ...opts });
}

// List all available modules
export function listModules() {
  return Object.entries(MODULE_CATALOG).map(([name, mod]) => ({
    name, path: mod.path, import: mod.import
  }));
}

// List all presets
export function listPresets() {
  return Object.entries(PRESETS).map(([name, cfg]) => ({
    name, title: cfg.title, moduleCount: cfg.modules.length, modules: cfg.modules
  }));
}
