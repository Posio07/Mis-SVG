#!/usr/bin/env node
/* Genera ifbb-pro-agent/tests/fixtures/plan-hashes.json: una huella (SHA-256 de la
 * serialización canónica, con claves ordenadas) de la salida del plan para 30
 * combinaciones: los 10 perfiles de plan-identity-baseline.json, cada uno sin
 * extras, con `healthGoal` y con `healthGoal` más lesiones.
 *
 *   node scripts/snapshot-plan-hashes.js [ruta/a/engine.js] [etiqueta]
 *
 * Sin argumentos usa el motor del árbol actual. Para fijar la salida de otra
 * versión (p. ej. la de main antes de una fase) pasar la ruta de su engine.js.
 * Solo regenerar cuando un cambio en la salida del plan es intencional y está
 * revisado: este archivo existe para que un cambio accidental haga fallar el test. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const FIXTURES = path.join(ROOT, 'ifbb-pro-agent', 'tests', 'fixtures');
const OUT = path.join(FIXTURES, 'plan-hashes.json');

const canonical = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.keys(x).sort().reduce((o, key) => { o[key] = x[key]; return o; }, {}) : x));
const hash = v => crypto.createHash('sha256').update(canonical(v)).digest('hex');
const VARIANTS = {
  base: {},
  healthGoal: { healthGoal: true },
  'healthGoal+lesiones': { healthGoal: true, injuryZones: ['shoulder', 'knee'] },
};

function computeHashes(engine) {
  const fx = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'plan-identity-baseline.json'), 'utf8'));
  const cases = {};
  Object.entries(fx.cases).forEach(([key, c]) => {
    Object.entries(VARIANTS).forEach(([variant, extra]) => {
      cases[`${key} | ${variant}`] = hash(engine.buildPlan(Object.assign({}, c.profile, extra), fx.today));
    });
  });
  return { today: fx.today, cases };
}

if (require.main === module) {
  const enginePath = path.resolve(process.argv[2] || path.join(ROOT, 'ifbb-pro-agent', 'js', 'engine.js'));
  const label = process.argv[3] || 'motor del árbol actual';
  const { today, cases } = computeHashes(require(enginePath));
  fs.writeFileSync(OUT, JSON.stringify({ note: `Huellas de la salida del plan (SHA-256 de la serialización canónica) generadas con: ${label}. Regenerar con scripts/snapshot-plan-hashes.js solo si un cambio de salida es intencional.`, today, cases }, null, 2) + '\n');
  console.log(`${Object.keys(cases).length} huellas escritas en ${path.relative(ROOT, OUT)} (${label})`);
}

module.exports = { canonical, hash, computeHashes, VARIANTS };
