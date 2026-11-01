import { chromium, firefox, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const origin = process.env.QUICKKIT_ORIGIN || 'http://127.0.0.1:4175';
const browserName = process.env.PLAYWRIGHT_BROWSER || 'chromium';
const browserType = { chromium, firefox, webkit }[browserName];
if (!browserType) throw new Error(`Unknown Playwright browser: ${browserName}`);
const browser = await browserType.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
const checks = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass: Boolean(pass), detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

async function generateClip(color, freq) {
  return page.evaluate(async ({ color, freq }) => {
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(20);
    const audio = new AudioContext();
    await audio.resume();
    const oscillator = audio.createOscillator(); oscillator.frequency.value = freq;
    const gain = audio.createGain(); gain.gain.value = 0.08;
    const destination = audio.createMediaStreamDestination(); oscillator.connect(gain).connect(destination);
    destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    const mimeType = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E', 'video/mp4'].find((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error('MediaRecorder could not create a browser-supported test clip');
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 450000, audioBitsPerSecond: 48000 });
    const chunks = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
    recorder.start(100);
    oscillator.start();
    const started = performance.now();
    while (performance.now() - started < 3200) {
      ctx.fillStyle = color; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ff00aa'; ctx.fillRect(0, 0, 30, 30);
      ctx.fillStyle = '#182638'; ctx.font = 'bold 24px sans-serif'; ctx.fillText(`${color} ${Math.round((performance.now() - started) / 1000)}s`, 16, 50);
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    recorder.stop(); oscillator.stop(); await stopped; const audioState = audio.state; await audio.close();
    stream.getTracks().forEach((track) => track.stop());
    const blob = new Blob(chunks, { type: mimeType });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const fixtureUrl = URL.createObjectURL(blob);
    const fixtureVideo = document.createElement('video'); fixtureVideo.src = fixtureUrl;
    await new Promise((resolve, reject) => { fixtureVideo.onloadedmetadata = resolve; fixtureVideo.onerror = () => reject(new Error('Generated fixture has unreadable video metadata')); });
    const duration = fixtureVideo.duration;
    fixtureVideo.removeAttribute('src'); fixtureVideo.load(); URL.revokeObjectURL(fixtureUrl);
    let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
    const extension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
    return { name: `quickkit-test-${color.replace('#', '')}.${extension}`, mimeType, base64: btoa(binary), size: blob.size, duration, audioState };
  }, { color, freq });
}

