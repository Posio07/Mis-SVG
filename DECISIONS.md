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
- *Precisión por DEC-011:* "adaptar" aplica al tamizaje y a diabetes (posicionamientos oficiales). Para lesiones no existe un marco validado: la app no adapta la rutina, exige autorización profesional y solo evita ejercicios como precaución E4.

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

**Arreglo posterior (esta regla no se cumplía en el código):** al revisar DEC-011 se vio que `exportJson` serializaba el perfil completo (`JSON.stringify(profile)`), así que el archivo exportado llevaba `data.health` (tamizaje, diabetes, lesiones y, desde DEC-011, la fecha de autorización por zona), `painFlags` y el dolor registrado en cada serie (`workouts[].pain`), a pesar de lo escrito arriba. Se corrigió con funciones puras de `engine.js`, testeadas:
- **Export (`exportProfile`):** copia del perfil sin `data.health`, sin `painFlags` y sin `workouts[].pain`. Se conserva el resto (datos, medidas, historial de fuerza con peso y repeticiones). No muta el perfil local.
- **Import (`prepareImportedProfile`):** ignora y no guarda `health`, los campos planos de salud del formulario y `painFlags`, también en archivos exportados con la versión anterior que sí los traían. Un perfil importado queda siempre sin lesiones declaradas, sin tamizaje y sin diabetes; si el archivo traía datos de salud con contenido, se avisa en pantalla que se ignoraron. `workouts` tampoco se importa (nunca se importó).
- **Advertencia previa (`localHealthConflicts`):** el import nunca pisa un perfil existente (siempre crea uno nuevo), así que no se pueden borrar lesiones locales. Aun así, si ya hay un perfil local con lesiones declaradas que tiene el mismo id de exportación o el mismo nombre, se pregunta antes de importar y se explica que el nuevo quedará sin lesiones y que el existente conserva las suyas. Cancelar no importa nada.
- **Por qué:** los datos de salud son sensibles. Un archivo exportado suele terminar en un chat, un correo o una nube, y no tiene por qué llevar lesiones, diabetes ni fechas de autorización médica de nadie.
- Quien ya tenga archivos exportados con la versión anterior conserva esos datos dentro de ellos: el arreglo evita nuevas filtraciones, pero no puede borrar lo que ya se exportó.

### Disclaimer
Visible en el perfil y en el plan cuando haya cualquier condición declarada (tamizaje con aviso, diabetes o alguna lesión):
> "Estas adaptaciones aplican posicionamientos científicos oficiales y no reemplazan la valoración de un médico, fisioterapeuta o entrenador certificado."

**Reemplazado por DEC-011:** el texto de arriba afirmaba "adaptaciones" y ya no se usa. Para lesiones, la app no adapta la rutina; ver DEC-011 para el texto vigente y el flujo de autorización profesional.

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
- **Configuración central** (`VALIDATOR_RULES` en `knowledge.js`, sin JSON externo): cada regla con `value`, `level` (E1-E4), `source`, `reviewedAt` y `verifiedAgainstPrimarySource` (false en todas: solo se consultaron resúmenes; el spec exige verificar contra la fuente primaria antes de fijar cada valor). `sessionSetCap` (25, el aviso de DEC-003 v2) entra como E4, sin fuente y con `reviewRequired: true`. `setExecutionSeconds` (45) es un supuesto fijo, a calibrar con tiempos reales del modo sesión. El motor ya lee de ahí el tope de 25, los 45 s y las series del paseo del granjero (`functionalNoVolumeExtraSets`: 2, E4, sin fuente, `reviewRequired: true`, mismo formato que `sessionSetCap`; se lee en el momento de generar el plan); los valores de R1-R3 están cargados pero todavía no los consume ninguna regla (fases siguientes).
- **DEC-005:** ver "Corrección por DEC-010" en esa decisión (el paseo del granjero se agrega sin descontar series).
- Tests: tabla completa y sin filas huérfanas; correcciones aprobadas; ids y nombres únicos; reglas bien formadas; identidad contra una línea base capturada con el motor anterior (10 perfiles sin `healthGoal` ni lesiones). El test compara TODO el plan y solo admite las diferencias de una lista blanca explícita de rutas (`exerciseId`, `bucket`, `secondary` por ejercicio y, desde DEC-011, `health.injuryBlockReason` y `health.injuryClearance`): cualquier clave nueva, quitada o cambiada que no esté listada lo hace fallar, y una ruta listada que ya no difiera también (para que la lista no quede vieja); paseo del granjero sin descuento y con volumen semanal intacto.

