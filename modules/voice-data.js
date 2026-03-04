// voice-data.js — Voice-controlled data analysis + visualization
// Speak queries like SQL and see results as 3D charts.
// Features:
// - "Show me a bar chart of sales by month" → generates chart
// - "Filter where age > 30" → applies filter
// - "Group by category, sum amount" → aggregates
// - "Load CSV" → parses data from clipboard
// - Voice-driven SQL-like queries on in-memory datasets
// - LLM translates natural language → data operations
// - 3D bar/scatter/line chart visualization

import { KI } from './core.js';

const TAU = Math.PI * 2;

// ── Data State ──
let datasets = new Map();  // name → { columns, rows, types }
let activeDataset = null;
let queryResult = null;
let chartType = 'bar';     // bar, scatter, line, pie
let chartData = [];

// ── 3D Chart ──
let group = null;
let bars = [];
let scatterPoints = null, scatterPos = null, scatterCol = null;
let lineChart = null, linePos = null, lineCol = null;
let axisLines = [];
const MAX_BARS = 50;
const MAX_SCATTER = 200;
const MAX_LINE_PTS = 100;

export function init(opts = {}) {
  const scene = KI.scene;
  if (!scene) { KI.on('scene:ready', () => init(opts)); return; }

  const pos = opts.position || [0, 1, -3];
  group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);

  // ── Bar chart meshes ──
  for (let i = 0; i < MAX_BARS; i++) {
    const geo = new THREE.BoxGeometry(0.15, 1, 0.15);
    geo.translate(0, 0.5, 0); // pivot at bottom
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00aaff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    group.add(mesh);
    bars.push(mesh);
  }

  // ── Scatter points ──
  const sGeo = new THREE.BufferGeometry();
  scatterPos = new Float32Array(MAX_SCATTER * 3);
  scatterCol = new Float32Array(MAX_SCATTER * 3);
  sGeo.setAttribute('position', new THREE.BufferAttribute(scatterPos, 3));
  sGeo.setAttribute('color', new THREE.BufferAttribute(scatterCol, 3));
  scatterPoints = new THREE.Points(sGeo, new THREE.PointsMaterial({
    size: 0.1, vertexColors: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(scatterPoints);

  // ── Line chart ──
  const lGeo = new THREE.BufferGeometry();
  linePos = new Float32Array(MAX_LINE_PTS * 3);
  lineCol = new Float32Array(MAX_LINE_PTS * 3);
  lGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  lGeo.setAttribute('color', new THREE.BufferAttribute(lineCol, 3));
  lineChart = new THREE.Line(lGeo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending
  }));
  group.add(lineChart);

  // ── Axis lines ──
  for (let a = 0; a < 3; a++) {
    const geo = new THREE.BufferGeometry();
    const pts = new Float32Array(6);
    const dirs = [[4,0,0],[0,3,0],[0,0,4]];
    pts[3] = dirs[a][0]; pts[4] = dirs[a][1]; pts[5] = dirs[a][2];
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: [0xff0000, 0x00ff00, 0x0000ff][a], transparent: true, opacity: 0.2
    }));
    group.add(line);
    axisLines.push(line);
  }

  // ── Sample dataset ──
  loadSampleData();

  // ── Register tools ──
  KI.on('voice-ai-core:ready', registerTools);
  const core = KI.get('voice-ai-core');
  if (core?.isReady()) registerTools();

  KI.on('voice-ai-core:command', handleCommand);

  KI.register('voice-data', {
    update, group,
    query: executeQuery,
    loadCSV,
    getDatasets: () => [...datasets.keys()],
    getChart: () => ({ type: chartType, data: chartData })
  });

  KI.emit('voice-data:ready');
}

function loadSampleData() {
  const sales = {
    columns: ['month', 'product', 'amount', 'quantity', 'region'],
    types: ['string', 'string', 'number', 'number', 'string'],
    rows: []
  };
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const products = ['Widget','Gadget','Doohickey','Thingamajig'];
  const regions = ['North','South','East','West'];
  for (let i = 0; i < 60; i++) {
    sales.rows.push([
      months[i % 12],
      products[Math.floor(Math.random() * 4)],
      Math.floor(Math.random() * 1000 + 100),
      Math.floor(Math.random() * 50 + 1),
      regions[Math.floor(Math.random() * 4)]
    ]);
  }
  datasets.set('sales', sales);
  activeDataset = 'sales';

  // Generate initial chart
  const grouped = groupBy(sales, 0, 2, 'sum');
  chartData = grouped;
  chartType = 'bar';
}

function loadCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return;
  const columns = lines[0].split(',').map(c => c.trim());
  const rows = [];
  const types = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim());
    rows.push(vals.map((v, j) => {
      const num = parseFloat(v);
      if (!isNaN(num) && isFinite(num)) {
        if (i === 1) types[j] = 'number';
        return num;
      }
      if (i === 1) types[j] = 'string';
      return v;
    }));
  }
  const name = 'csv_' + Date.now();
  datasets.set(name, { columns, rows, types });
  activeDataset = name;
  KI.emit('voice-data:dataset-loaded', { name, columns, rowCount: rows.length });
}