function asFile(clip) { return { name: clip.name, mimeType: clip.mimeType, buffer: Buffer.from(clip.base64, 'base64') }; }
function makeWav(name, frequency, seconds = 2) {
  const sampleRate = 48000; const frames = Math.floor(sampleRate * seconds); const dataBytes = frames * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + dataBytes, 4); buffer.write('WAVE', 8);
  buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(dataBytes, 40);
  for (let frame = 0; frame < frames; frame++) {
    const envelope = Math.min(1, frame / 1200, (frames - frame) / 1200);
    buffer.writeInt16LE(Math.round(Math.sin(2 * Math.PI * frequency * frame / sampleRate) * 9000 * envelope), 44 + frame * 2);
  }
  return { name, mimeType: 'audio/wav', buffer };
}
async function analyzeAudio(result, ranges) {
  return page.evaluate(async ({ base64, type, ranges }) => {
    const binary = atob(base64); const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const context = new AudioContext();
    const decoded = await context.decodeAudioData(bytes.buffer);
    const channel = decoded.getChannelData(0); const rate = decoded.sampleRate;
    const magnitudes = ranges.map(({ start, end, frequency }) => {
      const from = Math.floor(start * rate); const to = Math.min(channel.length, Math.floor(end * rate));
      let real = 0; let imaginary = 0; let squares = 0;
      for (let index = from; index < to; index++) {
        const sample = channel[index]; const angle = 2 * Math.PI * frequency * index / rate;
        real += sample * Math.cos(angle); imaginary += sample * Math.sin(angle); squares += sample * sample;
      }
      const count = Math.max(1, to - from);
      return { frequency, start, end, tone: Math.hypot(real, imaginary) / count * 2, rms: Math.sqrt(squares / count) };
    });
    await context.close();
    return { duration: decoded.duration, magnitudes };
  }, { base64: result.base64, type: result.type, ranges });
}
async function waitForResult() {
  await page.waitForFunction(() => !document.querySelector('#video-result').hidden || (document.querySelector('#video-progress-panel').hidden && document.querySelector('#video-status').classList.contains('is-error')), null, { timeout: 90000 });
  if (await page.locator('#video-status').evaluate((node) => node.classList.contains('is-error'))) throw new Error(`Video export failed: ${await page.locator('#video-status').innerText()}`);
  await page.waitForFunction(() => document.querySelector('#video-preview').readyState >= 1, null, { timeout: 20000 });
  return page.evaluate(async () => {
    const video = document.querySelector('#video-preview');
    const href = document.querySelector('#video-download').href;
    const response = await fetch(href);
    const bytes = await response.arrayBuffer();
    video.currentTime = Math.min(0.2, Math.max(0, video.duration - 0.1));
    await video.play(); await new Promise((resolve) => setTimeout(resolve, 500));
    const audioTrackCount = video.captureStream?.().getAudioTracks().length ?? 0;
    const decodedAudioBytes = video.webkitAudioDecodedByteCount ?? 0;
    video.pause();
    const data = new Uint8Array(bytes);
    let binary = '';
    for (let offset = 0; offset < data.length; offset += 0x8000) binary += String.fromCharCode(...data.subarray(offset, offset + 0x8000));
    return { duration: video.duration, width: video.videoWidth, height: video.videoHeight, playback: video.currentTime > 0, audioTrackCount, decodedAudioBytes, size: bytes.byteLength, type: response.headers.get('content-type'), base64: btoa(binary) };
  });
}
async function loadResult(result, name = 'quickkit-result.webm') {
  if (await page.locator('#video-file-summary').isVisible()) await page.locator('#video-clear').click();
  await page.locator('#video-files').setInputFiles({ name, mimeType: result.type || 'video/webm', buffer: Buffer.from(result.base64, 'base64') });
  await page.waitForFunction(() => !document.querySelector('#video-file-summary').hidden, null, { timeout: 20000 });
  await page.waitForFunction(() => document.querySelector('#video-run-trim').disabled === false, null, { timeout: 10000 });
  return page.locator('#video-file-details').innerText();
}
async function sampleFramePixel(result, time, x = 300, y = 150) {
  return page.evaluate(async ({ base64, type, time, x, y }) => {
    const binary = atob(base64); const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    const video = document.createElement('video'); video.muted = true;
    const metadata = new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = () => reject(new Error('Cannot load generated joined output for order check')); });
    video.src = url;
    await metadata;
    await new Promise((resolve, reject) => {
      video.addEventListener('seeked', resolve, { once: true });
      video.onerror = () => reject(new Error('Cannot seek generated joined output'));
      video.currentTime = Math.min(time, video.duration - 0.05);
    });
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const context = canvas.getContext('2d'); context.drawImage(video, 0, 0);
    const pixel = [...context.getImageData(x, y, 1, 1).data].slice(0, 3);
    const sample = { pixel, requestedTime: time, currentTime: video.currentTime, duration: video.duration };
    URL.revokeObjectURL(url); video.removeAttribute('src'); video.load();
    return sample;
  }, { base64: result.base64, type: result.type, time, x, y });
}
function colorDistance(sample, expected) { return Math.sqrt(sample.pixel.reduce((sum, value, index) => sum + (value - expected[index]) ** 2, 0)); }