**Estado: implementada (Fase 1).** Todavía no hay validación ni recortes: esta decisión solo prepara los datos.

**Nota (DEC-012):** la tabla de aporte ya no es un literal en `knowledge.js`: ahora se carga desde `data/exercise-muscles.csv` y suma un nivel de evidencia por fila. Los valores no cambiaron.

## DEC-011 · Lesiones: autorización profesional por zona, precauciones E4 y aviso por dolor
Contexto: `docs/specs/validador.md`, R5: "Lesiones musculoesqueléticas: no hay un framework validado para adaptar la rutina desde una app. Se advierte, se deriva a un profesional y solo se genera la rutina tras confirmación explícita de que un profesional autorizó el entrenamiento. Nunca: generar como si la condición no existiera, ni fingir una adaptación." Esta decisión reencuadra la Capa 3 de DEC-009 (que hablaba de "adaptar") sin cambiar el mapa de exclusiones.

### Flujo con cualquier zona declarada
1. **Advertencia:** el plan queda en pausa ("Plan en pausa", mismo patrón que la Capa 1 de DEC-009). El texto dice que la app no puede adaptar una rutina a una lesión porque no existe un marco validado.
2. **Derivación:** se indica consultar a un médico o fisioterapeuta.
3. **Confirmación explícita, una vez por zona:** "¿Un profesional te autorizó a entrenar con esta lesión?". Cada confirmación se guarda con fecha (`health.injuries[].clearanceDate`, formato `AAAA-MM-DD`).
- Aplica a cualquier zona, tenga o no diagnóstico profesional y marque o no dolor actual.
- Se vuelve a pedir si se **agrega** una zona (solo la nueva) o si una zona se quita y se vuelve a agregar. Editar el diagnóstico o el dolor actual de una zona que sigue declarada ya NO es neutro: ver "Ajuste posterior: re-autorización cuando una zona empeora" más abajo. La fecha se conserva entre ediciones del perfil (`carryOverInjuryClearances`, porque el formulario reconstruye las lesiones desde campos planos).
- Con síntomas (Capa 1) y lesión a la vez, la pantalla muestra las dos causas de pausa.
- Los perfiles que ya tenían una lesión declarada desde DEC-009 no tienen `clearanceDate`: se les pide la confirmación una vez, sin migración.
- El motor calcula el plan igual esté pausado o no (`buildPlan` es puro); es la interfaz la que decide no mostrarlo. Las sesiones solo se inician desde la vista del plan.

### Precauciones E4
- **Exclusiones por zona** (mapa de DEC-009, sin cambios): se aplican después de la autorización y son una **precaución heurística E4** (criterio de la app, sin fuente). Un aviso `{ evidence: 'E4' }` por zona lo dice en el plan, con la etiqueta visible "E4 · heurística".
- **Sustituto `shoulder_press_safe`:** también E4. El ejercicio del plan lleva `injurySubstitute: { zone, evidence: 'E4' }` y se muestra con la etiqueta. Un reemplazo por dolor (Capa B) NO hereda esa marca del ejercicio original: solo la lleva si el reemplazo es, a su vez, un ejercicio `injuryOnly`.
- **Texto de la interfaz:** ninguno puede decir que la rutina está adaptada a la lesión. Texto vigente del plan con condiciones: *"Estos avisos aplican posicionamientos científicos oficiales cuando existen y no reemplazan la valoración de un médico, fisioterapeuta o entrenador certificado."* + (con lesiones) *"Para lesiones la app no adapta la rutina: solo evita algunos ejercicios de la zona como precaución (E4) una vez que un profesional te autorizó a entrenar."* Reescritos también el texto de ayuda de Salud y el de lesiones del formulario.

