/* ═══════════════════════════════════════════════════════
   GAIA METRICS — Shared data fetching & metrics engine
   All NOAA SWPC / USGS / NASA endpoints wired up live
   Import: <script type="module" src="metrics.js">
   ═══════════════════════════════════════════════════════ */

const PROXY = 'https://api.allorigins.win/raw?url=';

// ─── Metric store ───
export const metrics = {
  // ── Seismic (USGS) ──
  earthquakes: [],
  eqMode: 'sim',

  // ── Solar Wind Plasma (NOAA DSCOVR) ──
  solarSpeed: 380 + Math.random() * 100,
  solarDensity: 3 + Math.random() * 4,
  solarTemp: 80000 + Math.random() * 40000,  // Kelvin
  solarMode: 'sim',

  // ── Geomagnetic Kp (NOAA) ──
  kpIndex: 1 + Math.floor(Math.random() * 3),
  kpMode: 'sim',

  // ── IMF / Magnetometer (NOAA DSCOVR) ──
  bz: 0,
  bt: 5,
  bx: 0,
  by: 0,
  bzHistory: new Float32Array(120).fill(0),
  bzPtr: 0,
  magMode: 'sim',

  // ── Dst Index (Kyoto via NOAA) ──
  dst: -10,
  dstHistory: new Float32Array(48).fill(-10),
  dstPtr: 0,
  dstMode: 'sim',

  // ── X-ray Flux (GOES) ──
  xrayFluxShort: 1e-8,   // 0.05-0.4nm
  xrayFluxLong: 1e-7,    // 0.1-0.8nm
  xrayClass: 'A1.0',
  xrayMode: 'sim',

  // ── Solar Flares (GOES) ──
  latestFlare: null,        // { class, begin, max, end }
  flareMode: 'sim',

  // ── Proton Flux (GOES >=10 MeV) ──
  protonFlux: 0.5 + Math.random() * 2,
  protonFlux100: 0.1,     // >=100 MeV
  protonMode: 'sim',

  // ── Electron Flux (GOES >=2 MeV) ──
  electronFlux: 500 + Math.random() * 200,
  electronMode: 'sim',

  // ── Solar Radio F10.7 (NOAA) ──
  f107Flux: 120 + Math.random() * 40,
  f107Mode: 'sim',

  // ── Sunspot Number (NOAA) ──
  sunspotNumber: 0,
  sunspotRegions: 0,
  sunspotMode: 'sim',

  // ── Solar Flare Probabilities (NOAA) ──
  flareProbC: 50,
  flareProbM: 10,
  flareProbX: 1,
  probMode: 'sim',

  // ── Space Weather Alerts (NOAA) ──
  alerts: [],
  alertMode: 'sim',

  // ── NOAA Scales (current storm levels) ──
  scaleG: 0,    // Geomagnetic storm G0-G5
  scaleS: 0,    // Solar radiation S0-S5
  scaleR: 0,    // Radio blackout R0-R5

  // ── Aurora Forecast (OVATION) ──
  auroraMax: 0,       // peak aurora intensity 0-9
  auroraHemiPower: 0, // GW

  // ── Schumann (derived) ──
  schumann: 7.83,

  // ── Simulated/Derived ──
  uvIndex: 3 + Math.random() * 4,
  lightningRate: 40 + Math.random() * 60,
  co2ppm: 424 + Math.random() * 2,
  seaLevel: 0,
  cosmicRayFlux: 6500 + Math.random() * 500,
  tidalForce: 0,
  hemisphereTemp: { north: 14.2, south: 13.8 },

  // ── Kappa ──
  kappa: (1 + Math.sqrt(5)) / 2,

  // ── Mode tracking ──
  liveCount: 0,
  totalFeeds: 13,
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
  if (events.length > 25) events.pop();
  listeners.forEach(fn => fn(entry, events));
}

export function getEvents() { return events; }

