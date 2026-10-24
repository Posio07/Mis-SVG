#!/usr/bin/env node
/* Lee data/exercise-muscles.csv, lo valida y genera ifbb-pro-agent/js/exerciseMuscles.js
 * (el módulo que carga la app; GitHub Pages solo publica la carpeta ifbb-pro-agent/).
 *
 *   node scripts/build-exercise-muscles.js           regenera el módulo
 *   node scripts/build-exercise-muscles.js --check   falla si el módulo no coincide con el CSV
 *
 * El CSV acepta coma o punto y coma como separador (Excel en español guarda con
 * punto y coma), comillas dobles estilo RFC 4180, BOM UTF-8 y saltos CRLF. */
'use strict';
const fs = require('fs');
const path = require('path');

const COLUMNS = ['exerciseId', 'muscle', 'role', 'evidence_level', 'source', 'notes', 'review_date'];
const ROLES = ['primary', 'secondary'];
const LEVELS = ['verificado', 'probable', 'a_verificar'];
// Mismos ids que KNOWLEDGE.MUSCLE_LABELS: un test comprueba que no se desalineen.
const MUSCLE_IDS = ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes', 'calves', 'biceps', 'triceps', 'abs'];

const ROOT = path.join(__dirname, '..');
const CSV_PATH = path.join(ROOT, 'data', 'exercise-muscles.csv');
const MODULE_PATH = path.join(ROOT, 'ifbb-pro-agent', 'js', 'exerciseMuscles.js');

// Separador de la fila de encabezado: el que más aparece fuera de comillas.
function detectDelimiter(text) {
  const firstLine = text.split(/\r\n|\n|\r/, 1)[0];
  let commas = 0, semis = 0, inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch === ',') commas++;
    else if (!inQuotes && ch === ';') semis++;
  }
  return semis > commas ? ';' : ',';
}

// Parser CSV mínimo (RFC 4180): comillas, comillas dobladas, saltos dentro de comillas.
function parseCsv(text, delimiter) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = [];
  let row = [], field = '', inQuotes = false, i = 0;
  const endField = () => { row.push(field); field = ''; };
  const endRow = () => { endField(); if (row.some(c => c.trim() !== '')) rows.push(row); row = []; };
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === delimiter) { endField(); i++; continue; }
    if (ch === '\r') { endRow(); i += text[i + 1] === '\n' ? 2 : 1; continue; }
    if (ch === '\n') { endRow(); i++; continue; }
    field += ch; i++;
  }
  if (inQuotes) throw new Error('CSV mal formado: comillas sin cerrar');
  if (field !== '' || row.length) endRow();
  return rows;
}

