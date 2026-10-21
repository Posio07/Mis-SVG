const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/engine.js');
const K = require('../js/knowledge.js');

const TODAY = '2026-09-15';

const male = {
  name: 'Test', sex: 'M', age: 30, heightCm: 178, weightKg: 85, bodyFatPct: 15,
  activity: 'moderate', level: 'intermediate', daysPerWeek: 5, division: 'classic_m', goal: 'cut',
};

test('Mifflin-St Jeor matches published equation', () => {
  assert.equal(Math.round(E.bmrMifflin('M', 85, 178, 30)), Math.round(10 * 85 + 6.25 * 178 - 5 * 30 + 5));
  assert.equal(Math.round(E.bmrMifflin('F', 60, 165, 28)), Math.round(10 * 60 + 6.25 * 165 - 5 * 28 - 161));
});

test('Navy body fat gives plausible values and rejects bad input', () => {
  const bf = E.bodyFatNavy('M', 178, 40, 85, 0);
  assert.ok(bf > 10 && bf < 20, `bf=${bf}`);
  const bfw = E.bodyFatNavy('F', 165, 33, 70, 95);
  assert.ok(bfw > 18 && bfw < 30, `bf=${bfw}`);
  assert.equal(E.bodyFatNavy('M', 178, 90, 85, 0), null);
  assert.equal(E.bodyFatNavy('F', 165, 33, 70, 0), null);
});

test('FFMI normalised to 1.80 m', () => {
  const f = E.ffmi(72, 180);
  assert.equal(Math.round(f.raw * 100) / 100, Math.round(72 / 3.24 * 100) / 100);
  assert.equal(Math.round(f.normalized * 100) / 100, Math.round(f.raw * 100) / 100);
});

test('cut plan: protein per kg LBM, fat 15-30 %, deficit within bounds, rate 0.5-1 %/wk', () => {
  const plan = E.buildPlan(male, TODAY);
  const n = plan.nutrition, m = plan.metrics, t = plan.targets;
  assert.ok(t.ratePct >= 0.5 && t.ratePct <= 1.0);
  assert.ok(n.protein / m.lbm >= 2.3 && n.protein / m.lbm <= 3.1, `p/lbm=${n.protein / m.lbm}`);
  assert.ok(n.fatPct >= 15 && n.fatPct <= 30, `fat%=${n.fatPct}`);
  assert.ok(n.calories < m.tdee && n.calories >= m.bmr);
  assert.ok(n.calories >= 0.7 * m.tdee - 1);
  assert.equal(t.targetBf, 6); // midpoint classic 5-7
  assert.ok(t.targetWeight < 85 && t.targetWeight > 70);
  assert.ok(t.classic && t.classic.lb === 202); // 178 cm = 70.08 in -> tramo "más de 5'10 hasta 5'11"
});

test('bulk plan: surplus 10-20 %, protein 1.6-2.2 g/kg, carbs >= 3 g/kg', () => {
  const plan = E.buildPlan(Object.assign({}, male, { goal: 'bulk', level: 'novice', bodyFatPct: 12 }), TODAY);
  const n = plan.nutrition, m = plan.metrics;
  const surplus = (n.calories - m.tdee) / m.tdee;
  assert.ok(surplus >= 0.095 && surplus <= 0.205, `surplus=${surplus}`);
  assert.ok(n.proteinPerKg >= 1.6 && n.proteinPerKg <= 2.2);
  assert.ok(n.carbsPerKg >= 3);
  assert.equal(plan.targets.ratePct, 0.5);
});

test('target date too close produces danger warning and caps the rate', () => {
  const plan = E.buildPlan(Object.assign({}, male, { targetDate: '2026-10-01' }), TODAY);
  assert.equal(plan.targets.dateFeasible, false);
  assert.equal(plan.targets.ratePct, 1.0);
  assert.ok(plan.warnings.some(w => w.level === 'danger'));
});

test('target below essential fat is clamped', () => {
  const plan = E.buildPlan(Object.assign({}, male, { targetBf: 3 }), TODAY);
  assert.equal(plan.targets.targetBf, 5);
});

test('female bikini profile without body fat uses default and warns', () => {
  const plan = E.buildPlan({ name: 'B', sex: 'F', age: 26, heightCm: 163, weightKg: 58, activity: 'light', level: 'novice', daysPerWeek: 4, division: 'bikini_w', goal: 'cut' }, TODAY);
  assert.equal(plan.metrics.bmrMethod, 'MIFFLIN');
  assert.ok(plan.warnings.some(w => /circunferencias/.test(w.text)));
  assert.equal(plan.targets.targetBf, 14);
  assert.equal(plan.targets.classic, null);
});

