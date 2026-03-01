// d2r-runes.js — All 33 Diablo 2 Resurrected runes mapped to musical notes
// Each rune spans C2 to G#4 chromatically (33 semitones)
// Rune properties: weapon/armor effects, rarity tier, element association

export const RUNES = [
  { id:1,  name:'El',    clvl:11, note:'C2',  freq:65.41,  tier:'low',    color:0x888888, element:'light',     wepEffect:'+50 AR, +1 Light Radius',        armEffect:'+15 Def, +1 Light Radius' },
  { id:2,  name:'Eld',   clvl:11, note:'C#2', freq:69.30,  tier:'low',    color:0x999988, element:'earth',     wepEffect:'+75% Dmg vs Undead, +50 AR vs Undead', armEffect:'15% Slower Stam Drain / +7% FBR' },
  { id:3,  name:'Tir',   clvl:13, note:'D2',  freq:73.42,  tier:'low',    color:0x88aacc, element:'spirit',    wepEffect:'+2 Mana After Kill',             armEffect:'+2 Mana After Kill' },
  { id:4,  name:'Nef',   clvl:13, note:'D#2', freq:77.78,  tier:'low',    color:0xaaaaaa, element:'air',       wepEffect:'Knockback',                       armEffect:'+30 Def vs Missile' },
  { id:5,  name:'Eth',   clvl:15, note:'E2',  freq:82.41,  tier:'low',    color:0x6688aa, element:'water',     wepEffect:'-25% Target Def',                 armEffect:'Regen Mana 15%' },
  { id:6,  name:'Ith',   clvl:15, note:'F2',  freq:87.31,  tier:'low',    color:0xaabb99, element:'air',       wepEffect:'+9 Max Dmg',                      armEffect:'15% Dmg to Mana' },
  { id:7,  name:'Tal',   clvl:17, note:'F#2', freq:92.50,  tier:'low',    color:0x44aa44, element:'poison',    wepEffect:'+75 Poison Dmg / 5sec',           armEffect:'Poison Resist +30%' },
  { id:8,  name:'Ral',   clvl:19, note:'G2',  freq:98.00,  tier:'low',    color:0xff6622, element:'fire',      wepEffect:'+5-30 Fire Dmg',                  armEffect:'Fire Resist +30%' },
  { id:9,  name:'Ort',   clvl:21, note:'G#2', freq:103.83, tier:'low',    color:0xffff44, element:'lightning', wepEffect:'+1-50 Lightning Dmg',             armEffect:'Lightning Resist +30%' },
  { id:10, name:'Thul',  clvl:23, note:'A2',  freq:110.00, tier:'low',    color:0x4488ff, element:'cold',      wepEffect:'+3-14 Cold Dmg',                  armEffect:'Cold Resist +30%' },
  { id:11, name:'Amn',   clvl:25, note:'A#2', freq:116.54, tier:'mid',    color:0xcc8844, element:'life',      wepEffect:'7% Life Stolen',                  armEffect:'Attacker Takes Dmg 14' },
  { id:12, name:'Sol',   clvl:27, note:'B2',  freq:123.47, tier:'mid',    color:0xffaa00, element:'light',     wepEffect:'+9 Min Dmg',                      armEffect:'Dmg Reduced by 7' },
  { id:13, name:'Shael', clvl:29, note:'C3',  freq:130.81, tier:'mid',    color:0x88ddff, element:'speed',     wepEffect:'20% IAS',                         armEffect:'20% FHR / 20% FBR' },
  { id:14, name:'Dol',   clvl:31, note:'C#3', freq:138.59, tier:'mid',    color:0xaa4444, element:'fear',      wepEffect:'Hit Causes Monster Flee 25%',     armEffect:'Replenish Life +7' },
  { id:15, name:'Hel',   clvl:0,  note:'D3',  freq:146.83, tier:'mid',    color:0x444444, element:'void',      wepEffect:'Req -20%',                        armEffect:'Req -15%' },
  { id:16, name:'Io',    clvl:35, note:'D#3', freq:155.56, tier:'mid',    color:0x66aaff, element:'spirit',    wepEffect:'+10 Vitality',                    armEffect:'+10 Vitality' },
  { id:17, name:'Lum',   clvl:37, note:'E3',  freq:164.81, tier:'mid',    color:0xaaff88, element:'earth',     wepEffect:'+10 Energy',                      armEffect:'+10 Energy' },
  { id:18, name:'Ko',    clvl:39, note:'F3',  freq:174.61, tier:'mid',    color:0x88cc66, element:'air',       wepEffect:'+10 Dexterity',                   armEffect:'+10 Dexterity' },
  { id:19, name:'Fal',   clvl:41, note:'F#3', freq:185.00, tier:'mid',    color:0xddaa66, element:'earth',     wepEffect:'+10 Strength',                    armEffect:'+10 Strength' },
  { id:20, name:'Lem',   clvl:43, note:'G3',  freq:196.00, tier:'mid',    color:0xffcc44, element:'gold',      wepEffect:'75% Extra Gold',                  armEffect:'50% Extra Gold' },
  { id:21, name:'Pul',   clvl:45, note:'G#3', freq:207.65, tier:'high',   color:0xdd8844, element:'holy',      wepEffect:'+75% Dmg vs Demons, +100 AR vs Demons', armEffect:'+30% Def' },
  { id:22, name:'Um',    clvl:47, note:'A3',  freq:220.00, tier:'high',   color:0xcc6644, element:'resist',    wepEffect:'25% Open Wounds',                 armEffect:'All Res +15 / +22' },
  { id:23, name:'Mal',   clvl:49, note:'A#3', freq:233.08, tier:'high',   color:0xbb5555, element:'death',     wepEffect:'Prevent Monster Heal',            armEffect:'Magic Dmg Reduced 7' },
  { id:24, name:'Ist',   clvl:51, note:'B3',  freq:246.94, tier:'high',   color:0x44ccaa, element:'fortune',   wepEffect:'30% MF',                          armEffect:'25% MF' },
  { id:25, name:'Gul',   clvl:53, note:'C4',  freq:261.63, tier:'high',   color:0xaa4466, element:'blood',     wepEffect:'20% Bonus AR',                    armEffect:'5% Max Poison Res' },
  { id:26, name:'Vex',   clvl:55, note:'C#4', freq:277.18, tier:'high',   color:0x8866aa, element:'mana',      wepEffect:'7% Mana Stolen',                  armEffect:'5% Max Fire Res' },
  { id:27, name:'Ohm',   clvl:57, note:'D4',  freq:293.66, tier:'high',   color:0xffdd44, element:'power',     wepEffect:'+50% Enhanced Dmg',               armEffect:'5% Max Cold Res' },
  { id:28, name:'Lo',    clvl:59, note:'D#4', freq:311.13, tier:'high',   color:0xff8888, element:'death',     wepEffect:'20% Deadly Strike',               armEffect:'5% Max Lightning Res' },
  { id:29, name:'Sur',   clvl:61, note:'E4',  freq:329.63, tier:'ultra',  color:0x66aadd, element:'ice',       wepEffect:'Hit Blinds Target',               armEffect:'Max Mana 5% / +50 Mana' },
  { id:30, name:'Ber',   clvl:63, note:'F4',  freq:349.23, tier:'ultra',  color:0x886622, element:'earth',     wepEffect:'20% Crushing Blow',               armEffect:'Dmg Reduced 8%' },
  { id:31, name:'Jah',   clvl:65, note:'F#4', freq:369.99, tier:'ultra',  color:0xffffff, element:'holy',      wepEffect:'Ignore Target Def',               armEffect:'Increase Max Life 5% / +50 Life' },
  { id:32, name:'Cham',  clvl:67, note:'G4',  freq:392.00, tier:'ultra',  color:0x88eeff, element:'cold',      wepEffect:'Freeze Target +3',                armEffect:'Cannot Be Frozen' },
  { id:33, name:'Zod',   clvl:69, note:'G#4', freq:415.30, tier:'ultra',  color:0xff00ff, element:'chaos',     wepEffect:'Indestructible',                  armEffect:'Indestructible' }
];

