/* ═══════════════════════════════════════════════════════
   GAIA METRICS — Shared data fetching & metrics engine
   Import: <script type="module" src="metrics.js">
   ═══════════════════════════════════════════════════════ */

const PROXY = 'https://api.allorigins.win/raw?url=';

// ─── Metric store ───
export const metrics = {
  // Seismic
  earthquakes: [],
  eqMode: 'sim',
  // Solar wind
  solarSpeed: 380 + Math.random() * 100,
  solarDensity: 3 + Math.random() * 4,
  solarMode: 'sim',
  // Geomagnetic
  kpIndex: 1 + Math.floor(Math.random() * 3),
  kpMode: 'sim',
  // IMF
  bz: 0,
  bt: 5,
  bzHistory: new Float32Array(120).fill(0),
  bzPtr: 0,
  // Schumann
  schumann: 7.83,
  // Additional metrics
  uvIndex: 3 + Math.random() * 4,
  lightningRate: 40 + Math.random() * 60,   // strikes/sec global
  co2ppm: 424 + Math.random() * 2,
  seaLevel: 0,                                // mm anomaly
  cosmicRayFlux: 6500 + Math.random() * 500,  // neutron counts/min
  tidalForce: 0,
  f107Flux: 120 + Math.random() * 40,         // solar radio flux
  protonFlux: 0.5 + Math.random() * 2,        // >10 MeV protons
  hemisphereTemp: { north: 14.2, south: 13.8 },
  // Kappa
  kappa: (1 + Math.sqrt(5)) / 2,
  // Timestamps
  lastUpdate: Date.now(),
};

const events = [];
const listeners = new Set();

// ─── Subscribe to events ───
export function onEvent(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function addEvent(type, msg) {
  if (events.length && events[0].msg === msg) return;
  const entry = { type, msg, time: new Date().toLocaleTimeString() };
  events.unshift(entry);
  if (events.length > 20) events.pop();
  listeners.forEach(fn => fn(entry, events));
}

export function getEvents() { return events; }

// ─── USGS Earthquake Feed ───
export async function fetchEarthquakes() {
  try {
    const r = await fetch(PROXY + encodeURIComponent('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson'));
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    metrics.earthquakes = d.features.slice(0, 20).map(f => ({
      mag: f.properties.mag, place: f.properties.place || 'Unknown',
      lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0],
      depth: f.geometry.coordinates[2], time: f.properties.time
    }));
    metrics.eqMode = 'live';
    if (metrics.earthquakes.length) {
      const e = metrics.earthquakes[0];
      addEvent('earthquake', 'M' + e.mag.toFixed(1) + ' ' + (e.place || '').substring(0, 18));
    }
  } catch (e) {
    metrics.eqMode = 'sim';
    simEQ();
  }
}

// ─── NOAA Solar Wind Plasma ───
export async function fetchSolar() {
  try {
    const r = await fetch(PROXY + encodeURIComponent('https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json'));
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    if (d.length > 1) {
      const l = d[d.length - 1];
      metrics.solarSpeed = parseFloat(l[2]) || 400;
      metrics.solarDensity = parseFloat(l[1]) || 5;
      metrics.solarMode = 'live';
    }
  } catch (e) {
    metrics.solarMode = 'sim';
    simSolar();
  }
  if (metrics.solarSpeed > 580) addEvent('solar', 'Wind: ' + Math.round(metrics.solarSpeed) + ' km/s');
}

// ─── NOAA Kp Index ───
export async function fetchKp() {
  try {
    const r = await fetch(PROXY + encodeURIComponent('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'));
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    if (d.length > 1) { metrics.kpIndex = parseFloat(d[d.length - 1][1]) || 2; metrics.kpMode = 'live'; }
  } catch (e) {
    metrics.kpMode = 'sim';
    simKp();
  }
  if (metrics.kpIndex >= 5) addEvent('geomag', 'Storm Kp ' + metrics.kpIndex);
}

// ─── NOAA IMF / Magnetometer ───
export async function fetchMag() {
  try {
    const r = await fetch(PROXY + encodeURIComponent('https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json'));
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    if (d.length > 1) {
      const l = d[d.length - 1];
      metrics.bz = parseFloat(l[3]) || 0;
      metrics.bt = parseFloat(l[6]) || 5;
    }
  } catch (e) {
    metrics.bz += (Math.random() - 0.5) * 2;
    metrics.bz = Math.max(-20, Math.min(20, metrics.bz));
    metrics.bt = Math.abs(metrics.bz) + 3 + Math.random() * 3;
  }
  metrics.bzHistory[metrics.bzPtr] = metrics.bz;
  metrics.bzPtr = (metrics.bzPtr + 1) % metrics.bzHistory.length;
}

// ─── Derived: Schumann ───
export function updateSchumann() {
  metrics.schumann = 7.83 + (metrics.kpIndex - 2) * 0.03 + (metrics.solarSpeed - 400) / 3000 + (Math.random() - 0.5) * 0.12;
}

// ─── Derived: Planetary Kappa ───
const PHI = (1 + Math.sqrt(5)) / 2;
const KAPPA_STAR = 1 / PHI;
export const PHASES = [
  { key: 'FROZEN', icon: '\u{1f9ca}', range: [0, 0.1], color: 0xa8d8ea },
  { key: 'RIGID',  icon: '\u{1f3db}\ufe0f', range: [0.1, 0.4], color: 0x7ec8c8 },
  { key: 'STABLE', icon: '\u{1f30a}', range: [0.4, 0.55], color: 0x58b09c },
  { key: 'KONOMI', icon: '\u{1f338}', range: [0.55, 0.7], color: 0xf2a6b3 },
  { key: 'TURB',   icon: '\u{1f32a}\ufe0f', range: [0.7, 0.88], color: 0xe07a5f },
  { key: 'CHAOS',  icon: '\u{1f525}', range: [0.88, 1], color: 0xd62828 },
];

