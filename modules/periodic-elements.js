// periodic-elements.js — All 118 elements of the periodic table
// Each element: atomic number, symbol, name, group, period, category, mass, phase, color
// Audio mapping: each element has a note based on its atomic number (chromatic across 10 octaves)
// Electronegativity, density, melting/boiling points for sonification parameters

const CATEGORIES = {
  'alkali-metal':       { color: '#ff6644', label: 'Alkali Metal' },
  'alkaline-earth':     { color: '#ffaa22', label: 'Alkaline Earth' },
  'transition-metal':   { color: '#ffcc44', label: 'Transition Metal' },
  'post-transition':    { color: '#66cc66', label: 'Post-Transition Metal' },
  'metalloid':          { color: '#44ccaa', label: 'Metalloid' },
  'nonmetal':           { color: '#44aaff', label: 'Reactive Nonmetal' },
  'noble-gas':          { color: '#aa88ff', label: 'Noble Gas' },
  'lanthanide':         { color: '#ff88cc', label: 'Lanthanide' },
  'actinide':           { color: '#cc88ff', label: 'Actinide' },
  'unknown':            { color: '#888888', label: 'Unknown Properties' }
};

// Note calculation: map atomic number 1-118 across chromatic scale
// We use C1 (32.7 Hz) as base, spanning ~10 octaves
function calcNote(z) {
  const semitone = (z - 1) % 12;
  const octave = Math.floor((z - 1) / 12) + 1;
  const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const name = noteNames[semitone] + octave;
  const freq = 32.70 * Math.pow(2, (z - 1) / 12);
  return { name, freq };
}

