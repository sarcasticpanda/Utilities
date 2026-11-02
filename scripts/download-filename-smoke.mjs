import { chromium } from 'playwright';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const servers = [
  { name: 'QuickKit', origin: process.env.QUICKKIT_ORIGIN || 'http://127.0.0.1:4177', config: 'products/quickkit/vite.config.js', port: '4177' },
  { name: 'WorkKit', origin: process.env.WORKKIT_ORIGIN || 'http://127.0.0.1:4187', config: 'products/workkit/vite.config.js', port: '4187' },
  { name: 'FormReady', origin: process.env.FORMREADY_ORIGIN || 'http://127.0.0.1:4188', config: 'products/formready/vite.config.js', port: '4188' }
];
const children = [];
const checks = [];
const outputDir = resolve('qa-results', 'download-filenames');
await mkdir(outputDir, { recursive: true });
const record = (name, pass, detail = '') => {
  checks.push({ name, pass: Boolean(pass), detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

async function ensureServer({ origin, config, port }) {
  try { await fetch(origin); return; } catch {}
  const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', config, '--host', '127.0.0.1', '--port', port, '--strictPort'], { stdio: 'ignore' });
  children.push(child);
  for (let i = 0; i < 80; i += 1) {
    try { await fetch(origin); return; } catch { await delay(250); }
  }
  throw new Error(`Could not start preview server on ${origin}`);
}

for (const server of servers) await ensureServer(server);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

try {
  const png = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 110;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#e7effb'; ctx.fillRect(0, 0, 160, 110);
    ctx.fillStyle = '#2463b8'; ctx.fillRect(24, 18, 112, 74);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });

  await page.goto(`${servers[0].origin}/image-to-pdf.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('#image-files').setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: Buffer.from(png) });
  await page.locator('#convert-images').click();
  const imagePdfLink = page.locator('#image-pdf-result .download-link');
  await imagePdfLink.waitFor({ state: 'visible', timeout: 30000 });
  const imagePdfName = page.locator('#image-pdf-result .download-filename-input');
  record('Image to PDF result card mounts an editable filename beside the download', await imagePdfName.isVisible());
  await imagePdfName.fill('my-application');
  const imagePdfDownloadPromise = page.waitForEvent('download');
  await imagePdfLink.click();
  const imagePdfDownload = await imagePdfDownloadPromise;
  record('Image to PDF download uses the chosen name and keeps the .pdf extension', imagePdfDownload.suggestedFilename() === 'my-application.pdf', imagePdfDownload.suggestedFilename());

  await page.goto(`${servers[0].origin}/image-compressor.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('#image-file').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(png) });
  await page.locator('#compress-image').click();
  const compressedLink = page.locator('#image-result .download-link');
  await compressedLink.waitFor({ state: 'visible', timeout: 30000 });
  const compressedName = page.locator('#image-result .download-filename-input');
  record('Image compressor result mounts its filename control', await compressedName.isVisible());
  await compressedName.fill('small-photo');
  const compressedDownloadPromise = page.waitForEvent('download'); await compressedLink.click();
  const compressedDownload = await compressedDownloadPromise;
  record('Image compressor download uses the chosen output name', compressedDownload.suggestedFilename() === 'small-photo.jpg', compressedDownload.suggestedFilename());

  await page.goto(`${servers[0].origin}/wifi-qr.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('#wifi-name').fill('QuickKit Guest');
  await page.locator('#wifi-security').selectOption('nopass');
  await page.locator('#qr-form button[type="submit"]').click();
  const qrLink = page.locator('#qr-output .download-link'); await qrLink.waitFor({ state: 'visible', timeout: 30000 });
  const qrName = page.locator('#qr-output .download-filename-input');
  record('Wi-Fi QR result mounts its filename control', await qrName.isVisible());
  await qrName.fill('guest-wifi');
  const qrDownloadPromise = page.waitForEvent('download'); await qrLink.click();
  const qrDownload = await qrDownloadPromise;
  record('Wi-Fi QR download uses the chosen PNG filename', qrDownload.suggestedFilename() === 'guest-wifi.png', qrDownload.suggestedFilename());
  await page.screenshot({ path: resolve(outputDir, 'image-to-pdf-desktop.png'), fullPage: true });
  const mobileContext = await browser.newContext({ acceptDownloads: true, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobile = await mobileContext.newPage();
  await mobile.goto(`${servers[0].origin}/image-to-pdf.html`, { waitUntil: 'domcontentloaded' });
  await mobile.locator('#image-files').setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: Buffer.from(png) });
  await mobile.locator('#convert-images').waitFor({ state: 'visible' });
  await mobile.locator('#convert-images').click();
  await mobile.locator('#image-pdf-result .download-filename-input').waitFor({ state: 'visible', timeout: 30000 });
  const mobileFit = await mobile.evaluate(() => {
    const control = document.querySelector('#image-pdf-result .download-filename-control').getBoundingClientRect();
    return { viewport: innerWidth, scroll: document.documentElement.scrollWidth, left: control.left, right: control.right };
  });
  record('Image to PDF filename control fits a 390px mobile viewport', mobileFit.scroll <= mobileFit.viewport && mobileFit.left >= 0 && mobileFit.right <= mobileFit.viewport, JSON.stringify(mobileFit));
  await mobile.screenshot({ path: resolve(outputDir, 'image-to-pdf-mobile.png'), fullPage: true });
  await mobileContext.close();

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([400, 500]).drawText('Rename this edited PDF', { x: 40, y: 450, size: 18, font });
  const pdfBytes = Buffer.from(await pdf.save());
  await page.goto(`${servers[0].origin}/pdf-editor.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('#pdf-source').setInputFiles({ name: 'sample.pdf', mimeType: 'application/pdf', buffer: pdfBytes });
  await page.locator('#pdf-workspace').waitFor({ state: 'visible', timeout: 30000 });
  const editedName = page.locator('.pdf-editor-topbar + .download-filename-control input');
  record('PDF editor exposes an editable filename for its PDF export', await editedName.isVisible());
  await editedName.fill('edited-contract');
  const editedPdfDownloadPromise = page.waitForEvent('download');
  await page.locator('#download-pdf').click();
  const editedPdfDownload = await editedPdfDownloadPromise;
  record('PDF editor export uses the chosen PDF filename', editedPdfDownload.suggestedFilename() === 'edited-contract.pdf', editedPdfDownload.suggestedFilename());

  await page.goto(`${servers[0].origin}/pdf-merge.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('#pdf-files').setInputFiles([
    { name: 'first.pdf', mimeType: 'application/pdf', buffer: pdfBytes },
    { name: 'second.pdf', mimeType: 'application/pdf', buffer: pdfBytes }
  ]);
  await page.locator('#merge-pdf').click();
  const mergedLink = page.locator('#pdf-result .download-link'); await mergedLink.waitFor({ state: 'visible', timeout: 30000 });
  const mergedName = page.locator('#pdf-result .download-filename-input');
  record('PDF merge result mounts its filename control', await mergedName.isVisible());
  await mergedName.fill('combined-report');
  const mergedDownloadPromise = page.waitForEvent('download'); await mergedLink.click();
  const mergedDownload = await mergedDownloadPromise;
  record('Merged PDF download uses the chosen filename', mergedDownload.suggestedFilename() === 'combined-report.pdf', mergedDownload.suggestedFilename());

  await page.goto(`${servers[1].origin}/time-card-calculator.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('.shift-start').first().fill('09:00');
  await page.locator('.shift-end').first().fill('17:00');
  await page.locator('#hourly-rate').fill('20');
  await page.locator('#calculate').click();
  const workkitName = page.locator('.result-actions .download-filename-input');
  record('WorkKit exposes a shared output name for CSV and printed PDF', await workkitName.isVisible());
  await workkitName.fill('week-42-timesheet');
  const csvDownloadPromise = page.waitForEvent('download');
  await page.locator('#export-csv').click();
  const csvDownload = await csvDownloadPromise;
  record('WorkKit CSV export uses the chosen name and .csv extension', csvDownload.suggestedFilename() === 'week-42-timesheet.csv', csvDownload.suggestedFilename());
  await page.evaluate(() => { window.__printedDocumentTitle = ''; window.print = () => { window.__printedDocumentTitle = document.title; }; });
  await page.locator('#print-timesheet').click();
  record('WorkKit Print / Save PDF uses the same chosen filename as its title', await page.evaluate(() => window.__printedDocumentTitle) === 'week-42-timesheet', await page.evaluate(() => window.__printedDocumentTitle));
  await page.setViewportSize({ width: 390, height: 844 });
  const workkitFit = await page.evaluate(() => {
    const control = document.querySelector('.result-actions .download-filename-control').getBoundingClientRect();
    return { viewport: innerWidth, scroll: document.documentElement.scrollWidth, left: control.left, right: control.right };
  });
  record('WorkKit filename control fits a 390px mobile viewport', workkitFit.scroll <= workkitFit.viewport && workkitFit.left >= 0 && workkitFit.right <= workkitFit.viewport, JSON.stringify(workkitFit));
  await page.screenshot({ path: resolve(outputDir, 'workkit-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.goto(`${servers[2].origin}/image-preparer.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('#exam-preset').selectOption('custom');
  await page.locator('#target-width').fill('160'); await page.locator('#target-height').fill('110');
  await page.locator('#min-kb').fill('0'); await page.locator('#max-kb').fill('500');
  await page.locator('#form-image').setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: Buffer.from(png) });
  await page.locator('.cropper-container').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#prepare-image').click();
  const formreadyLink = page.locator('.download-button');
  await formreadyLink.waitFor({ state: 'visible', timeout: 30000 });
  const formreadyName = page.locator('.validation-result .download-filename-input');
  record('FormReady result card mounts an editable filename', await formreadyName.isVisible());
  await formreadyName.fill('exam-photo');
  const photoDownloadPromise = page.waitForEvent('download');
  await formreadyLink.click();
  const photoDownload = await photoDownloadPromise;
  record('FormReady download uses the chosen name and generated format extension', photoDownload.suggestedFilename() === 'exam-photo.jpg', photoDownload.suggestedFilename());
  const formreadyMobileContext = await browser.newContext({ acceptDownloads: true, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const formreadyMobile = await formreadyMobileContext.newPage();
  await formreadyMobile.goto(`${servers[2].origin}/image-preparer.html`, { waitUntil: 'domcontentloaded' });
  const mobileFormImage = await formreadyMobile.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 110;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#dce7f5'; ctx.fillRect(0, 0, 160, 110);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await formreadyMobile.locator('#exam-preset').selectOption('custom');
  await formreadyMobile.locator('#target-width').fill('160'); await formreadyMobile.locator('#target-height').fill('110');
  await formreadyMobile.locator('#min-kb').fill('0'); await formreadyMobile.locator('#max-kb').fill('500');
  await formreadyMobile.locator('#form-image').setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: Buffer.from(mobileFormImage) });
  await formreadyMobile.locator('.cropper-container').waitFor({ state: 'visible', timeout: 30000 });
  await formreadyMobile.locator('#prepare-image').click();
  await formreadyMobile.locator('.validation-result .download-filename-input').waitFor({ state: 'visible', timeout: 30000 });
  const formreadyFit = await formreadyMobile.evaluate(() => {
    const control = document.querySelector('.validation-result .download-filename-control').getBoundingClientRect();
    return { viewport: innerWidth, scroll: document.documentElement.scrollWidth, left: control.left, right: control.right };
  });
  record('FormReady filename control fits a 390px mobile viewport', formreadyFit.scroll <= formreadyFit.viewport && formreadyFit.left >= 0 && formreadyFit.right <= formreadyFit.viewport, JSON.stringify(formreadyFit));
  await formreadyMobile.screenshot({ path: resolve(outputDir, 'formready-mobile.png'), fullPage: true });
  await formreadyMobileContext.close();

  record('No uncaught browser page errors during filename flows', errors.length === 0, errors.join(' | '));
} finally {
  await context.close();
  await browser.close();
  for (const child of children) child.kill();
}

if (checks.some((check) => !check.pass)) process.exitCode = 1;