try {
  await page.goto(`${origin}/video-tools.html`, { waitUntil: 'networkidle' });
  check('video route and controls load', await page.title().then((t) => t.includes('Video')) && await page.locator('#video-run-compress').count() === 1);
  check('starts with compression selected', await page.locator('#video-tab-compress').getAttribute('aria-selected') === 'true');
  const clipA = await generateClip('#cf6045', 440);
  const clipB = await generateClip('#3973b9', 660);
  check('generated audio source context is running', clipA.audioState === 'running', clipA.audioState);
  if (process.env.QA_SAVE_FIXTURES === '1') {
    const fixtureDir = resolve('qa-results/video-fixtures');
    await mkdir(fixtureDir, { recursive: true });
    for (const clip of [clipA, clipB]) await writeFile(resolve(fixtureDir, clip.name), Buffer.from(clip.base64, 'base64'));
  }
  check('generated short audio/video source clips', clipA.size > 10000 && clipB.size > 10000, `${clipA.size} B and ${clipB.size} B`);
  const sourceColorA = await sampleFramePixel(clipA, 0.6); const sourceColorB = await sampleFramePixel(clipB, 0.6);
  check('generated source clips have distinct visual markers', colorDistance(sourceColorA, [207, 96, 69]) < 45 && colorDistance(sourceColorB, [57, 115, 185]) < 45, `A ${sourceColorA.pixel.join(',')} · B ${sourceColorB.pixel.join(',')}`);

  await page.locator('#video-files').setInputFiles(asFile(clipA));
  await page.waitForFunction(() => document.querySelector('#video-run-compress').disabled === false, null, { timeout: 20000 });
  const sourceMetadata = await page.locator('#video-file-details').innerText();
  check('source metadata is read', sourceMetadata.includes('320 × 180') && sourceMetadata.includes('0:03'), sourceMetadata);
  check('compress keeps trim timeline out of the way', await page.locator('#video-editor-dock').isHidden());
  await page.locator('#video-tab-trim').click();
  check('trim keeps the plus beside Keep/Remove and the timeline dock shows export and synced preview', await page.locator('#video-editor-dock').isVisible() && await page.locator('#video-panel-trim #video-add-trim-range').isVisible() && await page.locator('#video-add-trim-range').innerText().then((text) => text.includes('+')) && await page.locator('#video-editor-dock #video-add-trim-range').count() === 0 && await page.locator('#video-run-trim').isVisible() && await page.locator('.timeline-playhead').count() === 1 && await page.locator('#video-timecode').innerText().then((text) => text.includes('0:03')));
  const dockLayout = await page.locator('#video-editor-dock').evaluate((element) => ({ position: getComputedStyle(element).position, bottom: element.getBoundingClientRect().bottom, viewport: window.innerHeight, tracks: element.querySelectorAll('.timeline-lane').length }));
  check('timeline stays docked at the bottom like an editing workspace', dockLayout.position === 'fixed' && dockLayout.bottom <= dockLayout.viewport && dockLayout.bottom >= dockLayout.viewport - 40 && dockLayout.tracks >= 1, JSON.stringify(dockLayout));
  await page.locator('#video-tab-crop').click();
  check('crop uses its own frame selection instead of the trim timeline dock', await page.locator('#video-editor-dock').isHidden() && await page.locator('#video-crop-adjust').isVisible() && await page.locator('#video-crop-zoom').isVisible());
  await page.locator('#video-tab-trim').click();
  await page.locator('#video-scrub').fill('1.2');
  await page.waitForFunction(() => document.querySelectorAll('#video-timeline .timeline-filmstrip img').length === 8, null, { timeout: 10000 });
  await page.evaluate(() => { window.__trimPointerTrace = []; document.addEventListener('pointerdown', (event) => { if (event.target.closest?.('#video-timeline .timeline-rail')) window.__trimPointerTrace.push({ target: event.target.tagName, part: event.target.closest('[data-trim-part]')?.dataset.trimPart || '', x: event.clientX }); }, true); });
  const trimRail = await page.locator('#video-timeline .timeline-rail').boundingBox();
  const endHandleBounds = await page.locator('#video-timeline [data-trim-part="end"]').boundingBox();
  await page.mouse.move(trimRail.x + trimRail.width - 1, trimRail.y + trimRail.height / 2);
  await page.mouse.down();
  await page.mouse.move(trimRail.x + trimRail.width * (2.5 / Number(await page.locator('#video-trim-end').getAttribute('max'))), trimRail.y + trimRail.height / 2, { steps: 6 });
  await page.mouse.up();
  const startHandle = await page.locator('#video-timeline [data-trim-part="start"]').boundingBox();
  await page.mouse.move(startHandle.x + startHandle.width / 2, startHandle.y + startHandle.height / 2);
  await page.mouse.down();
  await page.mouse.move(trimRail.x + trimRail.width * (.5 / Number(await page.locator('#video-trim-end').getAttribute('max'))), trimRail.y + trimRail.height / 2, { steps: 6 });
  await page.mouse.up();
  const dragDetails = { start: await page.locator('#video-trim-start').inputValue(), end: await page.locator('#video-trim-end').inputValue(), duration: await page.locator('#video-trim-end').getAttribute('max'), filmstripFrames: await page.locator('#video-timeline .timeline-filmstrip img').count(), previewTime: await page.locator('#video-preview').evaluate((video) => video.currentTime), summary: await page.locator('#video-trim-range-summary').innerText(), trimRail: trimRail, endHandle: endHandleBounds, pointer: await page.evaluate(() => window.__trimPointerTrace) };
  check('filmstrip trim handles drag to precise in/out times and sync to the preview', await page.locator('#video-trim-ranges').isVisible() && Number(dragDetails.start) === .5 && Number(dragDetails.end) === 2.5 && dragDetails.filmstripFrames === 8 && Math.abs(dragDetails.previewTime - 1.2) < .3, JSON.stringify(dragDetails));
  await mkdir(resolve('qa-results/readme-parts'), { recursive: true });
  await page.locator('#video-editor-dock').screenshot({ path: resolve('qa-results/readme-parts/quickkit-video-trim-redesign.png') });
  await page.locator('#video-timeline [data-trim-part="start"]').focus();
  await page.keyboard.press('ArrowRight');
  const keyboardTrimValue = Number(await page.locator('#video-trim-start').inputValue());
  check('keyboard trim handles provide fine nudging and an exact accessible value', keyboardTrimValue === .6 && await page.locator('#video-timeline [data-trim-part="start"]').getAttribute('aria-valuetext') === '0:00.60');
  await page.locator('#video-reset-trim').click();
  check('use full video resets both range handles and exact time fields', Number(await page.locator('#video-trim-start').inputValue()) === 0 && Math.abs(Number(await page.locator('#video-trim-end').inputValue()) - Number(await page.locator('#video-trim-end').getAttribute('max'))) < .05, `${await page.locator('#video-trim-start').inputValue()}–${await page.locator('#video-trim-end').inputValue()} / ${await page.locator('#video-trim-end').getAttribute('max')}`);
  await page.locator('#video-trim-start').fill('0.5');
  await page.locator('#video-trim-end').fill('2.5');
  check('exact keep-from and keep-to inputs update the timeline summary', await page.locator('#video-trim-range-summary').innerText().then((text) => text.includes('0:00') && text.includes('0:02')));
  await page.locator('#video-scrub').fill('1.2');
  await page.locator('#video-split-at-playhead').click();
  check('split at playhead creates two editable timeline sections', await page.locator('#video-tab-join').getAttribute('aria-selected') === 'true' && await page.locator('#video-segments .video-segment').count() === 2);
  await page.locator('#video-clear').click();
  await page.locator('#video-files').setInputFiles(asFile(clipA));
  await page.waitForFunction(() => document.querySelector('#video-run-compress').disabled === false, null, { timeout: 20000 });
  await page.locator('#video-tab-compress').click();

  await page.locator('#video-run-compress').click();
  const compressed = await waitForResult();
  check('compression creates playable export with audio', compressed.size > 1000 && compressed.playback && compressed.width === 320 && compressed.height === 180 && (compressed.audioTrackCount > 0 || compressed.decodedAudioBytes > 0), `${compressed.size} B · ${compressed.duration.toFixed(2)} s · audio tracks ${compressed.audioTrackCount}, decoded ${compressed.decodedAudioBytes} B`);
  const compressedDetails = await loadResult(compressed);
  check('compressed export reopens in the tool', compressedDetails.includes('320 × 180'), compressedDetails);

  await page.locator('#video-tab-crop').click();
  await page.locator('#video-crop-ratio').selectOption('1');
  check('square crop preview and export become available', await page.locator('#video-crop-summary').innerText().then((text) => text.includes('180 × 180')) && await page.locator('#video-run-crop').isEnabled());
  const cropScreenshot = resolve('qa-results/readme-parts/quickkit-video-crop.png');
  await mkdir(resolve('qa-results/readme-parts'), { recursive: true });
  await page.locator('#video-panel-crop').screenshot({ path: cropScreenshot });
  await page.locator('#video-run-crop').click();
  const cropped = await waitForResult();
  const cropCorner = await sampleFramePixel(cropped, 0.5, 5, 5);
  check('square crop exports square pixels and removes the outside-frame marker', cropped.width === 180 && cropped.height === 180 && colorDistance(cropCorner, [207, 96, 69]) < 55, `${cropped.width} × ${cropped.height} · corner ${cropCorner.pixel.join(',')}`);
  const croppedDetails = await loadResult(cropped, 'quickkit-cropped.webm');
  check('cropped export reopens with square dimensions', croppedDetails.includes('180 × 180'), croppedDetails);

  await page.locator('#video-clear').click();
  await page.locator('#video-files').setInputFiles(asFile(clipA));
  await page.waitForFunction(() => document.querySelector('#video-run-crop').disabled === false, null, { timeout: 20000 });
  await page.locator('#video-crop-ratio').selectOption('free');
  await page.locator('#video-crop-adjust').click();
  const cropBounds = await page.locator('#video-crop-overlay').boundingBox();
  await page.evaluate(() => { window.__cropPointerTrace = []; for (const name of ['pointerdown', 'pointermove', 'pointerup']) document.addEventListener(name, (event) => { if (event.target.closest?.('#video-crop-overlay')) { const rect = document.querySelector('#video-crop-overlay').getBoundingClientRect(); window.__cropPointerTrace.push({ name, x: event.clientX, y: event.clientY, top: rect.top, height: rect.height }); } }, true); });
  await page.mouse.move(cropBounds.x + cropBounds.width * .20, cropBounds.y + cropBounds.height * .20);
  await page.mouse.down();
  await page.mouse.move(cropBounds.x + cropBounds.width * .70, cropBounds.y + cropBounds.height * .75, { steps: 8 });
  await page.mouse.up();
  const freeCropSummary = await page.locator('#video-crop-summary').innerText();
  const freeCropGeometry = await page.locator('#video-crop-selection').evaluate((element) => ({ left: element.style.left, top: element.style.top, width: element.style.width, height: element.style.height, overlay: element.parentElement.getBoundingClientRect().toJSON() }));
  const cropPointerTrace = await page.evaluate(() => window.__cropPointerTrace);
  check('free crop can be drawn over an exact frame area', /160 × 99 crop/u.test(freeCropSummary), `${freeCropSummary} · ${JSON.stringify(freeCropGeometry)} · ${JSON.stringify(cropPointerTrace.slice(0, 3))} … ${JSON.stringify(cropPointerTrace.slice(-2))}`);
  await page.mouse.move(cropBounds.x + cropBounds.width * .40, cropBounds.y + cropBounds.height * .40);
  await page.mouse.down();
  await page.mouse.move(cropBounds.x + cropBounds.width * .45, cropBounds.y + cropBounds.height * .45, { steps: 4 });
  await page.mouse.up();
  const movedCrop = await page.locator('#video-crop-selection').evaluate((element) => ({ left: parseFloat(element.style.left), top: parseFloat(element.style.top), width: parseFloat(element.style.width), height: parseFloat(element.style.height) }));
  check('dragging inside the crop box moves it without changing its size', Math.abs(movedCrop.left - 25) < .5 && Math.abs(movedCrop.top - 25) < .5 && Math.abs(movedCrop.width - 50) < .5 && Math.abs(movedCrop.height - 55) < .5, JSON.stringify(movedCrop));
  const cropHandle = await page.locator('#video-crop-selection [data-crop-handle="se"]').boundingBox();
  await page.mouse.move(cropHandle.x + cropHandle.width / 2, cropHandle.y + cropHandle.height / 2);
  await page.mouse.down();
  await page.mouse.move(cropBounds.x + cropBounds.width * .85, cropBounds.y + cropBounds.height * .85, { steps: 4 });
  await page.mouse.up();
  const resizedCropSummary = await page.locator('#video-crop-summary').innerText();
  check('corner handles resize the crop box to the new frame area', /192 × 108 crop/u.test(resizedCropSummary), resizedCropSummary);
  await page.locator('#video-crop-zoom').evaluate((element) => { element.value = '150'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  const zoomedCropSummary = await page.locator('#video-crop-summary').innerText();
  check('zoom in narrows the selected frame and updates export dimensions', /128 × 72 crop/u.test(zoomedCropSummary), zoomedCropSummary);
  await page.locator('#video-crop-zoom').evaluate((element) => { element.value = '50'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  const zoomedOutCropSummary = await page.locator('#video-crop-summary').innerText();
  check('zoom out expands the selected crop up to the full source frame', /320 × 180 crop/u.test(zoomedOutCropSummary), zoomedOutCropSummary);
  await page.locator('#video-crop-zoom').evaluate((element) => { element.value = '100'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('#video-run-crop').click();
  const freeCropped = await waitForResult();
  const freeCropCorner = await sampleFramePixel(freeCropped, .5, 2, 2);
  check('free crop exports the moved and resized region with its measured dimensions', freeCropped.width === 192 && freeCropped.height === 108 && colorDistance(freeCropCorner, [255, 0, 170]) > 80, `${freeCropped.width} × ${freeCropped.height} · corner ${freeCropCorner.pixel.join(',')}`);

  await page.locator('#video-tab-trim').click();
  await page.locator('#video-trim-start').fill('0.5');
  await page.locator('#video-trim-end').fill('1.7');
  await page.locator('#video-run-trim').click();
  const trimmed = await waitForResult();
  check('trim creates playable clip with audio and selected duration', trimmed.playback && trimmed.duration >= 1 && trimmed.duration <= 1.5 && (trimmed.audioTrackCount > 0 || trimmed.decodedAudioBytes > 0), `${trimmed.duration.toFixed(2)} s · audio tracks ${trimmed.audioTrackCount}, decoded ${trimmed.decodedAudioBytes} B`);
  const trimmedDetails = await loadResult(trimmed, 'quickkit-trimmed.webm');
  check('trimmed export reopens and reports duration', trimmedDetails.includes('0:01'), trimmedDetails);

  await page.locator('#video-tab-join').click();
  await page.locator('#video-files').setInputFiles([asFile(clipA), asFile(clipB)]);
  await page.waitForFunction(() => document.querySelectorAll('#video-segments > li').length === 2, null, { timeout: 20000 });
  check('join accepts two ordered files', await page.locator('#video-run-join').isEnabled() && await page.locator('#video-segments > li').count() === 2);
  await page.locator('#video-run-join').click();
  const joined = await waitForResult();
  check('join creates playable file with audio and combined duration', joined.playback && joined.duration >= 5.7 && joined.duration <= 6.8 && (joined.audioTrackCount > 0 || joined.decodedAudioBytes > 0), `${joined.duration.toFixed(2)} s · audio tracks ${joined.audioTrackCount}, decoded ${joined.decodedAudioBytes} B`);
  const firstNormal = await sampleFramePixel(joined, 0.4); const secondNormal = await sampleFramePixel(joined, joined.duration / 2 + 0.5);
  const colorA = [207, 96, 69]; const colorB = [57, 115, 185];
  check('joined video frames follow the selected clip order', colorDistance(firstNormal, colorA) + 30 < colorDistance(firstNormal, colorB) && colorDistance(secondNormal, colorB) + 30 < colorDistance(secondNormal, colorA), `first ${JSON.stringify(firstNormal)} · second ${JSON.stringify(secondNormal)}`);
  await page.locator('#video-segments [aria-label="Move clip 1 down"]').click();
  await page.locator('#video-run-join').click();
  const reordered = await waitForResult();
  const firstReordered = await sampleFramePixel(reordered, 0.4); const secondReordered = await sampleFramePixel(reordered, reordered.duration / 2 + 0.5);
  check('reordering changes the actual exported sequence', colorDistance(firstReordered, colorB) + 30 < colorDistance(firstReordered, colorA) && colorDistance(secondReordered, colorA) + 30 < colorDistance(secondReordered, colorB), `first ${JSON.stringify(firstReordered)} · second ${JSON.stringify(secondReordered)}`);
  const joinedDetails = await loadResult(joined, 'quickkit-joined.webm');
  check('joined export reopens in the tool', joinedDetails.includes('320 × 180'), joinedDetails);

  await page.locator('#video-tab-join').click();
  await page.locator('#video-clear').click();
  await page.locator('#video-files').setInputFiles(asFile(clipA));
  await page.waitForFunction(() => document.querySelectorAll('#video-segments > li').length === 1, null, { timeout: 20000 });
  await page.locator('#video-add-segment').click();
  const rows = page.locator('#video-segments > li');
  await rows.nth(0).getByLabel('Clip 1 keep to seconds').fill('1.0');
  await rows.nth(1).getByLabel('Clip 2 keep from seconds').fill('2.0');
  await page.locator('#video-run-join').click();
  const cut = await waitForResult();
  check('same-file middle cut joins retained sections with audio', cut.playback && cut.duration >= 1.8 && cut.duration <= 2.3 && (cut.audioTrackCount > 0 || cut.decodedAudioBytes > 0), `${cut.duration.toFixed(2)} s · audio tracks ${cut.audioTrackCount}, decoded ${cut.decodedAudioBytes} B`);

  await page.locator('#video-tab-trim').click();
  const cutSourceDuration = Number(await page.locator('#video-scrub').getAttribute('max'));
  await page.locator('#video-trim-start').fill('1.0');
  await page.locator('#video-trim-end').fill('2.0');
  await page.locator('#video-add-trim-range').click();
  await page.locator('#video-trim-remove').click();
  check('remove mode reuses the saved trim range and has no duplicate single-cut control', await page.locator('#video-trim-segments > li').count() === 1 && await page.locator('#video-trim-remove').getAttribute('aria-pressed') === 'true' && await page.locator('#video-run-remove-range').count() === 0 && (await page.locator('#video-trim-intent-help').innerText()).includes('cut out'));
  await page.locator('#video-run-trim').click();
  const removed = await waitForResult();
  check('Remove selected parts exports the remaining video around the saved cut', removed.playback && Math.abs(removed.duration - (cutSourceDuration - 1)) < .55 && removed.width > 0 && removed.height > 0, `${removed.duration.toFixed(2)} s from ${cutSourceDuration.toFixed(2)} s`);

  await page.locator('#video-clear').click();
  await page.locator('#video-tab-join').click();
  await page.locator('#video-files').setInputFiles([asFile(clipA), asFile(clipB)]);
  await page.waitForFunction(() => document.querySelectorAll('#video-segments > li').length === 2, null, { timeout: 20000 });
  const soundtrackA = makeWav('ambient-bed.wav', 523);
  const soundtrackB = makeWav('opening-sting.wav', 880);
  await page.evaluate(({ name, mimeType, base64 }) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const transfer = new DataTransfer(); transfer.items.add(new File([bytes], name, { type: mimeType }));
    document.querySelector('#soundtrack-dropzone').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, { name: soundtrackA.name, mimeType: soundtrackA.mimeType, base64: soundtrackA.buffer.toString('base64') });
  await page.waitForFunction(() => document.querySelectorAll('#soundtrack-list > .soundtrack-track').length === 1, null, { timeout: 20000 });
  await page.locator('#soundtrack-files').setInputFiles([soundtrackB]);
  await page.waitForFunction(() => document.querySelectorAll('#soundtrack-list > .soundtrack-track').length === 2, null, { timeout: 20000 });
  check('multiple soundtrack tracks decode locally', await page.locator('#soundtrack-list > .soundtrack-track').count() === 2);
  await page.getByLabel('Soundtrack 1 start on video (sec)').fill('3.5');
  await page.getByLabel('Soundtrack 1 use audio from (sec)').fill('0.25');
  await page.getByLabel('Soundtrack 1 use audio to (sec)').fill('1.25');
  await page.getByLabel('Soundtrack 2 start on video (sec)').fill('5.0');
  await page.getByLabel('Soundtrack 2 use audio from (sec)').fill('1.0');
  await page.getByLabel('Soundtrack 2 use audio to (sec)').fill('1.75');
  await page.getByLabel('Soundtrack 2 volume').fill('70');
  check('timeline reflects chosen soundtrack positions', await page.locator('#video-timeline .timeline-lane').count() === 3 && await page.locator('#video-timeline .timeline-block.audio').count() === 2);
  const videoScreenshot = resolve('qa-results/readme-parts/quickkit-video-editor.png');
  const soundtrackScreenshot = resolve('qa-results/readme-parts/quickkit-video-soundtracks.png');
  await mkdir(resolve('qa-results/readme-parts'), { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: videoScreenshot });
  await page.locator('.soundtrack-editor').screenshot({ path: soundtrackScreenshot });
  await page.locator('#video-run-join').click();
  const mixed = await waitForResult();
  const audioMix = await analyzeAudio(mixed, [
    { start: 1.2, end: 1.6, frequency: 523 }, { start: 3.7, end: 4.1, frequency: 523 },
    { start: 4.6, end: 4.9, frequency: 880 }, { start: 5.2, end: 5.5, frequency: 880 },
    { start: 0.7, end: 1.1, frequency: 440 }
  ]);
  const [tone523Before, tone523During, tone880Before, tone880During, original440] = audioMix.magnitudes;
  check('soundtrack placement and source trims reach the exported audio', mixed.playback && mixed.duration >= 5.7 && mixed.duration <= 6.8 && tone523During.tone > tone523Before.tone * 1.7 && tone880During.tone > tone880Before.tone * 1.7 && original440.tone > 0.03, `${mixed.duration.toFixed(2)} s · 523 Hz ${tone523Before.tone.toFixed(4)} → ${tone523During.tone.toFixed(4)} · 880 Hz ${tone880Before.tone.toFixed(4)} → ${tone880During.tone.toFixed(4)} · original 440 Hz ${original440.tone.toFixed(4)}`);
  await page.locator('#original-volume').fill('0');
  await page.locator('#video-run-join').click();
  const muted = await waitForResult();
  const mutedAudio = await analyzeAudio(muted, [{ start: 0.7, end: 1.1, frequency: 440 }, { start: 3.7, end: 4.1, frequency: 523 }]);
  const audioControlState = await page.evaluate(() => ({ keep: document.querySelector('#keep-original-audio').checked, volume: document.querySelector('#original-volume').value, status: document.querySelector('#video-status').textContent }));
  check('original audio volume control changes the exported mix', mutedAudio.magnitudes[0].tone < original440.tone * 0.35 && mutedAudio.magnitudes[1].tone > 0.08, `original ${original440.tone.toFixed(4)} → ${mutedAudio.magnitudes[0].tone.toFixed(4)} · soundtrack ${mutedAudio.magnitudes[1].tone.toFixed(4)} · ${JSON.stringify(audioControlState)}`);
  await page.locator('#keep-original-audio').uncheck();
  check('original-audio mute disables its level slider', await page.locator('#original-volume').isDisabled());
  const mixedDetails = await loadResult(mixed, 'quickkit-soundtrack-mix.webm');
  check('mixed export reopens with audio and video metadata', mixedDetails.includes('320 × 180') && (mixed.audioTrackCount > 0 || mixed.decodedAudioBytes > 0), mixedDetails);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#video-tab-join').click();
  const layout = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  check('mobile viewport has no horizontal page overflow', layout.scroll <= layout.client + 1, `${layout.scroll}px / ${layout.client}px`);
  await page.setViewportSize({ width: 320, height: 740 });
  const narrowLayout = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  check('320px phone viewport has no horizontal page overflow', narrowLayout.scroll <= narrowLayout.client + 1, `${narrowLayout.scroll}px / ${narrowLayout.client}px`);
  check('no browser runtime or console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
} catch (error) {
  console.error('SMOKE ERROR', error?.stack || error);
  errors.push(error?.message || String(error));
  checks.push({ name: 'browser QA script completes', pass: false, detail: error?.message || String(error) });
} finally {
  await browser.close();
}

const failed = checks.filter((item) => !item.pass);
console.log(`\nVideo browser QA: ${checks.length - failed.length}/${checks.length} passed; ${failed.length} failed.`);
const reportName = browserName === 'chromium' ? 'video-tools-browser-smoke.json' : `video-tools-browser-smoke-${browserName}.json`;
const reportPath = resolve('qa-results', reportName);
await mkdir(resolve('qa-results'), { recursive: true });
await writeFile(reportPath, `${JSON.stringify({ date: new Date().toISOString().slice(0, 10), browser: `Playwright ${browserName}`, origin, checks, errors }, null, 2)}\n`);
console.log(`Report: ${reportPath}`);
if (failed.length) process.exitCode = 1;