// ═══════════════════════════════════════════════════════
// LIVE DATA FETCHERS
// ═══════════════════════════════════════════════════════

// ── 1. USGS Earthquake Feed ──
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
  } catch (e) { metrics.eqMode = 'sim'; simEQ(); }
}

// ── 2. NOAA Solar Wind Plasma (DSCOVR) ──
export async function fetchSolar() {
  try {
    const r = await fetch(PROXY + encodeURIComponent('https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json'));
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    if (d.length > 1) {
      const l = d[d.length - 1];
      metrics.solarDensity = parseFloat(l[1]) || 5;
      metrics.solarSpeed = parseFloat(l[2]) || 400;
      metrics.solarTemp = parseFloat(l[3]) || 100000;
      metrics.solarMode = 'live';
    }
  } catch (e) { metrics.solarMode = 'sim'; simSolar(); }
  if (metrics.solarSpeed > 580) addEvent('solar', 'Wind: ' + Math.round(metrics.solarSpeed) + ' km/s');
}

// ── 3. NOAA Kp Index ──
export async function fetchKp() {
  try {
    const r = await fetch(PROXY + encodeURIComponent('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'));
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    if (d.length > 1) { metrics.kpIndex = parseFloat(d[d.length - 1][1]) || 2; metrics.kpMode = 'live'; }
  } catch (e) { metrics.kpMode = 'sim'; simKp(); }
  if (metrics.kpIndex >= 5) addEvent('geomag', 'Storm Kp ' + metrics.kpIndex);
}

// ── 4. NOAA IMF / Magnetometer (DSCOVR) ──
export async function fetchMag() {
  try {
    const r = await fetch(PROXY + encodeURIComponent('https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json'));
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    if (d.length > 1) {
      const l = d[d.length - 1];
      metrics.bx = parseFloat(l[1]) || 0;
      metrics.by = parseFloat(l[2]) || 0;
      metrics.bz = parseFloat(l[3]) || 0;
      metrics.bt = parseFloat(l[6]) || 5;
      metrics.magMode = 'live';
    }
  } catch (e) {
    metrics.bz += (Math.random() - 0.5) * 2;
    metrics.bz = Math.max(-20, Math.min(20, metrics.bz));
    metrics.bt = Math.abs(metrics.bz) + 3 + Math.random() * 3;
  }
  metrics.bzHistory[metrics.bzPtr] = metrics.bz;
  metrics.bzPtr = (metrics.bzPtr + 1) % metrics.bzHistory.length;
}

// ── 5. Kyoto Dst Index ──
export async function fetchDst() {
  try {
    const r = await fetch(PROXY + encodeURIComponent('https://services.swpc.noaa.gov/products/kyoto-dst.json'));
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    if (d.length > 1) {
      const l = d[d.length - 1];
      metrics.dst = parseFloat(l[1]) || 0;
      metrics.dstMode = 'live';
      // Fill history from last 48 entries
      const slice = d.slice(-48);
      for (let i = 0; i < slice.length; i++) {
        metrics.dstHistory[i] = parseFloat(slice[i][1]) || 0;
      }
      metrics.dstPtr = Math.min(slice.length, 48);
    }
  } catch (e) {
    metrics.dst += (Math.random() - 0.5) * 5;
    metrics.dst = Math.max(-200, Math.min(50, metrics.dst));
    metrics.dstHistory[metrics.dstPtr] = metrics.dst;
    metrics.dstPtr = (metrics.dstPtr + 1) % metrics.dstHistory.length;
  }
  if (metrics.dst <= -50) addEvent('geomag', 'Dst ' + Math.round(metrics.dst) + ' nT — storm');
}