export function getPhase(k) {
  for (const p of PHASES) if (k >= p.range[0] && k < p.range[1]) return p;
  return PHASES[5];
}

export function computeKappa() {
  let k = KAPPA_STAR;
  const eE = metrics.earthquakes.reduce((s, e) => s + Math.pow(10, e.mag), 0);
  k += Math.min(0.12, (eE / 1e7) * 0.08);
  k += Math.min(0.1, ((metrics.solarSpeed - 300) / 500) * 0.08);
  k += (metrics.kpIndex / 9) * 0.1;
  k += Math.abs(metrics.schumann - 7.83) * 0.025;
  k += (metrics.protonFlux / 50) * 0.03;
  metrics.kappa = metrics.kappa * 0.93 + Math.max(0, Math.min(1, k)) * 0.07;
}

// ─── Additional metric sims ───
export function simAdditional() {
  metrics.uvIndex += (Math.random() - 0.5) * 0.3;
  metrics.uvIndex = Math.max(0, Math.min(12, metrics.uvIndex));
  metrics.lightningRate += (Math.random() - 0.5) * 8;
  metrics.lightningRate = Math.max(20, Math.min(150, metrics.lightningRate));
  metrics.co2ppm += (Math.random() - 0.5) * 0.05;
  metrics.cosmicRayFlux += (Math.random() - 0.5) * 50;
  metrics.cosmicRayFlux = Math.max(5000, Math.min(8000, metrics.cosmicRayFlux));
  metrics.f107Flux += (Math.random() - 0.5) * 3;
  metrics.f107Flux = Math.max(60, Math.min(300, metrics.f107Flux));
  metrics.protonFlux += (Math.random() - 0.5) * 0.2;
  metrics.protonFlux = Math.max(0.1, Math.min(100, metrics.protonFlux));
  metrics.tidalForce = Math.sin(Date.now() / 44700000 * Math.PI * 2) * 0.5; // ~12.4h cycle
  metrics.seaLevel = Math.sin(Date.now() / 44700000 * Math.PI * 2) * 180; // mm
  if (metrics.uvIndex >= 8) addEvent('uv', 'UV Index: ' + metrics.uvIndex.toFixed(1) + ' (High)');
  if (metrics.lightningRate > 110) addEvent('lightning', Math.round(metrics.lightningRate) + ' strikes/s global');
}

// ─── Simulation fallbacks ───
function simEQ() {
  if (Math.random() > 0.6) {
    const mag = 2.5 + Math.random() * 4;
    const places = ['Pacific Ridge', 'Chile', 'Japan', 'Indonesia', 'Alaska', 'California', 'Peru', 'Tonga', 'Mexico', 'Turkey'];
    const eq = { mag, place: places[Math.floor(Math.random() * places.length)], lat: (Math.random() - 0.5) * 140, lon: (Math.random() - 0.5) * 360, depth: 10 + Math.random() * 300, time: Date.now() };
    metrics.earthquakes.unshift(eq);
    if (metrics.earthquakes.length > 20) metrics.earthquakes.pop();
    addEvent('earthquake', 'M' + mag.toFixed(1) + ' ' + eq.place);
  }
}

function simSolar() {
  metrics.solarSpeed += (Math.random() - 0.5) * 25;
  metrics.solarSpeed = Math.max(280, Math.min(750, metrics.solarSpeed));
  metrics.solarDensity += (Math.random() - 0.5) * 1.5;
  metrics.solarDensity = Math.max(1, Math.min(18, metrics.solarDensity));
}

function simKp() {
  if (Math.random() > 0.75) {
    metrics.kpIndex += Math.random() > 0.5 ? 1 : -1;
    metrics.kpIndex = Math.max(0, Math.min(9, metrics.kpIndex));
  }
}

// ─── Aurora probability ───
export function auroraProbability() {
  let prob = 0;
  if (metrics.bz < 0) prob += Math.min(40, Math.abs(metrics.bz) * 4);
  prob += Math.min(30, (metrics.solarSpeed - 300) / 500 * 30);
  prob += Math.min(20, (metrics.kpIndex / 9) * 20);
  prob += Math.min(10, (metrics.solarDensity - 3) / 15 * 10);
  return Math.max(0, Math.min(100, Math.round(prob)));
}

// ─── Master refresh ───
export async function refreshAll() {
  await Promise.all([fetchEarthquakes(), fetchSolar(), fetchKp(), fetchMag()]);
  updateSchumann();
  simAdditional();
  computeKappa();
  metrics.lastUpdate = Date.now();
}

// ─── Tick (between fetches) ───
export function tick() {
  if (metrics.solarMode === 'sim') simSolar();
  if (metrics.kpMode === 'sim') simKp();
  updateSchumann();
  simAdditional();
  computeKappa();
}

// ─── Auto-start polling ───
export function startPolling(fetchInterval = 75000, tickInterval = 6000) {
  refreshAll();
  setInterval(refreshAll, fetchInterval);
  setInterval(tick, tickInterval);
  setInterval(() => {
    if (metrics.eqMode === 'sim' && Math.random() > 0.5) simEQ();
  }, 18000);
}

// ─── Lat/Lon to 3D position ───
export function latLonToVec3(THREE, lat, lon, radius) {
  const ph = (90 - lat) * Math.PI / 180;
  const th = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(
    radius * Math.sin(ph) * Math.cos(th),
    radius * Math.cos(ph),
    radius * Math.sin(ph) * Math.sin(th)
  );
}