# DECISIONS.md — Reglas de negocio de IFBB Pro Agent

Cada decisión lleva su nivel de respaldo:
**[Posicionamiento]** sociedad oficial · **[Evidencia]** metaanálisis o revisión · **[Criterio]** juicio práctico, sin estándar específico.

Este archivo es la fuente de verdad de la lógica de negocio. Antes de cambiar cualquier cálculo del motor (`ifbb-pro-agent/js/engine.js`), consultarlo.

## DEC-001 · Grupos rezagados
- Input opcional nuevo en el perfil: lista de grupos rezagados.
- Volumen de esos grupos = base × ajuste de fase × 1,25.
- Precedencia: rezagado > énfasis de división. Si la división reduce el grupo (×0,5), el rezagado anula esa reducción.
- Tope semanal: 20 series por grupo.
- Respaldo: [Evidencia] Schoenfeld, Ogborn & Krieger 2017. Multiplicador y tope: [Criterio].
- Test: perfil Men's Physique, definición, intermedio, rezagados = cuádriceps, isquios, glúteos → ≈15 series/semana por grupo (14 × 0,85 × 1,25). Sin rezagados → se mantiene ≈6.

**Estado: implementada.**

## DEC-002 · Top set de fuerza en definición
- Solo en fase de definición: el primer multiarticular de cada día arranca con 1 serie × 4-6 reps @ RIR 1-2, y luego las series de back-off con −10% de carga en el rango normal.
- Mostrarlo en el plan como una línea separada ("Top set").
- Respaldo: Formato top set/back-off: [Criterio], construido sobre [Evidencia] Helms et al. 2015, Bickel, Cross & Bamman 2011, Spiering et al. 2021 y [Posicionamiento] ACSM 2009.
- Test: en definición aparece el top set; en volumen/mantenimiento no.

**Estado: implementada.** Fuentes agregadas a la pestaña Fuentes: `BICKEL_2011`, `SPIERING_2021`.

## DEC-003 · Tope por sesión
- Parámetro configurable: máximo de series por sesión (default 25).
- Mostrar la duración estimada de cada día: series × (descanso medio + 45 s).
- Si una sesión se pasa del tope, recortar en este orden: grupos pequeños (brazos, pantorrillas) hasta su mínimo → aislamientos. Nunca recortar multiarticulares. Reubicar las series recortadas en otro día que entrene el mismo grupo, si lo hay.
- Respaldo: [Criterio].
- Test: ninguna sesión supera el tope y ningún multiarticular desaparece.

**Estado: REEMPLAZADA por DEC-003 v2** (motivo: el plan recortaba series de grupos chicos cuando un día se pasaba del tope e intentaba pasarlas a otro día; si ese otro día también estaba al límite, las series se perdían sin avisar, y el total semanal mostrado dejaba de coincidir con lo que realmente aparecía en la rutina).

## DEC-003 v2 · Distribución balanceada + aviso de tope
- Al GENERAR el plan (no después), los grupos pequeños se asignan a los días compatibles con menos series totales:
  · Abdomen y pantorrillas: cualquier día; prioridad a los días que no son de pierna.
  · Bíceps: días de torso o tirón. Tríceps: días de torso o empuje.
- Los grupos grandes no se mueven de su día.
- Duración estimada visible por día: series × (descanso medio + 45 s); los unilaterales cuentan doble (ver DEC-007).
- Si un día supera 25 series, mostrar un aviso no bloqueante. No recortar ni mover nada automáticamente.
- Respaldo: [Criterio].
- Test: perfil Emanuel → los días de pierna no tienen abdomen ni pantorrillas si existe un día de empuje o tirón con menos series; un día con 26 series muestra el aviso.

**Estado: implementada.**

## DEC-006 · Sin patrones duplicados por sesión
- Un mismo ejercicio base (incluidas sus variantes, por ejemplo "búlgara" y "búlgara con énfasis en cadera") aparece como máximo una vez por sesión. Puede repetirse en días distintos.
- Para el segundo ejercicio de cuádriceps, priorizar prensa.
- Respaldo: [Criterio].

**Estado: implementada.** Corrección posterior: la primera versión agrupaba por texto del nombre (regex), lo que en un caso real hizo que la sentadilla trasera desapareciera del Día 2 de un perfil y quedara reemplazada por la búlgara. Ahora cada ejercicio del catálogo (`knowledge.js`) lleva un id de patrón explícito (`pattern`, p. ej. `squat_bilateral` vs `split_squat`); la comparación de duplicados usa ese id, no el nombre. Las dos búlgaras (cuádriceps y glúteos) y la búlgara funcional comparten a propósito el id `split_squat`.

