# Especificación del validador de rutinas — IFBB Pro Agent

Versión: 23 de octubre de 2026 · Autor: Emanuel Miranda

## Contexto y objetivo

El validador revisa cada rutina generada contra límites con respaldo científico antes de mostrarla. Si la rutina no cumple, la ajusta o advierte al usuario, y explica qué regla se aplicó y con qué nivel de evidencia.

**Problema que resuelve.** En una misma semana aparecieron dos fallas con la misma raíz: el generador no tiene restricciones.

- Marcar cuádriceps, isquios y glúteos como rezagados llevó la pierna de 3–4 ejercicios por día a 8 ejercicios dos veces por semana (24 y 21 series por sesión), de un salto.
- Un full body de 3 días por semana salió con 34 series por sesión y más de 90 minutos, sin tiempo indicado y con una lesión de hombro declarada que la rutina ignoró.

**Alcance.** Es una capa posterior a la generación. Solo toca la lógica del generador para corregir datos de entrada, como las etiquetas de músculos. No adapta rutinas a lesiones ni a condiciones de salud, y no reemplaza a un profesional.

## Niveles de evidencia

Cada regla lleva una etiqueta de evidencia, y esa etiqueta define qué tan firme es el límite dentro de la app.

| Nivel | Qué significa | Cómo lo aplica la app |
| --- | --- | --- |
| E1 · Estándar oficial | Postura de un organismo reconocido (ej. ACSM) | Límite duro: ajuste automático |
| E2 · Meta-análisis publicado | Síntesis revisada por pares | Límite duro, con explicación al usuario |
| E3 · Preprint | Evidencia sólida aún sin revisión por pares | Límite por defecto; el usuario puede superarlo aceptando de forma explícita |
| E4 · Heurística | Regla práctica sin óptimo definido | Advertencia; el usuario decide |

Los valores, el nivel, la fuente y la fecha de revisión de cada regla viven en un archivo de configuración, no en el código. Así se actualizan cuando cambie la evidencia, sin tocar la lógica.

## Reglas del validador

Son cinco reglas: tres firmes (R1, R2, R5), una heurística etiquetada (R3) y una derivada por cálculo (R4).

### R1 · Tope por músculo por sesión (E3)

- **Regla:** como máximo 11 series fraccionadas por músculo por sesión. Una serie directa cuenta 1 y una indirecta cuenta 0.5.
- **Acción si se excede:** recortar primero las series de aislamiento de ese músculo. Si la frecuencia lo permite, redistribuirlas a otro día.
- **Base:** el meta-análisis de volumen por sesión de Pelland y colegas encontró el punto sin mejora detectable en ~11 series fraccionadas para hipertrofia y ~2 directas para fuerza. Es un preprint.

### R2 · Piso semanal y frecuencia (E1)

- **Regla:** al menos 10 series por músculo por semana para hipertrofia, y todos los grupos mayores entrenados 2 o más días por semana. Por defecto, 2–3 series por ejercicio; se permiten más si se respeta R1.
- **Acción:** si un músculo queda por debajo de 10, advertir o completar.
- **Base:** postura oficial del ACSM de 2026. Con igual volumen, la frecuencia no cambia los resultados, así que el generador puede repartir el volumen libremente.

### R3 · Rampa de progresión (E4)

- **Regla:** el volumen semanal por músculo no sube más de 20% respecto de la semana anterior. Equivale a un ratio agudo/crónico de 1.3 o menos sobre el promedio de 4 semanas.
- **Acción:** si el usuario cambia prioridades (por ejemplo, marca un músculo como rezagado), el aumento se reparte en varias semanas. El usuario puede aceptar el salto completo de forma explícita.
- **Usuario nuevo sin historial:** arranca en el piso de R2 y sube con la rampa.
- **Base:** heurística. El óptimo de progresión de volumen no está definido, y el ratio agudo/crónico viene de deportes de equipo y tiene críticas metodológicas.

### R4 · Duración derivada (cálculo + E1)

- **Regla:** duración estimada = suma de series × (tiempo de ejecución + descanso prescrito) + calentamiento.
- **Acción:** si el usuario indicó su tiempo disponible, la rutina se ajusta a ese tiempo. Si no lo indicó, se genera la dosis mínima efectiva de R2, se muestra la duración estimada y se ofrece de forma explícita una versión más larga.
- **Sin tope fijo de minutos:** ningún framework lo define. El tiempo de ejecución por serie es un parámetro configurable que se calibra con los tiempos reales del modo sesión.

### R5 · Tamizaje de condiciones (E1 para filtrar, sin framework para adaptar)

- **Regla:** antes de generar, el usuario completa el PAR-Q+ autoguiado, la herramienta que el ACSM recomienda para quien inicia un programa.
- **Condiciones cardiovasculares, metabólicas o renales** (ej. diabetes): se aplica la lógica del algoritmo ACSM 2015 (actividad actual, enfermedad o síntomas, intensidad deseada) para decidir si hace falta autorización médica.
- **Lesiones musculoesqueléticas** (ej. hombro): no hay un framework validado para adaptar la rutina desde una app. Se advierte, se deriva a un profesional y solo se genera la rutina tras confirmación explícita de que un profesional autorizó el entrenamiento. La advertencia queda visible en el plan.
- **Nunca:** generar como si la condición no existiera, ni fingir una adaptación.

## Requisitos de datos

El validador depende de que el catálogo cuente bien los músculos. Hoy hay al menos una etiqueta mal asignada.

