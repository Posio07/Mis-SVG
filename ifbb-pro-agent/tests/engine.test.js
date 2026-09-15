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

test('every source referenced by plan exists in knowledge base', () => {
  const plan = E.buildPlan(male, TODAY);
  plan.sourcesUsed.forEach(id => assert.ok(K.SOURCES[id], `missing source ${id}`));
  K.SUPPLEMENTS.forEach(s => assert.ok(K.SOURCES[s.source]));
});