## DEC-007 · Tiempo de unilaterales
- En la duración estimada, los ejercicios unilaterales cuentan doble.
- Respaldo: [Criterio].

**Estado: implementada.**

## DEC-004 · Aviso de inconsistencia en % de grasa
- Si hay % de grasa ingresado Y circunferencias, calcular también el % por fórmula Navy. Si la diferencia es mayor a 4 puntos, mostrar un aviso no bloqueante con ambos valores.
- Respaldo: [Evidencia] Hodgdon & Beckett 1984 (error ±3-4%). Umbral: [Criterio].
- Test: diferencia de 5 puntos → aviso; diferencia de 2 → sin aviso.

**Estado: implementada.**

## DEC-005 · Objetivo "salud/funcional"
- Bandera nueva en el perfil, desactivada por defecto.
- Si está activa: en definición el cardio no se minimiza; piso de 150 min/semana a intensidad moderada.
- Agregar al catálogo de ejercicios de pierna: sentadilla búlgara, step-up con carga y paseo del granjero. Solo se incluyen en el plan si la bandera está activa.
- Respaldo cardio: [Posicionamiento] ACSM 2011 / OMS 2020. Ejercicios: [Criterio].
- Test: bandera activa → cardio ≥150 min/semana; desactivada → sin cambios respecto al comportamiento actual.

**Aclaración (tras un bug real):** con la bandera activa, el ejercicio funcional (búlgara, step-up, paseo del granjero) se SUMA como complemento: va después de los multiarticulares principales del día y nunca reemplaza al patrón bilateral pesado. Se financia quitándole series a un aislamiento del mismo grupo ese día (o, si no hay, al último ejercicio del grupo), sin bajarlo de un piso de 2 series, para no alterar el volumen semanal de DEC-001.
- Test: con la bandera activa, el Día 2 incluye sentadilla trasera o hack Y búlgara, con la búlgara ordenada después.

**Estado: implementada.** La versión original sustituía directamente el primer ejercicio de cuádriceps por el funcional cuando la bandera estaba activa, lo que hacía desaparecer la sentadilla trasera/hack del día. Corregido con la regla de "sumar, no reemplazar" de arriba.

**Segundo bug encontrado en verificación (punto 4):** el reparto de los 3 ejercicios funcionales era un round-robin simple, pero cuádriceps solo entrena 2 veces por semana en todos los splits: con 3 opciones y 2 ocurrencias, "paseo del granjero" (el 3º de la lista) nunca llegaba a salir. Corregido reservando el acarreo para la última vez que el músculo aparece esa semana, y rotando las otras dos opciones (búlgara, step-up) en las ocurrencias anteriores. También se ajustó a qué ejercicio se le quitan series para financiarlo: antes podía tocar el propio ejercicio con top set si no había aislamiento ese día; ahora prioriza un compuesto sin top set (p. ej. prensa) antes que el que lo tiene.

**Corrección por DEC-010:** la regla de financiamiento descrita arriba solo vale para los funcionales que SÍ aportan volumen de hipertrofia al grupo (búlgara con mancuernas y step-up: primario cuádriceps, glúteo secundario). El paseo del granjero no aporta a ningún grupo: si se financiara quitándole series a un aislamiento, el volumen real de cuádriceps bajaría hasta 2 series por semana sin que nada lo reemplace. Por eso el paseo ahora se agrega aparte (2 series, `muscle: null`, etiqueta "Funcional"), sin descontar de ningún ejercicio. Cuenta en `totalSets` y en la duración, no en el volumen del grupo. Efecto visible, solo con la bandera activa: el último día de pierna suma 2 series y, en los 10 perfiles de prueba, entre 6 y 13 minutos de duración, y puede acercarse o cruzar el aviso de 25 series.

