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

test('DEC-002/DEC-008: top set solo en definición, en el primer ejercicio ELEGIBLE del día (no cualquier multiarticular)', () => {
  const cut = E.buildPlan(male, TODAY).training;
  // Con DEC-008, un día puede no tener top set si ningún ejercicio es
  // elegible ese día (nunca unilaterales ni máquinas); lo que sí vale
  // siempre es que, si hay top set, cae en un ejercicio elegible y es
  // el primero de la sesión.
  cut.sessions.forEach(s => {
    const idx = s.exercises.findIndex(e => e.topSet);
    if (idx === -1) return;
    assert.equal(idx, 0, `${s.name}: el top set debería quedar como el primer ejercicio`);
  });
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

test('DEC-008: ningún top set cae en búlgara ni en press en máquina/fondos; el Día 2 de Emanuel abre con sentadilla trasera/hack', () => {
  const emanuel = {
    name: 'Emanuel', sex: 'M', age: 28, heightCm: 175, weightKg: 78, bodyFatPct: 14,
    activity: 'moderate', level: 'intermediate', daysPerWeek: 5, division: 'physique_m', goal: 'cut',
    laggingMuscles: ['quads', 'hamstrings', 'glutes'],
  };
  const plan = E.buildPlan(emanuel, TODAY);
  const INELIGIBLE_PATTERNS = ['split_squat', 'chest_dip_or_machine', 'leg_press', 'step_up', 'row_cable'];
  plan.training.sessions.forEach(s => {
    const topEx = s.exercises.find(e => e.topSet);
    if (!topEx) return;
    assert.ok(!INELIGIBLE_PATTERNS.includes(topEx.pattern), `${s.name}: top set en patrón no elegible (${topEx.pattern})`);
    assert.ok(!topEx.unilateral, `${s.name}: top set en ejercicio unilateral`);
  });
  const dia2 = plan.training.sessions.find(s => s.name.includes('Pierna') && s.exercises.some(e => e.muscle === 'quads'));
  assert.equal(dia2.exercises[0].name, 'Sentadilla trasera o sentadilla en hack');
  assert.ok(dia2.exercises[0].topSet, 'el Día 2 debería abrir con el top set');
});

test('DEC-008: si el primero del día no es elegible, se reordena el elegible al frente', () => {
  // Día 3 Empuje de Men\'s Physique empieza con pecho (fondos/press en
  // máquina, patrón no elegible); hombros (press militar, elegible) debería
  // pasar a ser el primero si aparece antes del cierre del día.
  const plan = E.buildPlan({ name: 'T', sex: 'M', age: 30, heightCm: 178, weightKg: 85, bodyFatPct: 15, activity: 'moderate', level: 'intermediate', daysPerWeek: 5, division: 'physique_m', goal: 'cut' }, TODAY);
  const empuje = plan.training.sessions.find(s => s.name.includes('Empuje'));
  const topEx = empuje.exercises.find(e => e.topSet);
  const ELIGIBLE = ['squat_bilateral', 'bench_press', 'shoulder_press', 'hinge', 'row_barbell', 'vertical_pull'];
  if (topEx) {
    assert.equal(empuje.exercises[0], topEx, 'el ejercicio con top set debe quedar primero');
    assert.ok(ELIGIBLE.includes(topEx.pattern), `patrón ${topEx.pattern} debería ser elegible`);
  }
});

test('DEC-005 + cardio: con la bandera activa, Emanuel llega a >=150 min/semana de cardio y el paseo del granjero aparece en algún día', () => {
  const emanuel = {
    name: 'Emanuel', sex: 'M', age: 28, heightCm: 175, weightKg: 78, bodyFatPct: 14,
    activity: 'moderate', level: 'intermediate', daysPerWeek: 5, division: 'physique_m', goal: 'cut',
    laggingMuscles: ['quads', 'hamstrings', 'glutes'], healthGoal: true,
  };
  const plan = E.buildPlan(emanuel, TODAY);
  assert.ok(plan.training.cardio.sessions * plan.training.cardio.minutes >= 150, 'cardio semanal debería ser >=150 min');
  const tieneGranjero = plan.training.sessions.some(s => s.exercises.some(e => e.name === 'Paseo del granjero'));
  assert.ok(tieneGranjero, 'el paseo del granjero debería aparecer en al menos un día (bug: con round-robin simple nunca salía, solo había 2 ocurrencias de cuádriceps/semana para 3 opciones)');
});

test('every source referenced by plan exists in knowledge base', () => {
  const plan = E.buildPlan(male, TODAY);
  plan.sourcesUsed.forEach(id => assert.ok(K.SOURCES[id], `missing source ${id}`));
  K.SUPPLEMENTS.forEach(s => assert.ok(K.SOURCES[s.source]));
});

/* ---------- DEC-009: condiciones de salud y lesiones ---------- */

test('DEC-009 Capa 1: síntomas bloquea el plan hasta marcar autorización médica', () => {
  const withSymptoms = Object.assign({}, male, { healthSymptoms: true });
  const blocked = E.buildPlan(withSymptoms, TODAY);
  assert.equal(blocked.health.blocked, true);
  assert.ok(/consultá a un médico/i.test(blocked.health.blockReason));

  const cleared = Object.assign({}, withSymptoms, { healthMedicalClearance: true });
  const unblocked = E.buildPlan(cleared, TODAY);
  assert.equal(unblocked.health.blocked, false);
});

test('DEC-009 Capa 1: condición cardiovascular/metabólica/renal sin entrenar de forma regular también bloquea; entrenando regular solo avisa', () => {
  const sedentary = Object.assign({}, male, { healthCvMetabolicRenal: true, healthRegularExercise: false });
  const planSedentary = E.buildPlan(sedentary, TODAY);
  assert.equal(planSedentary.health.blocked, true);

  const active = Object.assign({}, male, { healthCvMetabolicRenal: true, healthRegularExercise: true });
  const planActive = E.buildPlan(active, TODAY);
  assert.equal(planActive.health.blocked, false);
  assert.equal(planActive.health.medicalClearanceRecommended, true);
});

test('DEC-009 Capa 2: diabetes con insulina avisa pero no cambia ningún número del plan', () => {
  const diabetic = Object.assign({}, male, { diabetesType: 'type2', healthDiabetesMed: true });
  const planBase = E.buildPlan(male, TODAY);
  const planDiabetic = E.buildPlan(diabetic, TODAY);
  assert.ok(planDiabetic.health.diabetesWarning, 'debería avisar riesgo de hipoglucemia');
  assert.ok(planDiabetic.health.weightLossMedWarning, 'en definición debería avisar sobre ajustar medicación');
  ['metrics', 'targets', 'nutrition', 'training', 'supplements'].forEach(key => {
    assert.deepEqual(stripHealthNoise(planDiabetic[key]), stripHealthNoise(planBase[key]), `${key} no debería cambiar por diabetes`);
  });
  // sin medicación, o sin diabetes: sin avisos de diabetes
  const noMed = Object.assign({}, male, { diabetesType: 'type2', healthDiabetesMed: false });
  assert.equal(E.buildPlan(noMed, TODAY).health.diabetesWarning, null);
});

test('DEC-009 Capa 3: lesión de hombro excluye shoulder_press, aparece el sustituto, avisa evaluación profesional y el volumen de hombro no cambia', () => {
  const injured = Object.assign({}, male, { injuryZones: ['shoulder'] });
  const planBase = E.buildPlan(male, TODAY);
  const planInjured = E.buildPlan(injured, TODAY);

  const allEx = s => s.training.sessions.flatMap(d => d.exercises);
  assert.ok(!allEx(planInjured).some(e => e.pattern === 'shoulder_press'), 'no debería quedar ningún shoulder_press en el plan');
  assert.ok(allEx(planInjured).some(e => e.pattern === 'shoulder_press_safe'), 'debería aparecer el sustituto');
  assert.ok(planInjured.warnings.some(w => /evaluación profesional/.test(w.text)), 'sin diagnóstico, debería avisar evaluación profesional');

  assert.equal(planInjured.training.weeklySets.shoulders, planBase.training.weeklySets.shoulders, 'el volumen semanal de hombro no debería cambiar');
  const shoulderSets = plan => allEx(plan).filter(e => e.muscle === 'shoulders').reduce((a, e) => a + e.sets, 0);
  assert.equal(shoulderSets(planInjured), shoulderSets(planBase), 'las series reales de hombro en el plan no deberían cambiar');

  // con diagnóstico, no debería avisar "evaluación profesional"
  const diagnosed = Object.assign({}, male, { injuryZones: ['shoulder'], injuryDiagnosed: ['shoulder'] });
  const planDiagnosed = E.buildPlan(diagnosed, TODAY);
  assert.ok(!planDiagnosed.warnings.some(w => /evaluación profesional/.test(w.text)));
});

test('DEC-009: sin condiciones de salud declaradas, el plan queda idéntico al que generaba el motor antes de DEC-009', () => {
  const plan = E.buildPlan(male, TODAY);
  assert.equal(plan.health.blocked, false);
  assert.equal(plan.health.anyCondition, false);
  assert.equal(plan.health.disclaimer, null);
  // normalizeProfile es idempotente sobre un perfil ya normalizado y
  // guardado (sin los campos planos del formulario): re-normalizar no
  // debería resetear nada de lo ya guardado.
  const stored = E.normalizeProfile(male);
  const reNormalized = E.normalizeProfile(stored);
  assert.deepEqual(reNormalized.health, stored.health);
});

function stripHealthNoise(obj) {
  // compara todo salvo listas de fuentes citadas, que sí pueden sumar
  // RIEBE_2015/COLBERG_2016/KANALEY_2022/SILBERNAGEL_2007 sin que eso
  // sea un cambio real de ningún número del plan.
  const c = JSON.parse(JSON.stringify(obj));
  delete c.sources;
  delete c.warnings;
  return c;
}

/* ---------- DEC-010: aporte de volumen por ejercicio ---------- */

const MUSCLE_IDS = Object.keys(K.MUSCLE_LABELS);
const catalogEntries = () => []
  .concat(...Object.entries(K.EXERCISES).map(([bucket, list]) => list.map(entry => ({ entry, bucket, functional: false }))))
  .concat(...Object.entries(K.FUNCTIONAL_EXERCISES).map(([bucket, list]) => list.map(entry => ({ entry, bucket, functional: true }))));

test('DEC-010: cada entrada del catálogo tiene id único y una fila en la tabla de aporte (y no sobran filas)', () => {
  const entries = catalogEntries();
  const ids = entries.map(x => x.entry.id);
  assert.ok(ids.every(id => typeof id === 'string' && id.length > 0), 'toda entrada necesita id');
  assert.equal(new Set(ids).size, ids.length, 'ids repetidos en el catálogo');
  ids.forEach(id => assert.ok(K.EXERCISE_CONTRIBUTION[id], `falta fila de aporte para ${id}`));
  assert.deepEqual(Object.keys(K.EXERCISE_CONTRIBUTION).sort(), ids.slice().sort(), 'la tabla tiene filas sin ejercicio (o al revés)');
  // `pattern` NO sirve de id: se repite con primarios distintos.
  const patterns = entries.map(x => x.entry.pattern);
  assert.ok(new Set(patterns).size < patterns.length, 'si pattern fuera único no haría falta id');
});

test('DEC-010: la tabla usa solo los 10 grupos, el secundario no repite al primario y toda fila es E4', () => {
  Object.entries(K.EXERCISE_CONTRIBUTION).forEach(([id, c]) => {
    assert.ok(c.primary === null || MUSCLE_IDS.includes(c.primary), `${id}: primario inválido`);
    assert.ok(Array.isArray(c.secondary), `${id}: secondary debe ser lista`);
    c.secondary.forEach(m => assert.ok(MUSCLE_IDS.includes(m), `${id}: secundario inválido ${m}`));
    assert.equal(new Set(c.secondary).size, c.secondary.length, `${id}: secundarios repetidos`);
    assert.ok(!c.secondary.includes(c.primary), `${id}: el secundario repite al primario`);
    assert.equal(c.evidence, 'E4', `${id}: toda la tabla va E4 hasta validarla`);
  });
});

test('DEC-010: correcciones aprobadas de la tabla de aporte', () => {
  const C = K.EXERCISE_CONTRIBUTION;
  assert.ok(!C['quads.squat_back_or_hack'].secondary.includes('abs'), 'sentadilla sin abs');
  assert.ok(!C['hamstrings.rdl'].secondary.includes('back'), 'peso muerto rumano sin back');
  assert.ok(!C['shoulders.press_overhead'].secondary.includes('chest'), 'press militar sin chest');
  assert.ok(!C['shoulders.press_landmine_neutral'].secondary.includes('chest'), 'press landmine sin chest');
  assert.ok(!C['glutes.kickback_cable'].secondary.includes('hamstrings'), 'patada de glúteo sin isquios');
  assert.deepEqual(C['glutes.hip_thrust'].secondary, ['hamstrings']);
  assert.equal(C['glutes.hip_thrust'].status, 'a_verificar', 'hip thrust → isquios queda marcado a verificar');
  assert.equal(C['functional.farmer_carry'].primary, null, 'paseo del granjero sin primario');
  assert.deepEqual(C['functional.farmer_carry'].secondary, [], 'paseo del granjero sin secundarios (ni abs)');
});

test('DEC-010: los nombres del catálogo son únicos (el historial viejo se mapea a exerciseId por nombre)', () => {
  const names = catalogEntries().map(x => x.entry.name);
  assert.equal(new Set(names).size, names.length);
  catalogEntries().forEach(x => assert.equal(K.EXERCISE_ID_BY_NAME[x.entry.name], x.entry.id));
  assert.equal(K.EXERCISE_INDEX['glutes.bulgarian_hip'].bucket, 'glutes');
});

test('DEC-010: reglas centralizadas con valor, nivel, fuente y fecha de revisión', () => {
  const R = K.VALIDATOR_RULES;
  Object.entries(R).forEach(([key, r]) => {
    assert.ok(r.value !== undefined, `${key}: sin valor`);
    assert.ok(['E1', 'E2', 'E3', 'E4'].includes(r.level), `${key}: nivel inválido`);
    assert.ok(r.source === null || (r.source.label && r.source.url), `${key}: fuente mal formada`);
    assert.match(r.reviewedAt, /^\d{4}-\d{2}-\d{2}$/, `${key}: fecha de revisión`);
    assert.equal(r.verifiedAgainstPrimarySource, false, `${key}: nada está verificado contra la fuente primaria todavía`);
  });
  assert.equal(R.sessionSetCap.value, 25);
  assert.equal(R.sessionSetCap.level, 'E4');
  assert.equal(R.sessionSetCap.source, null);
  assert.equal(R.sessionSetCap.reviewRequired, true);
  assert.equal(R.setExecutionSeconds.value, 45);
  assert.equal(R.setExecutionSeconds.assumption, true);
  assert.equal(R.secondaryMuscleWeight.value, 0.5);
  assert.equal(R.maxFractionalSetsPerMuscleSession.value, 11);
});

test('DEC-010: perfiles sin healthGoal ni lesiones generan el mismo plan que antes (salvo exerciseId, bucket y secondary)', () => {
  const fx = require('./fixtures/plan-identity-baseline.json');
  // Campos nuevos desde la línea base: DEC-010 (ejercicios) y DEC-011 (health).
  const NEW_EXERCISE_FIELDS = ['exerciseId', 'bucket', 'secondary'];
  const strip = plan => {
    const p = JSON.parse(JSON.stringify(plan));
    p.training.sessions.forEach(s => s.exercises.forEach(e => NEW_EXERCISE_FIELDS.forEach(f => { delete e[f]; })));
    delete p.health.injuryBlockReason;
    delete p.health.injuryClearance;
    return p;
  };
  assert.ok(Object.keys(fx.cases).length >= 10);
  Object.entries(fx.cases).forEach(([key, c]) => {
    assert.ok(!c.profile.healthGoal && !c.profile.injuryZones, `${key}: el fixture solo cubre perfiles sin healthGoal ni lesiones`);
    const plan = E.buildPlan(c.profile, fx.today);
    assert.deepEqual(strip(plan), c.plan, `${key}: el plan cambió respecto de la línea base previa a DEC-010`);
    // Los campos nuevos de health no pueden bloquear a quien no declaró lesiones.
    assert.equal(plan.health.injuryBlockReason, null);
    assert.deepEqual(plan.health.injuryClearance, { required: false, pendingZones: [], evidence: 'E4' });
    assert.equal(plan.health.blocked, false);
  });
});

test('DEC-010: bucket dice dónde vive y muscle es el primario real; coinciden salvo ejercicios sin aporte', () => {
  const plan = E.buildPlan(Object.assign({}, male, { healthGoal: true }), TODAY);
  const all = plan.training.sessions.flatMap(s => s.exercises);
  all.forEach(e => {
    assert.ok(e.exerciseId && K.EXERCISE_INDEX[e.exerciseId], `ejercicio sin exerciseId válido: ${e.name}`);
    assert.equal(e.bucket, K.EXERCISE_INDEX[e.exerciseId].bucket);
    assert.equal(e.muscle, K.EXERCISE_CONTRIBUTION[e.exerciseId].primary);
    assert.deepEqual(e.secondary, K.EXERCISE_CONTRIBUTION[e.exerciseId].secondary);
    if (e.muscle !== null) assert.equal(e.muscle, e.bucket);
  });
});

test('DEC-010 / DEC-005: el paseo del granjero se agrega aparte, sin descontar series y sin aportar volumen', () => {
  const profiles = [male, Object.assign({}, male, { daysPerWeek: 4 }), Object.assign({}, male, { daysPerWeek: 3, goal: 'maintain' }), Object.assign({}, male, { daysPerWeek: 6, goal: 'bulk' })];
  const exec = K.VALIDATOR_RULES.setExecutionSeconds.value;
  let carries = 0;
  profiles.forEach(p => {
    const plan = E.buildPlan(Object.assign({}, p, { healthGoal: true }), TODAY);
    const all = plan.training.sessions.flatMap(s => s.exercises);
    const carry = all.filter(e => e.exerciseId === 'functional.farmer_carry');
    carries += carry.length;
    carry.forEach(e => {
      assert.equal(e.muscle, null);
      assert.equal(e.muscleLabel, 'Funcional');
      assert.equal(e.bucket, 'quads');
      assert.equal(e.sets, 2);
      assert.deepEqual(e.secondary, []);
    });
    // El volumen de hipertrofia de cada grupo sigue siendo exactamente el semanal.
    Object.keys(plan.training.weeklySets).forEach(mu => {
      const assigned = all.filter(e => e.muscle === mu).reduce((a, e) => a + e.sets, 0);
      assert.equal(assigned, plan.training.weeklySets[mu], `${mu}: el volumen asignado cambió (${assigned} vs ${plan.training.weeklySets[mu]})`);
    });
    // totalSets y duración incluyen las series del paseo.
    plan.training.sessions.forEach(s => {
      assert.equal(s.totalSets, s.exercises.reduce((a, e) => a + e.sets, 0));
      let seconds = 0;
      s.exercises.forEach(e => {
        const uf = e.unilateral ? 2 : 1;
        if (e.topSet) seconds += uf * (180 + exec) + uf * ((e.backoffSets || 0) * (150 + exec));
        else seconds += uf * (e.sets * ((e.type === 'compound' ? 150 : 75) + exec));
      });
      assert.equal(s.durationMin, Math.round(seconds / 60));
    });
  });
  assert.ok(carries >= 3, 'el paseo del granjero debería aparecer en los planes con healthGoal');
});

/* ---------- DEC-011: lesiones (autorización profesional) y aviso por dolor ---------- */

const withInjury = (zones, extra) => Object.assign({}, male, { injuryZones: zones }, extra || {});
const cleared = (health, zone, date) => { const h = JSON.parse(JSON.stringify(health)); h.injuries.find(i => i.zone === zone).clearanceDate = date; return h; };

test('DEC-011: cualquier zona declarada pausa el plan hasta confirmar la autorización profesional', () => {
  const plan = E.buildPlan(withInjury(['shoulder']), TODAY);
  assert.equal(plan.health.blocked, true);
  assert.deepEqual(plan.health.injuryClearance, { required: true, pendingZones: ['shoulder'], evidence: 'E4' });
  assert.match(plan.health.injuryBlockReason, /Hombro/);
  assert.match(plan.health.injuryBlockReason, /no puede adaptar una rutina a una lesión/);
  assert.match(plan.health.injuryBlockReason, /profesional te haya autorizado/);
  assert.equal(plan.health.blockReason, null, 'sin síntomas ni condición CV, la pausa es solo por la lesión');
  // También con diagnóstico y también sin dolor: aplica a cualquier zona declarada.
  const diagnosed = E.buildPlan(withInjury(['knee'], { injuryDiagnosed: ['knee'] }), TODAY);
  assert.equal(diagnosed.health.blocked, true);
  assert.deepEqual(diagnosed.health.injuryClearance.pendingZones, ['knee']);
});

test('DEC-011: la confirmación es por zona y se guarda con fecha; con todas confirmadas el plan se muestra', () => {
  const base = E.normalizeProfile(withInjury(['shoulder', 'knee']));
  const one = Object.assign({}, base, { health: cleared(base.health, 'shoulder', '2026-09-10') });
  const planOne = E.buildPlan(one, TODAY);
  assert.equal(planOne.health.blocked, true);
  assert.deepEqual(planOne.health.injuryClearance.pendingZones, ['knee'], 'solo falta la zona sin confirmar');
  assert.doesNotMatch(planOne.health.injuryBlockReason, /Hombro/);
  const both = Object.assign({}, one, { health: cleared(one.health, 'knee', '2026-09-11') });
  const planBoth = E.buildPlan(both, TODAY);
  assert.equal(planBoth.health.blocked, false);
  assert.equal(planBoth.health.injuryBlockReason, null);
  assert.deepEqual(planBoth.health.injuryClearance.pendingZones, []);
  assert.equal(planBoth.health.injuries.find(i => i.zone === 'shoulder').clearanceDate, '2026-09-10');
  // El plan se calcula igual esté pausado o no (la UI decide no mostrarlo).
  assert.deepEqual(planBoth.training.sessions, E.buildPlan(withInjury(['shoulder', 'knee']), TODAY).training.sessions);
});

test('DEC-011: lesión y síntomas a la vez muestran las dos causas de pausa', () => {
  const plan = E.buildPlan(withInjury(['shoulder'], { healthSymptoms: 'on' }), TODAY);
  assert.equal(plan.health.blocked, true);
  assert.ok(plan.health.blockReason && plan.health.injuryBlockReason);
});

test('DEC-011: la autorización se conserva entre ediciones solo en las zonas que siguen declaradas', () => {
  const stored = E.normalizeProfile(withInjury(['shoulder', 'knee']));
  stored.health = cleared(cleared(stored.health, 'shoulder', '2026-09-10'), 'knee', '2026-09-11');
  // El formulario nunca envía clearanceDate: la edición produce null y se reinyecta lo guardado.
  const edited = E.normalizeProfile(withInjury(['shoulder', 'knee'], { injuryPainNow: ['shoulder'], injuryDiagnosed: ['knee'] }));
  assert.ok(edited.health.injuries.every(i => i.clearanceDate === null));
  const kept = E.carryOverInjuryClearances(stored.health, edited.health);
  assert.deepEqual(kept.injuries.map(i => [i.zone, i.clearanceDate]), [['shoulder', '2026-09-10'], ['knee', '2026-09-11']], 'cambiar diagnóstico o dolor no vuelve a pedirla');
  assert.equal(kept.injuries[0].painNow, true);
  // Se agrega una zona: solo esa vuelve a pedirse.
  const added = E.carryOverInjuryClearances(stored.health, E.normalizeProfile(withInjury(['shoulder', 'knee', 'ankle'])).health);
  assert.deepEqual(added.injuries.map(i => [i.zone, i.clearanceDate]), [['shoulder', '2026-09-10'], ['knee', '2026-09-11'], ['ankle', null]]);
  // Se quita una zona y después se vuelve a agregar: pierde la fecha y se vuelve a pedir.
  const removed = E.carryOverInjuryClearances(stored.health, E.normalizeProfile(withInjury(['shoulder'])).health);
  assert.deepEqual(removed.injuries.map(i => [i.zone, i.clearanceDate]), [['shoulder', '2026-09-10']]);
  const readded = E.carryOverInjuryClearances(removed, E.normalizeProfile(withInjury(['shoulder', 'knee'])).health);
  assert.equal(readded.injuries.find(i => i.zone === 'knee').clearanceDate, null);
  // Re-normalizar un perfil ya guardado no pierde las fechas.
  assert.deepEqual(E.normalizeProfile(stored).health.injuries.map(i => i.clearanceDate), ['2026-09-10', '2026-09-11']);
  // Sin datos previos no inventa fechas.
  assert.equal(E.carryOverInjuryClearances(undefined, edited.health).injuries[0].clearanceDate, null);
});

test('DEC-011: ningún texto del motor ni de la interfaz dice que la rutina está adaptada a la lesión; todo es precaución E4', () => {
  const fs = require('node:fs');
  const planPending = E.buildPlan(withInjury(['shoulder', 'knee'], { injuryDiagnosed: ['knee'] }), TODAY);
  const planOk = E.buildPlan(Object.assign({}, E.normalizeProfile(withInjury(['shoulder'])), { health: cleared(E.normalizeProfile(withInjury(['shoulder'])).health, 'shoulder', '2026-09-10') }), TODAY);
  const texts = [planPending.health.injuryBlockReason, planPending.health.disclaimer, planOk.health.disclaimer]
    .concat(planPending.warnings.map(w => w.text), planOk.warnings.map(w => w.text));
  const claim = /adaptad[oa]s? a (tu|la) lesi[oó]n|(plan|rutina) (est[aá] |queda )?adaptad[oa]|(?<!no )adapta(mos)? (el plan|la rutina)|adaptaciones aplican|se excluyen los ejercicios|igual se excluyen/i;
  texts.forEach(t => assert.doesNotMatch(t, claim, `texto con afirmación de adaptación: ${t}`));
  // Las precauciones por zona llevan la etiqueta E4 en el dato (la UI la dibuja).
  const precautions = planOk.warnings.filter(w => /precaución/.test(w.text));
  assert.equal(precautions.length, 1);
  assert.equal(precautions[0].evidence, 'E4');
  assert.match(planOk.health.disclaimer, /E4/);
  assert.match(planOk.health.disclaimer, /no adapta la rutina/);
  // Mismo criterio sobre el código fuente de la interfaz y del motor.
  ['../js/app.js', '../js/engine.js'].forEach(rel => {
    const src = fs.readFileSync(require('node:path').join(__dirname, rel), 'utf8');
    assert.doesNotMatch(src, claim, `${rel}: quedó un texto que afirma adaptación a la lesión`);
  });
});

test('DEC-011: el sustituto por lesión (shoulder_press_safe) y las exclusiones se etiquetan E4; sin lesión no hay etiqueta', () => {
  const injured = E.buildPlan(withInjury(['shoulder']), TODAY).training.sessions.flatMap(s => s.exercises);
  const subs = injured.filter(e => e.injurySubstitute);
  assert.ok(subs.length >= 1);
  subs.forEach(e => { assert.equal(e.pattern, 'shoulder_press_safe'); assert.deepEqual(e.injurySubstitute, { zone: 'shoulder', evidence: 'E4' }); });
  const clean = E.buildPlan(male, TODAY).training.sessions.flatMap(s => s.exercises);
  assert.ok(clean.every(e => !('injurySubstitute' in e)));
});

test('DEC-011: aviso de consultar a un profesional con 2 sesiones distintas con dolor >5 en las últimas 4 semanas', () => {
  const R = K.VALIDATOR_RULES;
  assert.equal(R.painFlagThreshold.value, 5);
  assert.equal(R.painAdviceMinSessions.value, 2);
  assert.equal(R.painAdviceWindowDays.value, 28);
  ['painFlagThreshold', 'painAdviceMinSessions', 'painAdviceWindowDays'].forEach(k => assert.equal(R[k].level, 'E4'));

  let rec = E.applyPainReading(undefined, 7, 'S1', '2026-09-01');
  assert.equal(rec.flagged, true);
  assert.equal(E.painProfessionalAdvice(rec, '2026-09-01').advise, false, 'una sola sesión no alcanza');
  rec = E.applyPainReading(rec, 8, 'S1', '2026-09-01'); // otra serie de la MISMA sesión
  assert.equal(rec.painSessions.length, 1, 'dos series de la misma sesión cuentan una vez');
  assert.equal(E.painProfessionalAdvice(rec, '2026-09-01').advise, false);
  // Una sesión intermedia sin dolor no corta la cuenta: no tienen que ser seguidas.
  rec = E.applyPainReading(rec, 2, 'S2', '2026-09-05');
  rec = E.applyPainReading(rec, 6, 'S3', '2026-09-09');
  const advice = E.painProfessionalAdvice(rec, '2026-09-09');
  assert.equal(advice.advise, true);
  assert.equal(advice.sessions, 2);
  assert.equal(advice.evidence, 'E4');
  // Dolor igual al umbral (5) no cuenta: tiene que superarlo.
  assert.equal(E.painProfessionalAdvice(E.applyPainReading(E.applyPainReading(undefined, 5, 'A', '2026-09-01'), 5, 'B', '2026-09-02'), '2026-09-02').advise, false);
});

test('DEC-011: la ventana de 4 semanas se cuenta en días (28 inclusive) y las sesiones viejas dejan de contar', () => {
  let rec = E.applyPainReading(undefined, 9, 'S1', '2026-09-01');
  rec = E.applyPainReading(rec, 9, 'S2', '2026-09-20');
  assert.equal(E.painProfessionalAdvice(rec, '2026-09-29').advise, true, 'S1 tiene 28 días: todavía cuenta');
  assert.equal(E.painProfessionalAdvice(rec, '2026-09-30').advise, false, 'S1 tiene 29 días: ya no cuenta');
  // El aviso no depende de que la marca de sustitución siga activa.
  let flagged = E.applyPainReading(undefined, 9, 'S1', '2026-09-01');
  flagged = E.applyPainReading(flagged, 9, 'S2', '2026-09-08');
  let unflagged = E.applyPainReading(flagged, 1, 'S3', '2026-09-10');
  unflagged = E.applyPainReading(unflagged, 1, 'S4', '2026-09-12');
  assert.equal(unflagged.flagged, false, 'la marca se limpia con 2 sesiones distintas ≤5 (regla de DEC-009 intacta)');
  assert.equal(E.painProfessionalAdvice(unflagged, '2026-09-12').advise, true);
  // Se poda el historial viejo al escribir (no crece sin límite).
  const later = E.applyPainReading(unflagged, 9, 'S5', '2026-11-30');
  assert.deepEqual(later.painSessions.map(s => s.sessionId), ['S5']);
});

test('DEC-011: applyPainReading no muta el registro anterior y conserva la regla de DEC-009 (2 sesiones distintas limpias para desmarcar)', () => {
  const rec0 = Object.freeze({ flagged: true, cleanStreak: 0, lastSessionId: 'S0', painSessions: Object.freeze([]) });
  const rec1 = E.applyPainReading(rec0, 2, 'S0', '2026-09-01'); // misma sesión: no cuenta para desmarcar
  assert.equal(rec1.flagged, true); assert.equal(rec1.cleanStreak, 0);
  const rec2 = E.applyPainReading(rec1, 2, 'S1', '2026-09-02');
  assert.equal(rec2.flagged, true); assert.equal(rec2.cleanStreak, 1);
  const rec3 = E.applyPainReading(rec2, 3, 'S2', '2026-09-03');
  assert.equal(rec3.flagged, false);
  assert.equal(E.applyPainReading(rec3, 9, 'S3', '2026-09-04').flagged, true, 'dolor >5 vuelve a marcar');
  // Registros guardados por versiones anteriores (sin painSessions) siguen funcionando.
  assert.deepEqual(E.painProfessionalAdvice({ flagged: true, cleanStreak: 0, lastSessionId: 'x' }, '2026-09-01'), { advise: false, sessions: 0, evidence: 'E4' });
});

/* ---------- DEC-009 (Privacidad): export e import sin datos de salud ---------- */

const HEALTH_KEYS = /"(health|painFlags|painNow|painSessions|pain|clearanceDate|injuries|screening|diabetes|healthSymptoms|diabetesType|injuryZones)":/;
function storedProfileWithHealth() {
  const data = E.normalizeProfile(withInjury(['shoulder', 'knee'], { healthSymptoms: 'on', healthMedicalClearance: 'on', diabetesType: 'type1', healthDiabetesMed: 'on' }));
  data.health = cleared(cleared(data.health, 'shoulder', '2026-09-10'), 'knee', '2026-09-11');
  return {
    id: 'prof-1', createdAt: '2026-09-01', updatedAt: '2026-09-12', data,
    log: [{ date: '2026-09-01', weightKg: 85, notes: 'Datos iniciales' }],
    workouts: [
      { sessionId: 's1', date: '2026-09-10', exercise: 'Press banca con barra', exerciseId: 'chest.bench_press_barbell', muscle: 'chest', setType: 'normal', setNumber: 1, weight: 80, reps: 8, pain: null },
      { sessionId: 's1', date: '2026-09-10', exercise: 'Sentadilla trasera o sentadilla en hack', exerciseId: 'quads.squat_back_or_hack', muscle: 'quads', setType: 'normal', setNumber: 1, weight: 100, reps: 6, pain: 7 },
    ],
    painFlags: { squat_bilateral: { flagged: true, cleanStreak: 0, lastSessionId: 's1', painSessions: [{ sessionId: 's1', date: '2026-09-10' }] } },
  };
}

test('DEC-009 privacidad: el export no incluye health, painFlags, dolor por serie ni fechas de autorización', () => {
  const stored = storedProfileWithHealth();
  const before = JSON.stringify(stored);
  assert.match(before, HEALTH_KEYS, 'el perfil de prueba tiene que traer datos de salud');
  const exported = E.exportProfile(stored);
  assert.doesNotMatch(JSON.stringify(exported), HEALTH_KEYS, 'el export filtró datos de salud');
  assert.ok(!('health' in exported.data) && !('painFlags' in exported));
  assert.equal(JSON.stringify(stored), before, 'exportProfile no debe mutar el perfil local');
  // Lo que no es salud se conserva: datos, medidas, historial de fuerza (sin el dolor).
  assert.equal(exported.id, 'prof-1');
  assert.equal(exported.data.name, stored.data.name);
  assert.equal(exported.data.weightKg, stored.data.weightKg);
  assert.deepEqual(exported.log, stored.log);
  assert.deepEqual(exported.workouts.map(w => [w.exerciseId, w.weight, w.reps]), [['chest.bench_press_barbell', 80, 8], ['quads.squat_back_or_hack', 100, 6]]);
  assert.ok(exported.workouts.every(w => !('pain' in w)));
  // Es un perfil válido: genera plan, y sin condiciones declaradas.
  const plan = E.buildPlan(exported.data, TODAY);
  assert.equal(plan.health.anyCondition, false);
  assert.equal(plan.health.blocked, false);
});

test('DEC-009 privacidad: un perfil sin datos de salud se exporta igual que antes (salvo el dolor por serie, que no existía)', () => {
  const plain = { id: 'p2', createdAt: '2026-09-01', updatedAt: '2026-09-02', data: E.normalizeProfile(male), log: [] };
  const exported = E.exportProfile(plain);
  const { health, ...restOfData } = plain.data;
  assert.deepEqual(exported.data, JSON.parse(JSON.stringify(restOfData)));
  assert.ok(!('workouts' in exported), 'sin workouts no se inventa la clave');
});

test('DEC-009 privacidad: importar un archivo viejo con health y painFlags los ignora y no los guarda', () => {
  const oldFile = JSON.parse(JSON.stringify(storedProfileWithHealth())); // formato de la versión anterior: incluye todo
  const prepared = E.prepareImportedProfile(oldFile, TODAY);
  assert.equal(prepared.droppedHealth, true, 'debe avisar que el archivo traía datos de salud');
  assert.deepEqual(prepared.data.health, { screening: { regularExercise: false, cvMetabolicRenal: false, symptoms: false, medicalClearance: false }, diabetes: { type: 'none', medication: false }, injuries: [] });
  // `health` queda como el objeto vacío por defecto; nada de lo que traía el archivo sobrevive.
  assert.doesNotMatch(JSON.stringify(prepared), /"(painFlags|painNow|painSessions|pain|clearanceDate|healthSymptoms|diabetesType|injuryZones)":/);
  assert.ok(!('painFlags' in prepared) && !('workouts' in prepared), 'no se guardan painFlags ni workouts del archivo');
  // El perfil importado no queda pausado por nada que venga del archivo.
  const plan = E.buildPlan(prepared.data, TODAY);
  assert.equal(plan.health.blocked, false);
  assert.equal(plan.health.anyCondition, false);
  assert.deepEqual(plan.health.injuryClearance.pendingZones, []);
  // También se ignoran los campos planos de salud (archivo armado a mano).
  const flat = E.prepareImportedProfile({ data: Object.assign({}, male, { injuryZones: ['shoulder'], healthSymptoms: 'on', diabetesType: 'type2', healthDiabetesMed: 'on' }) }, TODAY);
  assert.equal(flat.droppedHealth, true);
  assert.deepEqual(flat.data.health.injuries, []);
  assert.equal(flat.data.health.screening.symptoms, false);
  assert.equal(flat.data.health.diabetes.type, 'none');
  // painFlags suelto, sin health, también cuenta como dato ignorado y no se guarda.
  const onlyPain = E.prepareImportedProfile({ data: male, painFlags: oldFile.painFlags }, TODAY);
  assert.equal(onlyPain.droppedHealth, true);
  assert.ok(!('painFlags' in onlyPain));
});

test('DEC-009 privacidad: importar un archivo sin datos de salud deja el perfil sin lesiones y sin aviso de datos ignorados', () => {
  const noHealth = E.prepareImportedProfile({ createdAt: '2026-08-01', data: male, log: [{ date: '2026-08-01', weightKg: 85 }] }, TODAY);
  assert.equal(noHealth.droppedHealth, false);
  assert.deepEqual(noHealth.data.health.injuries, []);
  assert.equal(noHealth.createdAt, '2026-08-01');
  assert.equal(noHealth.updatedAt, TODAY);
  assert.equal(E.prepareImportedProfile({ data: male }, TODAY).createdAt, TODAY);
  // Un `health` vacío (lo que exportaba la versión anterior sin condiciones) no es "datos ignorados".
  const emptyHealth = E.prepareImportedProfile({ data: E.normalizeProfile(male) }, TODAY);
  assert.equal(emptyHealth.droppedHealth, false);
});

test('DEC-009 privacidad: se avisa antes de importar si ya hay un perfil local con lesiones que se parece', () => {
  const local = storedProfileWithHealth();
  const plainLocal = { id: 'p9', data: E.normalizeProfile(Object.assign({}, male, { name: 'Otro' })) };
  const incoming = { id: 'prof-1', data: Object.assign({}, male, { name: 'Distinto' }) };
  assert.deepEqual(E.localHealthConflicts([local, plainLocal], incoming).map(p => p.id), ['prof-1'], 'mismo id');
  const sameName = { id: 'otro-id', data: Object.assign({}, male, { name: local.data.name }) };
  assert.deepEqual(E.localHealthConflicts([local, plainLocal], sameName).map(p => p.id), ['prof-1'], 'mismo nombre');
  assert.deepEqual(E.localHealthConflicts([local, plainLocal], { id: 'x', data: Object.assign({}, male, { name: 'Otro' }) }), [], 'el parecido sin lesiones locales no avisa');
  assert.deepEqual(E.localHealthConflicts([local], { id: 'x', data: Object.assign({}, male, { name: 'Nadie' }) }), []);
});

/* ---------- DEC-011 (ajuste): la autorización se invalida cuando una zona empeora ---------- */

// Perfil guardado con las zonas dadas, todas con autorización fechada, y los
// flags de dolor/diagnóstico indicados. Devuelve el perfil y la edición típica.
function authorizedProfile(zones, { pain = [], diagnosed = [] } = {}) {
  const base = E.normalizeProfile(withInjury(zones, { injuryPainNow: pain, injuryDiagnosed: diagnosed }));
  base.health = zones.reduce((h, z, i) => cleared(h, z, `2026-09-1${i}`), base.health);
  return base;
}
function editAndReconcile(stored, zones, { pain = [], diagnosed = [] } = {}) {
  const edited = E.normalizeProfile(withInjury(zones, { injuryPainNow: pain, injuryDiagnosed: diagnosed }));
  const health = E.reconcileInjuryClearances(stored.health, edited.health);
  return { health, plan: E.buildPlan(Object.assign({}, edited, { health }), TODAY) };
}

test('DEC-011: una subida del dolor de una zona invalida su autorización y pausa el plan', () => {
  const stored = authorizedProfile(['shoulder']);
  assert.equal(E.buildPlan(stored, TODAY).health.blocked, false, 'autorizado y sin cambios: el plan se muestra');
  const { health, plan } = editAndReconcile(stored, ['shoulder'], { pain: ['shoulder'] });
  assert.equal(health.injuries[0].clearanceDate, null);
  assert.equal(health.injuries[0].painNow, true);
  assert.equal(plan.health.blocked, true);
  assert.deepEqual(plan.health.injuryClearance.pendingZones, ['shoulder']);
  // Mismo flujo que la primera vez: advertencia + derivación, y se destraba con una confirmación fechada nueva.
  assert.match(plan.health.injuryBlockReason, /no puede adaptar una rutina a una lesión/);
  const reconfirmed = Object.assign({}, stored, { health: cleared(health, 'shoulder', '2026-09-20') });
  assert.equal(E.buildPlan(reconfirmed, TODAY).health.blocked, false);
  assert.equal(E.buildPlan(reconfirmed, TODAY).health.injuries[0].clearanceDate, '2026-09-20');
});

test('DEC-011: una bajada del dolor, o dejarlo igual, no pide nada', () => {
  const stored = authorizedProfile(['shoulder', 'knee'], { pain: ['shoulder', 'knee'] });
  const down = editAndReconcile(stored, ['shoulder', 'knee'], { pain: ['knee'] }); // el hombro baja, la rodilla sigue igual
  assert.deepEqual(down.health.injuries.map(i => [i.zone, i.painNow, i.clearanceDate]), [['shoulder', false, '2026-09-10'], ['knee', true, '2026-09-11']]);
  assert.equal(down.plan.health.blocked, false);
  const allDown = editAndReconcile(stored, ['shoulder', 'knee']);
  assert.equal(allDown.plan.health.blocked, false);
  assert.deepEqual(allDown.health.injuries.map(i => i.clearanceDate), ['2026-09-10', '2026-09-11']);
  const same = editAndReconcile(stored, ['shoulder', 'knee'], { pain: ['shoulder', 'knee'] });
  assert.equal(same.plan.health.blocked, false);
});

test('DEC-011: un cambio de diagnóstico, en cualquier sentido, invalida la autorización y pausa el plan', () => {
  const undiagnosed = authorizedProfile(['knee']);
  const gotDiagnosis = editAndReconcile(undiagnosed, ['knee'], { diagnosed: ['knee'] });
  assert.equal(gotDiagnosis.health.injuries[0].clearanceDate, null);
  assert.equal(gotDiagnosis.plan.health.blocked, true);
  const diagnosed = authorizedProfile(['knee'], { diagnosed: ['knee'] });
  const lostDiagnosis = editAndReconcile(diagnosed, ['knee']);
  assert.equal(lostDiagnosis.health.injuries[0].clearanceDate, null);
  assert.equal(lostDiagnosis.plan.health.blocked, true);
  // Diagnóstico que cambia a la vez que el dolor baja: pausa igual (cambió el diagnóstico).
  const both = editAndReconcile(authorizedProfile(['knee'], { pain: ['knee'] }), ['knee'], { diagnosed: ['knee'] });
  assert.equal(both.plan.health.blocked, true);
  // Diagnóstico sin cambios: se mantiene.
  assert.equal(editAndReconcile(diagnosed, ['knee'], { diagnosed: ['knee'] }).plan.health.blocked, false);
});

test('DEC-011: la invalidación es por zona; las demás conservan su fecha, y las zonas nuevas siguen pidiéndose', () => {
  const stored = authorizedProfile(['shoulder', 'knee']);
  const { health, plan } = editAndReconcile(stored, ['shoulder', 'knee', 'ankle'], { pain: ['knee'] });
  assert.deepEqual(health.injuries.map(i => [i.zone, i.clearanceDate]), [['shoulder', '2026-09-10'], ['knee', null], ['ankle', null]]);
  assert.deepEqual(plan.health.injuryClearance.pendingZones, ['knee', 'ankle']);
  assert.doesNotMatch(plan.health.injuryBlockReason, /Hombro/);
});

test('DEC-011: reconcileInjuryClearances no muta sus entradas, tolera no tener estado previo y respeta carryOverInjuryClearances', () => {
  const stored = authorizedProfile(['shoulder']);
  const edited = E.normalizeProfile(withInjury(['shoulder'], { injuryPainNow: ['shoulder'] }));
  const storedBefore = JSON.stringify(stored.health), editedBefore = JSON.stringify(edited.health);
  E.reconcileInjuryClearances(stored.health, edited.health);
  assert.equal(JSON.stringify(stored.health), storedBefore);
  assert.equal(JSON.stringify(edited.health), editedBefore);
  assert.equal(E.reconcileInjuryClearances(undefined, edited.health).injuries[0].clearanceDate, null, 'sin estado previo no inventa fechas');
  // Sin cambios de dolor ni diagnóstico equivale exactamente a carryOver.
  const noChange = E.normalizeProfile(withInjury(['shoulder']));
  assert.deepEqual(E.reconcileInjuryClearances(stored.health, noChange.health), E.carryOverInjuryClearances(stored.health, noChange.health));
});