// ── 6. GOES X-Ray Flux ──
export async function fetchXray() {
  try {
    const r = await fetch(PROXY + encodeURIComponent('https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json'));
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    if (d.length > 1) {
      // Get the latest long-wave (0.1-0.8nm) entry
      for (let i = d.length - 1; i >= 0; i--) {
        if (d[i].energy === '0.1-0.8nm') {
          metrics.xrayFluxLong = d[i].flux || 1e-7;
          metrics.xrayMode = 'live';
          break;
        }
      }
      for (let i = d.length - 1; i >= 0; i--) {
        if (d[i].energy === '0.05-0.4nm') {
          metrics.xrayFluxShort = d[i].flux || 1e-8;
          break;
        }
      }
      // Derive X-ray class from long-wave flux
      metrics.xrayClass = fluxToClass(metrics.xrayFluxLong);
    }
  } catch (e) { metrics.xrayMode = 'sim'; }
}

function fluxToClass(f) {
  if (f >= 1e-4) return 'X' + (f / 1e-4).toFixed(1);
  if (f >= 1e-5) return 'M' + (f / 1e-5).toFixed(1);
  if (f >= 1e-6) return 'C' + (f / 1e-6).toFixed(1);
  if (f >= 1e-7) return 'B' + (f / 1e-7).toFixed(1);
  return 'A' + (f / 1e-8).toFixed(1);
}

// ── 7. GOES Solar Flares ──
export async function fetchFlares() {
  try {
    const r = await fetch(PROXY + encodeURIComponent('https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json'));
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    if (d.length) {
      const f = d[0];
      metrics.latestFlare = {
        currentClass: f.current_class || '--',
        maxClass: f.max_class || '--',
        begin: f.begin_time,
        max: f.max_time,
        end: f.end_time
      };
      metrics.flareMode = 'live';
      if (f.max_class && f.max_class.startsWith('M')) addEvent('flare', 'Flare ' + f.max_class);
      if (f.max_class && f.max_class.startsWith('X')) addEvent('flare', 'MAJOR FLARE ' + f.max_class);
    }
  } catch (e) { metrics.flareMode = 'sim'; }
}

// ── 8. GOES Proton Flux (>=10 MeV, >=100 MeV) ──
export async function fetchProtons() {
  try {
    const r = await fetch(PROXY + encodeURIComponent('https://services.swpc.noaa.gov/json/goes/primary/integral-protons-6-hour.json'));
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    if (d.length > 1) {
      for (let i = d.length - 1; i >= 0; i--) {
        if (d[i].energy === '>=10 MeV') { metrics.protonFlux = d[i].flux || 0.5; metrics.protonMode = 'live'; break; }
      }
      for (let i = d.length - 1; i >= 0; i--) {
        if (d[i].energy === '>=100 MeV') { metrics.protonFlux100 = d[i].flux || 0.1; break; }
      }
    }
  } catch (e) { metrics.protonMode = 'sim'; }
  if (metrics.protonFlux >= 10) addEvent('radiation', 'Proton flux: ' + metrics.protonFlux.toFixed(1) + ' pfu');
}

// ── 9. GOES Electron Flux (>=2 MeV) ──
export async function fetchElectrons() {
  try {
    const r = await fetch(PROXY + encodeURIComponent('https://services.swpc.noaa.gov/json/goes/primary/integral-electrons-6-hour.json'));
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    if (d.length > 1) {
      const l = d[d.length - 1];
      metrics.electronFlux = l.flux || 500;
      metrics.electronMode = 'live';
    }
  } catch (e) { metrics.electronMode = 'sim'; }
  if (metrics.electronFlux >= 1000) addEvent('radiation', 'High electron flux: ' + Math.round(metrics.electronFlux));
}

// ── 10. Solar F10.7 Radio Flux ──
export async function fetchF107() {
  try {
    const r = await fetch(PROXY + encodeURIComponent('https://services.swpc.noaa.gov/json/f107_cm_flux.json'));
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    if (d.length) {
      const l = d[d.length - 1];
      metrics.f107Flux = parseFloat(l.flux) || 120;
      metrics.f107Mode = 'live';
    }
  } catch (e) { metrics.f107Mode = 'sim'; }
}

