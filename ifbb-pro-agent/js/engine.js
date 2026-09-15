/* Motor de cálculo. Funciones puras: entrada = datos del perfil, salida = plan.
 * Cada número que se muestra al usuario lleva la clave de la fuente
 * (KNOWLEDGE.SOURCES) que lo respalda. Las reglas de seguridad propias de la
 * app se marcan como "guardrail" y se explican como tales en la interfaz.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./knowledge.js'));
  else root.ENGINE = factory(root.KNOWLEDGE);
})(typeof self !== 'undefined' ? self : this, function (K) {
  'use strict';

  const KCAL_PER_KG_FAT = 7700; // aproximación clásica (Wishnofsky 1958) usada en HELMS_NUT e IRAKI
  const LB_PER_KG = 2.20462;
  const CM_PER_IN = 2.54;

  const round = (v, d = 0) => { const m = Math.pow(10, d); return Math.round(v * m) / m; };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /* ---------- Composición corporal ---------- */

  function bmrMifflin(sex, weightKg, heightCm, age) {
    const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    return sex === 'M' ? base + 5 : base - 161;
  }

  function bmrKatch(lbmKg) {
    return 370 + 21.6 * lbmKg;
  }

  /* Navy method, ecuaciones de densidad (unidades en cm) + Siri. */
  function bodyFatNavy(sex, heightCm, neckCm, waistCm, hipCm) {
    if (!(heightCm > 0) || !(neckCm > 0) || !(waistCm > 0)) return null;
    let density;
    if (sex === 'M') {
      if (waistCm - neckCm <= 0) return null;
      density = 1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm);
    } else {
      if (!(hipCm > 0) || waistCm + hipCm - neckCm <= 0) return null;
      density = 1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.22100 * Math.log10(heightCm);
    }
    const bf = 495 / density - 450;
    if (!isFinite(bf) || bf < 2 || bf > 60) return null;
    return bf;
  }

  function ffmi(lbmKg, heightCm) {
    const h = heightCm / 100;
    const raw = lbmKg / (h * h);
    return { raw, normalized: raw + 6.1 * (1.8 - h) };
  }

  function essentialFat(sex) { return sex === 'M' ? 5 : 13; } // ACE_BF, límite superior de "grasa esencial"

  function classicLimit(heightCm, overrideLb) {
    if (overrideLb > 0) return { lb: overrideLb, kg: overrideLb / LB_PER_KG, source: 'usuario' };
    const inches = heightCm / CM_PER_IN;
    const row = K.CLASSIC_WEIGHT_TABLE.find(r => inches <= r.maxHeightIn + 1e-9);
    if (!row) return null;
    return { lb: row.maxLb, kg: row.maxLb / LB_PER_KG, source: 'tabla orientativa 2023' };
  }

  /* ---------- Plan ---------- */

  function computeMetrics(p) {
    const warnings = [];
    const h = p.heightCm / 100;
    const bmi = p.weightKg / (h * h);

    let bodyFat = null, bfMethod = null;
    if (p.bodyFatPct > 0) { bodyFat = p.bodyFatPct; bfMethod = 'medido (DXA, plicometría, BIA…)'; }
    else {
      const navy = bodyFatNavy(p.sex, p.heightCm, p.neckCm, p.waistCm, p.hipCm);
      if (navy != null) { bodyFat = navy; bfMethod = 'estimado por circunferencias (Navy ±3-4 %)'; }
    }
    if (bodyFat == null) {
      bodyFat = p.sex === 'M' ? 18 : 26;
      bfMethod = 'supuesto por defecto (sin datos)';
      warnings.push({ level: 'warn', text: 'No indicaste % de grasa ni circunferencias de cuello/cintura(/cadera). Se usa un valor supuesto y el plan será menos preciso. Añade esas medidas para mejorar el cálculo.' });
    }

    const lbm = p.weightKg * (1 - bodyFat / 100);
    const fatMass = p.weightKg - lbm;
    const mifflin = bmrMifflin(p.sex, p.weightKg, p.heightCm, p.age);
    const katch = bmrKatch(lbm);
    const useKatch = bfMethod !== 'supuesto por defecto (sin datos)';
    const bmr = useKatch ? katch : mifflin;
    const act = K.ACTIVITY.find(a => a.id === p.activity) || K.ACTIVITY[2];
    const tdee = bmr * act.factor;
    const f = ffmi(lbm, p.heightCm);
    const whtr = p.waistCm > 0 ? p.waistCm / p.heightCm : null;

    if (p.age < 18) warnings.push({ level: 'danger', text: 'Menor de 18 años: las recomendaciones de preparación competitiva no están validadas en menores. Consulta a un médico deportivo.' });
    if (bmi < 17) warnings.push({ level: 'danger', text: 'IMC muy bajo. No se debe iniciar un déficit calórico sin supervisión médica.' });
    if (f.normalized > 25 && useKatch) warnings.push({ level: 'info', text: `FFMI normalizado ${round(f.normalized, 1)}: por encima del techo observado en atletas naturales (25,0). Revisa la medición de grasa; si es correcta, tu masa magra es excepcional.` });

    return {
      bmi, bodyFat, bfMethod, lbm, fatMass, bmrMifflin: mifflin, bmrKatch: katch, bmr,
      bmrMethod: useKatch ? 'KATCH' : 'MIFFLIN', activityFactor: act.factor, activityLabel: act.label,
      tdee, ffmi: f.raw, ffmiNormalized: f.normalized, whtr, warnings,
    };
  }

  function weeksBetween(fromIso, toIso) {
    const a = new Date(fromIso), b = new Date(toIso);
    if (isNaN(a) || isNaN(b)) return null;
    return (b - a) / (7 * 24 * 3600 * 1000);
  }

  function computeTargets(p, m, today) {
    const warnings = [];
    const div = K.DIVISIONS[p.division] || (p.sex === 'M' ? K.DIVISIONS.general_m : K.DIVISIONS.general_w);
    const essential = essentialFat(p.sex);

    let targetBf;
    if (p.targetBf > 0) targetBf = p.targetBf;
    else if (p.goal === 'cut') targetBf = (div.stageBf[0] + div.stageBf[1]) / 2;
    else if (p.goal === 'bulk') targetBf = Math.min(m.bodyFat + 3, p.sex === 'M' ? 15 : 25);
    else targetBf = m.bodyFat;

    if (targetBf < essential) {
      warnings.push({ level: 'danger', text: `Objetivo de ${targetBf} % de grasa está por debajo de la grasa esencial (${essential} %). Se ajusta al mínimo seguro.` });
      targetBf = essential;
    }

    // Peso objetivo asumiendo masa magra constante (en un cut real se pierde algo de masa magra; en bulk se gana).
    let targetWeight;
    if (p.goal === 'cut') targetWeight = m.lbm / (1 - targetBf / 100);
    else if (p.goal === 'bulk') targetWeight = m.lbm / (1 - targetBf / 100); // ganancia mixta hasta el techo de grasa off-season
    else targetWeight = p.weightKg;

    const delta = targetWeight - p.weightKg;

    // Ritmo semanal recomendado (% del peso corporal)
    let ratePct;
    if (p.goal === 'cut') {
      const lean = p.sex === 'M' ? m.bodyFat <= 10 : m.bodyFat <= 18;
      ratePct = p.level === 'advanced' || lean ? 0.5 : p.level === 'intermediate' ? 0.7 : 1.0;
    } else if (p.goal === 'bulk') {
      ratePct = p.level === 'advanced' ? 0.25 : p.level === 'intermediate' ? 0.35 : 0.5;
    } else ratePct = 0;

    let rateKg = p.weightKg * ratePct / 100;
    let weeksNeeded = rateKg > 0 ? Math.abs(delta) / rateKg : 0;
    let dateFeasible = null;

    if (p.targetDate && p.goal !== 'maintain') {
      const wk = weeksBetween(today, p.targetDate);
      if (wk != null && wk > 0) {
        const requiredPct = Math.abs(delta) / wk / p.weightKg * 100;
        const maxPct = p.goal === 'cut' ? 1.0 : 0.5;
        if (requiredPct > maxPct) {
          dateFeasible = false;
          warnings.push({ level: 'danger', text: `Para llegar en ${round(wk, 1)} semanas harían falta ${round(requiredPct, 2)} %/semana, por encima del máximo respaldado (${maxPct} %/semana). La fecha no es alcanzable de forma segura; se mantiene el ritmo máximo y se indica la fecha realista.` });
          ratePct = maxPct;
        } else {
          dateFeasible = true;
          ratePct = Math.max(requiredPct, p.goal === 'cut' ? 0.3 : 0.2);
          if (requiredPct < 0.3 && p.goal === 'cut') warnings.push({ level: 'info', text: 'Tienes tiempo de sobra: se usa un ritmo suave (0,3 %/semana) para conservar masa muscular. Puedes retrasar el inicio del déficit.' });
        }
        rateKg = p.weightKg * ratePct / 100;
        weeksNeeded = rateKg > 0 ? Math.abs(delta) / rateKg : 0;
      }
    }

    const est = new Date(today);
    est.setDate(est.getDate() + Math.ceil(weeksNeeded * 7));

    let classic = null;
    if (div.weightLimit === 'classic') {
      classic = classicLimit(p.heightCm, p.classicLimitLb);
      if (classic) {
        classic.status = targetWeight <= classic.kg ? 'ok' : 'over';
        classic.marginKg = classic.kg - targetWeight;
        if (classic.status === 'over') warnings.push({ level: 'warn', text: `Tu peso objetivo (${round(targetWeight, 1)} kg) supera el límite orientativo de Classic Physique para tu estatura (${round(classic.kg, 1)} kg / ${classic.lb} lb). Verifica el reglamento vigente; si sigue siendo superior, tendrías que bajar más grasa o considerar Bodybuilding.` });
      }
    }

    const waistMaxHealth = 0.5 * p.heightCm; // ASHWELL

    return {
      division: div, targetBf, targetWeight, delta, ratePct, rateKg, weeksNeeded,
      estimatedDate: est.toISOString().slice(0, 10), dateFeasible, classic, waistMaxHealth,
      targetLbm: m.lbm, targetFatMass: targetWeight - m.lbm, warnings,
    };
  }

  function computeNutrition(p, m, t) {
    const warnings = [];
    const sources = ['ISSN_DIET'];
    let calories, delta = 0, deltaLabel = 'mantenimiento';

    if (p.goal === 'cut') {
      delta = -(t.rateKg * KCAL_PER_KG_FAT / 7);
      sources.push('HELMS_NUT', 'ISSN_PROT');
      const maxDeficit = 0.30 * m.tdee; // guardrail de la app: no superar el 30 % del gasto
      if (-delta > maxDeficit) { delta = -maxDeficit; warnings.push({ level: 'warn', text: 'El déficit se limita al 30 % del gasto diario (regla de seguridad de la app). El ritmo de pérdida real será algo menor que el objetivo.' }); }
      deltaLabel = 'déficit';
    } else if (p.goal === 'bulk') {
      const pct = p.level === 'advanced' ? 0.10 : p.level === 'intermediate' ? 0.15 : 0.20;
      delta = m.tdee * pct;
      deltaLabel = `superávit ${Math.round(pct * 100)} %`;
      sources.push('IRAKI');
    } else {
      sources.push('IRAKI', 'ISSN_PROT');
    }
    calories = m.tdee + delta;

    if (calories < m.bmr) {
      warnings.push({ level: 'warn', text: `Las calorías se elevan a tu gasto en reposo (${Math.round(m.bmr)} kcal) como regla de seguridad de la app. Por debajo de ese nivel aumenta la pérdida de masa muscular y el riesgo de RED-S.` });
      calories = m.bmr;
      delta = calories - m.tdee;
    }

    // Proteína
    let proteinG, proteinRule;
    if (p.goal === 'cut') {
      proteinG = Math.max(2.7 * m.lbm, 1.8 * p.weightKg);
      proteinRule = '2,3-3,1 g por kg de masa magra (se usa 2,7)';
    } else {
      proteinG = 2.0 * p.weightKg;
      proteinRule = '1,6-2,2 g por kg de peso (se usa 2,0)';
    }

    // Grasa: 25 % de las kcal, dentro de 15-30 % (HELMS_NUT) y ≥0,5 g/kg (IRAKI)
    let fatG = 0.25 * calories / 9;
    let carbsG = (calories - proteinG * 4 - fatG * 9) / 4;
    if (carbsG < 1.0 * p.weightKg && p.goal === 'cut') {
      fatG = Math.max(0.20 * calories / 9, 0.5 * p.weightKg);
      carbsG = (calories - proteinG * 4 - fatG * 9) / 4;
    }
    if (fatG < 0.5 * p.weightKg) warnings.push({ level: 'info', text: 'La grasa queda por debajo de 0,5 g/kg; vigila la función hormonal y considera acortar la fase.' });
    if (carbsG < 0) { carbsG = 0; warnings.push({ level: 'danger', text: 'Las calorías no permiten cubrir proteína y grasa mínimas. Revisa los datos introducidos.' }); }
    if (p.goal === 'bulk' && carbsG < 3 * p.weightKg) warnings.push({ level: 'info', text: 'Carbohidratos por debajo de 3 g/kg en volumen: el rendimiento en el entrenamiento puede resentirse.' });

    const fiberG = 14 * calories / 1000; // FIBER
    const waterL = (p.sex === 'M' ? 2.5 : 2.0); // EFSA_WATER, más pérdidas por sudor
    const meals = p.goal === 'cut' ? 4 : 4;
    const proteinPerMeal = proteinG / meals;
    const perMealPerKg = proteinPerMeal / p.weightKg;

    return {
      calories: Math.round(calories), delta: Math.round(delta), deltaLabel, tdee: Math.round(m.tdee),
      protein: Math.round(proteinG), proteinRule, proteinPerKg: round(proteinG / p.weightKg, 2),
      fat: Math.round(fatG), fatPct: Math.round(fatG * 9 / calories * 100),
      carbs: Math.round(carbsG), carbsPerKg: round(carbsG / p.weightKg, 1),
      fiber: Math.round(fiberG), waterL,
      meals, proteinPerMeal: Math.round(proteinPerMeal), perMealPerKg: round(perMealPerKg, 2),
      timing: [
        `${meals} comidas al día con ~${Math.round(proteinPerMeal)} g de proteína cada una (0,40-0,55 g/kg por comida).`,
        'Una comida con proteína y carbohidrato 1-2 h antes de entrenar y otra en las 1-2 h posteriores.',
        p.goal === 'cut' ? 'Concentra la mayor parte de los carbohidratos alrededor del entrenamiento; en días de descanso puedes bajarlos 20-30 % y subir verduras.' : 'Reparte los carbohidratos de forma uniforme; sube un poco la ración pre y post entreno.',
        p.goal === 'cut' ? 'Cada 7-14 días una comida o día de "refeed" a mantenimiento con más carbohidrato ayuda a la adherencia (evidencia moderada, HELMS_NUT).' : 'Pésate 3-4 veces por semana en ayunas y ajusta ±100-150 kcal si el promedio semanal se sale del ritmo objetivo.',
      ],
      foodGuide: buildFoodGuide(p, Math.round(proteinG), Math.round(carbsG), Math.round(fatG)),
      sources: sources.concat(['FIBER', 'EFSA_WATER', 'SCHOENFELD_MEAL']), warnings,
    };
  }

  function buildFoodGuide(p, protein, carbs, fat) {
    // Equivalencias prácticas (valores promedio de tablas de composición de alimentos).
    return {
      protein: [
        `Pechuga de pollo o pavo: ~23 g proteína / 100 g cocido → ${Math.round(protein * 0.4 / 23 * 100)} g cubren el 40 %.`,
        'Pescado blanco, atún, clara de huevo, ternera magra, yogur griego 0 %, queso batido, tofu/tempeh, legumbres.',
        'Suero de leche solo para completar lo que falte.',
      ],
      carbs: [
        `Arroz, patata, boniato, avena, pasta, pan integral, fruta. Ejemplo: ${Math.round(carbs / 0.28)} g de arroz cocido aportarían todos los carbohidratos del día.`,
        '≥400 g/día de verduras y hortalizas para la fibra y la saciedad.',
      ],
      fat: [
        `Aceite de oliva virgen (10 g = 1 cucharada), frutos secos, aguacate, pescado azul, yema de huevo. ${fat} g/día ≈ ${round(fat / 10, 1)} cucharadas de aceite si toda la grasa viniera del aceite.`,
        'Incluye pescado azul 2 veces/semana o 1-2 g/día de EPA+DHA (recomendación general de salud).',
      ],
    };
  }

  /* ---------- Entrenamiento ---------- */

  const SPLITS = {
    3: { name: 'Cuerpo completo ×3', days: [
      { name: 'Día 1 · Full body A', muscles: ['quads', 'chest', 'back', 'shoulders', 'hamstrings', 'abs'] },
      { name: 'Día 2 · Full body B', muscles: ['hamstrings', 'glutes', 'back', 'chest', 'biceps', 'triceps', 'calves'] },
      { name: 'Día 3 · Full body C', muscles: ['quads', 'shoulders', 'back', 'chest', 'glutes', 'abs', 'calves'] },
    ] },
    4: { name: 'Torso / Pierna ×2', days: [
      { name: 'Día 1 · Torso A', muscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
      { name: 'Día 2 · Pierna A', muscles: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'] },
      { name: 'Día 3 · Torso B', muscles: ['back', 'chest', 'shoulders', 'triceps', 'biceps'] },
      { name: 'Día 4 · Pierna B', muscles: ['hamstrings', 'glutes', 'quads', 'calves', 'abs'] },
    ] },
    5: { name: 'Torso / Pierna / Empuje / Tirón / Pierna', days: [
      { name: 'Día 1 · Torso', muscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
      { name: 'Día 2 · Pierna', muscles: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'] },
      { name: 'Día 3 · Empuje', muscles: ['chest', 'shoulders', 'triceps'] },
      { name: 'Día 4 · Tirón', muscles: ['back', 'biceps', 'shoulders'] },
      { name: 'Día 5 · Pierna', muscles: ['glutes', 'hamstrings', 'quads', 'calves', 'abs'] },
    ] },
    6: { name: 'Empuje / Tirón / Pierna ×2', days: [
      { name: 'Día 1 · Empuje A', muscles: ['chest', 'shoulders', 'triceps'] },
      { name: 'Día 2 · Tirón A', muscles: ['back', 'biceps', 'shoulders'] },
      { name: 'Día 3 · Pierna A', muscles: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'] },
      { name: 'Día 4 · Empuje B', muscles: ['shoulders', 'chest', 'triceps'] },
      { name: 'Día 5 · Tirón B', muscles: ['back', 'shoulders', 'biceps'] },
      { name: 'Día 6 · Pierna B', muscles: ['glutes', 'hamstrings', 'quads', 'calves', 'abs'] },
    ] },
  };

  const EMPHASIS_MAP = {
    bodybuilding_m: { up: ['back', 'quads'], down: [] },
    classic_m: { up: ['shoulders', 'back', 'quads'], down: [] },
    physique_m: { up: ['shoulders', 'back', 'abs'], down: ['quads', 'hamstrings', 'glutes'] },
    physique_w: { up: ['shoulders', 'back', 'quads'], down: [] },
    figure_w: { up: ['shoulders', 'back', 'glutes'], down: [] },
    bikini_w: { up: ['glutes', 'hamstrings', 'shoulders'], down: ['quads', 'chest', 'biceps', 'triceps'] },
    wellness_w: { up: ['glutes', 'quads', 'hamstrings'], down: ['chest', 'shoulders', 'biceps', 'triceps'] },
    general_m: { up: [], down: [] },
    general_w: { up: [], down: [] },
  };

  function computeTraining(p, t) {
    const days = clamp(Math.round(p.daysPerWeek) || 4, 3, 6);
    const split = SPLITS[days];
    const base = p.level === 'advanced' ? 18 : p.level === 'intermediate' ? 14 : 10; // SCHOENFELD_VOL, HELMS_TRAIN
    const cutFactor = p.goal === 'cut' ? 0.85 : 1; // HELMS_TRAIN: en déficit se prioriza intensidad y se modera el volumen
    const emph = EMPHASIS_MAP[p.division] || { up: [], down: [] };
    const small = ['biceps', 'triceps', 'calves', 'abs'];

    const weeklySets = {};
    Object.keys(K.EXERCISES).forEach(mu => {
      let s = base * cutFactor;
      if (small.includes(mu)) s *= 0.6;
      if (emph.up.includes(mu)) s *= 1.25;
      if (emph.down.includes(mu)) s *= 0.5;
      weeklySets[mu] = Math.max(4, Math.round(s));
    });

    const freq = {};
    split.days.forEach(d => d.muscles.forEach(mu => { freq[mu] = (freq[mu] || 0) + 1; }));

    const remaining = Object.assign({}, weeklySets);
    const rotate = {};
    const sessions = split.days.map(d => {
      const exercises = [];
      d.muscles.forEach(mu => {
        const lib = K.EXERCISES[mu];
        const perSession = Math.max(2, Math.round(weeklySets[mu] / freq[mu]));
        const sets = Math.min(perSession, Math.max(0, remaining[mu]));
        remaining[mu] -= sets;
        if (sets <= 0) return;
        const idx = rotate[mu] = (rotate[mu] || 0);
        const picks = sets <= 4 ? [lib[idx % lib.length]] : [lib[idx % lib.length], lib[(idx + 1) % lib.length]];
        rotate[mu] = idx + picks.length;
        const per = Math.floor(sets / picks.length);
        let rest = sets - per * picks.length;
        picks.forEach(ex => {
          const n = per + (rest-- > 0 ? 1 : 0);
          exercises.push({ muscle: mu, muscleLabel: K.MUSCLE_LABELS[mu], name: ex.name, sets: n, reps: `${ex.reps[0]}-${ex.reps[1]}`, rir: ex.type === 'compound' ? '2-3' : '1-2', rest: ex.type === 'compound' ? '2-3 min' : '60-90 s' });
        });
      });
      return { name: d.name, exercises, totalSets: exercises.reduce((a, e) => a + e.sets, 0) };
    });

    const cardio = p.goal === 'cut'
      ? { sessions: p.level === 'advanced' ? 3 : 2, minutes: 25, type: 'LISS (caminata inclinada, bici, elíptica) al 60-70 % FC máx.; opcional 1 sesión HIIT de 10-15 min', rule: 'La mínima cantidad necesaria para mantener el ritmo de pérdida; añade 10 min/sesión solo si el peso se estanca 2 semanas. Sepáralo del entrenamiento de fuerza o hazlo después.' }
      : { sessions: 2, minutes: 25, type: 'Cardio moderado por salud cardiovascular', rule: 'Sin objetivo de gasto: mantiene la capacidad aeróbica y la salud (150 min/semana moderado como referencia general). No interfiere con la hipertrofia a este volumen.' };

    return {
      splitName: split.name, daysPerWeek: days, weeklySets, sessions,
      intensity: 'La mayoría de series en 6-12 repeticiones al 70-80 % del 1RM, terminando a 1-3 repeticiones del fallo (RIR). Aislamientos hasta 15 repeticiones.',
      progression: 'Doble progresión: cuando completes el rango alto de repeticiones en todas las series con buena técnica, sube la carga 2-5 % (tren superior) o 5-10 % (tren inferior) y vuelve al rango bajo.',
      deload: 'Cada 4-6 semanas, o cuando el rendimiento caiga 2 sesiones seguidas, reduce el volumen a la mitad durante una semana manteniendo la carga.',
      cardio,
      posing: p.division.startsWith('general') ? null : 'Practica las poses obligatorias de tu división 2-3 veces/semana durante 10-15 min; en las últimas 8 semanas a diario. Es parte del juicio y también gasto energético.',
      sources: ['HELMS_TRAIN', 'SCHOENFELD_VOL', 'SCHOENFELD_FREQ', 'ACSM_RT', 'ACSM_CARDIO'],
    };
  }

  /* ---------- Plan completo ---------- */

  function buildPlan(profile, todayIso) {
    const today = todayIso || new Date().toISOString().slice(0, 10);
    const p = normalizeProfile(profile);
    const metrics = computeMetrics(p);
    const targets = computeTargets(p, metrics, today);
    const nutrition = computeNutrition(p, metrics, targets);
    const training = computeTraining(p, targets);
    const supplements = K.SUPPLEMENTS.filter(s => p.goal !== 'bulk' || s.source !== 'HELMS_NUT');
    const warnings = [].concat(metrics.warnings, targets.warnings, nutrition.warnings);
    const sourcesUsed = unique([metrics.bmrMethod, 'NAVY', 'KOURI', 'ACE_BF', 'ASHWELL', 'ROSSOW', 'IFBB_RULES'].concat(nutrition.sources, training.sources, supplements.map(s => s.source)));
    return {
      generatedAt: today, input: p, metrics, targets, nutrition, training, supplements, warnings, sourcesUsed,
      disclaimer: 'Esta app aplica recomendaciones publicadas en revisiones por pares y posicionamientos oficiales de sociedades científicas. No sustituye la valoración de un médico, un dietista-nutricionista colegiado ni un entrenador certificado. Ante enfermedad, embarazo, trastornos alimentarios o uso de fármacos, consulta antes de aplicar cualquier plan.',
    };
  }

  function normalizeProfile(src) {
    const n = v => { const x = parseFloat(v); return isFinite(x) ? x : 0; };
    const sex = src.sex === 'F' ? 'F' : 'M';
    let division = src.division;
    if (!K.DIVISIONS[division] || K.DIVISIONS[division].sex !== sex) division = sex === 'M' ? 'general_m' : 'general_w';
    return {
      name: (src.name || 'Perfil').toString().trim(),
      sex, age: n(src.age), heightCm: n(src.heightCm), weightKg: n(src.weightKg),
      bodyFatPct: n(src.bodyFatPct), neckCm: n(src.neckCm), waistCm: n(src.waistCm), hipCm: n(src.hipCm),
      activity: src.activity || 'moderate',
      level: ['novice', 'intermediate', 'advanced'].includes(src.level) ? src.level : 'intermediate',
      daysPerWeek: n(src.daysPerWeek) || 4,
      division, goal: ['cut', 'bulk', 'maintain'].includes(src.goal) ? src.goal : 'cut',
      targetDate: src.targetDate || '', targetBf: n(src.targetBf), classicLimitLb: n(src.classicLimitLb),
    };
  }

  function validateProfile(src) {
    const p = normalizeProfile(src);
    const errors = [];
    if (!p.name) errors.push('Pon un nombre al perfil.');
    if (!(p.age >= 14 && p.age <= 90)) errors.push('Edad entre 14 y 90 años.');
    if (!(p.heightCm >= 130 && p.heightCm <= 230)) errors.push('Estatura entre 130 y 230 cm.');
    if (!(p.weightKg >= 35 && p.weightKg <= 250)) errors.push('Peso entre 35 y 250 kg.');
    if (p.bodyFatPct && !(p.bodyFatPct >= 3 && p.bodyFatPct <= 60)) errors.push('% de grasa entre 3 y 60.');
    if (p.targetBf && !(p.targetBf >= 3 && p.targetBf <= 40)) errors.push('% de grasa objetivo entre 3 y 40.');
    return errors;
  }

  function unique(arr) { return arr.filter((v, i) => v && arr.indexOf(v) === i); }

  return { bmrMifflin, bmrKatch, bodyFatNavy, ffmi, classicLimit, computeMetrics, computeTargets, computeNutrition, computeTraining, buildPlan, normalizeProfile, validateProfile, SPLITS, LB_PER_KG };
});
