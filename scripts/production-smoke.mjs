import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sites = {
  workkit: { origin: 'https://workkit-hours-tools.pages.dev', paths: ['/', '/time-card-calculator.html', '/overtime-calculator.html', '/salary-converter.html'] },
  quickkit: { origin: 'https://quickkit-browser-tools.pages.dev', paths: ['/', '/image-compressor.html', '/pdf-editor.html', '/pdf-merge.html', '/text-tools.html', '/wifi-qr.html'] },
  formready: { origin: 'https://formready-photo-tools.pages.dev', paths: ['/', '/image-preparer.html'] }
};
const outDir = path.join(root, 'qa-results', 'production');
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = { generatedAt: new Date().toISOString(), browser: `Chromium ${browser.version()}`, sites: {}, errors: [], requests: [] };
const viewport = { width: 1440, height: 900 };

for (const [name, site] of Object.entries(sites)) {
  results.sites[name] = { origin: site.origin, pages: [] };
  for (const route of site.paths) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', (request) => results.requests.push({ site: name, method: request.method(), url: request.url() }));
    const response = await page.goto(`${site.origin}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.locator('h1').waitFor({ state: 'visible' });
    const pageInfo = await page.evaluate(() => ({
      title: document.title,
      h1: document.querySelector('h1')?.innerText,
      canonical: document.querySelector('link[rel="canonical"]')?.href,
      scrollWidth: document.documentElement.scrollWidth,
      width: document.documentElement.clientWidth
    }));
    const expectedCanonical = `${site.origin}${route === '/' ? '/' : route}`;
    const record = { route, status: response?.status(), ...pageInfo, errors, canonicalMatches: pageInfo.canonical === expectedCanonical };
    results.sites[name].pages.push(record);
    if (response?.status() !== 200) results.errors.push(`${name}${route}: HTTP ${response?.status()}`);
    if (!pageInfo.h1) results.errors.push(`${name}${route}: missing H1`);
    if (!record.canonicalMatches) results.errors.push(`${name}${route}: canonical ${pageInfo.canonical}`);
    if (pageInfo.scrollWidth > pageInfo.width + 1) results.errors.push(`${name}${route}: horizontal overflow`);
    if (errors.length) results.errors.push(`${name}${route}: ${errors.join('; ')}`);
    if (route === '/') await page.screenshot({ path: path.join(outDir, `${name}-home-desktop.png`), fullPage: true });
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(site.origin, { waitUntil: 'domcontentloaded' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  await page.screenshot({ path: path.join(outDir, `${name}-home-mobile.png`), fullPage: true });
  if (overflow) results.errors.push(`${name}: mobile homepage overflows`);
  if (errors.length) results.errors.push(`${name}: mobile console/page errors: ${errors.join('; ')}`);
  await page.close();
  const robots = await fetch(`${site.origin}/robots.txt`).then(async (r) => ({ status: r.status, body: await r.text() }));
  const sitemap = await fetch(`${site.origin}/sitemap.xml`).then(async (r) => ({ status: r.status, body: await r.text() }));
  results.sites[name].robots = robots;
  results.sites[name].sitemap = { status: sitemap.status, urls: [...sitemap.body.matchAll(/<loc>(.*?)<\/loc>/gu)].map((match) => match[1]) };
  if (robots.status !== 200 || !robots.body.includes('/sitemap.xml')) results.errors.push(`${name}: robots.txt check failed`);
  if (sitemap.status !== 200 || !results.sites[name].sitemap.urls.length) results.errors.push(`${name}: sitemap.xml check failed`);
}

// Representative live interactions.
{
  const site = sites.workkit;
  const page = await browser.newPage({ viewport });
  await page.goto(`${site.origin}/overtime-calculator.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('#ot-hours').fill('45'); await page.locator('#ot-rate').fill('20'); await page.locator('#overtime-form button[type=submit]').click();
  const pay = await page.locator('#ot-pay').innerText();
  results.sites.workkit.interaction = { pay };
  if (pay !== '$950.00') results.errors.push(`WorkKit production calculation returned ${pay}`);
  await page.close();
}
{
  const site = sites.workkit;
  const page = await browser.newPage({ viewport });
  await page.goto(`${site.origin}/time-card-calculator.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('.shift-day').first().selectOption('Sunday');
  await page.locator('.shift-start').first().fill('22:00'); await page.locator('.shift-end').first().fill('06:00');
  await page.locator('#add-shift').click();
  await page.locator('.shift-day').nth(1).selectOption('Monday');
  await page.locator('.shift-start').nth(1).fill('04:00'); await page.locator('.shift-end').nth(1).fill('08:00');
  await page.locator('#calculate').click();
  const overlapMessage = await page.locator('#form-message').innerText();
  results.sites.workkit.overlapInteraction = { message: overlapMessage, total: await page.locator('#total-hours').innerText() };
  if (!overlapMessage.includes('Shifts overlap') || results.sites.workkit.overlapInteraction.total !== '—') results.errors.push('WorkKit did not block overlapping Sunday/Monday shifts');
  await page.close();
}
{
  const site = sites.quickkit;
  const page = await browser.newPage({ viewport });
  await page.goto(`${site.origin}/text-tools.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('#text-input').fill('one  two'); await page.locator('[data-clean="trim"]').click();
  const clean = await page.locator('#text-input').inputValue();
  results.sites.quickkit.interaction = { cleaned: clean };
  if (clean !== 'one two') results.errors.push(`QuickKit production cleanup returned ${JSON.stringify(clean)}`);
  await page.close();
}
{
  const site = sites.quickkit;
  const page = await browser.newPage({ viewport });
  const sample = await PDFDocument.create(); sample.addPage([480, 640]);
  await page.goto(`${site.origin}/pdf-editor.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('#pdf-source').setInputFiles({ name: 'production-check.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await sample.save()) });
  await page.locator('#pdf-workspace').waitFor({ state: 'visible' });
  await page.locator('[data-tool="text"]').click();
  await page.locator('#pdf-page-stage').press('Enter');
  const placed = await page.locator('.pdf-overlay-text').count();
  const downloadWait = page.waitForEvent('download'); await page.locator('#download-pdf').click();
  const download = await downloadWait; const downloaded = await PDFDocument.load(await readFile(await download.path()));
  results.sites.quickkit.pdfEditorInteraction = { placed, pages: downloaded.getPageCount(), filename: download.suggestedFilename() };
  if (placed !== 1 || downloaded.getPageCount() !== 1) results.errors.push('QuickKit PDF editor production flow failed');
  await page.close();
}
{
  const site = sites.formready;
  const page = await browser.newPage({ viewport });
  await page.goto(`${site.origin}/image-preparer.html`, { waitUntil: 'domcontentloaded' });
  const bytes = await page.evaluate(() => new Promise((resolve) => {
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 180;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#32515d'; ctx.fillRect(0, 0, 240, 180); ctx.fillStyle = '#edb841'; ctx.fillRect(60, 40, 110, 90);
    canvas.toBlob(async (blob) => resolve(Array.from(new Uint8Array(await blob.arrayBuffer()))), 'image/png');
  }));
  await page.locator('#form-image').setInputFiles({ name: 'production-smoke.png', mimeType: 'image/png', buffer: Buffer.from(bytes) });
  await page.locator('.cropper-container').waitFor();
  await page.locator('#target-width').fill('120'); await page.locator('#target-height').fill('140'); await page.locator('#max-kb').fill('100');
  await page.locator('#prepare-image').click(); await page.locator('#prepare-result .validation-result').waitFor();
  const state = await page.locator('.ready-badge').innerText();
  const checks = await page.locator('.checks').innerText();
  results.sites.formready.interaction = { state, checks };
  if (state.toLowerCase() !== 'ready to review' || !checks.includes('120 × 140px')) results.errors.push(`FormReady production image check failed: ${state}; ${checks}`);
  await page.close();
}

const challengeRequests = results.requests.filter((request) => request.method === 'POST' && request.url.includes('/cdn-cgi/challenge-platform/'));
results.cloudflareSecurityChallengeRequests = challengeRequests.length;
const nonGet = results.requests.filter((request) => request.method !== 'GET' && !request.url.includes('/cdn-cgi/challenge-platform/') && !request.url.startsWith('data:') && !request.url.startsWith('blob:'));
if (nonGet.length) results.errors.push(`Unexpected non-GET production requests: ${JSON.stringify(nonGet)}`);
results.summary = { pages: Object.values(results.sites).reduce((sum, site) => sum + site.pages.length, 0), failures: results.errors.length, errors: results.errors };
await writeFile(path.join(root, 'qa-results', 'production-smoke-results.json'), JSON.stringify(results, null, 2));
await browser.close();
console.log(JSON.stringify(results.summary, null, 2));
if (results.errors.length) process.exitCode = 1;