### Dolor en Modo sesión (Capa B de DEC-009), aviso E4
- Se conserva la regla de DEC-009: dolor por encima del umbral marca el patrón para sustituir; se desmarca con 2 sesiones DISTINTAS seguidas sin pasarse. La lógica pasó a funciones puras de `engine.js` (`applyPainReading`, `painProfessionalAdvice`), testeadas, sin cambiar su comportamiento.
- **Aviso nuevo:** si un patrón tuvo dolor por encima del umbral en **2 o más sesiones distintas dentro de las últimas 4 semanas** (no necesariamente seguidas), el Modo sesión recomienda consultar a un profesional antes de seguir cargando ese movimiento. Etiqueta E4. Se evalúa sobre el patrón original del plan, haya sido sustituido o no, e independientemente de si la marca de sustitución sigue activa.
- Dos series con dolor de la misma sesión cuentan una vez. "Últimas 4 semanas" = 28 días hacia atrás, inclusive (a los 29 días la sesión deja de contar). El registro por patrón guarda `painSessions: [{ sessionId, date }]` y poda lo que sale de la ventana.
- Valores en `VALIDATOR_RULES`, todos E4: `painFlagThreshold` (5, con la fuente de Silbernagel 2007 ya citada en DEC-009), `painAdviceMinSessions` (2), `painAdviceWindowDays` (28).

### Tests
- Lesión declarada sin confirmar → plan pausado, con advertencia y derivación; con diagnóstico o sin él.
- Confirmación por zona con fecha: con una de dos zonas confirmadas, solo falta la otra; con todas, el plan se muestra.
- La fecha se conserva al editar; se vuelve a pedir al agregar una zona o al quitarla y volver a agregarla.
- Ningún texto del motor ni del código de la interfaz afirma adaptación a la lesión (detector probado contra los textos viejos); las precauciones llevan `evidence: 'E4'`.
- Aviso por dolor: 2 sesiones distintas dentro de 28 días (no seguidas); una sesión o dos series de la misma sesión no alcanzan; dolor igual al umbral no cuenta; el día 28 cuenta y el 29 no; sin mutar el registro anterior.
- Sin lesiones declaradas el plan no cambia y nunca se pausa (identidad contra la línea base).
- E2E en navegador: pausa → confirmación → fecha guardada → etiqueta E4 → al agregar una zona solo se pide la nueva; aviso de dolor y reemplazo sin heredar la etiqueta de precaución.

### Ajuste posterior: re-autorización cuando una zona empeora
La versión original de esta decisión conservaba la autorización de una zona aunque se editara su dolor o su diagnóstico. Eso dejaba entrenando con una autorización dada para otra situación clínica. Ahora, al guardar el perfil (`reconcileInjuryClearances`, función pura de `engine.js`):
- **Sube el dolor de la zona** (de "sin dolor" a "con dolor actualmente") → se invalida la autorización de esa zona.
- **Cambia el diagnóstico** (de "sin diagnóstico" a "con diagnóstico profesional", o al revés) → se invalida.
- **Baja el dolor, o no cambia nada** → no se pide nada; la fecha se conserva.
- La invalidación es **por zona**: las demás conservan su fecha. Una zona invalidada vuelve a pasar por el mismo flujo de advertencia, derivación y confirmación fechada.
- La comparación es contra lo guardado inmediatamente antes de editar, no contra el momento de la autorización: si el dolor baja y después vuelve a subir, esa segunda edición es una subida y vuelve a pedir la confirmación (criterio conservador).
- Hoy el dolor de una zona es una casilla (con dolor / sin dolor), así que "subir" es pasar de sin dolor a con dolor. Si más adelante se agrega una escala por zona, la regla "sube → invalida, baja → no" se mantiene y solo cambia la comparación.
- **Explicación en la pausa:** cuando una zona vuelve a pedirse por haber empeorado (y no cuando es su primera autorización), la pantalla de pausa agrega arriba del texto de siempre la línea *"Se pide de nuevo porque registraste dolor o cambiaste el diagnóstico en [zona]"*, con solo las zonas afectadas. La primera pausa y la de una zona nueva quedan sin esa línea. Para saber la diferencia, `reconcileInjuryClearances` marca la zona con `clearanceInvalidated: true` solo cuando pierde una autorización que ya tenía; la marca sobrevive a más ediciones mientras la zona siga sin confirmar (incluso si el dolor vuelve a bajar o empeora otra vez) y se borra al confirmar. La clave solo existe cuando vale `true`, así que no cambia nada para quien no empeoró. `zonesPendingReauthorization` (función pura) devuelve esas zonas. La marca es parte de `health`: no entra en `plan.health` ni sale en el export.
- `carryOverInjuryClearances` (conservar fechas) se mantiene como estaba; `reconcileInjuryClearances` la compone y además invalida las zonas que empeoraron.
- Tests: subida de dolor pausa; bajada o igual no pausa; cambio de diagnóstico en ambos sentidos pausa; invalidación solo de la zona afectada; funciones sin mutar entradas; e2e del flujo en navegador. Prueba de mutación: revirtiendo la invalidación fallan 3 tests unitarios y el e2e.

