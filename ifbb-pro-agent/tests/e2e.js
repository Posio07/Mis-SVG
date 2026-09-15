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
  const training = await page.$$eval('.session', els => els.length);
  if (training !== 5) throw new Error(`expected 5 sessions, got ${training}`);

  // Progreso
  await page.click('.tab[data-tab=progress]');
  await page.fill('#log-form input[name=weightKg]', '83.2');
  await page.fill('#log-form input[name=date]', '2026-09-22');
  await page.click('#log-form button[type=submit]');
  await page.waitForSelector('#btn-apply');
  const rows = await page.$$eval('table tr', r => r.length);
  if (rows < 3) throw new Error('log rows missing');
  await shot('05-progress');
  await page.click('#btn-apply');
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
  const items = await page.$$eval('.profile-item', els => els.map(e => e.querySelector('.name').textContent));
  if (items.length !== 3) throw new Error('expected 3 profiles, got ' + items.join(','));
  await shot('06-profiles');

  // Fuentes
  await page.click('.tab[data-tab=sources]');
  const srcCount = await page.$$eval('.source-item', e => e.length);
  if (srcCount < 15) throw new Error('sources missing');
  await shot('07-sources');

  // Service worker registrado y manifest válido
  const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!r; });
  const manifest = await (await page.request.get(base + 'manifest.webmanifest')).json();
  if (!manifest.icons || manifest.icons.length < 3) throw new Error('manifest icons missing');

  await browser.close();
  server.close();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log(`E2E OK · perfiles: ${items.join(' | ')} · fuentes: ${srcCount} · sw: ${sw}`);
})().catch(e => { console.error(e); process.exit(1); });