## DEC-008 · Elegibilidad del top set
- El top set solo se asigna a multiarticulares bilaterales con carga libre o guiada pesada, de esta lista: sentadilla trasera, sentadilla hack, press banca, press militar, peso muerto rumano, remo con barra, dominadas/fondos lastrados.
- Nunca a unilaterales ni a máquinas de press.
- Si el primer ejercicio del día no es elegible, el top set pasa al primer ejercicio elegible del día, y ese ejercicio se ordena primero. Si ninguno es elegible, ese día no lleva top set.
- Respaldo: cargas ≥80% 1RM para fuerza [Posicionamiento] ACSM 2009; elegibilidad: [Criterio].
- Test: ningún top set cae en búlgara ni en press en máquina; el Día 2 abre con top set en sentadilla trasera o hack.
- Implementación: la elegibilidad se decide por el id de patrón del catálogo (ver corrección de DEC-006), no por `type==='compound'` ni por el nombre. Lista cerrada: `squat_bilateral, bench_press, shoulder_press, hinge, row_barbell, vertical_pull`. "Dominadas" se cubre con `vertical_pull`; no hay una entrada separada solo para fondos lastrados, así que ese caso puntual no obtiene top set con el catálogo actual.

**Estado: implementada.**

## PRINCIPIO RECTOR · Adaptación por salud
- La app NO reemplaza ni emula a un médico, fisioterapeuta ni entrenador certificado.
- Solo adapta el plan cuando hay una regla de un posicionamiento oficial o algoritmo validado cargado en este archivo.
- Si una condición declarada no tiene regla cargada, la app NO ajusta nada: muestra "Consultá con un profesional antes de seguir este plan" y registra la condición.

## DEC-009 · Condiciones de salud y lesiones

### Capa 1 · Tamizaje previo (ACSM, Riebe et al. 2015) [Posicionamiento]
Preguntas en el perfil:
- (a) ¿Hacés ejercicio planificado al menos 30 min, 3 días/semana, a intensidad moderada, en los últimos 3 meses?
- (b) ¿Tenés diagnóstico de enfermedad cardiovascular, metabólica (diabetes tipo 1 o 2) o renal?
- (c) ¿Tenés alguno de estos síntomas?: dolor o molestia en el pecho, falta de aire en reposo o con poco esfuerzo, mareo o desmayo, palpitaciones, hinchazón de tobillos, dolor en las piernas al caminar, soplo cardíaco conocido, fatiga inusual.

El plan de la app se considera de intensidad vigorosa a estos efectos. Lógica:
- Síntomas (c) = sí → bloqueo: "Suspendé el ejercicio y consultá a un médico". No se muestra el plan hasta que el usuario marque "Tengo autorización médica".
- (b) = sí y (a) = no → mismo bloqueo suave (autorización médica recomendada antes de empezar).
- (b) = sí y (a) = sí, sin síntomas → aviso no bloqueante: autorización médica recomendada antes de entrenar a intensidad vigorosa (vigente en los últimos 12 meses). No oculta el plan.
- (b) = no y (c) = no → sin aviso.
- Si el usuario cambia cualquiera de las tres respuestas, se reevalúa (la autorización médica marcada se resetea si cambian los síntomas).
- Respaldo: [Posicionamiento] Riebe D et al. Updating ACSM's recommendations for exercise preparticipation health screening. Med Sci Sports Exerc 2015;47(11):2473-9.

### Capa 2 · Diabetes (ADA, Colberg et al. 2016; ACSM, Kanaley et al. 2022) [Posicionamiento]
- Preguntas: tipo de diabetes (ninguna / tipo 1 / tipo 2) y si usa insulina u otros fármacos que bajan la glucosa.
- Si usa insulina o esos fármacos: aviso fijo de riesgo de hipoglucemia, con las precauciones del posicionamiento (controlar glucosa antes y después de entrenar, tener carbohidrato de acción rápida a mano, reconocer los síntomas de hipoglucemia). Sin cifras de dosis ni de glucosa: el aviso enlaza a la fuente, no las reemplaza.
- En fase de definición (`goal === 'cut'`) con diabetes + medicación: aviso adicional de que la pérdida de peso puede requerir ajustar la medicación, con indicación de consultarlo con su médico antes de empezar.
- La app NO modifica el volumen, las calorías ni los ejercicios por diabetes: solo informa.
- Respaldo: [Posicionamiento] Colberg SR et al. Physical activity/exercise and diabetes: a position statement of the American Diabetes Association. Diabetes Care 2016;39(11):2065-79. Kanaley JA et al. Exercise/physical activity in individuals with type 2 diabetes: ACSM position stand. Med Sci Sports Exerc 2022;54(2):353-68.