// ── 11. Sunspot Report ──
export async function fetchSunspots() {
  try {
    const r = await fetch(PROXY + encodeURIComponent('https://services.swpc.noaa.gov/json/sunspot_report.json'));
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    if (d.length) {
      // Count unique regions from latest observation
      const regions = new Set(d.slice(-30).map(s => s.Region));
      metrics.sunspotRegions = regions.size;
      metrics.sunspotNumber = d.slice(-30).reduce((sum, s) => sum + (parseInt(s.Numspot) || 0), 0);
      metrics.sunspotMode = 'live';
    }
  } catch (e) { metrics.sunspotMode = 'sim'; }
}

// ── 12. Solar Flare Probabilities ──
export async function fetchFlareProbabilities() {
  try {
    const r = await fetch(PROXY + encodeURIComponent('https://services.swpc.noaa.gov/json/solar_probabilities.json'));
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    if (d.length) {
      const l = d[d.length - 1];
      metrics.flareProbC = l.c_class_1_day || 50;
      metrics.flareProbM = l.m_class_1_day || 10;
      metrics.flareProbX = l.x_class_1_day || 1;
      metrics.probMode = 'live';
    }
  } catch (e) { metrics.probMode = 'sim'; }
}

// ── 13. Space Weather Alerts ──
export async function fetchAlerts() {
  try {
    const r = await fetch(PROXY + encodeURIComponent('https://services.swpc.noaa.gov/products/alerts.json'));
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    if (d.length) {
      const recent = d.slice(-5).reverse();
      const newAlerts = recent.filter(a => !metrics.alerts.find(old => old.id === a.product_id + a.issue_datetime));
      metrics.alerts = recent.map(a => ({
        id: a.product_id + a.issue_datetime,
        code: a.product_id,
        time: a.issue_datetime,
        message: a.message.substring(0, 200)
      }));
      metrics.alertMode = 'live';
      // Parse NOAA scales from alerts
      for (const a of recent) {
        const m = a.message;
        if (/NOAA Scale: G(\d)/.test(m)) metrics.scaleG = Math.max(metrics.scaleG, parseInt(RegExp.$1));
        if (/NOAA Scale: S(\d)/.test(m)) metrics.scaleS = Math.max(metrics.scaleS, parseInt(RegExp.$1));
        if (/NOAA Scale: R(\d)/.test(m)) metrics.scaleR = Math.max(metrics.scaleR, parseInt(RegExp.$1));
      }
      newAlerts.forEach(a => {
        const short = a.product_id.replace(/[0-9]/g, '');
        addEvent('alert', a.product_id + ' — ' + (a.message.match(/ALERT:.*|WARNING:.*|WATCH:.*/)?.[0] || '').substring(0, 40));
      });
    }
  } catch (e) { metrics.alertMode = 'sim'; }
}

// ── 14. OVATION Aurora Forecast ──
export async function fetchAurora() {
  try {
    const r = await fetch(PROXY + encodeURIComponent('https://services.swpc.noaa.gov/json/ovation_aurora_latest.json'));
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    if (d.coordinates && d.coordinates.length) {
      let maxI = 0;
      for (const c of d.coordinates) { if (c[2] > maxI) maxI = c[2]; }
      metrics.auroraMax = maxI;
    }
  } catch (e) { /* aurora max stays simulated */ }
}

// ═══════════════════════════════════════════════════════
// DERIVED / COMPUTED
// ═══════════════════════════════════════════════════════

export function updateSchumann() {
  metrics.schumann = 7.83 + (metrics.kpIndex - 2) * 0.03 + (metrics.solarSpeed - 400) / 3000 + (Math.random() - 0.5) * 0.12;
}

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
  k += Math.max(0, -metrics.dst / 200) * 0.05;
  k += (metrics.scaleG / 5) * 0.04;
  k += Math.max(0, Math.log10(metrics.xrayFluxLong) + 7) * 0.01;
  metrics.kappa = metrics.kappa * 0.93 + Math.max(0, Math.min(1, k)) * 0.07;
}

