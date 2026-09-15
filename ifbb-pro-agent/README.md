# IFBB Pro Agent

Agente de preparación física para el teléfono: introduces tus datos y tu objetivo y obtienes plan de dieta, plan de entrenamiento y medidas objetivo calculados **solo** a partir de fuentes verificadas (revisiones sistemáticas, metaanálisis, posicionamientos oficiales de la ISSN y el ACSM, organismos reguladores y el reglamento de la IFBB Pro League). Cada cifra del plan lleva la clave de la fuente que la respalda y la pestaña **Fuentes** lista todas las referencias con enlace.

Es una **PWA** (aplicación web progresiva): se instala en Android como una app normal, con icono en la pantalla de inicio, pantalla completa y funcionamiento sin conexión. No necesita servidor ni cuenta: los perfiles se guardan en el propio teléfono.

## Qué hace

- **Perfiles ilimitados**: crea, abre, duplica, elimina, exporta e importa perfiles (JSON). Útil para distintas fases o distintas personas.
- **Datos**: sexo, edad, estatura, peso, % de grasa medido o estimado por circunferencias (método US Navy), actividad, experiencia, días de entreno, división IFBB Pro League, fase (definición / volumen / mantenimiento), fecha objetivo y % de grasa objetivo.
- **Plan de dieta**: calorías, proteína, carbohidratos, grasas, fibra, agua, reparto por comidas, guía de alimentos y reglas de ajuste semanal.
- **Plan de entrenamiento**: rutina completa según días disponibles (3 a 6), con ejercicios, series, repeticiones, RIR y descansos; volumen semanal por músculo ajustado a la división; cardio; progresión y descargas.
- **Medidas objetivo**: peso y % de grasa en tarima, masa magra a conservar, cintura de referencia, FFMI, límite de peso de Classic Physique y calendario con fecha estimada.
- **Progreso**: registro de mediciones, gráfica de peso frente al objetivo y recálculo del plan con la última medición.
- **Avisos de seguridad**: fecha no alcanzable sin superar 1 %/semana, objetivo por debajo de la grasa esencial, calorías por debajo del gasto en reposo, menores de edad, etc.

## Instalar en Android

1. Publica la carpeta `ifbb-pro-agent/` en una URL con HTTPS. La forma más sencilla es **GitHub Pages**: el flujo `.github/workflows/pages.yml` activa Pages por sí mismo y despliega automáticamente cuando hay cambios en `main`. Si el paso *configure-pages* fallara, actívalo a mano en *Settings → Pages → Source: GitHub Actions* y vuelve a lanzar el flujo desde la pestaña *Actions*.
2. Abre la URL en **Chrome** desde el teléfono.
3. Pulsa **Instalar** en la cabecera de la app (o menú ⋮ → *Añadir a pantalla de inicio* / *Instalar aplicación*).
4. La app queda en el cajón de aplicaciones y funciona sin conexión.

Alternativa sin publicar: copia la carpeta al teléfono y abre `index.html` con Chrome. Funciona igual salvo la instalación y el modo sin conexión, que requieren HTTPS.

## Desarrollo

```bash
# Pruebas del motor de cálculo (sin dependencias)
node --test ifbb-pro-agent/tests/engine.test.js

# Recorrido completo en Chromium móvil (requiere playwright instalado globalmente)
NODE_PATH=$(npm root -g) node ifbb-pro-agent/tests/e2e.js

# Regenerar los PNG del icono a partir de icons/icon.svg
NODE_PATH=$(npm root -g) node ifbb-pro-agent/tests/render-icons.js

# Servir en local
npx http-server ifbb-pro-agent -p 8080
```

Estructura:

| Archivo | Contenido |
|---|---|
| `js/knowledge.js` | Base de conocimiento: fuentes, divisiones, factores de actividad, biblioteca de ejercicios, suplementos |
| `js/engine.js` | Motor de cálculo (funciones puras): composición corporal, calorías, macros, rutina, objetivos y avisos |
| `js/app.js` | Interfaz, navegación, perfiles en `localStorage`, exportar/importar, gráfica, PWA |
| `sw.js` / `manifest.webmanifest` | Funcionamiento sin conexión e instalación |
| `tests/` | Pruebas unitarias, recorrido E2E y generador de iconos |

Sube `CACHE_VERSION` en `sw.js` cada vez que despliegues cambios para que los teléfonos ya instalados reciban la versión nueva.

## Base científica

| Ámbito | Fuente |
|---|---|
| Gasto en reposo | Mifflin-St Jeor 1990, validada por Frankenfield 2005 (Academy of Nutrition and Dietetics); Katch-McArdle cuando se conoce la masa magra |
| % de grasa por circunferencias | Hodgdon & Beckett 1984 (US Navy) |
| Preparación de competición (dieta) | Helms, Aragon & Fitschen 2014, JISSN |
| Preparación de competición (entreno y cardio) | Helms et al. 2015, J Sports Med Phys Fitness |
| Off-season | Iraki et al. 2019, Sports |
| Proteína, dietas, creatina, cafeína, beta-alanina | Posicionamientos oficiales de la International Society of Sports Nutrition (2015-2021) |
| Volumen y frecuencia de entrenamiento | Metaanálisis de Schoenfeld et al. 2016 y 2017; ACSM Position Stand 2009 |
| Límite natural de masa magra (FFMI) | Kouri et al. 1995 |
| Grasa en tarima | Estudios de caso con DXA (Rossow 2013, Kistler 2014 y otros) |
| Grasa esencial, cintura, fibra, agua | ACE, Ashwell 2012, Institute of Medicine 2005, EFSA 2010 |
| Divisiones y límite de peso Classic Physique | Reglamento IFBB Pro League / NPC (tabla de agosto de 2023, editable en la app) |

## Limitaciones

- Los rangos de grasa "en tarima" por división son estimaciones a partir de estudios de caso, no un criterio oficial.
- La tabla de peso de Classic Physique no pudo verificarse contra el reglamento vigente al construir la app y tuvo cambios en 2025: la app permite introducir el límite oficial a mano.
- Las ecuaciones de gasto energético tienen un error individual de ±10 %; el ajuste semanal con la báscula manda.
- La app no sustituye a un médico, dietista-nutricionista ni entrenador certificado.
