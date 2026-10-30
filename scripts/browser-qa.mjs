import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import jsQR from 'jsqr';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const base = {
  workkit: 'http://127.0.0.1:4173',
  quickkit: 'http://127.0.0.1:4174',
  formready: 'http://127.0.0.1:4175'
};
const viewports = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'tablet', width: 768, height: 1024 }, { name: 'mobile', width: 390, height: 844 }, { name: 'narrow-mobile', width: 320, height: 740 }];
const rootDir = fileURLToPath(new URL('..', import.meta.url));
const outDir = resolve(rootDir, 'qa-results', 'screenshots');
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = { generatedAt: new Date().toISOString(), browser: 'Chromium via Playwright', products: {}, errors: [] };
const allObservedRequests = [];
const pdfBytes = [];
for (let i = 0; i < 2; i++) {
  const pdf = await PDFDocument.create();
  pdf.addPage([300, 400]);
  pdfBytes.push(Buffer.from(await pdf.save()).toString('base64'));
}

async function pageFor(product, path, viewport) {
  const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
  const consoleErrors = [];
  const requests = [];
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`console: ${m.text()}`); });
  page.on('request', (r) => { const record = { method: r.method(), url: r.url() }; requests.push(record); allObservedRequests.push(record); });
  await page.goto(`${base[product]}/${path}`, { waitUntil: 'networkidle' });
  return { page, consoleErrors, requests };
}
async function checkLayout(product, path) {
  for (const viewport of viewports) {
    const { page, consoleErrors, requests } = await pageFor(product, path, viewport);
    const layout = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      title: document.title,
      h1: document.querySelector('h1')?.innerText || null,
      visibleButtons: [...document.querySelectorAll('button')].filter((b) => b.getClientRects().length).length
    }));
    const noOverflow = layout.scrollWidth <= layout.width + 1;
    const key = `${product}/${path || 'index.html'}@${viewport.name}`;
    results.products[key] = { layout, noOverflow, consoleErrors, requests };
    if (!noOverflow) results.errors.push(`${key}: horizontal overflow ${layout.scrollWidth}px > ${layout.width}px`);
    if (consoleErrors.length) results.errors.push(`${key}: ${consoleErrors.join('; ')}`);
    if (['desktop', 'mobile'].includes(viewport.name)) {
      const safe = path.replaceAll('/', '_').replaceAll('.html', '') || 'home';
      await page.screenshot({ path: resolve(outDir, `${product}-${safe}-${viewport.name}.png`), fullPage: true });
    }
    await page.close();
  }
}
async function assert(name, condition, details = '') {
  results.products[name] = { pass: Boolean(condition), details };
  if (!condition) results.errors.push(`${name}: ${details || 'failed'}`);
}
async function setImage(page, selector, { width = 640, height = 480, type = 'image/png', name = 'test-image.png' } = {}) {
  const data = await page.evaluate(({ width, height, type }) => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < height; y += 12) for (let x = 0; x < width; x += 12) {
      ctx.fillStyle = ((x + y) / 12) % 2 ? '#da6352' : '#2b5868'; ctx.fillRect(x, y, 12, 12);
    }
    ctx.fillStyle = '#f4c84b'; ctx.font = 'bold 42px sans-serif'; ctx.fillText('LOCAL TEST', 30, 80);
    return new Promise((resolve) => canvas.toBlob(async (blob) => {
      const buf = new Uint8Array(await blob.arrayBuffer());
      resolve(Array.from(buf));
    }, type));
  }, { width, height, type });
  await page.locator(selector).setInputFiles({ name, mimeType: type, buffer: Buffer.from(data) });
}

for (const [product, paths] of Object.entries({
  workkit: ['', 'time-card-calculator.html', 'overtime-calculator.html', 'salary-converter.html'],
  quickkit: ['', 'image-compressor.html', 'text-tools.html', 'wifi-qr.html', 'pdf-merge.html'],
  formready: ['', 'image-preparer.html']
})) for (const path of paths) await checkLayout(product, path);