**Estado: implementada (Fase 1b y ajuste posterior).**

## DEC-012 · Tabla de músculos por ejercicio en un CSV versionado, con nivel de evidencia
Contexto: `docs/specs/validador.md` pide contar series fraccionadas (primario 1,0, secundario 0,5) y que el conteo "se verifique contra el catálogo completo con las etiquetas corregidas". Para eso la tabla de DEC-010 necesita fuente por fila y un lugar donde se pueda revisar y corregir sin tocar código. Esta fase solo crea la capa de datos: **no cambia cómo se cuenta el volumen** (eso es la Fase 2) y la salida del plan es idéntica.

### Decisión
- **La tabla vive en `data/exercise-muscles.csv`**, versionado en git. Columnas: `exerciseId, muscle, role, evidence_level, source, notes, review_date`. Reemplaza al literal de DEC-010 en `knowledge.js`. 61 filas: 34 `primary` y 27 `secondary`.
- **`role` solo vale `primary` o `secondary`. No se cargan antagonistas ni estabilizadores.** El criterio sigue el de Pelland et al. 2026 (sección 2.5): primario = el músculo "probablemente generador primario de fuerza"; secundario = "probablemente entrenado de forma significativa pero no generador primario (sinergista)". Solo los 10 grupos de la app.
- **Jerarquía de evidencia por fila:**
  - `verificado`: un estudio que midió hipertrofia de ese músculo con ese ejercicio o uno equivalente (la nota aclara "equivalente").
  - `probable`: solo EMG o una clasificación publicada (Tabla 1 de Pelland et al. 2026). Esto último amplía la definición de "EMG o manual de referencia": la Tabla 1 es la decisión de los autores sobre qué ejercicio cuenta como directo o indirecto, no una medición. Cambiarlo a `a_verificar` es editar la columna.
  - `a_verificar`: sin fuente leída. Es preferible a una cita de la que no se está seguro: **no se inventan citas**. Una fila `a_verificar` puede llevar una fuente de contexto o en contra, y la nota lo dice.
  - Solo `verificado` y `probable` exigen `source` (autor, año, título y revista de lo que se leyó). Los resúmenes se leyeron por PubMed; el texto completo solo se abrió en Pelland 2026 y en el preprint de Remmert.
- **Distinto de E1-E4.** `evidence_level` es por fila. La etiqueta `evidence: 'E4'` de `EXERCISE_CONTRIBUTION` sigue igual: la tabla como regla de la app sigue siendo E4 (criterio de la app) hasta validarla. `evidenceLevel` y las filas (fuente, nota, fecha) viajan con los datos, pero **ningún cálculo los consume todavía** (un test lo vigila sobre `engine.js` y sobre las claves del plan).
- **Paseo del granjero:** sin filas, igual que hoy (sin primary y sin secundarios, DEC-010). Está declarado en `NO_MUSCLE_CONTRIBUTION` de `knowledge.js`; los tests exigen que ese sea el único ejercicio sin filas y que nadie más lo esté.
- **Resultado de la carga inicial:** 18 `verificado` (13 primary y 5 secondary), 26 `probable` (14 y 12) y 17 `a_verificar` (7 y 10). Fuentes y hallazgos en `docs/research/fuentes-musculos-ejercicio.md`.