// Devuelve { rows, delimiter, errors }. No lanza por datos inválidos: junta los errores.
function parseExerciseMuscles(text) {
  const delimiter = detectDelimiter(text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text);
  const table = parseCsv(text, delimiter);
  const errors = [];
  if (!table.length) return { rows: [], delimiter, errors: ['El CSV está vacío'] };
  const header = table[0].map(h => h.trim());
  const missing = COLUMNS.filter(c => !header.includes(c));
  const extra = header.filter(c => c !== '' && !COLUMNS.includes(c));
  if (missing.length) errors.push(`Faltan columnas: ${missing.join(', ')}`);
  if (extra.length) errors.push(`Columnas desconocidas: ${extra.join(', ')}`);
  if (missing.length) return { rows: [], delimiter, errors };
  const idx = Object.fromEntries(COLUMNS.map(c => [c, header.indexOf(c)]));
  const rows = [], seen = new Set();
  table.slice(1).forEach((cells, n) => {
    const line = n + 2;
    const get = c => (cells[idx[c]] === undefined ? '' : cells[idx[c]]).trim();
    const row = Object.fromEntries(COLUMNS.map(c => [c, get(c)]));
    const where = `fila ${line} (${row.exerciseId || 'sin exerciseId'}, ${row.muscle || 'sin muscle'})`;
    if (!row.exerciseId) errors.push(`${where}: exerciseId vacío`);
    if (!MUSCLE_IDS.includes(row.muscle)) errors.push(`${where}: muscle inválido "${row.muscle}" (válidos: ${MUSCLE_IDS.join(', ')})`);
    if (!ROLES.includes(row.role)) errors.push(`${where}: role inválido "${row.role}" (solo primary o secondary)`);
    if (!LEVELS.includes(row.evidence_level)) errors.push(`${where}: evidence_level inválido "${row.evidence_level}" (${LEVELS.join(', ')})`);
    if ((row.evidence_level === 'verificado' || row.evidence_level === 'probable') && !row.source) errors.push(`${where}: ${row.evidence_level} sin source`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.review_date) || isNaN(Date.parse(row.review_date))) errors.push(`${where}: review_date debe ser AAAA-MM-DD (en Excel, dar formato Texto a esa columna), no "${row.review_date}"`);
    const key = `${row.exerciseId}|${row.muscle}`;
    if (seen.has(key)) errors.push(`${where}: fila repetida para ese ejercicio y músculo`);
    seen.add(key);
    rows.push(row);
  });
  const primaries = {};
  rows.forEach(r => { if (r.role === 'primary') primaries[r.exerciseId] = (primaries[r.exerciseId] || 0) + 1; });
  Object.entries(primaries).forEach(([id, n]) => { if (n > 1) errors.push(`${id}: tiene ${n} filas primary (solo puede haber una)`); });
  return { rows, delimiter, errors };
}

function buildModuleSource(rows) {
  const lines = rows.map(r => '    ' + JSON.stringify(r));
  return [
    '/* GENERADO por scripts/build-exercise-muscles.js a partir de data/exercise-muscles.csv.',
    ' * No editar a mano: cambiar el CSV y volver a correr `node scripts/build-exercise-muscles.js`.',
    ' * Un test comprueba que este archivo coincide con el CSV. */',
    '(function (root, factory) {',
    "  if (typeof module === 'object' && module.exports) module.exports = factory();",
    '  else root.EXERCISE_MUSCLES = factory();',
    "})(typeof self !== 'undefined' ? self : this, function () {",
    "  'use strict';",
    '  return {',
    "    source: 'data/exercise-muscles.csv',",
    '    rows: [',
    lines.join(',\n'),
    '    ],',
    '  };',
    '});',
    '',
  ].join('\n');
}

function buildFromCsvText(text) {
  const parsed = parseExerciseMuscles(text);
  if (parsed.errors.length) {
    const e = new Error('data/exercise-muscles.csv inválido:\n - ' + parsed.errors.join('\n - '));
    e.errors = parsed.errors;
    throw e;
  }
  return buildModuleSource(parsed.rows);
}

if (require.main === module) {
  try {
    const source = buildFromCsvText(fs.readFileSync(CSV_PATH, 'utf8'));
    if (process.argv.includes('--check')) {
      const current = fs.existsSync(MODULE_PATH) ? fs.readFileSync(MODULE_PATH, 'utf8') : '';
      if (current !== source) { console.error('ifbb-pro-agent/js/exerciseMuscles.js no coincide con data/exercise-muscles.csv. Correr: node scripts/build-exercise-muscles.js'); process.exit(1); }
      console.log('exerciseMuscles.js coincide con el CSV');
    } else {
      fs.writeFileSync(MODULE_PATH, source);
      console.log('Generado ifbb-pro-agent/js/exerciseMuscles.js');
    }
  } catch (e) { console.error(e.message); process.exit(1); }
}

module.exports = { COLUMNS, ROLES, LEVELS, MUSCLE_IDS, CSV_PATH, MODULE_PATH, detectDelimiter, parseCsv, parseExerciseMuscles, buildModuleSource, buildFromCsvText };