// Build all 118 elements
// Format: [Z, symbol, name, group, period, category, mass, phase, electronegativity, density, melt, boil]
// phase: s=solid, l=liquid, g=gas  |  group 0 = lanthanide/actinide row
const RAW = [
  [1,'H','Hydrogen',1,1,'nonmetal',1.008,'g',2.20,0.00009,-259,-253],
  [2,'He','Helium',18,1,'noble-gas',4.003,'g',null,0.00018,-272,-269],
  [3,'Li','Lithium',1,2,'alkali-metal',6.941,'s',0.98,0.534,181,1342],
  [4,'Be','Beryllium',2,2,'alkaline-earth',9.012,'s',1.57,1.85,1287,2470],
  [5,'B','Boron',13,2,'metalloid',10.81,'s',2.04,2.34,2075,4000],
  [6,'C','Carbon',14,2,'nonmetal',12.01,'s',2.55,2.27,3550,4027],
  [7,'N','Nitrogen',15,2,'nonmetal',14.01,'g',3.04,0.0013,-210,-196],
  [8,'O','Oxygen',16,2,'nonmetal',16.00,'g',3.44,0.0014,-218,-183],
  [9,'F','Fluorine',17,2,'nonmetal',19.00,'g',3.98,0.0017,-220,-188],
  [10,'Ne','Neon',18,2,'noble-gas',20.18,'g',null,0.0009,-249,-246],
  [11,'Na','Sodium',1,3,'alkali-metal',22.99,'s',0.93,0.971,98,883],
  [12,'Mg','Magnesium',2,3,'alkaline-earth',24.31,'s',1.31,1.738,650,1090],
  [13,'Al','Aluminium',13,3,'post-transition',26.98,'s',1.61,2.698,660,2519],
  [14,'Si','Silicon',14,3,'metalloid',28.09,'s',1.90,2.329,1414,3265],
  [15,'P','Phosphorus',15,3,'nonmetal',30.97,'s',2.19,1.82,44,281],
  [16,'S','Sulfur',16,3,'nonmetal',32.07,'s',2.58,2.067,115,445],
  [17,'Cl','Chlorine',17,3,'nonmetal',35.45,'g',3.16,0.0032,-101,-34],
  [18,'Ar','Argon',18,3,'noble-gas',39.95,'g',null,0.0018,-189,-186],
  [19,'K','Potassium',1,4,'alkali-metal',39.10,'s',0.82,0.862,64,759],
  [20,'Ca','Calcium',2,4,'alkaline-earth',40.08,'s',1.00,1.55,842,1484],
  [21,'Sc','Scandium',3,4,'transition-metal',44.96,'s',1.36,2.989,1541,2836],
  [22,'Ti','Titanium',4,4,'transition-metal',47.87,'s',1.54,4.54,1668,3287],
  [23,'V','Vanadium',5,4,'transition-metal',50.94,'s',1.63,6.11,1910,3407],
  [24,'Cr','Chromium',6,4,'transition-metal',52.00,'s',1.66,7.15,1907,2671],
  [25,'Mn','Manganese',7,4,'transition-metal',54.94,'s',1.55,7.44,1246,2061],
  [26,'Fe','Iron',8,4,'transition-metal',55.85,'s',1.83,7.874,1538,2861],
  [27,'Co','Cobalt',9,4,'transition-metal',58.93,'s',1.88,8.9,1495,2927],
  [28,'Ni','Nickel',10,4,'transition-metal',58.69,'s',1.91,8.908,1455,2913],
  [29,'Cu','Copper',11,4,'transition-metal',63.55,'s',1.90,8.96,1085,2562],
  [30,'Zn','Zinc',12,4,'transition-metal',65.38,'s',1.65,7.134,420,907],
  [31,'Ga','Gallium',13,4,'post-transition',69.72,'s',1.81,5.907,30,2204],
  [32,'Ge','Germanium',14,4,'metalloid',72.63,'s',2.01,5.323,938,2833],
  [33,'As','Arsenic',15,4,'metalloid',74.92,'s',2.18,5.776,817,614],
  [34,'Se','Selenium',16,4,'nonmetal',78.97,'s',2.55,4.809,221,685],
  [35,'Br','Bromine',17,4,'nonmetal',79.90,'l',2.96,3.122,-7,59],
  [36,'Kr','Krypton',18,4,'noble-gas',83.80,'g',3.00,0.0037,-157,-153],
  [37,'Rb','Rubidium',1,5,'alkali-metal',85.47,'s',0.82,1.532,39,688],
  [38,'Sr','Strontium',2,5,'alkaline-earth',87.62,'s',0.95,2.64,777,1382],
  [39,'Y','Yttrium',3,5,'transition-metal',88.91,'s',1.22,4.469,1526,3345],
  [40,'Zr','Zirconium',4,5,'transition-metal',91.22,'s',1.33,6.506,1855,4409],
  [41,'Nb','Niobium',5,5,'transition-metal',92.91,'s',1.6,8.57,2477,4744],
  [42,'Mo','Molybdenum',6,5,'transition-metal',95.95,'s',2.16,10.22,2623,4639],
  [43,'Tc','Technetium',7,5,'transition-metal',98,'s',1.9,11.5,2157,4265],
  [44,'Ru','Ruthenium',8,5,'transition-metal',101.1,'s',2.2,12.37,2334,4150],
  [45,'Rh','Rhodium',9,5,'transition-metal',102.9,'s',2.28,12.41,1964,3695],
  [46,'Pd','Palladium',10,5,'transition-metal',106.4,'s',2.20,12.02,1555,2963],
  [47,'Ag','Silver',11,5,'transition-metal',107.9,'s',1.93,10.501,962,2162],
  [48,'Cd','Cadmium',12,5,'transition-metal',112.4,'s',1.69,8.65,321,767],
  [49,'In','Indium',13,5,'post-transition',114.8,'s',1.78,7.31,157,2072],
  [50,'Sn','Tin',14,5,'post-transition',118.7,'s',1.96,7.287,232,2602],
  [51,'Sb','Antimony',15,5,'metalloid',121.8,'s',2.05,6.685,631,1587],
  [52,'Te','Tellurium',16,5,'metalloid',127.6,'s',2.1,6.232,450,988],
  [53,'I','Iodine',17,5,'nonmetal',126.9,'s',2.66,4.93,114,184],
  [54,'Xe','Xenon',18,5,'noble-gas',131.3,'g',2.60,0.0059,-112,-108],
  [55,'Cs','Caesium',1,6,'alkali-metal',132.9,'s',0.79,1.873,28,671],
  [56,'Ba','Barium',2,6,'alkaline-earth',137.3,'s',0.89,3.594,727,1845],
  [57,'La','Lanthanum',3,6,'lanthanide',138.9,'s',1.10,6.145,920,3464],
  [58,'Ce','Cerium',0,6,'lanthanide',140.1,'s',1.12,6.77,795,3443],
  [59,'Pr','Praseodymium',0,6,'lanthanide',140.9,'s',1.13,6.773,931,3520],
  [60,'Nd','Neodymium',0,6,'lanthanide',144.2,'s',1.14,7.007,1016,3074],
  [61,'Pm','Promethium',0,6,'lanthanide',145,'s',1.13,7.26,1042,3000],
  [62,'Sm','Samarium',0,6,'lanthanide',150.4,'s',1.17,7.52,1072,1794],
  [63,'Eu','Europium',0,6,'lanthanide',152.0,'s',1.2,5.243,822,1529],
  [64,'Gd','Gadolinium',0,6,'lanthanide',157.3,'s',1.2,7.895,1313,3273],
  [65,'Tb','Terbium',0,6,'lanthanide',158.9,'s',1.1,8.229,1356,3230],
  [66,'Dy','Dysprosium',0,6,'lanthanide',162.5,'s',1.22,8.55,1412,2567],
  [67,'Ho','Holmium',0,6,'lanthanide',164.9,'s',1.23,8.795,1474,2700],
  [68,'Er','Erbium',0,6,'lanthanide',167.3,'s',1.24,9.066,1529,2868],
  [69,'Tm','Thulium',0,6,'lanthanide',168.9,'s',1.25,9.321,1545,1950],
  [70,'Yb','Ytterbium',0,6,'lanthanide',173.0,'s',1.1,6.965,824,1196],
  [71,'Lu','Lutetium',0,6,'lanthanide',175.0,'s',1.27,9.84,1663,3402],
  [72,'Hf','Hafnium',4,6,'transition-metal',178.5,'s',1.3,13.31,2233,4603],
  [73,'Ta','Tantalum',5,6,'transition-metal',180.9,'s',1.5,16.654,3017,5458],
  [74,'W','Tungsten',6,6,'transition-metal',183.8,'s',2.36,19.25,3422,5555],
  [75,'Re','Rhenium',7,6,'transition-metal',186.2,'s',1.9,21.02,3186,5596],
  [76,'Os','Osmium',8,6,'transition-metal',190.2,'s',2.2,22.587,3033,5012],
  [77,'Ir','Iridium',9,6,'transition-metal',192.2,'s',2.20,22.56,2446,4428],
  [78,'Pt','Platinum',10,6,'transition-metal',195.1,'s',2.28,21.46,1768,3825],
  [79,'Au','Gold',11,6,'transition-metal',197.0,'s',2.54,19.282,1064,2856],
  [80,'Hg','Mercury',12,6,'transition-metal',200.6,'l',2.00,13.5336,-39,357],
  [81,'Tl','Thallium',13,6,'post-transition',204.4,'s',1.62,11.85,304,1473],
  [82,'Pb','Lead',14,6,'post-transition',207.2,'s',1.87,11.342,327,1749],
  [83,'Bi','Bismuth',15,6,'post-transition',209.0,'s',2.02,9.807,271,1564],
  [84,'Po','Polonium',16,6,'post-transition',209,'s',2.0,9.32,254,962],
  [85,'At','Astatine',17,6,'metalloid',210,'s',2.2,7,302,337],
  [86,'Rn','Radon',18,6,'noble-gas',222,'g',2.2,0.0097,-71,-62],
  [87,'Fr','Francium',1,7,'alkali-metal',223,'s',0.7,1.87,27,677],
  [88,'Ra','Radium',2,7,'alkaline-earth',226,'s',0.9,5.5,696,1737],
  [89,'Ac','Actinium',3,7,'actinide',227,'s',1.1,10.07,1050,3198],
  [90,'Th','Thorium',0,7,'actinide',232.0,'s',1.3,11.72,1750,4788],
  [91,'Pa','Protactinium',0,7,'actinide',231.0,'s',1.5,15.37,1572,4027],
  [92,'U','Uranium',0,7,'actinide',238.0,'s',1.38,18.95,1135,4131],
  [93,'Np','Neptunium',0,7,'actinide',237,'s',1.36,20.45,644,3902],
  [94,'Pu','Plutonium',0,7,'actinide',244,'s',1.28,19.84,640,3228],
  [95,'Am','Americium',0,7,'actinide',243,'s',1.13,13.69,1176,2011],
  [96,'Cm','Curium',0,7,'actinide',247,'s',1.28,13.51,1345,3110],
  [97,'Bk','Berkelium',0,7,'actinide',247,'s',1.3,14.79,1050,2627],
  [98,'Cf','Californium',0,7,'actinide',251,'s',1.3,15.1,900,1472],
  [99,'Es','Einsteinium',0,7,'actinide',252,'s',1.3,8.84,860,996],
  [100,'Fm','Fermium',0,7,'actinide',257,'s',1.3,null,1527,null],
  [101,'Md','Mendelevium',0,7,'actinide',258,'s',1.3,null,827,null],
  [102,'No','Nobelium',0,7,'actinide',259,'s',1.3,null,827,null],
  [103,'Lr','Lawrencium',0,7,'actinide',266,'s',1.3,null,1627,null],
  [104,'Rf','Rutherfordium',4,7,'transition-metal',267,'s',null,null,null,null],
  [105,'Db','Dubnium',5,7,'transition-metal',268,'s',null,null,null,null],
  [106,'Sg','Seaborgium',6,7,'transition-metal',269,'s',null,null,null,null],
  [107,'Bh','Bohrium',7,7,'transition-metal',270,'s',null,null,null,null],
  [108,'Hs','Hassium',8,7,'transition-metal',277,'s',null,null,null,null],
  [109,'Mt','Meitnerium',9,7,'unknown',278,'s',null,null,null,null],
  [110,'Ds','Darmstadtium',10,7,'unknown',281,'s',null,null,null,null],
  [111,'Rg','Roentgenium',11,7,'unknown',282,'s',null,null,null,null],
  [112,'Cn','Copernicium',12,7,'unknown',285,'l',null,null,null,null],
  [113,'Nh','Nihonium',13,7,'unknown',286,'s',null,null,null,null],
  [114,'Fl','Flerovium',14,7,'unknown',289,'s',null,null,null,null],
  [115,'Mc','Moscovium',15,7,'unknown',290,'s',null,null,null,null],
  [116,'Lv','Livermorium',16,7,'unknown',293,'s',null,null,null,null],
  [117,'Ts','Tennessine',17,7,'unknown',294,'s',null,null,null,null],
  [118,'Og','Oganesson',18,7,'noble-gas',294,'g',null,null,null,null]
];

