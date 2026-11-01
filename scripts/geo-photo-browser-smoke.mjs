import { chromium } from 'playwright';
import piexif from 'piexifjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const origin = process.env.QUICKKIT_ORIGIN || 'http://127.0.0.1:4175';
const browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['geolocation', 'camera'], geolocation: { latitude: 26.8467, longitude: 80.9462 } });
const page = await context.newPage();
const checks = []; const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
const check = (name, pass, detail = '') => { checks.push({ name, pass: Boolean(pass), detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };

function decodeRational(value) { return value[0] / value[1]; }
function dmsToDecimal(values) { return decodeRational(values[0]) + decodeRational(values[1]) / 60 + decodeRational(values[2]) / 3600; }

async function makePng() {
  return page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 260;
    const context = canvas.getContext('2d'); context.fillStyle = '#3973b9'; context.fillRect(0, 0, 400, 260);
    context.fillStyle = '#fff'; context.font = 'bold 30px Arial'; context.fillText('QuickKit geo test', 26, 80);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return btoa(binary);
  });
}

async function makeMapTile() {
  return page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = '#e9e7d9'; context.fillRect(0, 0, 256, 256);
    context.fillStyle = '#cfe0c7'; context.fillRect(12, 20, 73, 57); context.fillRect(166, 18, 72, 84); context.fillRect(22, 168, 80, 66); context.fillRect(154, 165, 89, 70);
    context.strokeStyle = '#fff'; context.lineWidth = 17; context.beginPath(); context.moveTo(-12, 132); context.bezierCurveTo(80, 101, 136, 177, 270, 127); context.stroke();
    context.strokeStyle = '#e2cfa6'; context.lineWidth = 5; context.beginPath(); context.moveTo(122, -12); context.bezierCurveTo(100, 78, 157, 165, 128, 270); context.stroke();
    context.strokeStyle = '#fff'; context.lineWidth = 3; context.beginPath(); context.moveTo(26, 0); context.lineTo(56, 256); context.moveTo(203, 0); context.lineTo(191, 256); context.stroke();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return btoa(binary);
  });
}

