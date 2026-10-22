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
    if (p.bodyFatPct > 0) {
      bodyFat = p.bodyFatPct; bfMethod = 'medido (DXA, plicometría, BIA…)';
      // DEC-004: si además hay circunferencias, se contrasta con el método
      // Navy (error típico ±3-4 %, Hodgdon & Beckett 1984). Una diferencia
      // grande (umbral de criterio de la app) sugiere un dato mal tomado.
      const navyCheck = bodyFatNavy(p.sex, p.heightCm, p.neckCm, p.waistCm, p.hipCm);
      if (navyCheck != null && Math.abs(navyCheck - bodyFat) > 4) {
        warnings.push({ level: 'warn', text: `El % de grasa indicado (${round(bodyFat, 1)} %) y el estimado por circunferencias (${round(navyCheck, 1)} %) difieren en más de 4 puntos. Revisa las medidas: se usa el valor indicado (${round(bodyFat, 1)} %) para el resto del plan.` });
      }
    } else {
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

  // DEC-003 v2: solo los grupos GRANDES tienen día fijo acá. Los chicos
  // (abdomen, pantorrillas, bíceps, tríceps) se asignan al generar el plan,
  // según qué día de cada categoría tenga menos series (ver computeTraining).
  // category: 'full' (cuerpo completo), 'torso', 'legs', 'push', 'pull'.
  const SPLITS = {
    3: { name: 'Cuerpo completo ×3', days: [
      { name: 'Día 1 · Full body A', muscles: ['quads', 'chest', 'back', 'shoulders', 'hamstrings'], category: 'full' },
      { name: 'Día 2 · Full body B', muscles: ['hamstrings', 'glutes', 'back', 'chest'], category: 'full' },
      { name: 'Día 3 · Full body C', muscles: ['quads', 'shoulders', 'back', 'chest', 'glutes'], category: 'full' },
    ] },
    4: { name: 'Torso / Pierna ×2', days: [
      { name: 'Día 1 · Torso A', muscles: ['chest', 'back', 'shoulders'], category: 'torso' },
      { name: 'Día 2 · Pierna A', muscles: ['quads', 'hamstrings', 'glutes'], category: 'legs' },
      { name: 'Día 3 · Torso B', muscles: ['back', 'chest', 'shoulders'], category: 'torso' },
      { name: 'Día 4 · Pierna B', muscles: ['hamstrings', 'glutes', 'quads'], category: 'legs' },
    ] },
    5: { name: 'Torso / Pierna / Empuje / Tirón / Pierna', days: [
      { name: 'Día 1 · Torso', muscles: ['chest', 'back', 'shoulders'], category: 'torso' },
      { name: 'Día 2 · Pierna', muscles: ['quads', 'hamstrings', 'glutes'], category: 'legs' },
      { name: 'Día 3 · Empuje', muscles: ['chest', 'shoulders'], category: 'push' },
      { name: 'Día 4 · Tirón', muscles: ['back', 'shoulders'], category: 'pull' },
      { name: 'Día 5 · Pierna', muscles: ['glutes', 'hamstrings', 'quads'], category: 'legs' },
    ] },
    6: { name: 'Empuje / Tirón / Pierna ×2', days: [
      { name: 'Día 1 · Empuje A', muscles: ['chest', 'shoulders'], category: 'push' },
      { name: 'Día 2 · Tirón A', muscles: ['back', 'shoulders'], category: 'pull' },
      { name: 'Día 3 · Pierna A', muscles: ['quads', 'hamstrings', 'glutes'], category: 'legs' },
      { name: 'Día 4 · Empuje B', muscles: ['shoulders', 'chest'], category: 'push' },
      { name: 'Día 5 · Tirón B', muscles: ['back', 'shoulders'], category: 'pull' },
      { name: 'Día 6 · Pierna B', muscles: ['glutes', 'hamstrings', 'quads'], category: 'legs' },
    ] },
  };
  const SMALL_MUSCLES_LIST = ['abs', 'calves', 'biceps', 'triceps'];
  // Compatibilidad de cada grupo chico con la categoría del día (DEC-003 v2).
  const SMALL_COMPAT = {
    abs: () => true,
    calves: () => true,
    biceps: cat => ['torso', 'pull', 'full'].includes(cat),
    triceps: cat => ['torso', 'push', 'full'].includes(cat),
  };

  // DEC-009 · Capa 3: filtra el catálogo de un grupo muscular según las
  // zonas de lesión declaradas (K.INJURY_EXCLUSIONS, documentado en
  // DECISIONS.md). Sin lesiones declaradas, devuelve el catálogo tal cual
  // (mismo comportamiento que antes de DEC-009). Un ejercicio marcado
  // `injuryOnly: 'zona'` solo entra en el catálogo cuando esa zona está
  // declarada (es el caso del sustituto de press de hombro).
  function filterLibByInjuries(lib, muscle, zones) {
    zones = zones || [];
    // Sin excluir nada, igual hay que sacar los ejercicios `injuryOnly`:
    // solo deben aparecer cuando esa zona está declarada.
    const excluded = new Set();
    zones.forEach(z => {
      const map = K.INJURY_EXCLUSIONS && K.INJURY_EXCLUSIONS[z];
      if (map && map[muscle]) map[muscle].forEach(pat => excluded.add(pat));
    });
    return lib.filter(ex => {
      if (excluded.has(ex.pattern)) return false;
      if (ex.injuryOnly && zones.indexOf(ex.injuryOnly) === -1) return false;
      return true;
    });
  }

  // DEC-008: multiarticulares bilaterales con carga libre o guiada pesada
  // (ACSM 2009, cargas ≥80% 1RM para fuerza). Lista cerrada a propósito:
  // sentadilla trasera/hack, press banca, press militar, peso muerto
  // rumano, remo con barra, dominadas. Nunca unilaterales ni máquinas de
  // press (por eso "chest_dip_or_machine" y "leg_press" no están).
  const TOPSET_ELIGIBLE_PATTERNS = new Set([
    'squat_bilateral', 'bench_press', 'shoulder_press', 'hinge', 'row_barbell', 'vertical_pull',
  ]);

  // DEC-006 (corregido): la "familia" de un ejercicio es su id de patrón
  // explícito del catálogo (knowledge.js), no el texto de su nombre. Antes
  // se agrupaba por palabras del nombre y eso mezclaba por error ejercicios
  // distintos que compartían una palabra (p. ej. "fondos" aparecía tanto en
  // un ejercicio de pecho como en uno de tríceps).
  function basePattern(ex) {
    return ex && ex.pattern ? ex.pattern : (ex && ex.name); // sin id: el propio nombre es su patrón
  }
  // Si el candidato ya se usó ese día, busca en la misma lista la siguiente
  // opción que no choque. Si todas chocan, se permite el duplicado (no hay
  // alternativa real para ese músculo ese día).
  function resolvePick(candidate, lib, usedPatterns) {
    if (!usedPatterns.has(basePattern(candidate))) return candidate;
    const startIdx = lib.indexOf(candidate);
    for (let step = 1; step <= lib.length; step++) {
      const alt = lib[(startIdx + step) % lib.length];
      if (!usedPatterns.has(basePattern(alt))) return alt;
    }
    return candidate;
  }
  // Resuelve colisiones dentro de un mismo conjunto de picks para un día,
  // en orden, y deja el set de patrones usados actualizado.
  function dedupPicks(picks, lib, dayExercises) {
    const used = new Set(dayExercises.map(e => e.pattern || e.name));
    return picks.map(ex => {
      const resolved = resolvePick(ex, lib, used);
      used.add(basePattern(resolved));
      return resolved;
    });
  }

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
    const lagging = new Set(p.laggingMuscles || []); // DEC-001
    const injuryZones = (p.health && p.health.injuries || []).map(i => i.zone); // DEC-009

    const weeklySets = {};
    const laggingApplied = {};
    Object.keys(K.EXERCISES).forEach(mu => {
      if (lagging.has(mu)) {
        // DEC-001: un grupo rezagado anula el énfasis de división (incluida
        // una posible reducción ×0,5) y el recorte de músculo pequeño.
        // Tope semanal 20 series/grupo (criterio de la app).
        const s = base * cutFactor * 1.25;
        weeklySets[mu] = Math.min(20, Math.max(4, Math.round(s)));
        laggingApplied[mu] = true;
      } else {
        let s = base * cutFactor;
        if (small.includes(mu)) s *= 0.6;
        if (emph.up.includes(mu)) s *= 1.25;
        if (emph.down.includes(mu)) s *= 0.5;
        weeklySets[mu] = Math.max(4, Math.round(s));
      }
    });

    const freq = {};
    split.days.forEach(d => d.muscles.forEach(mu => { freq[mu] = (freq[mu] || 0) + 1; }));

    const remaining = Object.assign({}, weeklySets);
    const rotate = {};
    const rotateExtra = {}; // DEC-005
    const sessions = split.days.map(d => {
      const exercises = [];
      d.muscles.forEach(mu => {
        // DEC-005: con la bandera "salud/funcional" activa, pierna suma
        // sentadilla búlgara, step-up con carga y paseo del granjero a su
        // rotación de ejercicios. Desactivada (por defecto), el catálogo es
        // el mismo de siempre.
        const extra = p.healthGoal ? filterLibByInjuries(K.FUNCTIONAL_EXERCISES[mu] || [], mu, injuryZones) : [];
        const lib = filterLibByInjuries(K.EXERCISES[mu], mu, injuryZones); // DEC-009
        const perSession = Math.max(2, Math.round(weeklySets[mu] / freq[mu]));
        const sets = Math.min(perSession, Math.max(0, remaining[mu]));
        remaining[mu] -= sets;
        if (sets <= 0) return;
        const idx = rotate[mu] = (rotate[mu] || 0);
        let picks = sets <= 4 ? [lib[idx % lib.length]] : [lib[idx % lib.length], lib[(idx + 1) % lib.length]];
        rotate[mu] = idx + picks.length;
        if (mu === 'quads' && picks.length === 2) {
          // DEC-006: el segundo ejercicio de cuádriceps prioriza prensa.
          const prensa = lib.find(e => e.name === 'Prensa de piernas');
          if (prensa) { picks = picks.slice(); picks[1] = prensa; }
        }
        // DEC-006: ningún patrón (variantes incluidas) se repite en el día.
        picks = dedupPicks(picks, lib, exercises);
        const per = Math.floor(sets / picks.length);
        let rest = sets - per * picks.length;
        const dayEntries = picks.map(ex => {
          const n = per + (rest-- > 0 ? 1 : 0);
          return { muscle: mu, muscleLabel: K.MUSCLE_LABELS[mu], name: ex.name, type: ex.type, pattern: ex.pattern || ex.name, unilateral: !!ex.unilateral, sets: n, reps: `${ex.reps[0]}-${ex.reps[1]}`, rir: ex.type === 'compound' ? '2-3' : '1-2', rest: ex.type === 'compound' ? '2-3 min' : '60-90 s' };
        });
        dayEntries.forEach(e => exercises.push(e));
        // DEC-005 (aclarado): con la bandera activa, el ejercicio funcional
        // se SUMA después de los principales; nunca reemplaza el patrón
        // bilateral pesado del día. Se financia quitándole series a un
        // aislamiento del mismo grupo ese día (o, si no hay, al último
        // ejercicio puesto), sin bajarlo de un piso de 2 series, para no
        // tocar el volumen semanal de DEC-001.
        if (extra.length) {
          const ridx = rotateExtra[mu] = (rotateExtra[mu] || 0);
          rotateExtra[mu] = ridx + 1;
          // Si el músculo entrena pocas veces por semana (lo habitual: 2),
          // un reparto round-robin simple nunca llega a recorrer toda la
          // lista de extras (con 3 opciones y 2 ocurrencias, la 3ª nunca
          // sale). Se reserva el acarreo (paseo del granjero) para la
          // ÚLTIMA vez que el músculo aparece esa semana, y el resto de
          // ocurrencias rota entre las otras opciones.
          const carry = extra.find(e => e.pattern === 'loaded_carry');
          const others = extra.filter(e => e.pattern !== 'loaded_carry');
          const isLastOccurrence = ridx === (freq[mu] || 1) - 1;
          const bonus = (carry && isLastOccurrence) ? carry : (others.length ? others[ridx % others.length] : extra[ridx % extra.length]);
          const bonusPattern = bonus.pattern || bonus.name;
          const alreadyThere = exercises.some(e => (e.pattern || e.name) === bonusPattern);
          // Donante: el pick de este músculo ese día con más series de sobra
          // (prioriza aislamientos). Se prueba con 2 series y, si no entra,
          // con 1, antes de rendirse por falta de espacio.
          const isolationPicks = dayEntries.filter(e => e.type === 'isolation');
          const nonEligibleCompounds = dayEntries.filter(e => e.type === 'compound' && !TOPSET_ELIGIBLE_PATTERNS.has(e.pattern));
          const pool = isolationPicks.length ? isolationPicks : (nonEligibleCompounds.length ? nonEligibleCompounds : dayEntries);
          const donor = pool.slice().sort((a, b) => b.sets - a.sets)[0];
          let bonusSets = 0;
          if (!alreadyThere && donor) {
            if (donor.sets - 2 >= 2) bonusSets = 2;
            else if (donor.sets - 1 >= 2) bonusSets = 1;
          }
          if (bonusSets > 0) {
            donor.sets -= bonusSets;
            exercises.push({ muscle: mu, muscleLabel: K.MUSCLE_LABELS[mu], name: bonus.name, type: bonus.type, pattern: bonusPattern, unilateral: !!bonus.unilateral, sets: bonusSets, reps: `${bonus.reps[0]}-${bonus.reps[1]}`, rir: bonus.type === 'compound' ? '2-3' : '1-2', rest: bonus.type === 'compound' ? '2-3 min' : '60-90 s' });
          }
          // si no hay de dónde financiarlo ese día sin romper el piso, no se agrega esta vez
        }
      });
      return { name: d.name, exercises, totalSets: exercises.reduce((a, e) => a + e.sets, 0) };
    });

    // DEC-003 v2: los grupos chicos (abdomen, pantorrillas, bíceps, tríceps)
    // se reparten entre los días COMPATIBLES con menos series acumuladas
    // hasta ahora. Los grupos grandes no se tocan: ya quedaron fijos arriba.
    const trainingWarnings = [];
    SMALL_MUSCLES_LIST.forEach(mu => {
      const eligible = split.days.map((d, i) => ({ i, cat: d.category })).filter(x => SMALL_COMPAT[mu](x.cat));
      if (!eligible.length) return;
      const preferNonLeg = mu === 'abs' || mu === 'calves';
      eligible.sort((a, b) => {
        const prefA = preferNonLeg && a.cat === 'legs' ? 1 : 0;
        const prefB = preferNonLeg && b.cat === 'legs' ? 1 : 0;
        if (prefA !== prefB) return prefA - prefB;
        return sessions[a.i].totalSets - sessions[b.i].totalSets;
      });
      const freqMu = Math.min(2, eligible.length);
      freq[mu] = freqMu;
      const chosen = eligible.slice(0, freqMu).map(x => x.i);
      const lib = filterLibByInjuries(K.EXERCISES[mu], mu, injuryZones); // DEC-009
      const perSession = Math.max(2, Math.round(weeklySets[mu] / freqMu));
      let remainingMu = weeklySets[mu];
      chosen.forEach((dayIdx, k) => {
        const isLast = k === chosen.length - 1;
        const sets = isLast ? Math.max(0, remainingMu) : Math.min(perSession, remainingMu);
        remainingMu -= sets;
        if (sets <= 0) return;
        const idx = rotate[mu] = (rotate[mu] || 0);
        let picks = sets <= 4 ? [lib[idx % lib.length]] : [lib[idx % lib.length], lib[(idx + 1) % lib.length]];
        rotate[mu] = idx + picks.length;
        const s = sessions[dayIdx];
        picks = dedupPicks(picks, lib, s.exercises); // DEC-006
        const per = Math.floor(sets / picks.length);
        let rest = sets - per * picks.length;
        picks.forEach(ex => {
          const n = per + (rest-- > 0 ? 1 : 0);
          s.exercises.push({ muscle: mu, muscleLabel: K.MUSCLE_LABELS[mu], name: ex.name, type: ex.type, pattern: ex.pattern || ex.name, unilateral: !!ex.unilateral, sets: n, reps: `${ex.reps[0]}-${ex.reps[1]}`, rir: ex.type === 'compound' ? '2-3' : '1-2', rest: ex.type === 'compound' ? '2-3 min' : '60-90 s' });
          s.totalSets += n;
        });
      });
    });

    // DEC-003 v2: aviso no bloqueante si un día se pasa de 25 series. No se
    // recorta ni se mueve nada automáticamente.
    const SESSION_SET_CAP = 25;
    sessions.forEach(s => {
      if (s.totalSets > SESSION_SET_CAP) {
        trainingWarnings.push({ level: 'warn', text: `${s.name}: ${s.totalSets} series, por encima de las ${SESSION_SET_CAP} recomendadas por sesión. No se recorta nada automáticamente; si te resulta muy largo, movés vos algún aislamiento a otro día.` });
      }
    });

    // DEC-002 / DEC-008: en definición, el primer ejercicio ELEGIBLE del día
    // lleva un top set pesado (no suma series nuevas: la primera de sus
    // series pasa a ser el top set y el resto queda como back-off al -10%
    // de carga). Formato top set/back-off: [Criterio], construido sobre
    // [Evidencia] Helms et al. 2015, Bickel, Cross & Bamman 2011, Spiering
    // et al. 2021 y [Posicionamiento] ACSM 2009. Elegible = multiarticular
    // bilateral con carga libre o guiada pesada (ACSM 2009, ≥80% 1RM);
    // nunca unilaterales ni máquinas de press. Si el primero del día no es
    // elegible, el elegible se busca
    // más adelante y pasa a ordenarse primero. Si ninguno es elegible, ese
    // día no lleva top set.
    if (p.goal === 'cut') {
      sessions.forEach(s => {
        let idx = s.exercises.findIndex(e => TOPSET_ELIGIBLE_PATTERNS.has(e.pattern));
        if (idx === -1) return;
        if (idx > 0) {
          const [chosen] = s.exercises.splice(idx, 1);
          s.exercises.unshift(chosen);
          idx = 0;
        }
        const ex = s.exercises[idx];
        s.exercises[idx] = Object.assign({}, ex, {
          topSet: { reps: '4-6', rir: '1-2' },
          backoffSets: Math.max(0, ex.sets - 1),
          backoffPct: -10,
        });
      });
    }

    // DEC-003 v2 / DEC-007: duración estimada por día = series × (descanso
    // medio + 45 s de transición/ejecución), redondeada a minutos (criterio
    // de la app). Los ejercicios unilaterales cuentan doble (se hace cada
    // lado por separado, así que ocupan el doble de tiempo real).
    sessions.forEach(s => {
      let seconds = 0;
      s.exercises.forEach(e => {
        const unilateralFactor = e.unilateral ? 2 : 1;
        if (e.topSet) {
          seconds += unilateralFactor * (1 * (180 + 45));
          seconds += unilateralFactor * ((e.backoffSets || 0) * (150 + 45));
        } else {
          const rest = e.type === 'compound' ? 150 : 75;
          seconds += unilateralFactor * (e.sets * (rest + 45));
        }
      });
      s.durationMin = Math.round(seconds / 60);
    });

    // DEC-005: con la bandera activa, en definición el cardio deja de
    // minimizarse y respeta un piso de 150 min/semana a intensidad moderada
    // (OMS 2020 / ACSM 2011), aunque eso implique más interferencia con la
    // fuerza de la que recomienda Helms et al. 2015 para solo rendimiento.
    const cardio = p.goal === 'cut'
      ? (p.healthGoal
        ? { sessions: 3, minutes: 50, type: 'Cardio moderado (caminata, bici, elíptica) al 60-70 % FC máx.', rule: 'Objetivo "salud/funcional" activo: el cardio no se recorta por estar en definición; se mantiene el piso de 150 min/semana recomendado para la salud cardiovascular, aunque interfiera algo más con la ganancia de fuerza.' }
        : { sessions: p.level === 'advanced' ? 3 : 2, minutes: 25, type: 'LISS (caminata inclinada, bici, elíptica) al 60-70 % FC máx.; opcional 1 sesión HIIT de 10-15 min', rule: 'La mínima cantidad necesaria para mantener el ritmo de pérdida; añade 10 min/sesión solo si el peso se estanca 2 semanas. Sepáralo del entrenamiento de fuerza o hazlo después.' })
      : { sessions: 2, minutes: 25, type: 'Cardio moderado por salud cardiovascular', rule: 'Sin objetivo de gasto: mantiene la capacidad aeróbica y la salud (150 min/semana moderado como referencia general). No interfiere con la hipertrofia a este volumen.' };

    return {
      splitName: split.name, daysPerWeek: days, weeklySets, laggingApplied, sessions,
      intensity: 'La mayoría de series en 6-12 repeticiones al 70-80 % del 1RM, terminando a 1-3 repeticiones del fallo (RIR). Aislamientos hasta 15 repeticiones.',
      progression: 'Doble progresión: cuando completes el rango alto de repeticiones en todas las series con buena técnica, sube la carga 2-5 % (tren superior) o 5-10 % (tren inferior) y vuelve al rango bajo.',
      deload: 'Cada 4-6 semanas, o cuando el rendimiento caiga 2 sesiones seguidas, reduce el volumen a la mitad durante una semana manteniendo la carga.',
      cardio,
      posing: p.division.startsWith('general') ? null : 'Practica las poses obligatorias de tu división 2-3 veces/semana durante 10-15 min; en las últimas 8 semanas a diario. Es parte del juicio y también gasto energético.',
      sources: ['HELMS_TRAIN', 'SCHOENFELD_VOL', 'SCHOENFELD_FREQ', 'ACSM_RT', 'ACSM_CARDIO', 'WHO_PA', 'BICKEL_2011', 'SPIERING_2021'],
      warnings: trainingWarnings,
    };
  }

  /* ---------- DEC-009: tamizaje de salud ---------- */

  // PRINCIPIO RECTOR: esta función solo informa/bloquea según reglas con
  // respaldo cargado (ver DECISIONS.md). No inventa ajustes para
  // condiciones sin regla: esas quedan solo registradas, sin efecto.
  function computeHealthScreen(p) {
    const h = p.health;
    const warnings = [];
    const sources = [];

    // Capa 1 (ACSM / Riebe et al. 2015): el plan de la app se trata como
    // ejercicio de intensidad vigorosa a estos efectos.
    let blocked = false, blockReason = null, medicalClearanceRecommended = false;
    if (h.screening.symptoms || h.screening.cvMetabolicRenal) sources.push('RIEBE_2015');
    if (h.screening.symptoms) {
      blockReason = 'Indicaste tener síntomas de alarma (dolor en el pecho, falta de aire en reposo, mareo, palpitaciones u otros). Suspendé el ejercicio y consultá a un médico antes de continuar.';
      blocked = !h.screening.medicalClearance;
    } else if (h.screening.cvMetabolicRenal && !h.screening.regularExercise) {
      blockReason = 'Indicaste una condición cardiovascular, metabólica o renal y no entrenás de forma regular en los últimos 3 meses. Se recomienda autorización médica antes de empezar.';
      blocked = !h.screening.medicalClearance;
    } else if (h.screening.cvMetabolicRenal && h.screening.regularExercise) {
      medicalClearanceRecommended = true;
      warnings.push({ level: 'warn', text: 'Autorización médica recomendada antes de entrenar a intensidad vigorosa (vigente en los últimos 12 meses), por la condición cardiovascular, metabólica o renal indicada.' });
    }

    // Capa 2 (ADA/Colberg 2016, ACSM/Kanaley 2022): solo informa, nunca
    // cambia volumen, calorías ni ejercicios.
    let diabetesWarning = null, weightLossMedWarning = null;
    if (h.diabetes.type !== 'none' && h.diabetes.medication) {
      sources.push('COLBERG_2016', 'KANALEY_2022');
      diabetesWarning = 'Usás insulina u otro fármaco que baja la glucosa: hay riesgo de hipoglucemia asociada al ejercicio. Controlá tu glucosa antes y después de entrenar, llevá contigo un carbohidrato de acción rápida y reconocé los síntomas de hipoglucemia.';
      warnings.push({ level: 'warn', text: diabetesWarning });
      if (p.goal === 'cut') {
        weightLossMedWarning = 'La pérdida de peso en esta fase puede requerir ajustar tu medicación para la diabetes: consultalo con tu médico antes de empezar.';
        warnings.push({ level: 'warn', text: weightLossMedWarning });
      }
    }

    // Capa 3 (lesiones): aviso de evaluación profesional cuando no hay
    // diagnóstico. La exclusión de ejercicios (filterLibByInjuries) ya se
    // aplicó en computeTraining; acá solo se arma el aviso y el resumen.
    const injuries = h.injuries || [];
    if (injuries.length) sources.push('SILBERNAGEL_2007');
    injuries.forEach(inj => {
      if (!inj.diagnosed) {
        const label = (K.INJURY_LABELS && K.INJURY_LABELS[inj.zone]) || inj.zone;
        warnings.push({ level: 'info', text: `${label}: te recomendamos una evaluación profesional; mientras tanto, se excluyen los ejercicios que suelen cargar esta zona.` });
      }
    });

    const anyCondition = h.screening.cvMetabolicRenal || h.screening.symptoms || h.diabetes.type !== 'none' || injuries.length > 0;
    return {
      blocked, blockReason, medicalClearanceRecommended, diabetesWarning, weightLossMedWarning,
      injuries, anyCondition,
      disclaimer: anyCondition ? 'Estas adaptaciones aplican posicionamientos científicos oficiales y no reemplazan la valoración de un médico, fisioterapeuta o entrenador certificado.' : null,
      warnings, sources: unique(sources),
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
    const health = computeHealthScreen(p); // DEC-009: no cambia metrics/targets/nutrition; training ya filtró ejercicios por lesión arriba.
    const supplements = K.SUPPLEMENTS.filter(s => p.goal !== 'bulk' || s.source !== 'HELMS_NUT');
    const warnings = [].concat(metrics.warnings, targets.warnings, nutrition.warnings, training.warnings, health.warnings);
    const sourcesUsed = unique([metrics.bmrMethod, 'NAVY', 'KOURI', 'ACE_BF', 'ASHWELL', 'ROSSOW', 'IFBB_RULES'].concat(nutrition.sources, training.sources, supplements.map(s => s.source), health.sources));
    return {
      generatedAt: today, input: p, metrics, targets, nutrition, training, health, supplements, warnings, sourcesUsed,
      disclaimer: 'Esta app aplica recomendaciones publicadas en revisiones por pares y posicionamientos oficiales de sociedades científicas. No sustituye la valoración de un médico, un dietista-nutricionista colegiado ni un entrenador certificado. Ante enfermedad, embarazo, trastornos alimentarios o uso de fármacos, consulta antes de aplicar cualquier plan.',
    };
  }

  // DEC-009: reconstruye los datos de salud desde los campos planos del
  // formulario (mismo patrón que laggingMuscles/availablePlates: grupos de
  // checkboxes que comparten `name`, reunidos acá en listas/objetos).
  function normalizeHealth(src) {
    src = src || {};
    // normalizeProfile se llama tanto sobre datos frescos del formulario
    // (campos planos: healthSymptoms, diabetesType, injuryZones...) como
    // sobre un perfil YA normalizado y guardado (donde esos campos planos
    // no existen más: solo existe `health`, ya anidado). `diabetesType`
    // es un <select>, siempre viaja en el envío del formulario exista o
    // no cada checkbox marcado, así que sirve para distinguir ambos casos
    // sin depender de que algún checkbox en particular esté tildado.
    if (!('diabetesType' in src) && src.health) return src.health;
    const toList = v => Array.isArray(v) ? v : (v ? [v] : []);
    const validZones = (K.INJURY_ZONES || []);
    const zones = unique(toList(src.injuryZones).filter(z => validZones.indexOf(z) !== -1));
    const diagnosedSet = new Set(toList(src.injuryDiagnosed));
    const painSet = new Set(toList(src.injuryPainNow));
    const injuries = zones.map(zone => ({ zone, diagnosed: diagnosedSet.has(zone), painNow: painSet.has(zone) }));
    const diabetesType = ['type1', 'type2'].indexOf(src.diabetesType) !== -1 ? src.diabetesType : 'none';
    return {
      screening: {
        regularExercise: !!src.healthRegularExercise,
        cvMetabolicRenal: !!src.healthCvMetabolicRenal,
        symptoms: !!src.healthSymptoms,
        medicalClearance: !!src.healthMedicalClearance,
      },
      diabetes: { type: diabetesType, medication: !!src.healthDiabetesMed },
      injuries,
    };
  }

  function normalizeProfile(src) {
    const n = v => { const x = parseFloat(v); return isFinite(x) ? x : 0; };
    const sex = src.sex === 'F' ? 'F' : 'M';
    let division = src.division;
    if (!K.DIVISIONS[division] || K.DIVISIONS[division].sex !== sex) division = sex === 'M' ? 'general_m' : 'general_w';
    const validMuscles = Object.keys(K.EXERCISES);
    const laggingRaw = Array.isArray(src.laggingMuscles) ? src.laggingMuscles : (src.laggingMuscles ? [src.laggingMuscles] : []);
    const laggingMuscles = unique(laggingRaw.filter(m => validMuscles.includes(m)));
    return {
      name: (src.name || 'Perfil').toString().trim(),
      sex, age: n(src.age), heightCm: n(src.heightCm), weightKg: n(src.weightKg),
      bodyFatPct: n(src.bodyFatPct), neckCm: n(src.neckCm), waistCm: n(src.waistCm), hipCm: n(src.hipCm),
      activity: src.activity || 'moderate',
      level: ['novice', 'intermediate', 'advanced'].includes(src.level) ? src.level : 'intermediate',
      daysPerWeek: n(src.daysPerWeek) || 4,
      division, goal: ['cut', 'bulk', 'maintain'].includes(src.goal) ? src.goal : 'cut',
      targetDate: src.targetDate || '', targetBf: n(src.targetBf), classicLimitLb: n(src.classicLimitLb),
      laggingMuscles, healthGoal: !!src.healthGoal,
      health: normalizeHealth(src), // DEC-009
      // Fase 5: ajustes de la barra cargada. No participan de ningún cálculo
      // de volumen/calorías/selección de ejercicios, solo de la vista de
      // discos del modo sesión.
      plateUnit: src.plateUnit === 'lb' ? 'lb' : 'kg',
      barWeight: (() => { const w = parseFloat(src.barWeight); return w > 0 ? w : (src.plateUnit === 'lb' ? 45 : 20); })(),
      availablePlates: Array.isArray(src.availablePlates) && src.availablePlates.length
        ? src.availablePlates.map(Number).filter(n => n > 0)
        : (src.plateUnit === 'lb' ? [55, 45, 35, 25, 10, 5, 2.5] : [25, 20, 15, 10, 5, 2.5, 1.25]),
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

  return { bmrMifflin, bmrKatch, bodyFatNavy, ffmi, classicLimit, computeMetrics, computeTargets, computeNutrition, computeTraining, computeHealthScreen, buildPlan, normalizeProfile, validateProfile, SPLITS, LB_PER_KG };
});
