/* Recorrido end-to-end en Chromium móvil: crea un perfil, revisa cada pestaña,
 * registra progreso, exporta/duplica y comprueba que no hay errores de consola.
 * Uso: NODE_PATH=/opt/node22/lib/node_modules node tests/e2e.js */
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium, devices } = require('playwright');

const root = path.join(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const shots = path.join(__dirname, '..', '..', '.e2e-shots');
  fs.mkdirSync(shots, { recursive: true });
  const shot = name => page.screenshot({ path: path.join(shots, name + '.png'), fullPage: true });

  await page.goto(base, { waitUntil: 'networkidle' });
  await shot('01-empty');
  await page.click('#btn-new');
  await page.fill('input[name=name]', 'Óscar · Prep');
  await page.fill('input[name=age]', '32');
  await page.fill('input[name=heightCm]', '176');
  await page.fill('input[name=weightKg]', '84');
  await page.fill('input[name=neckCm]', '40');
  await page.fill('input[name=waistCm]', '88');
  await page.selectOption('select[name=level]', 'intermediate');
  await page.selectOption('select[name=daysPerWeek]', '5');
  await page.selectOption('select[name=division]', 'classic_m');
  await page.selectOption('select[name=goal]', 'cut');
  await shot('02-form');
  await page.click('button[type=submit]');
  await page.waitForSelector('#plan-body .stat');
  await shot('03-summary');
  const summary = await page.textContent('#plan-body');
  if (!/kcal\/día/.test(summary)) throw new Error('summary missing calories');

  for (const [tab, marker] of [['nutrition', 'Dieta diaria'], ['training', 'Entrenamiento ·'], ['targets', 'Medidas objetivo'], ['supps', 'Suplementos con respaldo']]) {
    await page.click(`[data-pt=${tab}]`);
    const txt = await page.textContent('#plan-body');
    if (!txt.includes(marker)) throw new Error(`tab ${tab} missing "${marker}"`);
    await shot(`04-${tab}`);
  }
  await page.click('[data-pt=training]');
  const training = await page.$$eval('[data-toggle-day]', els => els.length);
  if (training !== 5) throw new Error(`expected 5 training days, got ${training}`);

  // Modo sesión (Fase 4): abrir el día de hoy, registrar una serie, saltar
  // el descanso, terminar temprano y verificar el resumen + el guardado.
  await page.waitForSelector('.session-body:not([inert]) [data-start-session]');
  await page.click('.session-body:not([inert]) [data-start-session]');
  await page.waitForSelector('.session-mode');
  await shot('06-session-mode');
  await page.fill('[data-sm-weight="0"]', '60');
  await page.fill('[data-sm-reps="0"]', '5');
  await page.click('[data-sm-done="0"]');
  await page.waitForSelector('.timer-overlay');
  await shot('07-session-timer');
  await page.click('#sm-timer-skip');
  await page.waitForSelector('#sm-timer', { state: 'detached' });
  await page.click('#sm-finish');
  await page.waitForSelector('#sm-back-to-plan');
  const summaryTxt = await page.textContent('.session-mode-body');
  if (!/series hechas/.test(summaryTxt)) throw new Error('session summary missing series count');
  await shot('08-session-summary');
  const workouts = await page.evaluate(() => JSON.parse(localStorage.getItem('ifbb-agent:v1')).profiles[0].workouts);
  if (!workouts || workouts.length < 1 || workouts[0].reps !== 5 || workouts[0].weight !== 60) throw new Error('workout set not saved correctly: ' + JSON.stringify(workouts));
  if (!/^[a-z]+\.[a-z_]+$/.test(workouts[0].exerciseId || '')) throw new Error('workout set saved without a stable exerciseId: ' + JSON.stringify(workouts[0]));
  await page.click('#sm-back-to-plan');
  await page.waitForSelector('#session-mode-root', { state: 'detached' });
  await page.waitForSelector('.subtabs');

  // Fase 5: segunda sesión del mismo ejercicio ya con un "última vez" real
  // -> la barra cargada debe dibujar discos en vez del aviso "sin historial".
  await page.click('.session-body:not([inert]) [data-start-session]');
  await page.waitForSelector('.session-mode');
  // Solo logueamos el top set en la sesión anterior, así que el back-off
  // puede seguir sin historial propio: lo que importa es que el top set
  // (el que sí tiene "última vez") ya dibuje discos reales.
  const platebarHtml = await page.innerHTML('.session-mode-body');
  if (!/platebar-weight/.test(platebarHtml)) throw new Error('la barra cargada no dibujó discos con una "última vez" ya registrada');
  if (!/<svg class="platebar"/.test(platebarHtml)) throw new Error('no se encontró el SVG de la barra cargada');
  await shot('09-platebar');
  page.once('dialog', d => d.accept());
  await page.click('#sm-close');
  await page.waitForSelector('#session-mode-root', { state: 'detached' });

  // Progreso
  await page.click('.tab[data-tab=progress]');
  const future = new Date(); future.setDate(future.getDate() + 7);
  await page.fill('#log-form input[name=weightKg]', '83.2');
  await page.fill('#log-form input[name=date]', future.toISOString().slice(0, 10));
  await page.click('#log-form button[type=submit]');
  await page.waitForSelector('#btn-apply');
  const rows = await page.$$eval('table tr', r => r.length);
  if (rows < 3) throw new Error('log rows missing');
  await shot('05-progress');
  await page.click('#btn-apply');
  await page.waitForSelector('.modal-overlay');
  await page.click('#modal-confirm');
  await page.waitForSelector('#plan-body .stat');
  const w = await page.evaluate(() => JSON.parse(localStorage.getItem('ifbb-agent:v1')).profiles[0].data.weightKg);
  if (w !== 83.2) throw new Error('apply last measurement failed: ' + w);

  // Perfiles: segundo perfil femenino, duplicar, persistencia tras recarga
  await page.click('.tab[data-tab=profiles]');
  await page.click('#btn-new');
  await page.selectOption('select[name=sex]', 'F');
  await page.fill('input[name=name]', 'Ana · Bikini');
  await page.fill('input[name=age]', '27');
  await page.fill('input[name=heightCm]', '163');
  await page.fill('input[name=weightKg]', '58');
  await page.fill('input[name=bodyFatPct]', '22');
  await page.selectOption('select[name=division]', 'bikini_w');
  await page.fill('input[name=targetDate]', '2027-03-15');
  await page.click('button[type=submit]');
  await page.waitForSelector('#plan-body .stat');
  await page.click('.tab[data-tab=profiles]');
  await page.click('#btn-dup');
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('.tab[data-tab=profiles]');
  await page.waitForSelector('.profile-item');
  const items = await page.$$eval('.profile-item', els => els.map(e => e.querySelector('.name').textContent));
  if (items.length !== 3) throw new Error('expected 3 profiles, got ' + items.join(','));
  await shot('06-profiles');

  // Fuentes
  await page.click('.tab[data-tab=sources]');
  await page.waitForSelector('.source-item');
  const srcCount = await page.$$eval('.source-item', e => e.length);
  if (srcCount < 15) throw new Error('sources missing');
  await shot('07-sources');

  // DEC-011: lesión declarada → plan en pausa con advertencia y derivación →
  // confirmación explícita por zona (con fecha) → al agregar otra zona solo se
  // vuelve a pedir la nueva. Los textos nunca dicen "adaptado a la lesión".
  await page.click('.tab[data-tab=profiles]');
  await page.click('#btn-new');
  await page.fill('input[name=name]', 'Lesión · Test');
  await page.fill('input[name=age]', '35');
  await page.fill('input[name=heightCm]', '178');
  await page.fill('input[name=weightKg]', '85');
  await page.fill('input[name=neckCm]', '40');
  await page.fill('input[name=waistCm]', '88');
  await page.check('input[name=injuryZones][value=shoulder]');
  await page.click('button[type=submit]');
  await page.waitForSelector('[data-injury-clearance="shoulder"]');
  if (await page.$('.subtabs')) throw new Error('con una lesión sin confirmar el plan no debería mostrarse');
  const pausa = await page.textContent('#view');
  if (!/Plan en pausa/.test(pausa) || !/no puede adaptar una rutina a una lesión/.test(pausa) || !/Hombro/.test(pausa) || !/E4/.test(pausa)) throw new Error('la pausa por lesión no muestra advertencia + derivación + etiqueta E4: ' + pausa.slice(0, 400));
  if (/adaptad[oa] a (tu|la) lesi/i.test(pausa)) throw new Error('un texto afirma que la rutina está adaptada a la lesión');
  await page.click('[data-injury-clearance="shoulder"]');
  await page.waitForSelector('.subtabs');
  const clearedHealth = await page.evaluate(() => JSON.parse(localStorage.getItem('ifbb-agent:v1')).profiles.find(p => p.data.name === 'Lesión · Test').data.health);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clearedHealth.injuries[0].clearanceDate || '')) throw new Error('la autorización no quedó guardada con fecha: ' + JSON.stringify(clearedHealth.injuries));
  await page.click('[data-pt=training]');
  const trainingTxt = await page.textContent('#plan-body');
  if (!/E4/.test(trainingTxt)) throw new Error('el ejercicio sustituto por lesión no muestra la etiqueta E4');

  // DEC-011 · dolor: con 2 sesiones distintas con dolor en las últimas 4 semanas
  // sobre el press landmine, el Modo sesión reemplaza el ejercicio, avisa que
  // consulte a un profesional (E4) y el reemplazo NO hereda la etiqueta de
  // "ejercicio de precaución por lesión" del original.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('ifbb-agent:v1'));
    const p = s.profiles.find(x => x.data.name === 'Lesión · Test');
    const d = n => { const x = new Date(); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
    p.painFlags = { shoulder_press_safe: { flagged: true, cleanStreak: 0, lastSessionId: 'b', painSessions: [{ sessionId: 'a', date: d(10) }, { sessionId: 'b', date: d(2) }] } };
    localStorage.setItem('ifbb-agent:v1', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('.tab[data-tab=plan]');
  await page.waitForSelector('.subtabs');
  await page.click('[data-pt=training]');
  const dayIdx = await page.$$eval('[data-toggle-day]', els => els.map(e => e.dataset.toggleDay));
  let painStarted = false;
  for (const i of dayIdx) {
    const has = await page.evaluate(n => { const b = document.getElementById('day-body-' + n); return !!b && /Press landmine/.test(b.textContent); }, i);
    if (!has) continue;
    if (await page.getAttribute(`#day-body-${i}`, 'inert') !== null) { await page.click(`[data-toggle-day="${i}"]`); await page.waitForTimeout(400); }
    await page.click(`#day-body-${i} [data-start-session]`); painStarted = true; break;
  }
  if (!painStarted) throw new Error('no se encontró un día con el press landmine para probar el aviso de dolor');
  await page.waitForSelector('.session-mode');
  for (let k = 0; k < 12; k++) {
    if (/Reemplaza a/.test(await page.textContent('.session-mode-body'))) break;
    if (await page.$('#sm-next')) await page.click('#sm-next'); else break;
  }
  const painBody = await page.textContent('.session-mode-body');
  if (!/Reemplaza a "Press landmine/.test(painBody)) throw new Error('el ejercicio marcado por dolor no se reemplazó');
  if (!/en 2 sesiones distintas de las últimas 4 semanas/.test(painBody) || !/consultar a un profesional/.test(painBody)) throw new Error('falta el aviso de consultar a un profesional tras 2 sesiones con dolor');
  if (/Ejercicio incluido como precaución/.test(painBody)) throw new Error('el reemplazo heredó la etiqueta de precaución por lesión del ejercicio original');
  page.once('dialog', d => d.accept());
  await page.click('#sm-close');
  await page.waitForSelector('#session-mode-root', { state: 'detached' });
  await page.click('.tab[data-tab=profiles]');
  await page.click('#btn-edit');
  await page.check('input[name=injuryZones][value=knee]');
  await page.click('button[type=submit]');
  await page.waitForSelector('[data-injury-clearance="knee"]');
  if (await page.$('[data-injury-clearance="shoulder"]')) throw new Error('al agregar una zona no debería volver a pedirse la ya confirmada');
  const afterAdd = await page.evaluate(() => JSON.parse(localStorage.getItem('ifbb-agent:v1')).profiles.find(p => p.data.name === 'Lesión · Test').data.health.injuries);
  if (afterAdd.find(i => i.zone === 'shoulder').clearanceDate !== clearedHealth.injuries[0].clearanceDate) throw new Error('se perdió la fecha de la zona ya confirmada');

  // Service worker registrado y manifest válido
  const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!r; });
  const manifest = await (await page.request.get(base + 'manifest.webmanifest')).json();
  if (!manifest.icons || manifest.icons.length < 3) throw new Error('manifest icons missing');

  await browser.close();
  server.close();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log(`E2E OK · perfiles: ${items.join(' | ')} · fuentes: ${srcCount} · sw: ${sw}`);
})().catch(e => { console.error(e); process.exit(1); });
