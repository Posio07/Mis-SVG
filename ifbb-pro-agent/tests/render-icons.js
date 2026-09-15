/* Genera los PNG del manifest a partir de icons/icon.svg usando Chromium (Playwright). */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  const dir = path.join(__dirname, '..', 'icons');
  const svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const variants = [
    { file: 'icon-192.png', size: 192, pad: 0 },
    { file: 'icon-512.png', size: 512, pad: 0 },
    { file: 'icon-maskable-512.png', size: 512, pad: 0.1 }, // zona segura para iconos enmascarables
  ];
  for (const v of variants) {
    await page.setViewportSize({ width: v.size, height: v.size });
    const inner = Math.round(v.size * (1 - 2 * v.pad));
    await page.setContent(`<html><body style="margin:0;background:#0f1115;width:${v.size}px;height:${v.size}px;display:flex;align-items:center;justify-content:center">
      <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg style="width:${inner}px;height:${inner}px" `)}</div></body></html>`);
    await page.screenshot({ path: path.join(dir, v.file), omitBackground: false });
    console.log('ok', v.file);
  }
  await browser.close();
})();