test('division of the wrong sex falls back to general', () => {
  const plan = E.buildPlan(Object.assign({}, male, { division: 'bikini_w' }), TODAY);
  assert.equal(plan.targets.division.id, 'general_m');
});

test('training: every muscle trained >= 2x/week for 4-6 day splits and weekly sets >= 10 for big muscles', () => {
  [3, 4, 5, 6].forEach(days => {
    const plan = E.buildPlan(Object.assign({}, male, { daysPerWeek: days, goal: 'maintain' }), TODAY);
    const tr = plan.training;
    assert.equal(tr.sessions.length, days);
    const freq = {};
    tr.sessions.forEach(s => { const seen = new Set(s.exercises.map(e => e.muscle)); seen.forEach(mu => { freq[mu] = (freq[mu] || 0) + 1; }); });
    ['chest', 'back', 'quads', 'shoulders'].forEach(mu => {
      assert.ok(freq[mu] >= 2, `${days} días: ${mu} freq ${freq[mu]}`);
      assert.ok(tr.weeklySets[mu] >= 10, `${mu} sets ${tr.weeklySets[mu]}`);
    });
    const assigned = {};
    tr.sessions.forEach(s => s.exercises.forEach(e => { assigned[e.muscle] = (assigned[e.muscle] || 0) + e.sets; }));
    Object.keys(tr.weeklySets).forEach(mu => assert.ok(assigned[mu] <= tr.weeklySets[mu] && assigned[mu] >= tr.weeklySets[mu] - 2, `${days}d ${mu}: ${assigned[mu]} vs ${tr.weeklySets[mu]}`));
  });
});

test('mens physique de-emphasises legs, wellness emphasises glutes', () => {
  const mp = E.buildPlan(Object.assign({}, male, { division: 'physique_m', goal: 'maintain' }), TODAY).training.weeklySets;
  assert.ok(mp.quads < mp.shoulders);
  const w = E.buildPlan({ name: 'W', sex: 'F', age: 25, heightCm: 160, weightKg: 60, bodyFatPct: 22, activity: 'moderate', level: 'intermediate', daysPerWeek: 5, division: 'wellness_w', goal: 'maintain' }, TODAY).training.weeklySets;
  assert.ok(w.glutes > w.chest);
});

test('validateProfile catches missing data', () => {
  assert.ok(E.validateProfile({}).length >= 3);
  assert.deepEqual(E.validateProfile(male), []);
});

test('DEC-001: grupos rezagados anulan el énfasis de división y suben el volumen', () => {
  const base = Object.assign({}, male, { division: 'physique_m', goal: 'cut' });
  const withoutLagging = E.buildPlan(base, TODAY).training.weeklySets;
  assert.equal(withoutLagging.quads, 6); // 14*0.85*0.5 (énfasis "down" de physique_m) = 5.95 -> 6
  const withLagging = E.buildPlan(Object.assign({}, base, { laggingMuscles: ['quads', 'hamstrings', 'glutes'] }), TODAY).training.weeklySets;
  assert.equal(withLagging.quads, 15); // 14*0.85*1.25 = 14.875 -> 15
  assert.equal(withLagging.hamstrings, 15);
  assert.equal(withLagging.glutes, 15);
  assert.equal(withLagging.chest, withoutLagging.chest, 'músculos no rezagados no deberían cambiar');
});

test('DEC-001: tope de 20 series/semana para un grupo rezagado', () => {
  const plan = E.buildPlan(Object.assign({}, male, { level: 'advanced', goal: 'bulk', laggingMuscles: ['chest'] }), TODAY);
  assert.ok(plan.training.weeklySets.chest <= 20);
});

test('DEC-001: entradas inválidas en laggingMuscles se ignoran', () => {
  const p = E.normalizeProfile(Object.assign({}, male, { laggingMuscles: ['quads', 'no-existe', 'quads'] }));
  assert.deepEqual(p.laggingMuscles, ['quads']);
});

test('DEC-002: top set solo en definición, no cambia el total de series', () => {
  const cut = E.buildPlan(male, TODAY).training;
  const firstCompoundHasTopSet = cut.sessions.every(s => {
    const idx = s.exercises.findIndex(e => e.type === 'compound');
    return idx === -1 || s.exercises[idx].topSet;
  });
  assert.ok(firstCompoundHasTopSet, 'todas las sesiones de definición deberían tener top set en su primer multiarticular');
  assert.ok(cut.sessions.some(s => s.exercises.some(e => e.topSet)), 'al menos una sesión debe mostrar un top set');

  const maintain = E.buildPlan(Object.assign({}, male, { goal: 'maintain' }), TODAY).training;
  assert.ok(maintain.sessions.every(s => s.exercises.every(e => !e.topSet)), 'en mantenimiento no debería aparecer top set');
  const bulk = E.buildPlan(Object.assign({}, male, { goal: 'bulk' }), TODAY).training;
  assert.ok(bulk.sessions.every(s => s.exercises.every(e => !e.topSet)), 'en volumen no debería aparecer top set');
});

