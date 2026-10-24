# Series directas, indirectas y "fraccionadas": qué dicen Pelland (2026) y Remmert (2025)

Notas de investigación para DEC-012 y para la Fase 2 del validador (`docs/specs/validador.md`, R1). Consulta hecha el 2026-10-24. Todo lo de abajo sale de los textos que se leyeron; lo que no se pudo leer se dice explícitamente en la sección 4. Las páginas son las del PDF leído, no las de otra edición.

## 1. Pelland et al. 2026 (volumen semanal y frecuencia)

**Cita.** Pelland JC, Remmert JF, Robinson ZP, Hinson SR, Zourdos MC. *The Resistance Training Dose Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gains.* Sports Medicine 2026;56(2):481-505. doi:10.1007/s40279-025-02344-w. Publicado online el 2025-12-04 y en papel en febrero de 2026 (dato de Crossref; la página de Springer devolvió un desafío de navegador y no se pudo abrir). El PDF leído (copia de acceso libre indicada en el pedido) dice "Accepted: 14 October 2025". Se leyó el texto completo: 25 páginas. La página 1 del PDF equivale a la 481 de la revista.

### (a) Criterio para clasificar una serie como directa o indirecta
Sección 2.5, "Volume and Frequency Classifications", PDF pp. 3-4:

- **Hipertrofia.** *Directa:* "the measured muscle(s) was likely to be the primary force generator in the exercise". *Indirecta:* "the measured muscle(s) was likely to be meaningfully trained but not the primary force generator of the exercise (i.e., synergist)".
- **Fuerza.** *Directa:* las series del ejercicio exacto usado en la evaluación. *Indirecta:* cualquier serie que probablemente entrene de forma significativa el músculo involucrado (generador primario y sinergistas).
- La clasificación es **relativa al músculo medido en cada estudio**, no una propiedad del ejercicio en abstracto.
- Los autores advierten (p. 4): "This process was not wholly objective; therefore, Tables 1 and 2 report the decisions made throughout the included studies".
- Ejemplo del texto (pp. 3-4): 5 series de curl de bíceps en una sesión y 5 de remo en otra, midiendo el bíceps braquial, dan volumen semanal "total" 10, "fraccionado" 7,5 y "directo" 5.

### (b) Peso de la serie indirecta
- Sección 2.5, p. 3: "'fractional' counted indirect sets as half a set (indirect × 0.5 + direct)". "Total" suma directas e indirectas con peso 1; "directo" ignora las indirectas.
- Resumen (p. 1) y sección 4.1 (p. 16): indirectas cuantificadas como 1 para total, 0,5 para fraccionado y 0 para directo.
- **El 0,5 es una convención declarada como supuesto.** Sección 4.1, p. 16: "assigning indirect sets a weight of 0.5 is still an assumption" que "likely depends on several factors" (resultado medido, ejercicio, rango de repeticiones, estado de entrenamiento), y el método "should be regarded as a heuristic [...] rather than a definitive standard for practical application across all contexts". El método fraccionado fue el de mayor evidencia relativa frente a "total" y "directo" (valores de 2 × log(BF) entre 9,48 y 54,84 según resultado y variable, sección 3.4, p. 12; "strong" o "very strong" en la escala de Kass y Raftery, sección 4.1, p. 16).
- Nota menor: el texto de la sección 4.1 (p. 16) dice que el estímulo de una serie indirecta es "close to half the effect of an indirect set"; por contexto es una errata de "direct set".

### (c) Dónde está el criterio por ejercicio y músculo: Tabla 1, p. 5
La Tabla 1 ("Exercises counted as direct and indirect weekly set volume for hypertrophy") lista, para cada músculo evaluado, los ejercicios que se contaron como directos e indirectos:

| Músculo evaluado | Directos | Indirectos |
| --- | --- | --- |
| Cuádriceps (y sus partes) | sentadilla trasera, prensa, zancada con mancuernas, extensión de pierna, sentadilla hack, sentadilla en Smith, sentadilla dividida (barra, mancuernas, búlgara) | N/A |
| Recto femoral | extensión de pierna | sentadilla en Smith, prensa, sentadilla |
| Isquios / muslo posterior | curl femoral | N/A |
| Pectoral mayor | press banca, aperturas planas con mancuernas | N/A |
| Deltoides anterior | press de hombro con barra, elevación frontal con barra | press banca, press de pecho, press banca con agarre cerrado |
| Trapecio | N/A | jalón al pecho, remo sentado |
| Tríceps / extensores del codo | pushdown, extensiones, patada, rompecráneos, press cerrado, etc. | press banca plano/inclinado/declinado, press de hombro (barra y mancuernas), press inclinado con mancuernas, press inclinado y press en máquina |
| Bíceps / flexores del codo | curls (barra, mancuerna, martillo, inclinado, predicador, máquina) | jalones (varios agarres), remo sentado, remos en máquina, remo inclinado con barra |

La Tabla 2 (pp. 6-7) hace lo mismo para fuerza. Es una **clasificación de los autores** sobre los estudios incluidos, no una medición de hipertrofia de cada combinación ejercicio-músculo.