### Capa 3 · Lesiones: excluir y sustituir
- Input por zona declarada (hombro, codo, muñeca, espalda baja, cadera, rodilla, tobillo): si tiene diagnóstico profesional (sí/no) y si hay dolor actual.
- Sin diagnóstico → aviso: "Te recomendamos una evaluación profesional; mientras tanto, se excluyen los ejercicios que suelen cargar esta zona". La exclusión de ejercicios se aplica igual, con o sin diagnóstico; el diagnóstico solo cambia si se muestra ese aviso.
- Exclusión por zona [Criterio], dentro del mismo grupo muscular para mantener el volumen semanal de DEC-001 (el volumen por grupo se calcula antes de elegir ejercicios; excluir opciones de la lista no cambia cuántas series le tocan a cada grupo, solo cuáles ejercicios las cubren). Mapa cerrado, por id de patrón del catálogo:
  · **Hombro**: excluye `shoulder_press` (press por encima de la cabeza) de hombros, `chest_dip_or_machine` (fondos profundos) de pecho, `close_grip_press` de tríceps. Hombros se queda sin compuesto si no se sustituye, así que se agregó al catálogo "Press landmine o con agarre neutro" (patrón `shoulder_press_safe`), que pasa a ser la opción compuesta de hombro cuando `shoulder_press` está excluido. No es elegible para top set (DEC-008): un sustituto por lesión no debería cargarse por defecto al máximo.
  · **Codo**: excluye `curl_barbell` (curl con barra) de bíceps y `close_grip_press` de tríceps. Quedan `curl_incline` y `triceps_extension` respectivamente.
  · **Muñeca**: excluye `bench_press` (barra, extensión de muñeca bajo carga) de pecho, `row_barbell` de espalda y `curl_barbell` de bíceps. Quedan `incline_press`/`chest_dip_or_machine`, `vertical_pull`/`row_cable` y `curl_incline`.
  · **Espalda baja**: excluye `hinge` (peso muerto rumano) de isquiotibiales, `row_barbell` de espalda y `squat_bilateral` de cuádriceps. Isquiotibiales se queda solo con `leg_curl` (aislamiento): no se inventa un sustituto compuesto porque no hay uno razonable sin carga axial en el catálogo actual.
  · **Cadera**: excluye `squat_bilateral` y `split_squat` de cuádriceps, `split_squat` de glúteos. Quedan `leg_press`/`knee_extension` y `hip_thrust`/`hip_abduction`/`glute_kickback`.
  · **Rodilla**: excluye `squat_bilateral`, `split_squat` y `knee_extension` de cuádriceps (deja `leg_press`, generalmente mejor tolerada con rango controlado).
  · **Tobillo**: excluye `calf_raise_standing` de pantorrillas (deja `calf_raise_seated`) y `split_squat` de cuádriceps/glúteos (apoyo unilateral inestable).
- "Sustituir" significa, por defecto, que el motor elige el siguiente ejercicio no excluido de la misma lista del grupo muscular (ya existe en el catálogo); solo se agregó un ejercicio nuevo al catálogo en el caso de hombro, donde excluir dejaba el grupo sin ningún compuesto.
- Modo sesión: escala de dolor 0-10 en cada serie de ejercicios cuyo GRUPO MUSCULAR figure en el mapa de exclusión de alguna zona declarada por el usuario (tenga o no diagnóstico); no solo el patrón excluido, porque ese nunca llega a aparecer en el plan una vez excluido, y el que sí aparece (el sustituto, u otro ejercicio del mismo grupo) sigue involucrando la zona igual. Dolor ≤5 que no empeora al día siguiente → aceptable, sigue igual. Dolor >5 → se marca el ejercicio (por patrón) para sustituir en la próxima sesión por otro de la misma lista, y se sugiere consultar a un profesional. La marca se limpia recién cuando 2 sesiones DISTINTAS seguidas (no 2 series de la misma sesión) quedan con dolor ≤5.
  Respaldo: [Evidencia] modelo de monitoreo del dolor para tendinopatías (Silbernagel KG et al. Full symptomatic recovery does not ensure full recovery of muscle-tendon function in patients with Achilles tendinopathy. Br J Sports Med 2007;41(4):276-80; escala 0-10, ≤5 sin empeorar al día siguiente = carga aceptable). Extensión del modelo (pensado para tendinopatías) a otras zonas y mecanismos de dolor: [Criterio].
- Un ejercicio marcado por dolor nunca recibe el top set de DEC-002/008 ni progresión de carga sugerida mientras siga marcado; la marca se limpia si dos sesiones seguidas quedan con dolor ≤5.

### Privacidad
- Los datos de salud (tamizaje, diabetes, lesiones, registros de dolor) se guardan solo en el dispositivo (`localStorage`), nunca se incluyen en la exportación JSON del perfil y se pueden borrar con un botón ("Borrar datos de salud") sin afectar el resto del perfil.