function registerTools() {
  const core = KI.get('voice-ai-core');
  if (!core) return;

  core.registerTool('voice-data', {
    description: 'Query and visualize data with natural language',
    parameters: { command: 'string' },
    handler: handleDataTool
  });
}

async function handleDataTool(params) {
  const core = KI.get('voice-ai-core');
  if (!core) return { error: 'Core not ready' };
  const cmd = params.command || '';
  return executeQuery(cmd);
}

function handleCommand(cmd) {
  if (cmd.intent !== 'data') return;
}

async function executeQuery(queryText) {
  const ds = datasets.get(activeDataset);
  if (!ds) return { error: 'No active dataset' };

  const lower = queryText.toLowerCase();
  const core = KI.get('voice-ai-core');

  // Direct parse of common operations
  // Filter
  const filterMatch = lower.match(/filter\s+(?:where\s+)?(\w+)\s*(>|<|=|>=|<=|!=)\s*(\S+)/);
  if (filterMatch) {
    const [, col, op, val] = filterMatch;
    const colIdx = ds.columns.findIndex(c => c.toLowerCase() === col);
    if (colIdx >= 0) {
      const numVal = parseFloat(val);
      const filtered = ds.rows.filter(row => {
        const v = typeof row[colIdx] === 'number' ? row[colIdx] : parseFloat(row[colIdx]);
        switch(op) {
          case '>': return v > numVal;
          case '<': return v < numVal;
          case '>=': return v >= numVal;
          case '<=': return v <= numVal;
          case '=': return row[colIdx] == val;
          case '!=': return row[colIdx] != val;
          default: return true;
        }
      });
      queryResult = { columns: ds.columns, rows: filtered, operation: 'filter' };
      updateChart(queryResult);
      if (core) core.speak(`Filtered to ${filtered.length} rows`);
      return { rowCount: filtered.length };
    }
  }

  // Group by
  const groupMatch = lower.match(/group\s+by\s+(\w+)/);
  if (groupMatch) {
    const col = groupMatch[1];
    const colIdx = ds.columns.findIndex(c => c.toLowerCase() === col);
    // Find first numeric column for aggregation
    const numIdx = ds.types.findIndex(t => t === 'number');
    if (colIdx >= 0 && numIdx >= 0) {
      const aggType = lower.includes('average') || lower.includes('avg') ? 'avg' :
                       lower.includes('count') ? 'count' : 'sum';
      const result = groupBy(ds, colIdx, numIdx, aggType);
      chartData = result;
      chartType = 'bar';
      if (core) core.speak(`Grouped by ${col}, ${result.length} groups`);
      return { groups: result.length };
    }
  }

  // Sort
  const sortMatch = lower.match(/sort\s+by\s+(\w+)\s*(asc|desc)?/);
  if (sortMatch) {
    const col = sortMatch[1];
    const dir = sortMatch[2] === 'desc' ? -1 : 1;
    const colIdx = ds.columns.findIndex(c => c.toLowerCase() === col);
    if (colIdx >= 0) {
      const sorted = [...ds.rows].sort((a, b) => (a[colIdx] > b[colIdx] ? dir : -dir));
      queryResult = { columns: ds.columns, rows: sorted, operation: 'sort' };
      if (core) core.speak(`Sorted by ${col}`);
      return { sorted: true };
    }
  }

  // Chart type
  if (lower.includes('bar chart') || lower.includes('bar graph')) { chartType = 'bar'; return { chartType: 'bar' }; }
  if (lower.includes('scatter') || lower.includes('scatter plot')) { chartType = 'scatter'; return { chartType: 'scatter' }; }
  if (lower.includes('line chart') || lower.includes('line graph')) { chartType = 'line'; return { chartType: 'line' }; }

  // Count
  if (lower.includes('count') || lower.includes('how many')) {
    const count = (queryResult || ds).rows.length;
    if (core) core.speak(`${count} rows`);
    return { count };
  }

  // Fallback: LLM interpretation
  if (core) {
    const result = await core.infer(
      `Dataset columns: ${ds.columns.join(', ')}. Types: ${ds.types.join(', ')}. ${ds.rows.length} rows.\nQuery: ${queryText}\nDescribe the operation to perform in 1 sentence.`,
      { maxTokens: 40 }
    );
    core.speak(result || 'I could not parse that query');
    return { llmResponse: result };
  }

  return { error: 'Could not parse query' };
}