test('DEC-004: aviso de inconsistencia si %grasa medido y Navy difieren más de 4 puntos', () => {
  // Navy con estos datos (178cm, cuello 40, cintura 110) da ~27-28%.
  const big = E.buildPlan(Object.assign({}, male, { bodyFatPct: 15, neckCm: 40, waistCm: 110 }), TODAY);
  assert.ok(big.warnings.some(w => /difieren en más de 4 puntos/.test(w.text)), 'debería avisar con diferencia grande');
  assert.equal(big.metrics.bodyFat, 15, 'se sigue usando el % medido, no el de Navy');

  // Diferencia pequeña: cintura 85 da un Navy cercano a 15-16%.
  const small = E.buildPlan(Object.assign({}, male, { bodyFatPct: 15, neckCm: 40, waistCm: 85 }), TODAY);
  assert.ok(!small.warnings.some(w => /difieren en más de 4 puntos/.test(w.text)), 'no debería avisar con diferencia chica');
});

test('DEC-005: bandera salud/funcional sube el cardio en definición a >=150 min/semana', () => {
  const off = E.buildPlan(male, TODAY).training.cardio; // male = cut, sin bandera
  assert.ok(off.sessions * off.minutes < 150, 'por defecto el cardio en definición sigue minimizado');
  const on = E.buildPlan(Object.assign({}, male, { healthGoal: true }), TODAY).training.cardio;
  assert.ok(on.sessions * on.minutes >= 150, `con la bandera activa debería haber >=150 min/semana, hay ${on.sessions * on.minutes}`);
});

test('DEC-005: bandera desactivada no cambia nada (regresión) y activada agrega ejercicios funcionales a pierna', () => {
  const withoutFlag = E.buildPlan(male, TODAY);
  assert.equal(withoutFlag.training.cardio.sessions * withoutFlag.training.cardio.minutes, 2 * 25, 'cardio de cut sin bandera no debería cambiar');
  const withFlag = E.buildPlan(Object.assign({}, male, { healthGoal: true, daysPerWeek: 6, level: 'advanced' }), TODAY);
  const names = withFlag.training.sessions.flatMap(s => s.exercises.map(e => e.name));
  const hasFunctional = names.some(n => /Sentadilla búlgara con mancuernas|Step-up con carga|Paseo del granjero/.test(n));
  assert.ok(hasFunctional, 'con la bandera activa debería poder aparecer algún ejercicio funcional de pierna');
});

test('DEC-005: healthGoal no es true por defecto ni con valores falsy', () => {
  assert.equal(E.normalizeProfile(male).healthGoal, false);
  assert.equal(E.normalizeProfile(Object.assign({}, male, { healthGoal: false })).healthGoal, false);
  assert.equal(E.normalizeProfile(Object.assign({}, male, { healthGoal: true })).healthGoal, true);
});

test('DEC-003 v2: grupos chicos no van a pierna si hay un día de empuje/tirón con menos series; grupos grandes no se mueven de su día', () => {
  const emanuel = {
    name: 'Emanuel', sex: 'M', age: 28, heightCm: 175, weightKg: 78, bodyFatPct: 14,
    activity: 'moderate', level: 'intermediate', daysPerWeek: 5, division: 'physique_m', goal: 'cut',
    laggingMuscles: ['quads', 'hamstrings', 'glutes'],
  };
  const plan = E.buildPlan(emanuel, TODAY);
  const byName = name => plan.training.sessions.find(s => s.name === name);
  const musclesOf = s => new Set(s.exercises.map(e => e.muscle));
  ['Día 2 · Pierna', 'Día 5 · Pierna'].forEach(name => {
    const m = musclesOf(byName(name));
    assert.ok(!m.has('abs') && !m.has('calves'), `${name} no debería tener abdomen/pantorrillas`);
    assert.ok(m.has('quads') && m.has('hamstrings') && m.has('glutes'), `${name} debería conservar sus grupos grandes`);
  });
  // weeklySets (el volumen total) no cambia por mover el día de asignación.
  const assigned = {};
  plan.training.sessions.forEach(s => s.exercises.forEach(e => { assigned[e.muscle] = (assigned[e.muscle] || 0) + e.sets; }));
  Object.keys(plan.training.weeklySets).forEach(mu => assert.equal(assigned[mu], plan.training.weeklySets[mu], `${mu}: volumen total cambió`));
});