### Hallazgos que cuestionan datos actuales (no se cambió ningún valor en esta fase)
- `glutes.hip_thrust` → isquios: `a_verificar`. Plotkin 2023 midió el área de isquios con hip thrust y no encontró crecimiento apreciable (EMG de Contreras 2015 sí muestra más bíceps femoral que la sentadilla). Candidata a revisar en la Fase 2.
- `glutes.bulgarian_hip` → cuádriceps (0,5): Pelland 2026 clasifica la búlgara como serie directa para el cuádriceps (1,0).
- `back.pullover_cable`: Di Fonza 2026 (revisión de EMG) reporta que el pullover parece activar más el pectoral que el dorsal; el primario `back` queda sin respaldo.
- Sentadilla y prensa → glúteo (0,5): Kubo 2019 midió glúteo mayor +6,7 % con sentadilla completa y Kinoshita 2026, +15,4 % con prensa. El 0,5 podría subestimar ese aporte.
- Sin respaldo en el dataset de Pelland: no midió glúteo, dorsal, deltoides lateral/posterior, pantorrillas ni abdomen.

### Cómo llega a la app
- GitHub Pages solo publica `ifbb-pro-agent/` y el modo sin conexión necesita todo precargado, así que la app **no lee el CSV**. `scripts/build-exercise-muscles.js` lo valida y genera `ifbb-pro-agent/js/exerciseMuscles.js`, que se **sube al repositorio**. `index.html` lo carga antes de `knowledge.js` y `sw.js` lo precarga (versión de caché en v4).
- El parser acepta coma y punto y coma (Excel en español guarda con punto y coma), BOM, CRLF y comillas, y rechaza con un mensaje por fila: `role`, `evidence_level` o `muscle` inválidos, `verificado` o `probable` sin `source`, fecha que no sea `AAAA-MM-DD`, pares repetidos y más de un `primary` por ejercicio. `data/README.md` explica cómo abrirlo y guardarlo desde Excel.
- Un test falla si el módulo no coincide con el CSV. Consecuencia: editar el CSV en GitHub sin regenerar el módulo frena el despliegue (la puerta de Pages corre `engine.test.js`). Alternativa no adoptada: un paso de build en el workflow, que implica modificar el CI/CD.

### Por qué no una base de datos externa
- **Sin conexión:** la app es una PWA y tiene que funcionar sin red; una base externa agregaría un pedido de red y un estado de error en el generador.
- **DEC-009:** los datos del usuario no salen del dispositivo. Hoy la app no hace ningún pedido a un servicio propio ni maneja credenciales; una base externa lo cambiaría, con cuenta, claves y superficie de ataque.
- **Tamaño:** 35 ejercicios y 61 filas (el CSV pesa ~28 KB y el módulo generado ~34 KB). Cabe en el repositorio, cada cambio se revisa en un PR con su historial y se edita con Excel.

### Tests (`engine.test.js`)
Cada `exerciseId` del CSV existe en el catálogo y viceversa (salvo el paseo); exactamente un `primary` por ejercicio; valores válidos de `role`, `evidence_level`, `muscle` y fecha; `source` en `verificado` y `probable`; citas con autor y año; el parser lee igual coma y punto y coma (con BOM y CRLF) y respeta comillas, delimitadores y saltos de línea dentro de un campo; rechaza datos inválidos; el módulo generado coincide con el CSV; el catálogo toma `muscle`, `secondary` y nivel del CSV en su orden; conteo de niveles; ningún cálculo consume el nivel; y la salida de los 30 planes (10 perfiles × sin extras, con `healthGoal` y con `healthGoal` más lesiones) es idéntica a la de `main` antes de la fase (huellas en `tests/fixtures/plan-hashes.json`, regenerables con `scripts/snapshot-plan-hashes.js` solo si un cambio de salida es intencional). Prueba de mutación: cambiar a mano un `primary` en el CSV hace fallar 2 tests si no se regenera el módulo y 6 si se regenera.

**Estado: implementada (capa de datos).** El nivel de evidencia todavía no se usa en ningún cálculo.