try {
  const mapPixel = Buffer.from(await makeMapTile(), 'base64');
  const geocoderRequests = [];
  const mapTileRequests = [];
  await page.route('https://tile.openstreetmap.org/**', async (route) => { mapTileRequests.push(route.request().url()); return route.fulfill({ status: 200, contentType: 'image/png', body: mapPixel }); });
  await page.route('https://nominatim.openstreetmap.org/**', (route) => {
    const url = new URL(route.request().url()); geocoderRequests.push(url.toString());
    const result = { place_id: 1, lat: '17.4348000', lon: '78.4160000', name: 'Raintree Park', display_name: 'Raintree Park, Jubilee Hills, Hyderabad, Telangana, India', address: { park: 'Raintree Park', suburb: 'Jubilee Hills', city: 'Hyderabad' } };
    return route.fulfill({ status: 200, contentType: 'application/json', body: url.pathname.endsWith('/search') ? JSON.stringify([result]) : JSON.stringify(result) });
  });
  await page.goto(`${origin}/geo-photo.html`, { waitUntil: 'networkidle' });
  check('geo-photo route and metadata controls load', await page.title().then((title) => title.includes('Geo Tag')) && await page.locator('#geo-create').count() === 1);
  check('map-card starts in the lower-left corner shown in the reference photo', await page.locator('#geo-position').inputValue() === 'bottom-left');
  check('export disabled before a photo and location are supplied', await page.locator('#geo-create').isDisabled());
  await page.setViewportSize({ width: 390, height: 844 });
  const cameraEntry = await page.locator('#geo-camera-open').evaluate((button) => {
    const bounds = button.getBoundingClientRect();
    return { inPreview: Boolean(button.closest('.geo-preview-panel')), visibleAboveFold: bounds.top >= 0 && bounds.bottom <= window.innerHeight, label: button.innerText.trim() };
  });
  check('camera action is clear and visible above the photo preview on a phone', cameraEntry.inPreview && cameraEntry.visibleAboveFold && cameraEntry.label === 'Use camera', JSON.stringify(cameraEntry));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#geo-camera-open').click();
  await page.waitForFunction(() => document.querySelector('#geo-camera-video').videoWidth > 0, null, { timeout: 15000 });
  check('live camera opens beside the photo preview after the user requests it', await page.locator('#geo-camera-panel').isVisible() && await page.locator('#geo-camera-capture').isEnabled() && await page.locator('#geo-preview-frame').isHidden() && await page.locator('#geo-camera-status').innerText().then((text) => text.includes('Camera ready')));
  await page.locator('#geo-camera-flip').click();
  await page.waitForFunction(() => document.querySelector('#geo-camera-flip').dataset.facingMode === 'user' && !document.querySelector('#geo-camera-capture').disabled);
  const frontCameraRequested = await page.locator('#geo-camera-flip').getAttribute('data-facing-mode') === 'user';
  await page.locator('#geo-camera-flip').click();
  await page.waitForFunction(() => document.querySelector('#geo-camera-flip').dataset.facingMode === 'environment' && !document.querySelector('#geo-camera-capture').disabled);
  const rearCameraRequested = await page.locator('#geo-camera-flip').getAttribute('data-facing-mode');
  check('front/back camera switch action toggles the requested facing mode', frontCameraRequested && rearCameraRequested === 'environment', `front=${frontCameraRequested}; rear=${rearCameraRequested}; status=${await page.locator('#geo-camera-status').innerText()}`);
  await page.locator('#geo-date').fill('2001-01-01T00:00');
  const captureStartedAt = Date.now();
  await page.locator('#geo-camera-capture').click();
  await page.waitForFunction(() => document.querySelector('#geo-preview-image').naturalWidth > 0, null, { timeout: 15000 });
  const capturedStampTime = new Date(await page.locator('#geo-date').inputValue()).getTime();
  check('camera capture becomes a local editable photo, stops the stream and uses capture time', await page.locator('#geo-upload-title').innerText().then((text) => text.includes('quickkit-camera-')) && await page.locator('#geo-camera-panel').isHidden() && await page.locator('#geo-preview-frame').isVisible() && await page.locator('#geo-camera-status').innerText().then((text) => text.includes('captured and ready')) && capturedStampTime >= captureStartedAt - 60000 && capturedStampTime <= Date.now() + 60000, new Date(capturedStampTime).toISOString());
  await page.locator('#geo-camera-open').click();
  await page.waitForFunction(() => document.querySelector('#geo-camera-video').videoWidth > 0, null, { timeout: 15000 });
  await page.locator('#geo-clear').click();
  check('Start over restores the photo preview and closes an active camera', await page.locator('#geo-preview-frame').isVisible() && await page.locator('#geo-camera-panel').isHidden() && await page.locator('#geo-camera-video').evaluate((video) => !video.srcObject));
  await page.locator('#geo-camera-open').click();
  await page.waitForFunction(() => document.querySelector('#geo-camera-video').videoWidth > 0, null, { timeout: 15000 });
  await page.locator('#geo-camera-tag-location').click();
  await page.waitForFunction(() => !document.querySelector('#geo-result').hidden, null, { timeout: 20000 });
  check('Capture and tag current location adds a nearby place label and creates the GPS photo', await page.locator('#geo-preview-caption').innerText().then((text) => text.includes('Tagged JPEG')) && await page.locator('#geo-location-status').innerText().then((text) => text.includes('Location ready')) && await page.locator('#geo-place').inputValue() === 'Raintree Park' && await page.locator('#geo-camera-video').evaluate((video) => !video.srcObject));
  await page.locator('#geo-clear').click();
  const png = Buffer.from(await makePng(), 'base64');
  await page.locator('#geo-file').setInputFiles({ name: 'geo-fixture.png', mimeType: 'image/png', buffer: png });
  await page.waitForFunction(() => document.querySelector('#geo-preview-image').naturalWidth === 400, null, { timeout: 15000 });
  check('PNG photo loads with its size and browser preview', await page.locator('#geo-preview-caption').innerText().then((text) => text.includes('400 × 260')));

  const geocoderRequestsBeforeMap = geocoderRequests.length;
  await page.locator('#geo-map-open').click();
  await page.waitForFunction(() => Boolean(document.querySelector('#geo-map')._quickkitMap), null, { timeout: 15000 });
  await page.evaluate(() => document.querySelector('#geo-map')._quickkitMap.fire('click', { latlng: { lat: 12.3456789, lng: 78.9012345 } }));
  check('map click sets exact photo coordinates and a Google Maps destination', await page.locator('#geo-latitude').inputValue() === '12.3456789' && await page.locator('#geo-longitude').inputValue() === '78.9012345' && (await page.locator('#geo-open-google-map').getAttribute('href')).includes('12.3456789%2C78.9012345'));
  check('opening the map does not send an extra place lookup automatically', geocoderRequests.length === geocoderRequestsBeforeMap);
  await page.locator('#geo-place-query').fill('Raintree Park');
  await page.waitForTimeout(1050);
  await page.locator('#geo-place-search').click();
  await page.locator('#geo-map-results button').waitFor({ state: 'visible', timeout: 5000 });
  check('place search returns a selectable named map result', geocoderRequests.length === geocoderRequestsBeforeMap + 1 && new URL(geocoderRequests.at(-1)).searchParams.get('q') === 'Raintree Park');
  await page.locator('#geo-map-results button').first().click();
  check('choosing a place fills its name, coordinates and map pin', await page.locator('#geo-place').inputValue() === 'Raintree Park' && await page.locator('#geo-latitude').inputValue() === '17.4348000' && await page.locator('#geo-longitude').inputValue() === '78.4160000' && await page.locator('#geo-reverse-lookup').isEnabled());
  check('geo photo card shows available neighbourhood and city details below the place name', await page.locator('#geo-stamp-locality').isVisible() && (await page.locator('#geo-stamp-locality').innerText()).includes('Jubilee Hills, Hyderabad'));
  await page.evaluate(() => {
    window.__quickkitGeoDrawnText = [];
    window.__quickkitOriginalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      if (this.canvas.width > 256 && this.canvas.height > 256) window.__quickkitGeoDrawnText.push(String(text));
      return window.__quickkitOriginalFillText.call(this, text, ...args);
    };
  });
  await page.locator('#geo-create').click();
  await page.waitForFunction(() => !document.querySelector('#geo-result').hidden, null, { timeout: 20000 });
  const localityPaintedOnExport = await page.evaluate(() => {
    CanvasRenderingContext2D.prototype.fillText = window.__quickkitOriginalFillText;
    return window.__quickkitGeoDrawnText.some((text) => text.includes('Jubilee Hills, Hyderabad'));
  });
  check('downloaded GPS photo includes the looked-up neighbourhood and city on its map card', localityPaintedOnExport && await page.locator('#geo-preview-badge').innerText().then((text) => text.includes('GPS metadata verified')));
  await page.waitForTimeout(1050);
  await page.locator('#geo-reverse-lookup').click();
  await page.waitForFunction(() => document.querySelector('#geo-place-status').textContent.includes('does not verify you are there'));
  check('reverse lookup labels a pinned coordinate and discloses that it is a map estimate', geocoderRequests.length === geocoderRequestsBeforeMap + 2 && (await page.locator('#geo-place').inputValue()) === 'Raintree Park');
  const movedPin = await page.evaluate(() => {
    const marker = document.querySelector('#geo-map')._quickkitMarker;
    return Boolean(marker?.dragging?.enabled());
  });
  await page.evaluate(() => {
    const marker = document.querySelector('#geo-map')._quickkitMarker;
    marker.setLatLng([17.435, 78.417]);
    marker.fire('dragend');
  });
  check('map pin can be dragged to refine coordinates and clears an outdated place label', movedPin && await page.locator('#geo-latitude').inputValue() === '17.4350000' && await page.locator('#geo-longitude').inputValue() === '78.4170000' && await page.locator('#geo-place').inputValue() === '');
  await page.locator('#geo-map-close').click();
  check('location map stays closed until opened by the user', await page.locator('#geo-map-panel').isHidden() && await page.locator('#geo-map-open').getAttribute('aria-expanded') === 'false');

  await page.locator('#geo-latitude').fill('-33.1234567');
  await page.locator('#geo-longitude').fill('-151.2345678');
  await page.locator('#geo-place').fill('Lucknow, India');
  check('valid negative latitude and longitude enable export', await page.locator('#geo-create').isEnabled() && await page.locator('#geo-stamp-place').innerText().then((text) => text.includes('Lucknow, India')) && await page.locator('#geo-stamp-address').innerText().then((text) => text.includes('-33.123457') && text.includes('-151.234568')));
  check('map-card preview explains when map tiles load and shows a clear placeholder', await page.locator('#geo-stamp-credit').innerText().then((text) => text.includes('Map loads when you make')) && await page.locator('#geo-stamp-map-placeholder').isVisible());
  const controlsScreenshot = resolve('qa-results/readme-parts/quickkit-geo-photo-setup.png');
  const previewScreenshot = resolve('qa-results/readme-parts/quickkit-geo-photo-preview.png');
  await mkdir(resolve('qa-results/readme-parts'), { recursive: true });
  await page.locator('.geo-controls').screenshot({ path: controlsScreenshot });
  await page.locator('.geo-preview-panel').screenshot({ path: previewScreenshot });
  const mapTileCountBeforeExport = mapTileRequests.length;
  await page.locator('#geo-create').click();
  await page.waitForFunction(() => !document.querySelector('#geo-result').hidden, null, { timeout: 20000 });
  const exportTiles = mapTileRequests.slice(mapTileCountBeforeExport);
  check('export loads only the nearby map tiles needed for the chosen location', exportTiles.length === 4 && exportTiles.every((url) => url.startsWith('https://tile.openstreetmap.org/14/')), `${exportTiles.length} map tiles`);
  check('printed map card includes OpenStreetMap attribution', await page.locator('#geo-stamp-credit').innerText().then((text) => text.includes('© OpenStreetMap contributors')));
  const output = await page.evaluate(async () => {
    const response = await fetch(document.querySelector('#geo-download').href); const blob = await response.blob();
    const image = new Image(); const url = URL.createObjectURL(blob); image.src = url;
    if (image.decode) await image.decode(); else await new Promise((resolve) => { image.onload = resolve; });
    const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return { name: document.querySelector('#geo-download').download, type: blob.type, width: image.naturalWidth, height: image.naturalHeight, base64: btoa(binary), size: blob.size };
  });
  const exif = piexif.load(`data:image/jpeg;base64,${output.base64}`);
  const gps = exif.GPS;
  const latitude = dmsToDecimal(gps[piexif.GPSIFD.GPSLatitude]) * (gps[piexif.GPSIFD.GPSLatitudeRef] === 'S' ? -1 : 1);
  const longitude = dmsToDecimal(gps[piexif.GPSIFD.GPSLongitude]) * (gps[piexif.GPSIFD.GPSLongitudeRef] === 'W' ? -1 : 1);
  check('PNG converts to JPEG at original pixel dimensions with embedded GPS', output.type === 'image/jpeg' && output.name.endsWith('.jpg') && output.width === 400 && output.height === 260 && Math.abs(latitude + 33.1234567) < 1e-6 && Math.abs(longitude + 151.2345678) < 1e-6, `${output.width}×${output.height} · ${latitude.toFixed(7)}, ${longitude.toFixed(7)} · ${output.size} bytes`);
  check('EXIF GPS carries correct south and west references plus date', gps[piexif.GPSIFD.GPSLatitudeRef] === 'S' && gps[piexif.GPSIFD.GPSLongitudeRef] === 'W' && Boolean(gps[piexif.GPSIFD.GPSDateStamp]) && Boolean(exif.Exif[piexif.ExifIFD.DateTimeOriginal]));
  check('preview verifies metadata and hides duplicate overlay', await page.locator('#geo-preview-badge').innerText().then((text) => text.includes('verified')) && await page.locator('#geo-stamp-preview').isHidden());
  const taggedPhotoScreenshot = resolve('qa-results/readme-parts/quickkit-geo-tagged-output.png');
  await page.locator('.geo-preview-panel').screenshot({ path: taggedPhotoScreenshot });

  await page.locator('#geo-clear').click();
  check('reset clears photo, coordinates and result', await page.locator('#geo-create').isDisabled() && await page.locator('#geo-result').isHidden() && await page.locator('#geo-latitude').inputValue() === '');
  const pngAgain = Buffer.from(await makePng(), 'base64');
  await page.locator('#geo-file').setInputFiles({ name: 'geo-location-fixture.png', mimeType: 'image/png', buffer: pngAgain });
  await page.waitForFunction(() => document.querySelector('#geo-preview-image').naturalWidth === 400);
  await page.locator('#geo-use-current').click();
  await page.waitForFunction(() => document.querySelector('#geo-create').disabled === false, null, { timeout: 10000 });
  await page.waitForFunction(() => document.querySelector('#geo-place').value === 'Raintree Park', null, { timeout: 10000 });
  check('browser geolocation action fills coordinates and finds the nearby place name', (await page.locator('#geo-latitude').inputValue()).startsWith('26.8467') && (await page.locator('#geo-longitude').inputValue()).startsWith('80.9462') && await page.locator('#geo-place').inputValue() === 'Raintree Park');
  await page.locator('#geo-print-stamp').uncheck();
  check('optional visible stamp can be turned off while GPS export remains available', await page.locator('#geo-stamp-preview').isHidden() && await page.locator('#geo-create').isEnabled());
  await page.locator('#geo-create').click();
  await page.waitForFunction(() => !document.querySelector('#geo-result').hidden, null, { timeout: 20000 });
  const secondOutput = await page.evaluate(async () => {
    const response = await fetch(document.querySelector('#geo-download').href); const blob = await response.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return { base64: btoa(binary), size: blob.size };
  });
  const secondExif = piexif.load(`data:image/jpeg;base64,${secondOutput.base64}`);
  check('current-location export keeps GPS metadata with the stamp off', secondExif.GPS[piexif.GPSIFD.GPSLatitudeRef] === 'N' && secondExif.GPS[piexif.GPSIFD.GPSLongitudeRef] === 'E' && await page.locator('#geo-stamp-preview').isHidden());

  await page.evaluate(() => Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition(_success, onError) { onError({ code: 3 }); } }
  }));
  await page.locator('#geo-use-current').click();
  await page.waitForFunction(() => document.querySelector('#geo-location-status').textContent.includes('did not return a fix'));
  check('location timeout explains device settings and points to map/manual fallback', await page.locator('#geo-location-status').innerText().then((text) => text.includes('Location Services') && text.includes('map')) && await page.locator('#geo-use-current').innerText().then((text) => text.includes('Try current location again')));

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  check('mobile view has no horizontal overflow', mobile.scroll <= mobile.client + 1, `${mobile.scroll}px / ${mobile.client}px`);
  await page.locator('#geo-map-open').click();
  await page.waitForFunction(() => Boolean(document.querySelector('#geo-map')._quickkitMap), null, { timeout: 15000 });
  const mobileMap = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, search: document.querySelector('.geo-map-search-controls').getBoundingClientRect().width }));
  check('place search and map controls fit on a 390px phone', mobileMap.scroll <= mobileMap.client + 1 && mobileMap.search > 0, JSON.stringify(mobileMap));
  await page.locator('#geo-map-close').click();
  await page.setViewportSize({ width: 320, height: 740 });
  const narrowMobile = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  check('320px phone view has no horizontal overflow', narrowMobile.scroll <= narrowMobile.client + 1, `${narrowMobile.scroll}px / ${narrowMobile.client}px`);
  await page.locator('#geo-map-open').click();
  const narrowMap = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, search: document.querySelector('.geo-map-search-controls').getBoundingClientRect().width }));
  check('place search and map controls fit on a 320px phone', narrowMap.scroll <= narrowMap.client + 1 && narrowMap.search > 0, JSON.stringify(narrowMap));
  check('no browser runtime or console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
} catch (error) {
  console.error('GEO PHOTO QA ERROR', error?.stack || error);
  errors.push(error?.message || String(error)); checks.push({ name: 'browser QA script completes', pass: false, detail: error?.message || String(error) });
} finally { await browser.close(); }

const failed = checks.filter((item) => !item.pass);
console.log(`\nGeo photo browser QA: ${checks.length - failed.length}/${checks.length} passed; ${failed.length} failed.`);
const reportPath = resolve('qa-results/geo-photo-browser-smoke.json');
await mkdir(resolve('qa-results'), { recursive: true });
await writeFile(reportPath, `${JSON.stringify({ date: new Date().toISOString().slice(0, 10), browser: 'Playwright Chromium', origin, checks, errors }, null, 2)}\n`);
console.log(`Report: ${reportPath}`);
if (failed.length) process.exitCode = 1;
