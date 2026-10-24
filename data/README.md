# Datos de la app

## `exercise-muscles.csv` · músculos que trabaja cada ejercicio

Una fila por cada par ejercicio-músculo. Es la **fuente de verdad** de qué músculo es el primario (suma 1,0) y cuáles son secundarios (suman 0,5) en cada ejercicio del catálogo. Por ahora la app solo carga estos datos: ningún cálculo usa todavía el nivel de evidencia, y el conteo del volumen no cambió (eso es la Fase 2 del validador, `docs/specs/validador.md`).

### Columnas

| Columna | Qué lleva |
| --- | --- |
| `exerciseId` | Id único del ejercicio en el catálogo (`ifbb-pro-agent/js/knowledge.js`), por ejemplo `quads.leg_press`. No se inventan ni se cambian. |
| `muscle` | Uno de los 10 grupos: `chest` (pecho), `back` (espalda), `shoulders` (hombros), `quads` (cuádriceps), `hamstrings` (isquiotibiales), `glutes` (glúteos), `calves` (pantorrillas), `biceps`, `triceps`, `abs` (abdomen). |
| `role` | Solo `primary` o `secondary`. **No se cargan antagonistas ni estabilizadores.** |
| `evidence_level` | `verificado`, `probable` o `a_verificar` (ver abajo). |
| `source` | Autor, año, título y revista de lo que se leyó. Obligatorio si el nivel es `verificado` o `probable`. En `a_verificar` puede ir una fuente de contexto o en contra, y la nota lo aclara. |
| `notes` | Qué dice la fuente, con sus límites. |
| `review_date` | Fecha de revisión de la fila, `AAAA-MM-DD`. |

### Niveles de evidencia
- **`verificado`:** un estudio que **midió hipertrofia** de ese músculo con ese ejercicio o uno equivalente (la nota dice cuando es "equivalente").
- **`probable`:** solo EMG o una clasificación publicada (por ejemplo, la Tabla 1 de Pelland et al. 2026). No mide hipertrofia de esa combinación.
- **`a_verificar`:** sin fuente leída. Es preferible dejar `a_verificar` antes que anotar una fuente de la que no se está seguro: **nunca se inventan citas**.

El detalle de cómo se asignó cada nivel y de las fuentes leídas está en `docs/research/fuentes-musculos-ejercicio.md`.

### Reglas que valida el parser
- Cada ejercicio del catálogo tiene **exactamente una** fila `primary`. La única excepción es el paseo del granjero (`functional.farmer_carry`), que no suma volumen de hipertrofia a ningún grupo y por eso no tiene filas.
- No se repite el mismo par `exerciseId` + `muscle`, y un músculo no puede ser a la vez primario y secundario del mismo ejercicio.
- Valores de `role`, `evidence_level` y `muscle` solo los de las tablas de arriba, y `review_date` con formato `AAAA-MM-DD`.

### Cómo abrirlo y guardarlo con Excel (en español)
El archivo usa UTF-8 y coma como separador. Excel en español guarda con **punto y coma**; el parser acepta ambos, no hace falta convertirlos.

**Abrir**
1. No hacer doble clic (Excel puede leer mal las tildes). En Excel: *Datos → Obtener datos → Desde un archivo → Desde texto o CSV*.
2. *Origen del archivo:* `65001: Unicode (UTF-8)`. *Delimitador:* coma.
3. Elegir *Transformar datos* y poner la columna `review_date` como tipo **Texto** (si no, Excel la convierte en una fecha y la guarda como `24/10/2026`, que el parser rechaza). Luego *Cerrar y cargar*.

**Guardar**
1. *Archivo → Guardar como*, y en *Tipo* elegir **CSV UTF-8 (delimitado por comas) (*.csv)**.
2. **No** usar "CSV (delimitado por comas)" a secas: guarda en otra codificación y rompe las tildes.
3. Si Excel pregunta si mantener el formato, responder que sí.
4. Al editar, no cambiar ni borrar los nombres de la fila de encabezado. Las columnas pueden ir en otro orden.

### Después de cambiar el CSV
La app no lee el CSV: GitHub Pages solo publica la carpeta `ifbb-pro-agent/`, y el modo sin conexión necesita todo precargado. Por eso hay un módulo **generado y subido al repositorio**, `ifbb-pro-agent/js/exerciseMuscles.js`. Cada vez que cambie el CSV hay que regenerarlo:

```
node scripts/build-exercise-muscles.js          # regenera el módulo (falla y explica si el CSV tiene errores)
node scripts/build-exercise-muscles.js --check  # solo comprueba que módulo y CSV coinciden
node --test ifbb-pro-agent/tests/engine.test.js
```

Un test de `engine.test.js` falla si el módulo no coincide con el CSV, y ese archivo es la puerta del despliegue a Pages. Si se edita el CSV directamente en GitHub sin regenerar el módulo, el despliegue se frena hasta regenerarlo.