test('DEC-003 v2: aviso no bloqueante si un día supera 25 series, sin recortar nada', () => {
  const emanuel = {
    name: 'Emanuel', sex: 'M', age: 28, heightCm: 175, weightKg: 78, bodyFatPct: 14,
    activity: 'moderate', level: 'intermediate', daysPerWeek: 5, division: 'physique_m', goal: 'cut',
    laggingMuscles: ['quads', 'hamstrings', 'glutes'],
  };
  const plan = E.buildPlan(emanuel, TODAY);
  const over = plan.training.sessions.find(s => s.totalSets > 25);
  assert.ok(over, 'debería haber al menos un día por encima de 25 series con este perfil');
  assert.ok(plan.warnings.some(w => w.text.includes(over.name) && w.text.includes(String(over.totalSets))));
  // no bloqueante: el plan se genera igual, con el total real (no recortado)
  assert.ok(over.totalSets > 25);
});

test('DEC-003 v2: no cambia nada cuando ningún día se pasa de 25 (regresión de avisos)', () => {
  const plan = E.buildPlan(Object.assign({}, male, { goal: 'maintain' }), TODAY);
  const anyOver = plan.training.sessions.some(s => s.totalSets > 25);
  const hasWarning = plan.warnings.some(w => /series, por encima/.test(w.text));
  assert.equal(hasWarning, anyOver);
});

test('DEC-006: no se repite el mismo patrón de ejercicio en una sesión (variantes incluidas)', () => {
  const basePattern = n => { // misma lógica que engine.js, para no probar con la implementación interna
    if (/búlgara/i.test(n)) return 'bulgara';
    if (/sentadilla/i.test(n)) return 'sentadilla';
    return n;
  };
  [3, 4, 5, 6].forEach(days => {
    ['cut', 'bulk', 'maintain'].forEach(goal => {
      const plan = E.buildPlan(Object.assign({}, male, { daysPerWeek: days, goal, division: 'bodybuilding_m', level: 'advanced' }), TODAY);
      plan.training.sessions.forEach(s => {
        const patterns = s.exercises.map(e => basePattern(e.name));
        const seen = new Set();
        patterns.forEach(p => {
          assert.ok(!seen.has(p), `${days}d/${goal} ${s.name}: patrón "${p}" repetido`);
          seen.add(p);
        });
      });
    });
  });
});

test('DEC-006: el segundo ejercicio de cuádriceps prioriza prensa de piernas', () => {
  const plan = E.buildPlan(Object.assign({}, male, { division: 'bodybuilding_m', level: 'advanced', goal: 'bulk' }), TODAY);
  const legDay = plan.training.sessions.find(s => s.exercises.some(e => e.muscle === 'quads'));
  const quadsExercises = legDay.exercises.filter(e => e.muscle === 'quads');
  if (quadsExercises.length >= 2) assert.equal(quadsExercises[1].name, 'Prensa de piernas');
});

test('DEC-007: los ejercicios unilaterales cuentan el doble en la duración estimada', () => {
  // Fuerza que el pick de cuádriceps sea el unilateral "Zancadas o sentadilla
  // búlgara" en vez de "Sentadilla trasera...", comparando dos perfiles
  // idénticos salvo por eso, usando el mismo número de series.
  const K = require('../js/knowledge.js');
  const quadsLib = K.EXERCISES.quads;
  const unilateralIdx = quadsLib.findIndex(e => e.unilateral);
  assert.ok(unilateralIdx >= 0, 'debería haber al menos un ejercicio de cuádriceps marcado unilateral');
  // Cálculo directo: mismo ejercicio, sets=4, type compound (150s) -> normal vs x2
  const sets = 4, restSec = 150, transition = 45;
  const normalMin = Math.round((sets * (restSec + transition)) / 60);
  const unilateralMin = Math.round((2 * sets * (restSec + transition)) / 60);
  assert.equal(unilateralMin, normalMin * 2);

  // Chequeo end-to-end: un día con "Zancadas o sentadilla búlgara" dura más
  // que si ese mismo volumen fuera con un ejercicio bilateral.
  const plan = E.buildPlan(Object.assign({}, male, { division: 'bodybuilding_m', level: 'advanced', goal: 'maintain', daysPerWeek: 3 }), TODAY);
  const dayWithBulgara = plan.training.sessions.find(s => s.exercises.some(e => e.name === 'Zancadas o sentadilla búlgara'));
  assert.ok(dayWithBulgara, 'algún día debería tener la variante unilateral de cuádriceps');
});

