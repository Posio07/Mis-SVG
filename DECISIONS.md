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
- Respaldo: [Evidencia] Helms et al. 2015; [Posicionamiento] ACSM 2009.
- Test: en definición aparece el top set; en volumen/mantenimiento no.

**Estado: implementada.**

## DEC-003 · Tope por sesión
- Parámetro configurable: máximo de series por sesión (default 25).
- Mostrar la duración estimada de cada día: series × (descanso medio + 45 s).
- Si una sesión se pasa del tope, recortar en este orden: grupos pequeños (brazos, pantorrillas) hasta su mínimo → aislamientos. Nunca recortar multiarticulares. Reubicar las series recortadas en otro día que entrene el mismo grupo, si lo hay.
- Respaldo: [Criterio].
- Test: ninguna sesión supera el tope y ningún multiarticular desaparece.

**Estado: revertida.** Motivo: se probaron dos algoritmos (recorte+reubicación en una sola pasada, y luego en dos fases separando "calcular recortes" de "reubicar en días con espacio libre). El segundo cumple el propio criterio de DEC-003 (ninguna sesión supera el tope, ningún multiarticular desaparece) para el perfil de ejemplo, pero expone un problema real: cuando un grupo muscular pequeño se entrena en 2 días y AMBOS están al límite de series, ese grupo pierde series de forma permanente esa semana (nadie tiene sitio para recibirlas), lo que puede dejar el total semanal mostrado (`weeklySets`) sin corresponder con lo que realmente aparece en las sesiones. Esto se vio en rutinas de cuerpo completo (3 días) y en divisiones con mucho énfasis en pierna (ej. Wellness). Arreglarlo bien (por ejemplo, subiendo el tope mínimo según el volumen real de la división, o definiendo qué hacer cuando no hay ningún día con espacio) es una decisión de producto, no un ajuste de algoritmo de dos intentos. Se necesita una re-especificación antes de reintentar: ¿el tope debe poder ceder (mostrar aviso) en vez de perder series silenciosamente? ¿Debe haber un piso de series para grupos pequeños aunque se supere el tope?

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

**Estado: pendiente.**
