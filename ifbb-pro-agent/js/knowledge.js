/* Base de conocimiento del agente.
 * Todo valor numérico usado por el motor sale de una fuente identificada aquí.
 * Las claves de SOURCES se citan desde engine.js y desde la interfaz.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KNOWLEDGE = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SOURCES = {
    MIFFLIN: {
      id: 'MIFFLIN',
      short: 'Mifflin-St Jeor 1990 / Frankenfield 2005',
      title: 'Mifflin MD et al. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr 1990;51:241-7. Validada como la ecuación más precisa por Frankenfield D et al., J Am Diet Assoc 2005;105:775-89 (revisión sistemática de la Academy of Nutrition and Dietetics).',
      url: 'https://pubmed.ncbi.nlm.nih.gov/15883556/',
      type: 'Revisión sistemática / guía clínica',
    },
    KATCH: {
      id: 'KATCH',
      short: 'Katch-McArdle (Cunningham 1980)',
      title: 'Cunningham JJ. A reanalysis of the factors influencing basal metabolic rate in normal adults. Am J Clin Nutr 1980;33:2372-4. Ecuación basada en masa libre de grasa, útil en personas con mucha masa muscular.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/7435418/',
      type: 'Artículo revisado por pares',
    },
    NAVY: {
      id: 'NAVY',
      short: 'Hodgdon & Beckett 1984 (US Navy)',
      title: 'Hodgdon JA, Beckett MB. Prediction of percent body fat for U.S. Navy men/women from body circumferences and height. Naval Health Research Center, Reports 84-11 y 84-29, 1984. Error típico ±3-4 % frente a DXA.',
      url: 'https://apps.dtic.mil/sti/citations/ADA143890',
      type: 'Informe técnico institucional',
    },
    HELMS_NUT: {
      id: 'HELMS_NUT',
      short: 'Helms, Aragon & Fitschen 2014 (JISSN)',
      title: 'Helms ER, Aragon AA, Fitschen PJ. Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. J Int Soc Sports Nutr 2014;11:20. Proteína 2,3-3,1 g/kg de masa magra, grasa 15-30 % kcal, resto carbohidrato, pérdida 0,5-1 % del peso/semana.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/24864135/',
      type: 'Revisión revisada por pares',
    },
    HELMS_TRAIN: {
      id: 'HELMS_TRAIN',
      short: 'Helms et al. 2015 (J Sports Med Phys Fitness)',
      title: 'Helms ER, Fitschen PJ, Aragon AA, Cronin J, Schoenfeld BJ. Recommendations for natural bodybuilding contest preparation: resistance and cardiovascular training. J Sports Med Phys Fitness 2015;55(3):164-78. Cada grupo muscular ≥2 veces/semana, mayoría de repeticiones en 6-12 al 70-80 % 1RM, ~40-70 repeticiones por grupo y sesión, cardio mínimo necesario.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/24998610/',
      type: 'Revisión revisada por pares',
    },
    IRAKI: {
      id: 'IRAKI',
      short: 'Iraki et al. 2019 (Sports)',
      title: 'Iraki J, Fitschen P, Espinar S, Helms E. Nutrition recommendations for bodybuilders in the off-season: a narrative review. Sports 2019;7(7):154. Superávit ~10-20 %, ganancia 0,25-0,5 % del peso/semana, proteína 1,6-2,2 g/kg, grasa 0,5-1,5 g/kg, carbohidrato ≥3-5 g/kg, 3-6 comidas con 0,40-0,55 g/kg de proteína cada una.',
      url: 'https://doi.org/10.3390/sports7070154',
      type: 'Revisión revisada por pares',
    },
    ISSN_PROT: {
      id: 'ISSN_PROT',
      short: 'ISSN Position Stand: Proteína (Jäger 2017)',
      title: 'Jäger R et al. International Society of Sports Nutrition Position Stand: protein and exercise. J Int Soc Sports Nutr 2017;14:20. 1,4-2,0 g/kg/día para la mayoría; 2,3-3,1 g/kg/día en déficit calórico para conservar masa magra.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/28642676/',
      type: 'Posicionamiento oficial de sociedad científica',
    },
    ISSN_DIET: {
      id: 'ISSN_DIET',
      short: 'ISSN Position Stand: Dietas y composición corporal (Aragon 2017)',
      title: 'Aragon AA et al. International Society of Sports Nutrition position stand: diets and body composition. J Int Soc Sports Nutr 2017;14:16. La pérdida de grasa depende de un déficit calórico sostenido; la distribución de macronutrientes es secundaria una vez cubierta la proteína.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/28630601/',
      type: 'Posicionamiento oficial de sociedad científica',
    },
    ISSN_CREATINE: {
      id: 'ISSN_CREATINE',
      short: 'ISSN Position Stand: Creatina (Kreider 2017)',
      title: 'Kreider RB et al. ISSN position stand: safety and efficacy of creatine supplementation in exercise, sport, and medicine. J Int Soc Sports Nutr 2017;14:18. 3-5 g/día de monohidrato de creatina (o 0,3 g/kg/día 5-7 días de carga).',
      url: 'https://pubmed.ncbi.nlm.nih.gov/28615996/',
      type: 'Posicionamiento oficial de sociedad científica',
    },
    ISSN_CAFFEINE: {
      id: 'ISSN_CAFFEINE',
      short: 'ISSN Position Stand: Cafeína (Guest 2021)',
      title: 'Guest NS et al. ISSN position stand: caffeine and exercise performance. J Int Soc Sports Nutr 2021;18:1. 3-6 mg/kg 60 min antes del ejercicio mejora el rendimiento.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/33388079/',
      type: 'Posicionamiento oficial de sociedad científica',
    },
    ISSN_BA: {
      id: 'ISSN_BA',
      short: 'ISSN Position Stand: Beta-alanina (Trexler 2015)',
      title: 'Trexler ET et al. ISSN position stand: beta-alanine. J Int Soc Sports Nutr 2015;12:30. 4-6 g/día durante ≥2-4 semanas mejora esfuerzos de 1-4 min.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/26175657/',
      type: 'Posicionamiento oficial de sociedad científica',
    },
    ACSM_RT: {
      id: 'ACSM_RT',
      short: 'ACSM Position Stand: Progresión en entrenamiento de fuerza (2009)',
      title: 'American College of Sports Medicine. Progression models in resistance training for healthy adults. Med Sci Sports Exerc 2009;41(3):687-708. Hipertrofia: 70-85 % 1RM, 8-12 repeticiones, descanso 1-3 min, 1-3 series por ejercicio en novatos y más en avanzados, periodización.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/19204579/',
      type: 'Posicionamiento oficial de sociedad científica',
    },
    SCHOENFELD_VOL: {
      id: 'SCHOENFELD_VOL',
      short: 'Schoenfeld, Ogborn & Krieger 2017 (J Sports Sci)',
      title: 'Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis. J Sports Sci 2017;35(11):1073-82. ≥10 series semanales por grupo muscular producen más hipertrofia que <10; relación dosis-respuesta.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/27433992/',
      type: 'Metaanálisis',
    },
    SCHOENFELD_FREQ: {
      id: 'SCHOENFELD_FREQ',
      short: 'Schoenfeld, Ogborn & Krieger 2016 (Sports Med)',
      title: 'Schoenfeld BJ, Ogborn D, Krieger JW. Effects of resistance training frequency on measures of muscle hypertrophy: a systematic review and meta-analysis. Sports Med 2016;46(11):1689-97. Entrenar cada grupo muscular ≥2 veces por semana supera a 1 vez a igual volumen.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/27102172/',
      type: 'Metaanálisis',
    },
    KOURI: {
      id: 'KOURI',
      short: 'Kouri et al. 1995 (Clin J Sport Med)',
      title: 'Kouri EM, Pope HG, Katz DL, Oliva P. Fat-free mass index in users and nonusers of anabolic-androgenic steroids. Clin J Sport Med 1995;5(4):223-8. FFMI normalizado a 1,80 m: ningún atleta natural superó 25,0.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/7496846/',
      type: 'Artículo revisado por pares',
    },
    ROSSOW: {
      id: 'ROSSOW',
      short: 'Rossow et al. 2013; Kistler et al. 2014 (estudios de caso)',
      title: 'Rossow LM et al. Natural bodybuilding competition preparation and recovery: a 12-month case study. Int J Sports Physiol Perform 2013;8(5):582-92 (DXA: 14,8 % → 4,5 % en 6 meses). Kistler BM et al. Case study: natural bodybuilding contest preparation. Int J Sport Nutr Exerc Metab 2014;24(6):694-700. Hombres en tarima: ~4-6 % de grasa (DXA); mujeres físico/bikini: ~9-16 % según Hulmi 2017 y Rohrig 2017.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/23412685/',
      type: 'Estudios de caso revisados por pares',
    },
    ACE_BF: {
      id: 'ACE_BF',
      short: 'ACE: categorías de porcentaje graso',
      title: 'American Council on Exercise. Grasa esencial: 2-5 % hombres, 10-13 % mujeres. Atletas: 6-13 % hombres, 14-20 % mujeres. Referencia de seguridad: no planificar por debajo de la grasa esencial.',
      url: 'https://www.acefitness.org/resources/everyone/tools-calculators/percent-body-fat-calculator/',
      type: 'Organismo certificador (NCCA)',
    },
    ASHWELL: {
      id: 'ASHWELL',
      short: 'Ashwell et al. 2012 (Obes Rev)',
      title: 'Ashwell M, Gunn P, Gibson S. Waist-to-height ratio is a better screening tool than waist circumference and BMI for adult cardiometabolic risk factors. Obes Rev 2012;13(3):275-86. Cintura < 0,5 × estatura como umbral de salud.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/22106927/',
      type: 'Metaanálisis',
    },
    FIBER: {
      id: 'FIBER',
      short: 'Institute of Medicine 2005 (DRI)',
      title: 'Institute of Medicine. Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids. 2005. Fibra: 14 g por cada 1.000 kcal.',
      url: 'https://nap.nationalacademies.org/catalog/10490',
      type: 'Institución científica nacional',
    },
    EFSA_WATER: {
      id: 'EFSA_WATER',
      short: 'EFSA 2010: agua',
      title: 'EFSA Panel on Dietetic Products. Scientific opinion on dietary reference values for water. EFSA Journal 2010;8(3):1459. Ingesta adecuada: 2,0 L/día mujeres, 2,5 L/día hombres, más las pérdidas por sudor.',
      url: 'https://doi.org/10.2903/j.efsa.2010.1459',
      type: 'Agencia regulatoria',
    },
    ACSM_CARDIO: {
      id: 'ACSM_CARDIO',
      short: 'ACSM 2011: cantidad y calidad de ejercicio',
      title: 'Garber CE et al. ACSM position stand: quantity and quality of exercise for developing and maintaining cardiorespiratory, musculoskeletal, and neuromotor fitness in apparently healthy adults. Med Sci Sports Exerc 2011;43(7):1334-59. ≥150 min/semana de cardio moderado para salud.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/21694556/',
      type: 'Posicionamiento oficial de sociedad científica',
    },
    IFBB_RULES: {
      id: 'IFBB_RULES',
      short: 'IFBB Professional League: reglamento por división',
      title: 'IFBB Professional League / NPC. Reglas y criterios de juicio de cada división (Bodybuilding, Classic Physique, Men\'s Physique, Women\'s Physique, Figure, Bikini, Wellness). La tabla de peso máximo por estatura de Classic Physique se actualizó en agosto de 2023 (subida de 2-7 lb) y de nuevo para 2025. Los valores de esta app son orientativos: verifica siempre el límite en el reglamento vigente antes de un chequeo de peso.',
      url: 'https://www.ifbbpro.com/rules/',
      type: 'Reglamento federativo',
    },
    SCHOENFELD_MEAL: {
      id: 'SCHOENFELD_MEAL',
      short: 'Schoenfeld & Aragon 2018 (JISSN)',
      title: 'Schoenfeld BJ, Aragon AA. How much protein can the body use in a single meal for muscle-building? J Int Soc Sports Nutr 2018;15:10. Objetivo 0,4 g/kg por comida en ≥4 comidas para alcanzar 1,6 g/kg/día.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/29497353/',
      type: 'Revisión revisada por pares',
    },
  };

  /* Factores de actividad (PAL) usados por FAO/OMS/UNU 2004 y adoptados por
   * la Academy of Nutrition and Dietetics para multiplicar el gasto en reposo. */
  const ACTIVITY = [
    { id: 'sedentary', label: 'Sedentario (trabajo de oficina, sin entrenar)', factor: 1.2 },
    { id: 'light', label: 'Ligero (entreno 1-3 días/semana)', factor: 1.375 },
    { id: 'moderate', label: 'Moderado (entreno 3-5 días/semana)', factor: 1.55 },
    { id: 'high', label: 'Alto (entreno 6-7 días/semana o trabajo físico)', factor: 1.725 },
    { id: 'veryhigh', label: 'Muy alto (doble sesión o trabajo muy físico)', factor: 1.9 },
  ];

  /* Divisiones IFBB Pro League. El rango de % graso en tarima procede de
   * estudios de caso con DXA (ROSSOW) y es una estimación, no un criterio oficial. */
  const DIVISIONS = {
    bodybuilding_m: {
      id: 'bodybuilding_m', sex: 'M', label: 'Men\'s Bodybuilding (Open / 212)',
      stageBf: [4, 6],
      judging: 'Masa muscular máxima con simetría, proporción, definición y separación. Se juzgan 8 poses obligatorias.',
      emphasis: ['Todo el cuerpo con volumen alto', 'Piernas y espalda como prioridad de masa'],
      weightLimit: null,
    },
    classic_m: {
      id: 'classic_m', sex: 'M', label: 'Classic Physique',
      stageBf: [5, 7],
      judging: 'Estética clásica: cintura estrecha, hombros anchos, línea en V, proporción y simetría por encima de la masa. Peso máximo según estatura.',
      emphasis: ['Deltoides y espalda alta (anchura)', 'Cuádriceps y pantorrillas (proporción)', 'Control de cintura y vacuum'],
      weightLimit: 'classic',
    },
    physique_m: {
      id: 'physique_m', sex: 'M', label: 'Men\'s Physique',
      stageBf: [6, 10],
      judging: 'Físico atlético en bermuda: hombros anchos, cintura estrecha, abdomen definido, presencia escénica. Las piernas no se juzgan y el exceso de masa se penaliza.',
      emphasis: ['Deltoides laterales y espalda (V-taper)', 'Abdomen y serrato', 'Pecho superior'],
      weightLimit: null,
    },
    physique_w: {
      id: 'physique_w', sex: 'F', label: 'Women\'s Physique',
      stageBf: [8, 12],
      judging: 'Musculatura visible y definida con feminidad, simetría y presentación. Poses obligatorias con manos abiertas.',
      emphasis: ['Deltoides y espalda', 'Cuádriceps e isquios', 'Glúteos'],
      weightLimit: null,
    },
    figure_w: {
      id: 'figure_w', sex: 'F', label: 'Figure',
      stageBf: [10, 14],
      judging: 'Línea en V, hombros redondeados, cintura pequeña, tono muscular general sin la separación de Physique.',
      emphasis: ['Deltoides laterales', 'Dorsal ancho', 'Glúteos y cuádriceps'],
      weightLimit: null,
    },
    bikini_w: {
      id: 'bikini_w', sex: 'F', label: 'Bikini',
      stageBf: [12, 16],
      judging: 'Equilibrio, forma y tono con menor definición que Figure; se valora la presentación y el desarrollo de glúteos y hombros sin exceso de musculatura.',
      emphasis: ['Glúteos e isquiotibiales', 'Deltoides', 'Espalda (línea en V suave)'],
      weightLimit: null,
    },
    wellness_w: {
      id: 'wellness_w', sex: 'F', label: 'Wellness',
      stageBf: [14, 18],
      judging: 'Mayor desarrollo de tren inferior (glúteos, cuádriceps, isquios) respecto al tren superior, con cintura estrecha.',
      emphasis: ['Glúteos', 'Cuádriceps e isquiotibiales', 'Tren superior moderado'],
      weightLimit: null,
    },
    general_m: {
      id: 'general_m', sex: 'M', label: 'Sin competir (físico general)',
      stageBf: [10, 14],
      judging: 'Objetivo de físico atlético saludable sin fecha de competición.',
      emphasis: ['Equilibrio general'],
      weightLimit: null,
    },
    general_w: {
      id: 'general_w', sex: 'F', label: 'Sin competir (físico general)',
      stageBf: [18, 22],
      judging: 'Objetivo de físico atlético saludable sin fecha de competición.',
      emphasis: ['Equilibrio general'],
      weightLimit: null,
    },
  };

  /* Tabla orientativa de peso máximo Classic Physique (IFBB Pro League / NPC,
   * versión de agosto 2023, en libras). No pudo verificarse contra el reglamento
   * vigente al construir esta app: la interfaz permite sobrescribirla. */
  const CLASSIC_WEIGHT_TABLE = [
    { maxHeightIn: 64, maxLb: 167 },
    { maxHeightIn: 65, maxLb: 172 },
    { maxHeightIn: 66, maxLb: 177 },
    { maxHeightIn: 67, maxLb: 182 },
    { maxHeightIn: 68, maxLb: 187 },
    { maxHeightIn: 69, maxLb: 192 },
    { maxHeightIn: 70, maxLb: 197 },
    { maxHeightIn: 71, maxLb: 202 },
    { maxHeightIn: 72, maxLb: 207 },
    { maxHeightIn: 73, maxLb: 212 },
    { maxHeightIn: 74, maxLb: 217 },
    { maxHeightIn: 75, maxLb: 222 },
    { maxHeightIn: 76, maxLb: 227 },
    { maxHeightIn: 77, maxLb: 232 },
    { maxHeightIn: 78, maxLb: 237 },
    { maxHeightIn: 79, maxLb: 242 },
  ];

  /* Biblioteca de ejercicios: multiarticulares como núcleo y monoarticulares de
   * apoyo (HELMS_TRAIN, ACSM_RT). Los rangos de repeticiones siguen 6-12 como
   * zona principal con 10-15 en aislamiento. */
  const EXERCISES = {
    chest: [
      { name: 'Press banca con barra', type: 'compound', reps: [6, 10] },
      { name: 'Press inclinado con mancuernas', type: 'compound', reps: [8, 12] },
      { name: 'Fondos en paralelas o press en máquina', type: 'compound', reps: [8, 12] },
      { name: 'Aperturas en polea o pec-deck', type: 'isolation', reps: [10, 15] },
    ],
    back: [
      { name: 'Dominadas o jalón al pecho', type: 'compound', reps: [6, 10] },
      { name: 'Remo con barra o remo pendlay', type: 'compound', reps: [6, 10] },
      { name: 'Remo en polea baja o máquina', type: 'compound', reps: [8, 12] },
      { name: 'Pullover en polea', type: 'isolation', reps: [10, 15] },
    ],
    shoulders: [
      { name: 'Press militar con barra o mancuernas', type: 'compound', reps: [6, 10] },
      { name: 'Elevaciones laterales con mancuerna', type: 'isolation', reps: [10, 15] },
      { name: 'Elevaciones laterales en polea', type: 'isolation', reps: [12, 15] },
      { name: 'Face pull / pájaros (deltoides posterior)', type: 'isolation', reps: [12, 15] },
    ],
    quads: [
      { name: 'Sentadilla trasera o sentadilla en hack', type: 'compound', reps: [6, 10] },
      { name: 'Prensa de piernas', type: 'compound', reps: [8, 12] },
      { name: 'Zancadas o sentadilla búlgara', type: 'compound', reps: [8, 12] },
      { name: 'Extensión de cuádriceps', type: 'isolation', reps: [10, 15] },
    ],
    hamstrings: [
      { name: 'Peso muerto rumano', type: 'compound', reps: [6, 10] },
      { name: 'Curl femoral tumbado o sentado', type: 'isolation', reps: [10, 15] },
    ],
    glutes: [
      { name: 'Hip thrust con barra', type: 'compound', reps: [6, 10] },
      { name: 'Sentadilla búlgara con énfasis en cadera', type: 'compound', reps: [8, 12] },
      { name: 'Abducción de cadera en máquina', type: 'isolation', reps: [12, 15] },
      { name: 'Patada de glúteo en polea', type: 'isolation', reps: [12, 15] },
    ],
    calves: [
      { name: 'Elevación de talones de pie', type: 'isolation', reps: [8, 12] },
      { name: 'Elevación de talones sentado', type: 'isolation', reps: [12, 15] },
    ],
    biceps: [
      { name: 'Curl con barra o barra Z', type: 'isolation', reps: [8, 12] },
      { name: 'Curl inclinado con mancuernas', type: 'isolation', reps: [10, 15] },
    ],
    triceps: [
      { name: 'Press cerrado o fondos', type: 'compound', reps: [6, 10] },
      { name: 'Extensión de tríceps en polea', type: 'isolation', reps: [10, 15] },
    ],
    abs: [
      { name: 'Crunch en polea o rueda abdominal', type: 'isolation', reps: [10, 15] },
      { name: 'Elevaciones de piernas colgado', type: 'isolation', reps: [10, 15] },
      { name: 'Vacuum abdominal (Classic / Physique)', type: 'isolation', reps: [5, 8] },
    ],
  };

  const MUSCLE_LABELS = {
    chest: 'Pecho', back: 'Espalda', shoulders: 'Hombros', quads: 'Cuádriceps',
    hamstrings: 'Isquiotibiales', glutes: 'Glúteos', calves: 'Pantorrillas',
    biceps: 'Bíceps', triceps: 'Tríceps', abs: 'Abdomen',
  };

  /* Suplementos con evidencia de posicionamiento oficial (ISSN). Cualquier otro
   * producto no se recomienda por falta de respaldo de este nivel. */
  const SUPPLEMENTS = [
    { name: 'Creatina monohidrato', dose: '3-5 g/día, cualquier hora, todos los días', source: 'ISSN_CREATINE', note: 'Mayor evidencia para fuerza y masa magra. Puede retener 1-2 kg de agua intramuscular.' },
    { name: 'Cafeína', dose: '3-6 mg/kg, 60 min antes de entrenar (máx. 400 mg/día)', source: 'ISSN_CAFFEINE', note: 'Evitar en las 6-8 h previas a dormir. Opcional.' },
    { name: 'Beta-alanina', dose: '4-6 g/día repartidos (≥4 semanas)', source: 'ISSN_BA', note: 'Útil en series largas / metabólicas. Puede causar hormigueo inofensivo.' },
    { name: 'Proteína en polvo (suero/caseína)', dose: 'Solo para completar la proteína diaria', source: 'ISSN_PROT', note: 'Es un alimento, no un suplemento ergogénico. Priorizar comida real.' },
    { name: 'Multivitamínico / vitamina D', dose: 'Según analítica', source: 'HELMS_NUT', note: 'Recomendado en dietas de preparación prolongadas por riesgo de deficiencias. Confirmar con análisis de sangre.' },
  ];

  return { SOURCES, ACTIVITY, DIVISIONS, CLASSIC_WEIGHT_TABLE, EXERCISES, MUSCLE_LABELS, SUPPLEMENTS };
});
