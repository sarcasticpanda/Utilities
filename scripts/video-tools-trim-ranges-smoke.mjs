import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const origin = process.env.QUICKKIT_ORIGIN || 'http://127.0.0.1:4181';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
let demoVideo;
page.on('pageerror', (error) => errors.push(error.message));
const checks = [];
const check = (name, pass, detail = '') => { checks.push({ name, pass: Boolean(pass), detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };
async function loadSource() {
  if (await page.locator('#video-file-summary').isVisible()) await page.locator('#video-clear').click();
  await page.locator('#video-files').setInputFiles({ name: 'sample-video.webm', mimeType: 'video/webm', buffer: demoVideo });
  await page.waitForFunction(() => !document.querySelector('#video-file-summary').hidden, null, { timeout: 20000 });
  await page.locator('#video-tab-trim').click();
}
async function saveRange(start, end) {
  if ((await page.locator('#video-add-trim-range').innerText()).includes('Add another')) await page.locator('#video-add-trim-range').click();
  await page.locator('#video-trim-start').fill(start.toFixed(2));
  await page.locator('#video-trim-end').fill(end.toFixed(2));
  await page.locator('#video-add-trim-range').click();
}
async function exportRanges() {
  await page.locator('#video-preview-trim-ranges').click();
  await page.waitForFunction(() => !document.querySelector('#video-result').hidden || (document.querySelector('#video-progress-panel').hidden && document.querySelector('#video-status').classList.contains('is-error')), null, { timeout: 90000 });
  if (await page.locator('#video-status').evaluate((node) => node.classList.contains('is-error'))) throw new Error(await page.locator('#video-status').innerText());
  await page.waitForFunction(() => document.querySelector('#video-preview').readyState >= 1, null, { timeout: 20000 });
  return page.locator('#video-preview').evaluate((video) => ({ duration: video.duration, width: video.videoWidth, height: video.videoHeight, url: video.currentSrc, download: document.querySelector('#video-download').href }));
}
try {
  await page.goto(`${origin}/video-tools.html`, { waitUntil: 'networkidle' });
  demoVideo = Buffer.from(await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
    const context = canvas.getContext('2d'); const stream = canvas.captureStream(24); const chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    recorder.addEventListener('dataavailable', (event) => { if (event.data.size) chunks.push(event.data); });
    const stopped = new Promise((resolve) => recorder.addEventListener('stop', resolve, { once: true }));
    const start = performance.now();
    const draw = () => {
      const t = (performance.now() - start) / 1000;
      const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#254a67'); gradient.addColorStop(1, '#4d8f88');
      context.fillStyle = gradient; context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#ffffff20'; context.fillRect(0, 250, canvas.width, 110);
      context.fillStyle = '#f2c67d'; context.beginPath(); context.arc(100 + (t * 105) % 440, 180, 48, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#dbeef0'; context.beginPath(); context.arc(480, 105, 22, 0, Math.PI * 2); context.fill();
    };
    draw(); recorder.start(100); const timer = setInterval(draw, 40);
    await new Promise((resolve) => setTimeout(resolve, 3200)); clearInterval(timer); recorder.stop(); await stopped;
    for (const track of stream.getTracks()) track.stop();
    const blob = new Blob(chunks, { type: 'video/webm' }); const binary = new Uint8Array(await blob.arrayBuffer());
    let output = ''; for (let offset = 0; offset < binary.length; offset += 0x8000) output += String.fromCharCode(...binary.subarray(offset, offset + 0x8000));
    return btoa(output);
  }), 'base64');
  await loadSource();
  const sourceDuration = Number(await page.locator('#video-scrub').getAttribute('max'));
  check('Trim exposes the plus action and export within its timeline dock', await page.locator('#video-editor-dock').isVisible() && await page.locator('#video-add-trim-range').isVisible() && (await page.locator('#video-add-trim-range').innerText()).includes('+') && await page.locator('#video-run-trim').isVisible());
  await saveRange(.30, .90);
  check('first range saves, appears in the dock and offers another plus action', await page.locator('#video-trim-segments > li').count() === 1 && await page.locator('#video-trim-segments').isVisible() && (await page.locator('#video-add-trim-range').innerText()).includes('Add another'));
  await page.locator('#video-add-trim-range').click();
  await page.locator('#video-trim-start').fill('.50'); await page.locator('#video-trim-end').fill('.80');
  await page.locator('#video-add-trim-range').click();
  check('overlapping saved ranges are rejected with a clear message', await page.locator('#video-status').innerText().then((text) => text.includes('overlaps')) && await page.locator('#video-trim-segments > li').count() === 1);
  await saveRange(1.80, 2.40);
  check('two distinct ranges appear on timeline and in editable list', await page.locator('#video-trim-segments > li').count() === 2 && await page.locator('#video-timeline .timeline-trim-saved').count() === 2);
  const rail = await page.locator('#video-timeline .timeline-rail').boundingBox();
  const firstStart = await page.locator('#video-timeline .timeline-trim-saved [data-trim-range-id] [data-trim-part="start"], #video-timeline .timeline-trim-saved[data-trim-range-id] [data-trim-part="start"]').first().boundingBox();
  await page.mouse.move(firstStart.x + firstStart.width / 2, firstStart.y + firstStart.height / 2); await page.mouse.down();
  await page.mouse.move(rail.x + rail.width * (.40 / sourceDuration), rail.y + rail.height / 2, { steps: 6 }); await page.mouse.up();
  const draggedStart = Number(await page.locator('#video-trim-segments input[aria-label="Part 1 start time in seconds"]').inputValue());
  check('saved range handles can be dragged and update the time list', Math.abs(draggedStart - .40) < .08, `${draggedStart.toFixed(2)} seconds`);
  await page.screenshot({ path: resolve('qa-results/readme-parts/quickkit-video-multi-trim.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#video-add-trim-range').scrollIntoViewIfNeeded();
  const mobileTrim = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, addButton: document.querySelector('#video-add-trim-range').getBoundingClientRect().width, dockBottom: document.querySelector('#video-editor-dock').getBoundingClientRect().bottom, dockTop: document.querySelector('#video-editor-dock').getBoundingClientRect().top, viewportHeight: innerHeight }));
  check('multi-range controls remain visible and usable without overflow on phone width', mobileTrim.width === mobileTrim.viewport && mobileTrim.addButton > 0 && mobileTrim.dockBottom <= mobileTrim.viewportHeight && mobileTrim.dockTop < mobileTrim.dockBottom, JSON.stringify(mobileTrim));
  await page.setViewportSize({ width: 1440, height: 1000 });
  const keep = await exportRanges();
  check('keep mode joins both parts into a playable downloadable preview', Math.abs(keep.duration - 1.3) < .5 && keep.width > 0 && keep.height > 0 && Boolean(keep.download));

  await loadSource();
  for (const [start, end] of [[.15, .35], [.55, .8], [1.05, 1.3], [1.55, 1.8], [2.25, 2.6]]) await saveRange(start, end);
  check('plus action saves five separate ranges in one source clip', await page.locator('#video-trim-segments > li').count() === 5 && (await page.locator('#video-trim-saved-count').innerText()).includes('5 parts'));

  await loadSource();
  await saveRange(.50, .90);
  await page.locator('#video-add-trim-range').click();
  await saveRange(1.80, 2.20);
  await page.locator('#video-trim-remove').click();
  check('remove mode explains that selected parts become cuts', (await page.locator('#video-trim-intent-help').innerText()).includes('cut out'));
  const remove = await exportRanges();
  check('remove mode cuts both parts and previews the remaining video', Math.abs(remove.duration - (sourceDuration - .8)) < .55 && remove.width > 0 && remove.height > 0 && Boolean(remove.download), `${remove.duration.toFixed(2)}s from ${sourceDuration.toFixed(2)}s`);
  check('no browser runtime errors', errors.length === 0, errors.join(' | '));
  const result = { date: new Date().toISOString(), browser: 'Playwright Chromium', origin, sourceDuration, checks, errors };
  await writeFile(resolve('qa-results/video-tools-trim-ranges-smoke.json'), JSON.stringify(result, null, 2));
  if (checks.some((item) => !item.pass) || errors.length) process.exitCode = 1;
} catch (error) {
  errors.push(error.message); console.error(`SMOKE ERROR ${error.message}`);
  await writeFile(resolve('qa-results/video-tools-trim-ranges-smoke.json'), JSON.stringify({ date: new Date().toISOString(), browser: 'Playwright Chromium', origin, checks, errors }, null, 2));
  process.exitCode = 1;
} finally { await browser.close(); }