export const ELEMENTS = RAW.map(r => {
  const noteInfo = calcNote(r[0]);
  return {
    z: r[0], symbol: r[1], name: r[2], group: r[3], period: r[4],
    category: r[5], mass: r[6], phase: r[7],
    electronegativity: r[8], density: r[9], melt: r[10], boil: r[11],
    note: noteInfo.name, freq: noteInfo.freq,
    color: CATEGORIES[r[5]].color, catLabel: CATEGORIES[r[5]].label
  };
});

// lookup maps
export const BY_Z = {};
export const BY_SYMBOL = {};
export const BY_NAME = {};
ELEMENTS.forEach(el => {
  BY_Z[el.z] = el;
  BY_SYMBOL[el.symbol] = el;
  BY_NAME[el.name.toLowerCase()] = el;
});

export { CATEGORIES };

// helpers
export function getElement(query) {
  if (typeof query === 'number') return BY_Z[query];
  const q = query.trim();
  return BY_SYMBOL[q] || BY_SYMBOL[q.charAt(0).toUpperCase() + q.slice(1).toLowerCase()]
    || BY_NAME[q.toLowerCase()];
}

export function byCategory(cat) { return ELEMENTS.filter(el => el.category === cat); }
export function byPeriod(p) { return ELEMENTS.filter(el => el.period === p); }
export function byGroup(g) { return ELEMENTS.filter(el => el.group === g); }
export function byPhase(ph) { return ELEMENTS.filter(el => el.phase === ph); }

export function search(query) {
  const q = query.toLowerCase();
  return ELEMENTS.filter(el =>
    el.name.toLowerCase().includes(q) ||
    el.symbol.toLowerCase().includes(q) ||
    el.catLabel.toLowerCase().includes(q) ||
    String(el.z) === q
  );
}

// grid position for standard periodic table layout
export function gridPosition(el) {
  // lanthanides/actinides (group 0) go in separate rows
  if (el.group === 0) {
    if (el.category === 'lanthanide') {
      return { col: 3 + (el.z - 58), row: 9 };
    } else {
      return { col: 3 + (el.z - 90), row: 10 };
    }
  }
  return { col: el.group, row: el.period };
}