// lookup by name
export const RUNE_MAP = {};
RUNES.forEach(r => { RUNE_MAP[r.name] = r; });

// tier colors for UI
export const TIER_COLORS = {
  low:   { bg: '#333', border: '#666', text: '#aaa',    glow: '#6668' },
  mid:   { bg: '#2a2a1a', border: '#886', text: '#cc8',  glow: '#cc84' },
  high:  { bg: '#2a1a1a', border: '#a64', text: '#fa4',  glow: '#fa44' },
  ultra: { bg: '#1a1a2a', border: '#a4f', text: '#c8f',  glow: '#c8f6' }
};

// element → color mapping
export const ELEMENT_COLORS = {
  fire: '#ff4422', lightning: '#ffff44', cold: '#4488ff', poison: '#44aa44',
  light: '#ffffff', earth: '#886644', air: '#88ffaa', water: '#4466cc',
  spirit: '#88aaff', life: '#ff8844', speed: '#88ddff', fear: '#aa4444',
  void: '#444444', gold: '#ffcc44', holy: '#ffffaa', resist: '#cc8844',
  death: '#aa2222', fortune: '#44ccaa', blood: '#aa4466', mana: '#8866cc',
  power: '#ffdd44', ice: '#aaeeff', chaos: '#ff00ff'
};

// get rune by name (case-insensitive)
export function getRune(name) {
  return RUNE_MAP[name] || RUNE_MAP[name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()];
}