// WorkKit: overnight time, breaks, overtime pay, draft restore and CSV export.
{
  const { page } = await pageFor('workkit', 'time-card-calculator.html', { width: 1440, height: 900 });
  await page.locator('#hourly-rate').fill('20');
  await page.locator('.shift-start').first().fill('22:00');
  await page.locator('.shift-end').first().fill('06:00');
  await page.locator('.shift-break').first().fill('30');
  await page.locator('#add-shift').click();
  await page.locator('.shift-start').nth(1).fill('08:00');
  await page.locator('.shift-end').nth(1).fill('16:00');
  await page.locator('#shift-list .shift-row').nth(1).locator('.shift-break').fill('0');
  await page.locator('#calculate').click();
  const totals = await page.locator('#total-hours').innerText();
  const pay = await page.locator('#gross-pay').innerText();
  await assert('WorkKit overnight shift plus break totals 15.5h and $310', totals === '15.50' && pay === '$310.00', `actual ${totals} hours, ${pay}`);
  await page.reload();
  await assert('WorkKit local draft restores shifts and rate', await page.locator('#shift-list .shift-row').count() === 2 && await page.locator('#hourly-rate').inputValue() === '20', 'stored draft reload');
  const downloadPromise = page.waitForEvent('download'); await page.locator('#export-csv').click(); const download = await downloadPromise;
  await assert('WorkKit CSV download', download.suggestedFilename() === 'workkit-timesheet.csv', download.suggestedFilename());
  await page.locator('#clear-shifts').click();
  await page.locator('#shift-list').locator('.shift-start').first().fill('08:00');
  await page.locator('#shift-list').locator('.shift-end').first().fill('08:00');
  await assert('WorkKit equal start/end shows a clear validation message', await page.locator('#form-message').innerText() === 'Start and end times cannot match. Change one time so the shift length is clear.', await page.locator('#form-message').innerText());
  await page.close();
  const ot = await pageFor('workkit', 'overtime-calculator.html', { width: 390, height: 844 });
  await ot.page.locator('#ot-hours').fill('45'); await ot.page.locator('#ot-rate').fill('20'); await ot.page.locator('#overtime-form button[type=submit]').click();
  const overtimePay = await ot.page.locator('#ot-pay').innerText();
  await assert('WorkKit 45h overtime example', overtimePay === '$950.00', overtimePay);
  await ot.page.close();
}