### Disclaimer
Visible en el perfil y en el plan cuando haya cualquier condición declarada (tamizaje con aviso, diabetes o alguna lesión):
> "Estas adaptaciones aplican posicionamientos científicos oficiales y no reemplazan la valoración de un médico, fisioterapeuta o entrenador certificado."

### Tests
- Síntomas (c) = sí → el plan queda oculto hasta marcar la autorización médica.
- Diabetes con insulina → aparece el aviso de hipoglucemia; ningún número del plan (series, calorías, macros) cambia.
- Lesión de hombro (sin diagnóstico) → ningún ejercicio con patrón `shoulder_press` en el plan; el volumen semanal de hombro se mantiene igual (el sustituto cubre las mismas series).
- Sin condiciones declaradas → el plan queda idéntico al que generaba el motor antes de DEC-009.

**Estado: implementada.**

## DEC-010 · Aporte de volumen por ejercicio (base del validador)
Contexto: `docs/specs/validador.md` (23-oct-2026). El validador necesita contar series fraccionadas por músculo (primario 1.0, secundario 0.5) y un historial confiable. Hasta ahora el "músculo" de un ejercicio era el grupo donde vive en el catálogo, sin secundarios.

- **Ubicación ≠ aporte.** El bucket (`EXERCISES[grupo]` / `FUNCTIONAL_EXERCISES[grupo]`) define dónde vive un ejercicio: día, rotación, mapa de lesiones. El aporte de volumen sale de una tabla por ejercicio (`EXERCISE_CONTRIBUTION` en `knowledge.js`).
- **Campos del ejercicio en el plan:** `exerciseId`, `bucket` (dónde vive), `muscle` (primario real; `null` si no suma volumen de hipertrofia), `muscleLabel` ("Funcional" cuando `muscle` es null) y `secondary` (lista, peso 0.5). Para todo el catálogo salvo el paseo del granjero `muscle` coincide con `bucket`, así que ningún plan sin `healthGoal` cambia.
- **`exerciseId` único por entrada del catálogo, estable e inmutable** (`grupo.slug`, p. ej. `glutes.bulgarian_hip`). `pattern` no sirve de id: `split_squat` aparece 3 veces con primarios distintos y `lateral_raise` 2 veces en el mismo bucket. El nombre es solo de pantalla.
- **Historial:** cada serie de `profile.workouts` guarda `exerciseId` desde ahora. Las series viejas solo tienen `exercise` (nombre): se mapean por nombre con `EXERCISE_ID_BY_NAME`, posible porque los nombres del catálogo son únicos (hay un test que lo exige).
- **Tabla de aporte (todo E4: criterio de la app, sin fuente, hasta validarla).** Solo los 10 grupos existentes como primario/secundario. Correcciones aprobadas sobre la propuesta inicial: sin `abs` en sentadilla, sin `back` en peso muerto rumano, sin `chest` en press militar ni en press landmine, sin isquios en patada de glúteo. Hip thrust → isquios queda marcado `status: 'a_verificar'`. Paseo del granjero: sin aporte en ningún grupo (ni siquiera abs).
- **Configuración central** (`VALIDATOR_RULES` en `knowledge.js`, sin JSON externo): cada regla con `value`, `level` (E1-E4), `source`, `reviewedAt` y `verifiedAgainstPrimarySource` (false en todas: solo se consultaron resúmenes; el spec exige verificar contra la fuente primaria antes de fijar cada valor). `sessionSetCap` (25, el aviso de DEC-003 v2) entra como E4, sin fuente y con `reviewRequired: true`. `setExecutionSeconds` (45) es un supuesto fijo, a calibrar con tiempos reales del modo sesión. El motor ya lee de ahí el tope de 25 y los 45 s; los valores de R1-R3 están cargados pero todavía no los consume ninguna regla (fases siguientes).
- **DEC-005:** ver "Corrección por DEC-010" en esa decisión (el paseo del granjero se agrega sin descontar series).
- Tests: tabla completa y sin filas huérfanas; correcciones aprobadas; ids y nombres únicos; reglas bien formadas; identidad contra una línea base capturada con el motor anterior (10 perfiles sin `healthGoal` ni lesiones, salvo `exerciseId`/`bucket`/`secondary`); paseo del granjero sin descuento y con volumen semanal intacto.

**Estado: implementada (Fase 1).** Todavía no hay validación ni recortes: esta decisión solo prepara los datos.