### Qué músculos tiene el dataset
El material suplementario (OSF 6z3xu, archivo "Extracted Data.xlsx") se pudo abrir. Tiene 710 observaciones; 220 son de hipertrofia, de 35 estudios. No nombra los ejercicios de cada estudio (solo la medida, p. ej. "Triceps MT"), así que no permite reconstruir qué se entrenó en cada uno. Sí muestra qué músculos se midieron:

- Muy medidos: cuádriceps y sus cabezas, flexores y extensores del codo.
- Medidos en pocos estudios: pectoral (1 estudio, Corrêa 2022), deltoides anterior (1, Yue 2018), trapecio (1, Rønnestad 2007), isquios (3: Starkey 1996, Rønnestad 2007, Van Vossel 2023).
- **Sin ninguna medición de glúteo, de dorsal ancho, de deltoides lateral o posterior, de pantorrillas ni de abdomen.**

Por eso el meta-análisis no aporta respaldo para el aporte a esos músculos.

## 2. Preprint de Remmert et al. (volumen por sesión)

**Cita.** Remmert JF, Pelland JC, Robinson ZP, Hinson SR, Zourdos MC. *Is There Too Much of a Good Thing? Meta-Regressions of the Effect of Per-Session Volume on Hypertrophy and Strength.* SportRχiv 2025. doi:10.51224/SRXIV.537 (publicado el 2025-04-02). Se leyó el texto completo: 31 páginas. La portada dice "Preprint, not peer reviewed" (p. 1). **El primer autor es Remmert, no Pelland**: `docs/specs/validador.md` lo cita como "Pelland et al.".

### El valor de ~11
Confirmado. Resumen (p. 2), sección 4.6.2 (p. 17) y Tabla 1 (p. 17): el PUOS ("point of undetectable outcome superiority") para hipertrofia es de **~11 series "fraccionadas" por sesión**; para fuerza, ~2 series "directas".

| PUOS (p. 17, Tabla 1) | Series totales | Series directas | Series fraccionadas |
| --- | --- | --- | --- |
| Hipertrofia | 13,835 | 8,165 | **11** |
| Fuerza | 4,957 | **2** | 3,478 |

Las conversiones usan la proporción media de series indirectas del dataset (25,776 %; sección 3.7, pp. 11-12).

### ¿Es por músculo?
Sí, por el músculo medido en cada estudio y no por ejercicio ni por sesión completa. La introducción (p. 4) dice que ningún meta-análisis previo había "quantified only sets per session for the measured muscle group (not per exercise)", y que esta es su cuantificación. La sección 2.5 (pp. 6-7) aplica el mismo criterio directa/indirecta de Pelland: con bíceps medido, el curl aislado cuenta 1 y los jalones, 0,5.

### Qué significa exactamente el umbral
Definición (sección 3.7, p. 11): el PUOS es "the value of per-session volume at which no pairwise comparisons to higher per-session volume values showed a >50% probability of the cumulative differences to exceed the smallest detectable effect size" (SDES: 2,05 % para hipertrofia, 3,96 % para fuerza; sección 2.6, p. 7). Los propios autores aclaran:

- **No es un límite superior** (sección 4.6.2, p. 17): "these PUOS values are not upper limits beyond which additional increases in outcomes are not observed". Significa que, por encima de ese volumen, ningún aumento adicional tiene más de 50 % de probabilidad de superar el efecto mínimo detectable.
- **Fue "determined arbitrarily"** (sección 5, p. 18), aunque "justifiable".
- Los datos casi no llegan a volúmenes altos: media de 5,95 ± 4,49 series fraccionadas por sesión, rango 0-24 (p. 23). El resumen (p. 2) dice que faltan datos con volúmenes muy altos.
- **Cuidado al extrapolar a rutinas de cuerpo entero** (p. 23): muchos estudios entrenaban un solo músculo.
- **El 0,5 también se discute ahí** (p. 23): un análisis exploratorio aproximó la contribución de una serie indirecta en ~32 % de una directa para hipertrofia (~16 % para fuerza).
- No se analizaron el riesgo de lesión ni el agotamiento psicológico (p. 24).

## 3. Cómo afecta a la especificación del validador (hechos, sin decidir nada)
- "Directa = 1, indirecta = 0,5" coincide con el método de Pelland, pero allí es una convención declarada como supuesto.
- La R1 de `validador.md` dice "como máximo 11 series fraccionadas por músculo por sesión". El preprint dice por músculo (coincide), pero aclara que 11 no es un máximo y que se fijó de forma arbitraria. Además es un preprint sin revisión por pares.
- El preprint mide un músculo por vez en estudios mayormente de un solo músculo; la R1 lo aplicaría a rutinas de varios músculos.

## 4. No se pudo acceder o no se encontró
- **Página de Springer** del artículo de Pelland: bloqueada por un desafío de navegador. Año y volumen se tomaron de Crossref.
- **Material suplementario de Pelland:** solo se abrieron `Extracted Data.xlsx` y `TestEx.xlsx` (calidad de los estudios). No se abrieron los PDF de análisis ni los de OSF del preprint (osf.io/dqka3).
- **Estudios primarios:** no se leyeron los estudios incluidos en los meta-análisis. La Tabla 1 de Pelland se usa como clasificación publicada, no como medición.
- **Texto completo de los estudios citados en la CSV:** solo se leyeron los resúmenes (PubMed), salvo los dos documentos de esta nota. Ver `fuentes-musculos-ejercicio.md`.