// QuickKit: image compression, text handling, QR payload and valid multi-PDF merge.
{
  const { page } = await pageFor('quickkit', 'image-compressor.html', { width: 1440, height: 900 });
  await setImage(page, '#image-file'); await page.locator('#compress-image').click();
  await page.locator('#image-result .download-link').waitFor();
  const imageDetails = await page.locator('#image-result').innerText();
  await assert('QuickKit image compression outputs measured result and download', /result/i.test(imageDetails) && await page.locator('#image-result img').count() === 1 && await page.locator('#image-result .download-link').count() === 1, imageDetails);
  await page.close();
  const text = await pageFor('quickkit', 'text-tools.html', { width: 390, height: 844 });
  await text.page.locator('#text-input').fill('  hello   world  \n\nhello world');
  await text.page.locator('[data-clean="trim"]').click();
  const cleaned = await text.page.locator('#text-input').inputValue();
  await assert('QuickKit trim cleanup', cleaned === 'hello world\n\nhello world', JSON.stringify(cleaned));
  await text.page.locator('[data-clean="duplicates"]').click();
  await assert('QuickKit duplicate line cleanup', await text.page.locator('#text-input').inputValue() === 'hello world\n', JSON.stringify(await text.page.locator('#text-input').inputValue()));
  await text.page.locator('#password-length').fill('24'); await text.page.locator('#generate-password').click();
  const password = await text.page.locator('#password-output').innerText();
  await assert('QuickKit password generator length', password.length === 24 && password !== 'Choose Generate', `length ${password.length}`);
  await text.page.close();
  const qr = await pageFor('quickkit', 'wifi-qr.html', { width: 1440, height: 900 });
  await qr.page.locator('#wifi-name').fill('Home; WiFi'); await qr.page.locator('#wifi-password').fill('safe:password');
  await qr.page.locator('#qr-form button[type=submit]').click(); await qr.page.locator('#qr-output canvas').waitFor();
  const pixels = await qr.page.locator('#qr-output canvas').evaluate((canvas) => { const { data, width, height } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height); return { data: Array.from(data), width, height }; });
  const decoded = jsQR(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height)?.data;
  await assert('QuickKit Wi-Fi QR decodes with escaped credentials', Boolean(decoded && decoded.includes('S:Home\\; WiFi') && decoded.includes('P:safe\\:password')), decoded || 'Could not decode canvas QR');
  await qr.page.close();
  const pdf = await pageFor('quickkit', 'pdf-merge.html', { width: 1440, height: 900 });
  await pdf.page.locator('#pdf-files').setInputFiles(pdfBytes.map((buffer, i) => ({ name: `sample-${i + 1}.pdf`, mimeType: 'application/pdf', buffer: Buffer.from(buffer, 'base64') })));
  await pdf.page.locator('#merge-pdf').click(); await pdf.page.locator('#pdf-result .download-link').waitFor();
  const mergedDownload = pdf.page.waitForEvent('download'); await pdf.page.locator('#pdf-result .download-link').click(); const dl = await mergedDownload;
  const path = await dl.path(); const merged = await PDFDocument.load(await (await import('node:fs/promises')).readFile(path));
  await assert('QuickKit PDF merge produces valid 2-page PDF', merged.getPageCount() === 2, `pages: ${merged.getPageCount()}`);
  await pdf.page.close();
}

// FormReady: interactive crop selection, exact dimensions and honest validation state.
{
  const { page } = await pageFor('formready', 'image-preparer.html', { width: 1440, height: 900 });
  await setImage(page, '#form-image'); await page.locator('.cropper-container').waitFor();
  await page.locator('#target-width').fill('120'); await page.locator('#target-height').fill('140'); await page.locator('#max-kb').fill('100');
  await page.locator('#prepare-image').click(); await page.locator('#prepare-result .validation-result').waitFor();
  const badge = (await page.locator('.ready-badge').innerText()).toLowerCase();
  const checks = await page.locator('.checks').innerText();
  await assert('FormReady exact dimensions and size check', badge === 'ready to review' && checks.includes('120 × 140px') && checks.includes('PASS'), `${badge}; ${checks}`);
  const resultDownload = page.waitForEvent('download'); await page.locator('#prepare-result .download-button').click(); const result = await resultDownload;
  await assert('FormReady image download', result.suggestedFilename().startsWith('formready-'), result.suggestedFilename());
  await page.locator('#clear-image').click();
  await assert('FormReady reset clears cropper and result', await page.locator('#crop-stage').isHidden() && await page.locator('.validation-result').count() === 0 && await page.locator('#prepare-image').isDisabled(), 'cropper reset');
  await page.close();
}

// Confirm no first-party image/PDF submission is made. Browser requests include local development assets and Google Fonts.
results.observedRequests = allObservedRequests;
for (const [name, record] of Object.entries(results.products)) {
  if (!record?.requests) continue;
  const posts = record.requests.filter((r) => r.method !== 'GET' && !r.url.startsWith('data:'));
  if (posts.length) results.errors.push(`${name}: unexpected non-GET requests: ${JSON.stringify(posts)}`);
}
results.summary = { total: Object.keys(results.products).length, failures: results.errors.length, errors: results.errors };
await writeFile(resolve(rootDir, 'qa-results', 'browser-qa-results.json'), JSON.stringify(results, null, 2));
await browser.close();
console.log(JSON.stringify(results.summary, null, 2));
if (results.errors.length) process.exitCode = 1;
