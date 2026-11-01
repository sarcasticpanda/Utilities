import { webkit } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const origin = process.env.QUICKKIT_ORIGIN || 'https://quickkit-browser-tools.pages.dev';
const fixturePath = resolve('qa-results/video-fixtures/quickkit-test-cf6045.webm');
const fixture = await readFile(fixturePath);
const browser = await webkit.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
const checks = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass: Boolean(pass), detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

try {
  await page.goto(`${origin}/video-tools.html`, { waitUntil: 'networkidle' });
  const capability = await page.evaluate(() => ({ videoDecoder: typeof VideoDecoder, videoEncoder: typeof VideoEncoder, mediaRecorder: typeof MediaRecorder }));
  check('WebKit video route loads', await page.title().then((value) => value.includes('Video')));
  await page.locator('#video-files').setInputFiles({ name: 'quickkit-test-cf6045.webm', mimeType: 'video/webm', buffer: fixture });
  await page.waitForFunction(() => {
    const status = document.querySelector('#video-status');
    return status?.classList.contains('is-error') || !document.querySelector('#video-run-compress').disabled;
  }, null, { timeout: 30000 });
  const state = await page.evaluate(() => ({ status: document.querySelector('#video-status').innerText, canCompress: !document.querySelector('#video-run-compress').disabled }));
  const unsupported = capability.videoDecoder === 'undefined' || capability.videoEncoder === 'undefined';
  if (unsupported) {
    check('unsupported WebKit codec path explains the limitation', !state.canCompress && /decode|codec|browser/i.test(state.status), `${capability.videoDecoder}/${capability.videoEncoder}: ${state.status}`);
  } else {
    check('WebKit can prepare a decodable video source', state.canCompress, state.status);
  }
  const layout = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  check('WebKit mobile layout has no horizontal overflow', layout.scroll <= layout.client + 1, `${layout.scroll}px / ${layout.client}px`);
  check('WebKit has no unhandled page/console errors', errors.length === 0, errors.join(' | '));
  if (unsupported) console.log('LIMITATION WebKit Playwright build lacks WebCodecs; it cannot validate Safari editing support.');
} catch (error) {
  errors.push(error?.message || String(error));
  checks.push({ name: 'WebKit capability QA completes', pass: false, detail: error?.message || String(error) });
  console.error(error?.stack || error);
} finally {
  await browser.close();
}

const failed = checks.filter((item) => !item.pass);
const report = { date: new Date().toISOString().slice(0, 10), browser: 'Playwright WebKit', origin, checks, errors, limitation: 'Playwright WebKit build does not include the Safari browser feature set.' };
const reportPath = resolve('qa-results/video-tools-webkit-smoke.json');
await mkdir(resolve('qa-results'), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`WebKit capability QA: ${checks.length - failed.length}/${checks.length} passed; ${failed.length} failed.\nReport: ${reportPath}`);
if (failed.length) process.exitCode = 1;
