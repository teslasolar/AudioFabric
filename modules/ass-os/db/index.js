// ass-os/db/index.js — DB barrel export + init
import { KI } from '../../core.js';
import { Database } from './database.js';
import { createSchemas } from './schemas.js';

export const alarmsDB     = new Database('alarms');
export const workordersDB = new Database('workorders');
export const narrativesDB = new Database('narratives');
export const statelogDB   = new Database('statelog');
export const faultsDB     = new Database('faults');
export const goalsDB      = new Database('goals');
export const metricsDB    = new Database('metrics');
export const tagsDB       = new Database('tags');

export function allDBs() { return { alarmsDB, workordersDB, narrativesDB, statelogDB, faultsDB, goalsDB, metricsDB, tagsDB }; }

export function allStats() {
  const s = {};
  for (const [k, db] of Object.entries(allDBs())) s[k.replace('DB', '')] = db.stats();
  return s;
}

export function saveAll() { let ok = 0; for (const db of Object.values(allDBs())) if (db.save()) ok++; return ok; }
export function loadAll() { let ok = 0; for (const db of Object.values(allDBs())) if (db.load()) ok++; return ok; }

let metricsTimer = 0;

export function init() {
  createSchemas(allDBs());
  loadAll();
  const kpi = metricsDB.table('kpi');
  if (kpi && kpi.count() === 0)
    kpi.insert({ id: 'ASSOS_OEE', availability: 1, performance: 1, quality: 1, oee: 1, alarm_rate: 0, mtbf: 0, mttr: 0, updated: Date.now() });
  KI.register('ass-os-db', { update, getState: allStats });
  KI.emit('ass-os-db:ready', allStats());
}

function update(dt, t) {
  metricsTimer += dt;
  if (metricsTimer > 2) { metricsTimer = 0; KI.emit('ass-os-db:stats', allStats()); }
  if (Math.floor(t) % 30 === 0 && Math.floor(t) !== Math.floor(t - dt)) saveAll();
}