function groupBy(ds, groupCol, valueCol, aggType) {
  const groups = new Map();
  for (const row of ds.rows) {
    const key = String(row[groupCol]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(typeof row[valueCol] === 'number' ? row[valueCol] : parseFloat(row[valueCol]) || 0);
  }
  const result = [];
  for (const [key, vals] of groups) {
    let value;
    if (aggType === 'sum') value = vals.reduce((a, b) => a + b, 0);
    else if (aggType === 'avg') value = vals.reduce((a, b) => a + b, 0) / vals.length;
    else if (aggType === 'count') value = vals.length;
    else value = vals.reduce((a, b) => a + b, 0);
    result.push({ label: key, value });
  }
  return result.sort((a, b) => b.value - a.value);
}

function updateChart(result) {
  if (!result || !result.rows.length) return;
  // Auto-detect first string + first number column
  const ds = datasets.get(activeDataset);
  if (!ds) return;
  const strCol = ds.types.findIndex(t => t === 'string');
  const numCol = ds.types.findIndex(t => t === 'number');
  if (strCol >= 0 && numCol >= 0) {
    chartData = groupBy({ rows: result.rows }, strCol, numCol, 'sum');
  }
}

function update(dt, t) {
  const v = KI.voice;
  const energy = v.energy || 0;

  if (chartType === 'bar') {
    // ── Bar chart visualization ──
    const maxVal = chartData.reduce((m, d) => Math.max(m, d.value), 1);
    scatterPoints.material.opacity = 0;
    lineChart.material.opacity = 0;

    for (let i = 0; i < MAX_BARS; i++) {
      const bar = bars[i];
      if (i < chartData.length) {
        bar.visible = true;
        const d = chartData[i];
        const h = (d.value / maxVal) * 2.5;
        bar.scale.y = h + energy * 0.3;
        bar.position.x = (i - chartData.length / 2) * 0.22;
        bar.position.y = 0;
        bar.position.z = 0;
        const hue = i / chartData.length;
        const rgb = KI.hslToRgb(hue, 0.7, 0.3 + energy * 0.2);
        bar.material.color.setRGB(rgb[0], rgb[1], rgb[2]);
        bar.material.opacity = 0.5 + energy * 0.3;
      } else {
        bar.visible = false;
      }
    }
  } else if (chartType === 'scatter') {
    // ── Scatter visualization ──
    for (const b of bars) b.visible = false;
    lineChart.material.opacity = 0;

    const ds = datasets.get(activeDataset);
    const rows = (queryResult || ds)?.rows || [];
    const numCols = ds?.types.map((t, i) => t === 'number' ? i : -1).filter(i => i >= 0) || [];
    const xCol = numCols[0] || 0;
    const yCol = numCols[1] || numCols[0] || 0;

    for (let i = 0; i < MAX_SCATTER; i++) {
      if (i < rows.length) {
        const x = (parseFloat(rows[i][xCol]) || 0) / 500 * 3 - 1.5;
        const y = (parseFloat(rows[i][yCol]) || 0) / 500 * 2.5;
        scatterPos[i*3] = x + Math.sin(t + i) * energy * 0.1;
        scatterPos[i*3+1] = y;
        scatterPos[i*3+2] = (Math.random() - 0.5) * 0.2;
        const hue = (i / rows.length + t * 0.02) % 1;
        const rgb = KI.hslToRgb(hue, 0.8, 0.4);
        scatterCol[i*3] = rgb[0]; scatterCol[i*3+1] = rgb[1]; scatterCol[i*3+2] = rgb[2];
      } else {
        scatterPos[i*3] = scatterPos[i*3+1] = scatterPos[i*3+2] = 0;
        scatterCol[i*3] = scatterCol[i*3+1] = scatterCol[i*3+2] = 0;
      }
    }
    scatterPoints.geometry.attributes.position.needsUpdate = true;
    scatterPoints.geometry.attributes.color.needsUpdate = true;
    scatterPoints.material.opacity = 0.6 + energy * 0.3;
  } else if (chartType === 'line') {
    // ── Line chart ──
    for (const b of bars) b.visible = false;
    scatterPoints.material.opacity = 0;

    const pts = Math.min(chartData.length, MAX_LINE_PTS);
    const maxVal = chartData.reduce((m, d) => Math.max(m, d.value), 1);
    for (let i = 0; i < MAX_LINE_PTS; i++) {
      if (i < pts) {
        linePos[i*3] = (i / pts) * 5 - 2.5;
        linePos[i*3+1] = (chartData[i].value / maxVal) * 2.5 + energy * Math.sin(t + i * 0.5) * 0.1;
        linePos[i*3+2] = 0;
        const hue = (i / pts + t * 0.02) % 1;
        const rgb = KI.hslToRgb(hue, 0.8, 0.4);
        lineCol[i*3] = rgb[0]; lineCol[i*3+1] = rgb[1]; lineCol[i*3+2] = rgb[2];
      }
    }
    lineChart.geometry.attributes.position.needsUpdate = true;
    lineChart.geometry.attributes.color.needsUpdate = true;
    lineChart.geometry.setDrawRange(0, pts);
    lineChart.material.opacity = 0.6 + energy * 0.3;
  }

  KI.emit('voice-data:update', {
    activeDataset,
    chartType,
    dataPoints: chartData.length,
    datasetCount: datasets.size
  });
}
