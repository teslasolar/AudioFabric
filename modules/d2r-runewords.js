// d2r-runewords.js — Complete D2R runeword database
// Each runeword: name, runes (in order), item types, clvl, sockets, category
// Includes Patch 2.4, 2.6 (Mosaic), and Reign of the Warlock expansion runewords

// Categories: weapon, armor, helm, shield, missile, claw, staff, scepter, polearm, grimoire
// r = rune names array, t = item types, l = clvl, s = sockets, c = category tag

export const RUNEWORDS = [
  // === 2-SOCKET ===
  { name:'Steel',       r:['Tir','El'],          t:'Swords/Axes/Maces', l:13, s:2, c:'weapon' },
  { name:'Nadir',       r:['Nef','Tir'],          t:'Helms',             l:13, s:2, c:'helm' },
  { name:'Leaf',        r:['Tir','Ral'],          t:'Staves',            l:19, s:2, c:'staff' },
  { name:'Zephyr',      r:['Ort','Eth'],          t:'Missile Weapons',   l:21, s:2, c:'missile' },
  { name:'Strength',    r:['Amn','Tir'],          t:'Melee Weapons',     l:25, s:2, c:'weapon' },
  { name:'Lore',        r:['Ort','Sol'],          t:'Helms',             l:27, s:2, c:'helm' },
  { name:'Rhyme',       r:['Shael','Eth'],        t:'Shields',           l:29, s:2, c:'shield' },
  { name:'White',       r:['Dol','Io'],           t:'Wands',             l:35, s:2, c:'weapon' },
  { name:'Stealth',     r:['Tal','Eth'],          t:'Body Armor',        l:17, s:2, c:'armor' },
  { name:'Smoke',       r:['Nef','Lum'],          t:'Body Armor',        l:37, s:2, c:'armor' },
  { name:'Splendor',    r:['Eth','Lum'],          t:'Shields',           l:37, s:2, c:'shield' },
  { name:'Prudence',    r:['Mal','Tir'],          t:'Body Armor',        l:49, s:2, c:'armor' },
  { name:'Wind',        r:['Sur','El'],           t:'Melee Weapons',     l:61, s:2, c:'weapon' },

  // === 3-SOCKET ===
  { name:'Malice',      r:['Ith','El','Eth'],     t:'Melee Weapons',     l:15, s:3, c:'weapon' },
  { name:'Ancient\'s Pledge', r:['Ral','Ort','Tal'], t:'Shields',        l:21, s:3, c:'shield' },
  { name:'Edge',        r:['Tir','Tal','Amn'],    t:'Missile Weapons',   l:25, s:3, c:'missile' },
  { name:'King\'s Grace', r:['Amn','Ral','Thul'], t:'Swords/Scepters',   l:25, s:3, c:'weapon' },
  { name:'Radiance',    r:['Nef','Sol','Ith'],    t:'Helms',             l:27, s:3, c:'helm' },
  { name:'Pattern',     r:['Tal','Ort','Thul'],   t:'Claws',             l:23, s:3, c:'claw' },
  { name:'Peace',       r:['Shael','Thul','Amn'], t:'Body Armor',        l:29, s:3, c:'armor' },
  { name:'Myth',        r:['Hel','Amn','Nef'],    t:'Body Armor',        l:25, s:3, c:'armor' },
  { name:'Black',       r:['Thul','Io','Nef'],    t:'Clubs/Hammers/Maces', l:35, s:3, c:'weapon' },
  { name:'Fury',        r:['Jah','Gul','Eth'],    t:'Melee Weapons',     l:65, s:3, c:'weapon' },
  { name:'Melody',      r:['Shael','Ko','Nef'],   t:'Missile Weapons',   l:39, s:3, c:'missile' },
  { name:'Treachery',   r:['Shael','Thul','Lem'], t:'Body Armor',        l:43, s:3, c:'armor' },
  { name:'Wealth',      r:['Lem','Ko','Tir'],     t:'Body Armor',        l:43, s:3, c:'armor' },
  { name:'Crescent Moon', r:['Shael','Um','Tir'], t:'Axes/Swords/Polearms', l:47, s:3, c:'weapon' },
  { name:'Duress',      r:['Shael','Um','Thul'],  t:'Body Armor',        l:47, s:3, c:'armor' },
  { name:'Venom',       r:['Tal','Dol','Mal'],    t:'Weapons',           l:49, s:3, c:'weapon' },
  { name:'Gloom',       r:['Fal','Um','Pul'],     t:'Body Armor',        l:47, s:3, c:'armor' },
  { name:'Rain',        r:['Ort','Mal','Ith'],    t:'Body Armor',        l:49, s:3, c:'armor' },
  { name:'Bone',        r:['Sol','Um','Um'],       t:'Body Armor',        l:47, s:3, c:'armor' },
  { name:'Enigma',      r:['Jah','Ith','Ber'],    t:'Body Armor',        l:65, s:3, c:'armor' },
  { name:'Dragon',      r:['Sur','Lo','Sol'],     t:'Body Armor/Shields', l:61, s:3, c:'armor' },
  { name:'Dream',       r:['Io','Jah','Pul'],     t:'Helms/Shields',     l:65, s:3, c:'helm' },
  { name:'Lionheart',   r:['Hel','Lum','Fal'],   t:'Body Armor',        l:41, s:3, c:'armor' },
  { name:'Lawbringer',  r:['Amn','Lem','Ko'],     t:'Swords/Hammers/Scepters', l:43, s:3, c:'weapon' },
  { name:'Sanctuary',   r:['Ko','Ko','Mal'],      t:'Shields',           l:49, s:3, c:'shield' },
  { name:'Delirium',    r:['Lem','Ist','Io'],     t:'Helms',             l:51, s:3, c:'helm' },
  { name:'Chaos',       r:['Fal','Ohm','Um'],     t:'Claws',             l:57, s:3, c:'claw' },
  { name:'Plague',      r:['Cham','Shael','Um'],  t:'Swords/Claws/Daggers', l:67, s:3, c:'weapon' },
  { name:'Flickering Flame', r:['Nef','Pul','Vex'], t:'Helms',           l:55, s:3, c:'helm' },
  { name:'Wisdom',      r:['Pul','Ith','Eld'],    t:'Helms',             l:45, s:3, c:'helm' },
  { name:'Authority',   r:['Hel','Shael','Ral'],  t:'Grimoires',         l:29, s:3, c:'grimoire' },

  // === 4-SOCKET ===
  { name:'Holy Thunder', r:['Eth','Ral','Ort','Tal'], t:'Scepters',      l:21, s:4, c:'scepter' },
  { name:'Spirit',      r:['Tal','Thul','Ort','Amn'], t:'Swords/Shields', l:25, s:4, c:'weapon' },
  { name:'Insight',     r:['Ral','Tir','Tal','Sol'],  t:'Polearms/Staves/Bows', l:27, s:4, c:'polearm' },
  { name:'Passion',     r:['Dol','Ort','Eld','Lem'],  t:'Weapons',       l:43, s:4, c:'weapon' },
  { name:'Stone',       r:['Shael','Um','Pul','Lum'], t:'Body Armor',    l:47, s:4, c:'armor' },
  { name:'Voice of Reason', r:['Lem','Ko','El','Eld'], t:'Swords/Maces', l:43, s:4, c:'weapon' },
  { name:'Heart of the Oak', r:['Ko','Vex','Pul','Thul'], t:'Staves/Maces', l:55, s:4, c:'weapon' },
  { name:'Oath',        r:['Shael','Pul','Mal','Lum'], t:'Swords/Axes/Maces', l:49, s:4, c:'weapon' },
  { name:'Chains of Honor', r:['Dol','Um','Ber','Ist'], t:'Body Armor',  l:63, s:4, c:'armor' },
  { name:'Bramble',     r:['Ral','Ohm','Sur','Eth'],  t:'Body Armor',    l:61, s:4, c:'armor' },
  { name:'Fortitude',   r:['El','Sol','Dol','Lo'],    t:'Weapons/Armor', l:59, s:4, c:'armor' },
  { name:'Faith',       r:['Ohm','Jah','Lem','Eld'],  t:'Missile Weapons', l:65, s:4, c:'missile' },
  { name:'Ice',         r:['Amn','Shael','Jah','Lo'], t:'Missile Weapons', l:65, s:4, c:'missile' },
  { name:'Wrath',       r:['Pul','Lum','Ber','Mal'],  t:'Missile Weapons', l:63, s:4, c:'missile' },
  { name:'Brand',       r:['Jah','Lo','Mal','Gul'],   t:'Missile Weapons', l:65, s:4, c:'missile' },
  { name:'Infinity',    r:['Ber','Mal','Ber','Ist'],   t:'Polearms/Spears', l:63, s:4, c:'polearm' },
  { name:'Pride',       r:['Cham','Sur','Io','Lo'],    t:'Polearms/Spears', l:67, s:4, c:'polearm' },
  { name:'Phoenix',     r:['Vex','Vex','Lo','Jah'],    t:'Weapons/Shields', l:65, s:4, c:'weapon' },
  { name:'Exile',       r:['Vex','Ohm','Ist','Dol'],   t:'Paladin Shields', l:57, s:4, c:'shield' },
  { name:'Famine',      r:['Fal','Ohm','Ort','Jah'],   t:'Axes/Hammers', l:65, s:4, c:'weapon' },
  { name:'Hand of Justice', r:['Sur','Cham','Amn','Lo'], t:'Weapons',     l:67, s:4, c:'weapon' },
  { name:'Mosaic',      r:['Mal','Gul','Amn','Cham'],  t:'Claws',         l:67, s:4, c:'claw' },
  { name:'Doom',        r:['Hel','Ohm','Um','Lo','Cham'], t:'Axes/Polearms/Hammers', l:67, s:5, c:'weapon' },

  // === 5-SOCKET ===
  { name:'Honor',       r:['Amn','El','Ith','Tir','Sol'], t:'Melee Weapons', l:27, s:5, c:'weapon' },
  { name:'Obedience',   r:['Hel','Ko','Thul','Eth','Fal'], t:'Polearms/Spears', l:41, s:5, c:'polearm' },
  { name:'Call to Arms', r:['Amn','Ral','Mal','Ist','Ohm'], t:'Weapons',  l:57, s:5, c:'weapon' },
  { name:'Grief',       r:['Eth','Tir','Lo','Mal','Ral'],  t:'Swords/Axes', l:59, s:5, c:'weapon' },
  { name:'Death',       r:['Hel','El','Vex','Ort','Gul'],  t:'Swords/Axes', l:55, s:5, c:'weapon' },
  { name:'Destruction', r:['Vex','Lo','Ber','Jah','Ko'],   t:'Polearms/Swords', l:65, s:5, c:'weapon' },
  { name:'Eternity',    r:['Amn','Ber','Ist','Sol','Sur'],  t:'Melee Weapons', l:63, s:5, c:'weapon' },
  { name:'Mist',        r:['Cham','Shael','Gul','Thul','Ith'], t:'Missile Weapons', l:67, s:5, c:'missile' },

  // === 6-SOCKET ===
  { name:'Silence',     r:['Dol','Eld','Hel','Ist','Tir','Vex'], t:'Weapons', l:55, s:6, c:'weapon' },
  { name:'Breath of the Dying', r:['Vex','Hel','El','Eld','Zod','Eth'], t:'Weapons', l:69, s:6, c:'weapon' },
  { name:'Last Wish',   r:['Jah','Mal','Jah','Sur','Jah','Ber'], t:'Swords/Hammers/Axes', l:65, s:6, c:'weapon' },
  { name:'Obsession',   r:['Zod','Ist','Lem','Lum','Io','Nef'],  t:'Staves',  l:69, s:6, c:'staff' },
  { name:'Unbending Will', r:['Fal','Io','Ith','Eld','El','Hel'], t:'Swords', l:41, s:6, c:'weapon' },

  // === REIGN OF THE WARLOCK (new expansion) ===
  { name:'Vigilance',   r:['Io','El','Eld'],      t:'Shields/Off-Hands', l:35, s:3, c:'shield' },
  { name:'Void',        r:['Lem','Pul','Thul'],   t:'Grimoires',         l:45, s:3, c:'grimoire' },
  { name:'Ritual',      r:['Fal','Io','Hel','Ko'], t:'Daggers/Grimoires', l:41, s:4, c:'weapon' },
  { name:'Mania',       r:['Gul','Ist','Mal'],    t:'Grimoires',         l:53, s:3, c:'grimoire' },
  { name:'Hysteria',    r:['Ohm','Sur','Lo'],     t:'Grimoires',         l:61, s:3, c:'grimoire' }
];

// index by name
export const RUNEWORD_MAP = {};
RUNEWORDS.forEach(rw => { RUNEWORD_MAP[rw.name] = rw; });

// filter helpers
export function byCategory(cat) { return RUNEWORDS.filter(rw => rw.c === cat); }
export function bySockets(n)    { return RUNEWORDS.filter(rw => rw.s === n); }
export function byLevel(min, max) { return RUNEWORDS.filter(rw => rw.l >= min && rw.l <= max); }
export function byRune(runeName) {
  return RUNEWORDS.filter(rw => rw.r.includes(runeName));
}
export function search(query) {
  const q = query.toLowerCase();
  return RUNEWORDS.filter(rw =>
    rw.name.toLowerCase().includes(q) ||
    rw.t.toLowerCase().includes(q) ||
    rw.r.some(r => r.toLowerCase().includes(q))
  );
}