export function auroraProbability() {
  let prob = 0;
  if (metrics.bz < 0) prob += Math.min(40, Math.abs(metrics.bz) * 4);
  prob += Math.min(30, (metrics.solarSpeed - 300) / 500 * 30);
  prob += Math.min(20, (metrics.kpIndex / 9) * 20);
  prob += Math.min(10, (metrics.solarDensity - 3) / 15 * 10);
  return Math.max(0, Math.min(100, Math.round(prob)));
}

// ─── Simulation fallbacks ───
export function simAdditional() {
  metrics.uvIndex += (Math.random() - 0.5) * 0.3;
  metrics.uvIndex = Math.max(0, Math.min(12, metrics.uvIndex));
  metrics.lightningRate += (Math.random() - 0.5) * 8;
  metrics.lightningRate = Math.max(20, Math.min(150, metrics.lightningRate));
  metrics.co2ppm += (Math.random() - 0.5) * 0.05;
  metrics.cosmicRayFlux += (Math.random() - 0.5) * 50;
  metrics.cosmicRayFlux = Math.max(5000, Math.min(8000, metrics.cosmicRayFlux));
  metrics.tidalForce = Math.sin(Date.now() / 44700000 * Math.PI * 2) * 0.5;
  metrics.seaLevel = Math.sin(Date.now() / 44700000 * Math.PI * 2) * 180;
  if (metrics.uvIndex >= 8) addEvent('uv', 'UV Index: ' + metrics.uvIndex.toFixed(1) + ' (High)');
  if (metrics.lightningRate > 110) addEvent('lightning', Math.round(metrics.lightningRate) + ' strikes/s global');
}

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

// ─── Count live feeds ───
function countLive() {
  metrics.liveCount = [
    metrics.eqMode, metrics.solarMode, metrics.kpMode, metrics.magMode,
    metrics.dstMode, metrics.xrayMode, metrics.flareMode, metrics.protonMode,
    metrics.electronMode, metrics.f107Mode, metrics.sunspotMode,
    metrics.probMode, metrics.alertMode
  ].filter(m => m === 'live').length;
}

// ═══════════════════════════════════════════════════════
// REFRESH / POLLING
// ═══════════════════════════════════════════════════════

export async function refreshAll() {
  await Promise.all([
    fetchEarthquakes(),
    fetchSolar(),
    fetchKp(),
    fetchMag(),
    fetchDst(),
    fetchXray(),
    fetchFlares(),
    fetchProtons(),
    fetchElectrons(),
    fetchF107(),
    fetchSunspots(),
    fetchFlareProbabilities(),
    fetchAlerts(),
    fetchAurora(),
  ]);
  updateSchumann();
  simAdditional();
  computeKappa();
  countLive();
  metrics.lastUpdate = Date.now();
}

export function tick() {
  if (metrics.solarMode === 'sim') simSolar();
  if (metrics.kpMode === 'sim') simKp();
  updateSchumann();
  simAdditional();
  computeKappa();
}

export function startPolling(fetchInterval = 75000, tickInterval = 6000) {
  refreshAll();
  setInterval(refreshAll, fetchInterval);
  setInterval(tick, tickInterval);
  setInterval(() => { if (metrics.eqMode === 'sim' && Math.random() > 0.5) simEQ(); }, 18000);
}

// ─── Lat/Lon to 3D position ───
export function latLonToVec3(THREE, lat, lon, radius) {
  const ph = (90 - lat) * Math.PI / 180;
  const th = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(radius * Math.sin(ph) * Math.cos(th), radius * Math.cos(ph), radius * Math.sin(ph) * Math.sin(th));
}