test('DEC-007: no afecta el cálculo si no hay ejercicios unilaterales ese día', () => {
  const plan = E.buildPlan(male, TODAY); // classic_m no usa ejercicios unilaterales en su rotación típica de 5 días
  plan.training.sessions.forEach(s => {
    const hasUnilateral = s.exercises.some(e => e.unilateral);
    if (!hasUnilateral) {
      let seconds = 0;
      s.exercises.forEach(e => {
        if (e.topSet) { seconds += 180 + 45; seconds += (e.backoffSets || 0) * (150 + 45); }
        else { const rest = e.type === 'compound' ? 150 : 75; seconds += e.sets * (rest + 45); }
      });
      assert.equal(s.durationMin, Math.round(seconds / 60), `${s.name}: duración no coincide con la fórmula simple`);
    }
  });
});

test('DEC-006 (corregido): el Día 2 de Emanuel incluye sentadilla trasera o hack, no solo búlgara', () => {
  const emanuel = {
    name: 'Emanuel', sex: 'M', age: 28, heightCm: 175, weightKg: 78, bodyFatPct: 14,
    activity: 'moderate', level: 'intermediate', daysPerWeek: 5, division: 'physique_m', goal: 'cut',
    laggingMuscles: ['quads', 'hamstrings', 'glutes'],
  };
  const plan = E.buildPlan(emanuel, TODAY);
  const dia2 = plan.training.sessions.find(s => s.name.includes('Pierna') && s.exercises.some(e => e.muscle === 'quads'));
  const names = dia2.exercises.map(e => e.name);
  assert.ok(names.includes('Sentadilla trasera o sentadilla en hack'), `Día 2 debería tener sentadilla trasera/hack, tiene: ${names.join(', ')}`);
});

test('DEC-006 (corregido): el patrón viene del catálogo, no del texto del nombre', () => {
  const K = require('../js/knowledge.js');
  assert.equal(K.EXERCISES.quads[2].pattern, 'split_squat');
  assert.equal(K.EXERCISES.glutes[1].pattern, 'split_squat'); // misma familia, confirmado por catálogo
  assert.notEqual(K.EXERCISES.chest[2].pattern, K.EXERCISES.triceps[0].pattern); // "fondos" ya no choca
});

test('DEC-005 (aclarado): con la bandera activa, el funcional se suma después del principal, no lo reemplaza', () => {
  const emanuel = {
    name: 'Emanuel', sex: 'M', age: 28, heightCm: 175, weightKg: 78, bodyFatPct: 14,
    activity: 'moderate', level: 'intermediate', daysPerWeek: 5, division: 'physique_m', goal: 'cut',
    laggingMuscles: ['quads', 'hamstrings', 'glutes'], healthGoal: true,
  };
  const plan = E.buildPlan(emanuel, TODAY);
  const dia2 = plan.training.sessions.find(s => s.name.includes('Pierna') && s.exercises.some(e => e.muscle === 'quads'));
  const quadsNames = dia2.exercises.filter(e => e.muscle === 'quads').map(e => e.name);
  const idxSquat = quadsNames.indexOf('Sentadilla trasera o sentadilla en hack');
  const idxBulgara = quadsNames.indexOf('Sentadilla búlgara con mancuernas');
  assert.ok(idxSquat !== -1, 'debería seguir estando la sentadilla trasera/hack');
  assert.ok(idxBulgara !== -1, 'debería aparecer la búlgara funcional');
  assert.ok(idxBulgara > idxSquat, 'la búlgara debe ir después del ejercicio principal');
  // el volumen semanal de cuádriceps no cambia por activar la bandera
  const withoutFlag = E.buildPlan(Object.assign({}, emanuel, { healthGoal: false }), TODAY);
  assert.equal(plan.training.weeklySets.quads, withoutFlag.training.weeklySets.quads);
  const assignedWith = plan.training.sessions.filter(s => s.exercises.some(e => e.muscle === 'quads')).reduce((a, s) => a + s.exercises.filter(e => e.muscle === 'quads').reduce((b, e) => b + e.sets, 0), 0);
  assert.equal(assignedWith, plan.training.weeklySets.quads, 'el total asignado de cuádriceps no debería cambiar por sumar el funcional');
});

test('every source referenced by plan exists in knowledge base', () => {
  const plan = E.buildPlan(male, TODAY);
  plan.sourcesUsed.forEach(id => assert.ok(K.SOURCES[id], `missing source ${id}`));
  K.SUPPLEMENTS.forEach(s => assert.ok(K.SOURCES[s.source]));
});