- **Mapa ejercicio → músculos:** cada ejercicio tiene músculos primarios (peso 1.0) y secundarios (peso 0.5). Hay que auditar el catálogo completo. Caso conocido: el paseo del granjero figura como "Cuádriceps", cuando trabaja agarre, trapecio y core.
- **Historial de volumen:** series semanales por músculo de al menos las últimas 4 semanas, para R3.
- **Tiempo disponible:** dato opcional del usuario, para R4.
- **Tamizaje y aceptaciones:** respuestas del PAR-Q+ y cada aceptación explícita (salto de volumen, rutina larga, autorización profesional), guardadas con fecha.
- **Configuración de reglas:** valor, nivel de evidencia, fuente y fecha de revisión por regla.
- **Modo sesión:** registrar la duración real por serie para calibrar R4. La métrica de recuperación (dolor por músculo del 0 al 10 y top set) se empieza a registrar en v1, pero se usa para autorregular recién en v2.

## Flujo de integración

1. **Tamizaje PAR-Q+ (R5).**
   - Sin bandera → pasa al generador.
   - Con bandera → derivación a profesional. Solo pasa al generador tras confirmación explícita de autorización.
2. **Generador** produce la rutina.
3. **Validador (R1–R4)** revisa la rutina.
   - Cumple → rutina final al usuario.
   - No cumple → ajuste automático (E1–E2) o advertencia (E3–E4), y luego rutina final al usuario.
4. **Rutina final:** siempre muestra qué regla actuó, su nivel de evidencia y su fuente.

## Casos de prueba

Los tres casos cubren una falla real, una falla de seguridad y un control para evitar falsos positivos.

| Caso | Entrada | Reglas que se disparan | Resultado esperado |
| --- | --- | --- | --- |
| A · Experimento de pierna | Historial de 3–4 ejercicios de pierna por día; nueva rutina con día de cuádriceps de 24 series y día de isquios de 21 | R3: salto de volumen muy superior a 20%. R1: glúteo con ~14 fraccionadas el día de cuádriceps (hip thrust 4 + abducción 4 directas, y 12 indirectas de sentadilla, prensa, búlgara y rumano) y ~11.5 el día de isquios | Rampa de varias semanas propuesta; primero se recortan los aislamientos de glúteo; el paseo del granjero no cuenta para cuádriceps |
| B · Full body con hombro | 3 días por semana, 34 series por sesión, sin tiempo indicado, lesión de hombro declarada | R5, R4, R3 (usuario sin historial), R1 a verificar por músculo | Las 34 series no se muestran. Primero aparece la advertencia con derivación; tras la confirmación, se genera la dosis mínima de R2 con su duración estimada |
| C · Control válido | Torso/Pierna de 4 días, 12–16 series por músculo por semana, 11 o menos por sesión, historial similar | Ninguna | La rutina pasa sin cambios ni advertencias |

El experimento de Emanuel sigue corriendo con la rutina original, así que sus datos sirven para contrastar el caso A con lo que pasó en la realidad.

## Criterios de aceptación y fuera de alcance

La v1 está lista cuando los tres casos de prueba dan el resultado esperado y cada ajuste se explica solo.

- [ ] Los casos A, B y C producen el resultado esperado.
- [ ] Cada ajuste o advertencia muestra la regla que lo causó, su nivel de evidencia y la fuente.
- [ ] Los valores de las reglas viven en configuración, no en código.
- [ ] Las aceptaciones explícitas quedan registradas con fecha.
- [ ] El conteo fraccionado se verificó contra el catálogo completo, con las etiquetas corregidas.
- [ ] Cada valor se verificó contra el texto completo de su fuente primaria antes de fijarlo.

**Fuera de alcance en v1:** adaptar rutinas a lesiones o condiciones, autorregular el volumen según la recuperación (queda para v2), el rediseño visual y la dieta.

**Preguntas abiertas:**

- Revisar los términos de uso del PAR-Q+ antes de integrarlo.
- Definir el valor inicial del tiempo de ejecución por serie hasta tener datos del modo sesión.

## Fuentes

Salvo el preprint, se consultaron resúmenes y no los textos completos. Por eso el criterio de aceptación exige verificar cada valor en su fuente primaria.

| Regla | Fuente |
| --- | --- |
| R1 | [Pelland et al., meta-regresiones del volumen por sesión (preprint, SportRxiv)](https://sportrxiv.org/index.php/server/preprint/view/537) |
| R1, R2 | [Pelland et al., dosis-respuesta del volumen semanal y la frecuencia (resumen)](https://train.fitness/personal-trainer-blogs/not-all-sets-are-created-equal) |
| R2, R4 | [ACSM 2026, postura sobre prescripción del entrenamiento de fuerza (resumen)](https://recmanagement.com/articles/155711/acsm-unveils-landmark-2026-resistance-training-guidelines) · [tabla de recomendaciones ACSM 2026 vs 2009](https://exrx.net/WeightTraining/Guidelines.html) |
| R3 | [FAPESP: la progresión óptima de volumen no está definida (estudio de 20% vs 120% en curso)](https://bv.fapesp.br/en/bolsas/223465/URL) · [Gabbett, ratio de carga aguda/crónica](https://research.usq.edu.au/item/q6y98/workload-monitoring-and-athlete-management) |
| R5 | [ACE: tamizaje ACSM y PAR-Q+](https://www.acefitness.org/continuing-education/certified/february-2018/6898/new-preparticipation-guidelines-remove-barriers-to-exercise) · [Algoritmo ACSM 2015 de tamizaje previo (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7059860) |
