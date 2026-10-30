import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import jsQR from 'jsqr';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const base = {
  workkit: process.env.WORKKIT_ORIGIN || 'http://127.0.0.1:4173',
  quickkit: process.env.QUICKKIT_ORIGIN || 'http://127.0.0.1:4174',
  formready: process.env.FORMREADY_ORIGIN || 'http://127.0.0.1:4175'
};
const viewports = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'tablet', width: 768, height: 1024 }, { name: 'mobile', width: 390, height: 844 }, { name: 'narrow-mobile', width: 320, height: 740 }];
const rootDir = fileURLToPath(new URL('..', import.meta.url));
const outDir = resolve(rootDir, 'qa-results', 'screenshots-polished');
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = { generatedAt: new Date().toISOString(), browser: `Chromium ${browser.version()}`, products: {}, errors: [] };
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
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}`);
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
  quickkit: ['', 'image-to-pdf.html', 'image-compressor.html', 'text-tools.html', 'wifi-qr.html', 'pdf-editor.html', 'pdf-merge.html'],
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
  await assert('WorkKit also displays total in hours and minutes', await page.locator('#hours-minutes').innerText() === '15h 30m', await page.locator('#hours-minutes').innerText());
  await page.locator('#currency').selectOption('INR');
  await assert('WorkKit formats estimates in Indian rupees without converting the entered rate', await page.locator('#gross-pay').innerText() === '₹310.00' && await page.locator('#currency-symbol').innerText() === '₹', await page.locator('#gross-pay').innerText());
  await page.reload();
  await assert('WorkKit local draft restores shifts, rate and currency', await page.locator('#shift-list .shift-row').count() === 2 && await page.locator('#hourly-rate').inputValue() === '20' && await page.locator('#currency').inputValue() === 'INR', 'stored draft reload');
  const downloadPromise = page.waitForEvent('download'); await page.locator('#export-csv').click(); const download = await downloadPromise;
  await assert('WorkKit CSV download', download.suggestedFilename() === 'workkit-timesheet.csv', download.suggestedFilename());
  await page.locator('#clear-shifts').click();
  await page.locator('#shift-list').locator('.shift-start').first().fill('08:00');
  await page.locator('#shift-list').locator('.shift-end').first().fill('08:00');
  await assert('WorkKit equal start/end shows a clear validation message', await page.locator('#form-message').innerText() === 'Start and end times cannot match. Change one time so the shift length is clear.', await page.locator('#form-message').innerText());
  await assert('WorkKit hides partial totals while a shift is invalid', await page.locator('#total-hours').innerText() === '—', await page.locator('#total-hours').innerText());
  await page.locator('.shift-start').first().fill('08:00'); await page.locator('.shift-end').first().fill('16:00');
  await page.evaluate(() => { window.__printCalled = false; window.print = () => { window.__printCalled = true; }; });
  await page.locator('#print-timesheet').click();
  const printCalled = await page.evaluate(() => window.__printCalled);
  await assert('WorkKit print/save PDF action opens browser print flow', printCalled, printCalled ? 'window.print was called' : 'window.print was not called');
  await page.locator('#clear-shifts').click();
  await page.locator('.shift-day').first().selectOption('Sunday');
  await page.locator('.shift-start').first().fill('22:00'); await page.locator('.shift-end').first().fill('06:00');
  await page.locator('#add-shift').click();
  await page.locator('.shift-day').nth(1).selectOption('Monday');
  await page.locator('.shift-start').nth(1).fill('04:00'); await page.locator('.shift-end').nth(1).fill('08:00');
  await page.locator('#calculate').click();
  const overlapMessage = await page.locator('#form-message').innerText();
  await assert('WorkKit rejects shifts overlapping across the week boundary', overlapMessage.includes('Shifts overlap') && await page.locator('#total-hours').innerText() === '—', overlapMessage);
  await page.locator('#clear-shifts').click();
  for (let i = 0; i < 14; i++) await page.locator('#add-shift').click();
  await assert('WorkKit can hold fifteen weekly shift rows', await page.locator('#shift-list .shift-row').count() === 15, `rows ${await page.locator('#shift-list .shift-row').count()}`);
  await page.reload();
  await assert('WorkKit restores all fifteen weekly shift rows', await page.locator('#shift-list .shift-row').count() === 15, `rows ${await page.locator('#shift-list .shift-row').count()}`);
  await page.close();
  const ot = await pageFor('workkit', 'overtime-calculator.html', { width: 390, height: 844 });
  const fxRequests = [];
  await ot.page.route('https://api.frankfurter.dev/v2/rate/**', async (route) => {
    const url = new URL(route.request().url());
    fxRequests.push({ method: route.request().method(), path: url.pathname });
    const [, , , base, quote] = url.pathname.split('/');
    const rate = base === 'usd' && quote === 'inr' ? 83.5 : base === 'inr' && quote === 'gbp' ? .01 : 1.25;
    await route.fulfill({ json: { date: '2026-10-29', base: base.toUpperCase(), quote: quote.toUpperCase(), rate } });
  });
  await ot.page.locator('#ot-hours').fill('45'); await ot.page.locator('#ot-rate').fill('20'); await ot.page.locator('#overtime-form button[type=submit]').click();
  const overtimePay = await ot.page.locator('#ot-pay').innerText();
  await assert('WorkKit 45h overtime example', overtimePay === '$950.00', overtimePay);
  await ot.page.waitForFunction(() => document.querySelector('#ot-fx-rate')?.innerText.includes('daily mid-market reference'));
  await assert('WorkKit converts weekly gross pay with a dated daily rate', await ot.page.locator('#ot-fx-pay').innerText() === '₹79,325.00' && (await ot.page.locator('#ot-fx-rate').innerText()).includes('2026-10-29'), `${await ot.page.locator('#ot-fx-pay').innerText()} · ${await ot.page.locator('#ot-fx-rate').innerText()}`);
  await assert('WorkKit sends only currency codes to the exchange-rate API', fxRequests.length === 1 && fxRequests[0].method === 'GET' && fxRequests[0].path === '/v2/rate/usd/inr' && !JSON.stringify(fxRequests).match(/950|20|45/u), JSON.stringify(fxRequests));
  await ot.page.locator('#currency').selectOption('INR');
  await assert('WorkKit overtime estimate supports INR formatting', await ot.page.locator('#ot-pay').innerText() === '₹950.00', await ot.page.locator('#ot-pay').innerText());
  await assert('WorkKit shows the same-currency amount without an unnecessary rate request', await ot.page.locator('#ot-fx-pay').innerText() === '₹950.00' && (await ot.page.locator('#ot-fx-rate').innerText()).includes('Same currency') && fxRequests.length === 1, `${await ot.page.locator('#ot-fx-pay').innerText()} · requests ${fxRequests.length}`);
  await ot.page.locator('#ot-target-currency').selectOption('GBP');
  await ot.page.waitForFunction(() => document.querySelector('#ot-fx-rate')?.innerText.includes('daily mid-market reference'));
  await assert('WorkKit can convert between other selected currencies', await ot.page.locator('#ot-fx-pay').innerText() === '£9.50' && fxRequests.at(-1)?.path === '/v2/rate/inr/gbp', `${await ot.page.locator('#ot-fx-pay').innerText()} · ${JSON.stringify(fxRequests)}`);
  await ot.page.locator('#ot-fx-refresh').click();
  await ot.page.waitForFunction(() => document.querySelector('#ot-fx-rate')?.innerText.includes('daily mid-market reference'));
  await assert('WorkKit refreshes a cached currency pair on request', fxRequests.filter((request) => request.path === '/v2/rate/inr/gbp').length === 2, JSON.stringify(fxRequests));
  await ot.page.close();
  const salary = await pageFor('workkit', 'salary-converter.html', { width: 390, height: 844 });
  await salary.page.locator('#salary-rate').fill('20'); await salary.page.locator('#salary-form button[type=submit]').click();
  await salary.page.locator('#currency').selectOption('INR');
  await assert('WorkKit salary conversion supports INR formatting', await salary.page.locator('#annual-pay').innerText() === '₹41,600.00', await salary.page.locator('#annual-pay').innerText());
  await salary.page.close();
}

// QuickKit: image compression, text handling, QR payload and valid multi-PDF merge.
{
  const imagePdf = await pageFor('quickkit', 'image-to-pdf.html', { width: 1440, height: 900 });
  const galleryImages = await Promise.all([[640, 480, '#2b5868'], [480, 640, '#b84b3f']].map(([width, height, color], index) => imagePdf.page.evaluate(async ({ width, height, color, index }) => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'); context.fillStyle = color; context.fillRect(0, 0, width, height);
    context.fillStyle = '#f4c84b'; context.font = 'bold 42px sans-serif'; context.fillText(`PHOTO ${index + 1}`, 30, 80);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, { width, height, color, index })));
  await imagePdf.page.locator('#image-files').setInputFiles(galleryImages.map((data, index) => ({ name: `photo-${index + 1}.png`, mimeType: 'image/png', buffer: Buffer.from(data) })));
  await imagePdf.page.locator('#image-gallery li').nth(1).waitFor();
  await assert('QuickKit image-to-PDF gallery accepts multiple local photos', await imagePdf.page.locator('#image-gallery li').count() === 2 && await imagePdf.page.locator('#selection-count').innerText() === '2 of 2 photos selected', await imagePdf.page.locator('#selection-count').innerText());
  await imagePdf.page.locator('#deselect-all').click();
  await assert('QuickKit image-to-PDF can exclude every page before conversion', await imagePdf.page.locator('#convert-images').isDisabled() && await imagePdf.page.locator('#pdf-page-count').innerText() === '0 pages', await imagePdf.page.locator('#pdf-page-count').innerText());
  await imagePdf.page.locator('#select-all').click();
  await imagePdf.page.locator('#image-gallery li').nth(1).locator('button').first().click();
  const reorderedNames = (await imagePdf.page.locator('.gallery-file-name').allInnerTexts()).map((name) => name.split('\n')[0]);
  await assert('QuickKit image-to-PDF reorders pages using gallery controls', reorderedNames[0] === 'photo-2.png' && reorderedNames[1] === 'photo-1.png', reorderedNames.join(', '));
  await imagePdf.page.locator('#image-gallery li').nth(0).dragTo(imagePdf.page.locator('#image-gallery li').nth(1));
  const draggedNames = (await imagePdf.page.locator('.gallery-file-name').allInnerTexts()).map((name) => name.split('\n')[0]);
  await assert('QuickKit image-to-PDF supports drag-and-drop page ordering', draggedNames[0] === 'photo-1.png' && draggedNames[1] === 'photo-2.png', draggedNames.join(', '));
  await imagePdf.page.locator('#page-margin').selectOption('15');
  await imagePdf.page.locator('#paper-size').selectOption('a4');
  await imagePdf.page.locator('#rotate-right').click();
  await imagePdf.page.locator('#rotate-left').click();
  await imagePdf.page.locator('#image-filter').selectOption('grayscale');
  await imagePdf.page.locator('#brightness').fill('110');
  const liveFilterPreview = await imagePdf.page.locator('.cropper-canvas img').first().evaluate((image) => getComputedStyle(image).filter);
  await assert('QuickKit filter selection updates the visible crop preview immediately', liveFilterPreview.includes('grayscale(1)'), liveFilterPreview);
  await imagePdf.page.locator('#apply-edit').click();
  await imagePdf.page.locator('#image-gallery li').first().waitFor();
  const filteredPixels = await imagePdf.page.locator('#image-gallery li img').first().evaluate(async (image) => {
    await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0, 1, 1);
    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
    return { red, green, blue, maxChannelDifference: Math.max(red, green, blue) - Math.min(red, green, blue) };
  });
  await assert('QuickKit applied grayscale filter changes the edited photo pixels', filteredPixels.maxChannelDifference <= 3, JSON.stringify(filteredPixels));
  await assert('QuickKit image-to-PDF applies crop/rotation and filter edits before export', (await imagePdf.page.locator('#image-gallery li').first().innerText()).includes('edited') && await imagePdf.page.locator('#convert-images').isEnabled(), await imagePdf.page.locator('#edit-status').innerText());
  await imagePdf.page.locator('#convert-images').click();
  await imagePdf.page.locator('#image-pdf-result .download-link').waitFor();
  const imagePdfDownload = imagePdf.page.waitForEvent('download');
  await imagePdf.page.locator('#image-pdf-result .download-link').click();
  const imagePdfFile = await imagePdfDownload;
  const generatedImagePdf = await PDFDocument.load(await (await import('node:fs/promises')).readFile(await imagePdfFile.path()));
  const generatedPages = generatedImagePdf.getPages();
  await assert('QuickKit image-to-PDF applies margins and keeps chosen page order', generatedPages.length === 2 && generatedPages[0].getWidth() > generatedPages[0].getHeight() && generatedPages[1].getWidth() < generatedPages[1].getHeight(), `pages: ${generatedPages.map((page) => `${Math.round(page.getWidth())}×${Math.round(page.getHeight())}`).join(', ')}`);
  await imagePdf.page.close();

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
  await assert('FormReady rotate and reset crop controls appear', await page.locator('#rotate-left').isVisible() && await page.locator('#rotate-right').isVisible() && await page.locator('#reset-crop').isVisible(), 'crop actions missing');
  await page.locator('#rotate-left').click(); await page.locator('#reset-crop').click();
  await page.locator('#target-dpi').fill('1300');
  await page.locator('#target-width').fill('1'); await page.locator('#target-height').fill('1');
  await page.locator('#prepare-image').click();
  const dpiMessage = await page.locator('#prepare-message').innerText();
  await assert('FormReady enforces its maximum print resolution', dpiMessage.includes('1 and 1,200 DPI'), dpiMessage);
  await page.locator('#target-dpi').fill('300');
  await page.locator('#target-unit').selectOption('px'); await page.locator('#target-width').fill('120'); await page.locator('#target-height').fill(''); await page.locator('#max-kb').fill('500');
  await page.locator('#prepare-image').click(); await page.locator('#prepare-result .validation-result').waitFor();
  const singleDimension = await page.locator('#prepare-result .result-details').innerText();
  await assert('FormReady preserves aspect ratio when only width is specified', /120 × 90px/.test(singleDimension), singleDimension);
  await page.locator('#target-unit').selectOption('mm'); await page.locator('#target-width').fill('35'); await page.locator('#target-height').fill('45'); await page.locator('#target-dpi').fill('300'); await page.locator('#max-kb').fill('500');
  await page.locator('#prepare-image').click(); await page.locator('#prepare-result .validation-result').waitFor();
  const physicalChecks = await page.locator('.checks').innerText();
  await assert('FormReady converts physical dimensions to pixels at the requested DPI', physicalChecks.includes('413 × 531px'), physicalChecks);
  await page.locator('#target-unit').selectOption('px'); await page.locator('#target-width').fill('120'); await page.locator('#target-height').fill('140'); await page.locator('#max-kb').fill('100');
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
const unexpectedRequests = allObservedRequests.filter((r) => r.method !== 'GET' && !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
if (unexpectedRequests.length) results.errors.push(`Unexpected non-GET browser requests: ${JSON.stringify(unexpectedRequests)}`);
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
