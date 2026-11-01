import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const origin = process.env.FORMREADY_ORIGIN || 'http://127.0.0.1:4188';
const ownsServer = !process.env.FORMREADY_ORIGIN;
let server;
if (ownsServer) {
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'products/formready/vite.config.js', '--host', '127.0.0.1', '--port', '4188', '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try { await fetch(origin); break; } catch { await delay(250); }
  }
}
const browser = await chromium.launch({ headless: true });
const checks = [];
const record = (name, pass, detail = '') => { checks.push({ name, pass: Boolean(pass), detail: String(detail) }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [], nonGet = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => { if (request.method() !== 'GET' && !request.url().startsWith('blob:') && !request.url().startsWith('data:')) nonGet.push(`${request.method()} ${request.url()}`); });
  await page.goto(`${origin}/image-preparer.html`);
  await page.locator('#exam-preset option[value="ibps-po-mt-xvi-2026-photo"]').waitFor({ state: 'attached' });
  record('Exam presets load from versioned source data', await page.locator('#exam-preset option').count() >= 7, `options=${await page.locator('#exam-preset option').count()}`);
  await page.locator('#exam-preset').selectOption('ibps-po-mt-xvi-2026-photo');
  const defaults = await page.evaluate(() => ({ w: document.querySelector('#target-width').value, h: document.querySelector('#target-height').value, min: document.querySelector('#min-kb').value, max: document.querySelector('#max-kb').value, format: document.querySelector('#form-format').value, note: document.querySelector('#preset-source').innerText }));
  record('IBPS PO photo preset fills verified cycle-specific values', defaults.w === '200' && defaults.h === '230' && defaults.min === '20' && defaults.max === '50' && defaults.format === 'image/jpeg' && /historical/i.test(defaults.note) && /Official source/.test(defaults.note), JSON.stringify(defaults));
  await page.locator('#target-unit').selectOption('mm');
  record('Dimension labels track physical units instead of misleading px labels', await page.locator('#target-width-label').innerText() === 'Width (mm)' && await page.locator('#target-height-label').innerText() === 'Height (mm)', 'Width/Height show mm');
  await page.locator('#target-unit').selectOption('px');

  const imageData = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 460; canvas.height = 529;
    const ctx = canvas.getContext('2d');
    let seed = 531;
    for (let y = 0; y < canvas.height; y += 1) for (let x = 0; x < canvas.width; x += 1) {
      seed = (seed * 16807) % 2147483647; const n = seed % 256;
      ctx.fillStyle = `rgb(${n},${(n * 3) % 256},${(n * 7) % 256})`; ctx.fillRect(x, y, 1, 1);
    }
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#form-image').setInputFiles({ name: 'exam-test.png', mimeType: 'image/png', buffer: Buffer.from(imageData, 'base64') });
  await page.locator('.cropper-container').waitFor();
  await page.locator('#prepare-image').click();
  await page.locator('.validation-result').waitFor();
  const output = await page.evaluate(async () => {
    const link = document.querySelector('.download-button'); const response = await fetch(link.href); const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    return { size: blob.size, type: blob.type, width: bitmap.width, height: bitmap.height, badge: document.querySelector('.ready-badge').innerText, checks: document.querySelector('.checks').innerText };
  });
  record('IBPS photo export reaches JPEG dimensions and inclusive KB band', output.type === 'image/jpeg' && output.width === 200 && output.height === 230 && output.size >= 20 * 1024 && output.size <= 50 * 1024 && output.badge.toLowerCase() === 'ready to review', JSON.stringify(output));
  record('Checker discloses human review and source', /Please review before upload|Reviewed by you/.test(output.checks) && await page.locator('.source-result-link').count() === 1, output.checks);
  const downloadPromise = page.waitForEvent('download'); await page.locator('.download-button').click(); const download = await downloadPromise;
  record('Prepared preset result downloads as a JPG', download.suggestedFilename().endsWith('.jpg'), download.suggestedFilename());

  await page.locator('#exam-preset').selectOption('ibps-po-mt-xvi-2026-signature');
  record('Signature preset displays opt-in cleanup controls', await page.locator('#signature-options').isVisible() && await page.locator('#clean-signature').isVisible(), await page.locator('#preset-source').innerText());
  const signatureData = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 460; canvas.height = 200; const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 460, 200); gradient.addColorStop(0, '#aaa'); gradient.addColorStop(.5, '#ddd'); gradient.addColorStop(1, '#b8b8b8');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.strokeStyle = '#243342'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(35, 130); ctx.bezierCurveTo(90, 20, 120, 180, 185, 85); ctx.bezierCurveTo(235, 20, 240, 165, 290, 85); ctx.lineTo(415, 70); ctx.stroke();
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#form-image').setInputFiles({ name: 'signature-scan.png', mimeType: 'image/png', buffer: Buffer.from(signatureData, 'base64') });
  await page.locator('.cropper-container').waitFor();
  await page.locator('#clean-signature').check();
  await page.locator('#quality-review').check();
  await page.locator('#prepare-image').click(); await page.locator('.validation-result').waitFor();
  const signature = await page.evaluate(async () => {
    const blob = await (await fetch(document.querySelector('.download-button').href)).blob(); const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height; const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0); const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let light = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 240 && pixels[i+1] > 240 && pixels[i+2] > 240) light++;
    return { width: bitmap.width, height: bitmap.height, size: blob.size, reviewed: document.querySelector('.checks').innerText.includes('Reviewed by you'), lightRatio: light / (pixels.length / 4) };
  });
  record('Signature cleanup exports opaque white paper and dark contrast', signature.lightRatio > .2 && signature.width === 140 && signature.height === 60 && signature.reviewed, JSON.stringify(signature));

  await page.locator('#exam-preset').selectOption('ibps-po-mt-xvi-2026-thumb');
  record('IBPS thumb preset exact dimensions and size range prefill', await page.locator('#target-width').inputValue() === '240' && await page.locator('#target-height').inputValue() === '240' && await page.locator('#min-kb').inputValue() === '20' && await page.locator('#max-kb').inputValue() === '50', '240×240 px · 20–50 KB');
  await page.locator('#exam-preset').selectOption('ibps-po-mt-xvi-2026-declaration');
  record('IBPS declaration preset exact dimensions and file band prefill', await page.locator('#target-width').inputValue() === '800' && await page.locator('#target-height').inputValue() === '400' && await page.locator('#min-kb').inputValue() === '50' && await page.locator('#max-kb').inputValue() === '100', '800×400 px · 50–100 KB');
  await page.locator('#exam-preset').selectOption('ssc-cgl-2026-signature');
  record('SSC CGL preset is historical, signature-only and source-linked', /Historical cycle/i.test(await page.locator('#preset-source').innerText()) && /photo live|live photo/i.test(await page.locator('#preset-source').innerText()) && /6 × 2 cm/.test(await page.locator('#preset-source').innerText()) && await page.locator('#min-kb').inputValue() === '10', await page.locator('#preset-source').innerText());
  await page.locator('#exam-preset').selectOption('ssc-chsl-2025-signature');
  record('SSC CHSL preset uses its own archived cycle dimensions and bounds', /4 × 2 cm/.test(await page.locator('#preset-source').innerText()) && await page.locator('#max-kb').inputValue() === '20', await page.locator('#preset-source').innerText());
  await page.locator('#exam-preset').selectOption('rrb-cen-09-2025-signature');
  record('RRB preset checks minimum size and labels the previous cycle', await page.locator('#min-kb').inputValue() === '30' && await page.locator('#max-kb').inputValue() === '49' && /historical/i.test(await page.locator('#preset-source').innerText()), await page.locator('#preset-source').innerText());

  await page.locator('#exam-preset').selectOption('custom');
  await page.locator('#target-width').fill('240'); await page.locator('#target-height').fill('180'); await page.locator('#target-width').dispatchEvent('input');
  await page.locator('#min-kb').fill('0'); await page.locator('#max-kb').fill('100');
  await page.locator('#add-stamp').check(); await page.locator('#stamp-name').fill('Test Applicant'); await page.locator('#stamp-date').fill('2026-11-01');
  await page.locator('#prepare-image').click(); await page.locator('.validation-result').waitFor();
  record('Optional name/date stamp processes only when explicitly enabled', await page.locator('.validation-result img').count() === 1 && !await page.locator('#stamp-fields').isHidden(), await page.locator('.result-details').first().innerText());
  await page.locator('#add-stamp').uncheck();
  await page.locator('#min-kb').fill('99'); await page.locator('#max-kb').fill('100');
  await page.locator('#prepare-image').click(); await page.locator('.validation-result').waitFor();
  const impossible = await page.locator('.ready-badge').innerText();
  record('Unattainable strict size ranges do not get padded or called ready', impossible === 'Needs attention' || (await page.locator('.checks').innerText()).includes('FIX'), impossible);

  for (const width of [390, 320]) {
    const mobileContext = await browser.newContext({ viewport: { width, height: 850 } });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`${origin}/image-preparer.html`);
    await mobilePage.locator('#form-image').setInputFiles({ name: 'mobile-test.png', mimeType: 'image/png', buffer: Buffer.from(imageData, 'base64') });
    await mobilePage.locator('.cropper-container').waitFor();
    const layout = await mobilePage.evaluate(() => {
      const stage = document.querySelector('#crop-stage').getBoundingClientRect();
      const crop = document.querySelector('.cropper-container').getBoundingClientRect();
      return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, stageWidth: Math.round(stage.width), cropWidth: Math.round(crop.width), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
    });
    await mobilePage.screenshot({ path: `qa-results/screenshots-polished/formready-exam-kit-${width}px.png`, fullPage: true });
    record(`Exam Form Kit crop preview fits ${width}px mobile viewport`, !layout.overflow && layout.cropWidth <= layout.stageWidth + 1, JSON.stringify(layout));
    await mobileContext.close();
  }
  record('No browser errors during FormReady exam workflows', errors.length === 0, errors.join(' | '));
  record('No user-file upload requests', nonGet.length === 0, nonGet.join(' | '));
  await context.close();
} catch (error) {
  record('Exam Form Kit smoke completes without an uncaught error', false, error.stack || error.message);
} finally {
  await browser.close();
  if (server) { server.kill(); }
}
const failures = checks.filter((check) => !check.pass);
console.log(`\n${checks.length - failures.length}/${checks.length} checks passed`);
if (failures.length) process.exitCode = 1;
