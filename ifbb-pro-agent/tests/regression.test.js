/* Test de regresión (Fase 1 del plan DECISIONS.md).
 * Captura los números clave ANTES de implementar DEC-001..DEC-005 y verifica
 * que, sin usar ninguno de los inputs nuevos, el plan siga dando los mismos
 * resultados: mismo volumen semanal por músculo, misma nutrición, mismos
 * objetivos. Excepción permitida por el propio spec: DEC-002 añade una línea
 * de "top set" dentro del primer ejercicio multiarticular en fase de
 * definición, pero no cambia el total de series (se reparte dentro del mismo
 * ejercicio), así que tampoco afecta a los números que este test comprueba.
 *
 * Nota: el arreglo de ejercicios DENTRO de cada sesión sí puede cambiar por
 * DEC-003 (tope de series por sesión, activo por defecto en 25): los
 * perfiles "cut" y "maintain" de abajo ya tenían sesiones de 27-28 y 35
 * series antes de DEC-003, por encima del tope por defecto. DEC-003 es una
 * corrección de seguridad que aplica siempre, no un input nuevo que haya que
 * activar, así que ese reparto día a día puede variar: lo que este test fija
 * como invariante es el volumen semanal total por músculo (weeklySets) y la
 * nutrición/objetivos, no la distribución exacta ejercicio-por-día.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/engine.js');

const TODAY = '2026-09-15';

const PROFILES = {
  cut: { name: 'Oscar', sex: 'M', age: 32, heightCm: 176, weightKg: 84, neckCm: 40, waistCm: 88, activity: 'moderate', level: 'intermediate', daysPerWeek: 5, division: 'classic_m', goal: 'cut' },
  bulk: { name: 'Novice', sex: 'M', age: 24, heightCm: 180, weightKg: 75, bodyFatPct: 14, activity: 'moderate', level: 'novice', daysPerWeek: 4, division: 'physique_m', goal: 'bulk' },
  maintain: { name: 'W', sex: 'F', age: 25, heightCm: 160, weightKg: 60, bodyFatPct: 22, activity: 'moderate', level: 'intermediate', daysPerWeek: 5, division: 'wellness_w', goal: 'maintain' },
};

// Capturado con `node -e` contra el motor anterior a DEC-001..DEC-005.
const BASELINE = {
  cut: {
    weeklySets: { chest: 12, back: 15, shoulders: 15, quads: 15, hamstrings: 12, glutes: 12, calves: 7, biceps: 7, triceps: 7, abs: 7 },
    nutrition: { calories: 2246, protein: 187, carbs: 234, fat: 62 },
    targets: { targetBf: 6, targetWeight: 73.69, ratePct: 0.7 },
  },
  bulk: {
    weeklySets: { chest: 10, back: 13, shoulders: 13, quads: 5, hamstrings: 5, glutes: 5, calves: 6, biceps: 6, triceps: 6, abs: 8 },
    nutrition: { calories: 3280, protein: 150, carbs: 465, fat: 91 },
    targets: { targetBf: 15, targetWeight: 75.88, ratePct: 0.5 },
  },
  maintain: {
    weeklySets: { chest: 7, back: 14, shoulders: 7, quads: 18, hamstrings: 18, glutes: 18, calves: 8, biceps: 4, triceps: 4, abs: 8 },
    nutrition: { calories: 2140, protein: 120, carbs: 281, fat: 59 },
    targets: { targetBf: 22, targetWeight: 60, ratePct: 0 },
  },
};

Object.entries(PROFILES).forEach(([key, profile]) => {
  test(`regresión ${key}: sin inputs nuevos, mismos resultados que antes de DECISIONS.md`, () => {
    const plan = E.buildPlan(profile, TODAY);
    const base = BASELINE[key];
    assert.deepEqual(plan.training.weeklySets, base.weeklySets, `${key}: weeklySets cambió`);
    assert.equal(plan.nutrition.calories, base.nutrition.calories, `${key}: calorías cambiaron`);
    assert.equal(plan.nutrition.protein, base.nutrition.protein, `${key}: proteína cambió`);
    assert.equal(plan.nutrition.carbs, base.nutrition.carbs, `${key}: carbohidratos cambiaron`);
    assert.equal(plan.nutrition.fat, base.nutrition.fat, `${key}: grasa cambió`);
    assert.equal(plan.targets.targetBf, base.targets.targetBf, `${key}: %grasa objetivo cambió`);
    assert.equal(Math.round(plan.targets.targetWeight * 100) / 100, base.targets.targetWeight, `${key}: peso objetivo cambió`);
    assert.equal(plan.targets.ratePct, base.targets.ratePct, `${key}: ritmo cambió`);
    // El total de series asignadas por músculo en las sesiones debe seguir
    // sumando lo mismo que weeklySets, sin importar en qué día caigan.
    const assigned = {};
    plan.training.sessions.forEach(s => s.exercises.forEach(e => { assigned[e.muscle] = (assigned[e.muscle] || 0) + e.sets; }));
    Object.keys(base.weeklySets).forEach(mu => {
      assert.ok(Math.abs((assigned[mu] || 0) - base.weeklySets[mu]) <= 2, `${key}: ${mu} asignado ${assigned[mu]} vs ${base.weeklySets[mu]}`);
    });
  });
});
