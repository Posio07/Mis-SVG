/* Fase 7: imágenes ilustrativas de ejercicios (posición inicial/final),
 * solo vista, sin ningún dato que participe de un cálculo.
 *
 * Fuente: free-exercise-db (https://github.com/yuhonas/free-exercise-db),
 * licencia Unlicense (dominio público: "Anyone is free to copy, modify,
 * publish, use, compile, sell, or distribute this software... for any
 * purpose... by any means", sin atribución obligatoria). Verificado en
 * LICENSE.md del repositorio antes de copiar cualquier imagen. Las
 * imágenes se descargaron una sola vez y se sirven localmente: la app no
 * depende de que ese repositorio siga disponible.
 *
 * Solo se mapean los ejercicios del catálogo con una imagen equivalente
 * razonable. Si un ejercicio no tiene equivalente claro (p. ej. abducción
 * de cadera en máquina), se omite a propósito: no se muestra imagen. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EXERCISE_IMAGES = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const BASE = 'img/exercises/';
  const map = {
    'Press banca con barra': 'Barbell_Bench_Press_-_Medium_Grip',
    'Press inclinado con mancuernas': 'Incline_Dumbbell_Press',
    'Fondos en paralelas o press en máquina': 'Dips_-_Chest_Version',
    'Aperturas en polea o pec-deck': 'Butterfly',
    'Dominadas o jalón al pecho': 'Wide-Grip_Lat_Pulldown',
    'Remo con barra o remo pendlay': 'Bent_Over_Barbell_Row',
    'Remo en polea baja o máquina': 'Seated_Cable_Rows',
    'Pullover en polea': 'Straight-Arm_Dumbbell_Pullover',
    'Press militar con barra o mancuernas': 'Standing_Military_Press',
    'Elevaciones laterales con mancuerna': 'Side_Lateral_Raise',
    'Elevaciones laterales en polea': 'Cable_Seated_Lateral_Raise',
    'Face pull / pájaros (deltoides posterior)': 'Face_Pull',
    'Sentadilla trasera o sentadilla en hack': 'Barbell_Squat',
    'Prensa de piernas': 'Leg_Press',
    'Zancadas o sentadilla búlgara': 'Split_Squat_with_Dumbbells',
    'Extensión de cuádriceps': 'Leg_Extensions',
    'Peso muerto rumano': 'Romanian_Deadlift',
    'Curl femoral tumbado o sentado': 'Lying_Leg_Curls',
    'Hip thrust con barra': 'Barbell_Hip_Thrust',
    'Sentadilla búlgara con énfasis en cadera': 'Split_Squat_with_Dumbbells',
    'Patada de glúteo en polea': 'Glute_Kickback',
    'Elevación de talones de pie': 'Standing_Calf_Raises',
    'Elevación de talones sentado': 'Seated_Calf_Raise',
    'Curl con barra o barra Z': 'Barbell_Curl',
    'Curl inclinado con mancuernas': 'Incline_Dumbbell_Curl',
    'Press cerrado o fondos': 'Close-Grip_Barbell_Bench_Press',
    'Extensión de tríceps en polea': 'Triceps_Pushdown',
    'Crunch en polea o rueda abdominal': 'Cable_Crunch',
    'Elevaciones de piernas colgado': 'Hanging_Leg_Raise',
    'Vacuum abdominal (Classic / Physique)': 'Stomach_Vacuum',
    'Sentadilla búlgara con mancuernas': 'Split_Squat_with_Dumbbells',
    'Step-up con carga': 'Step-up_with_Knee_Raise',
    'Paseo del granjero': 'Farmers_Walk',
  };

  const EXERCISE_IMAGES = {};
  Object.keys(map).forEach(name => {
    const folder = map[name];
    EXERCISE_IMAGES[name] = [BASE + folder + '/0.jpg', BASE + folder + '/1.jpg'];
  });

  return EXERCISE_IMAGES;
});
