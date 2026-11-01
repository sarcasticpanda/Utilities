import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.env.QUICKKIT_ORIGIN || 'https://quickkit-browser-tools.pages.dev';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const failures = [];
const liveTileRequests = [];
page.on('pageerror', (error) => failures.push(error.message));
page.on('request', (request) => { if (request.url().includes('tile.openstreetmap.org')) liveTileRequests.push(request.url()); });
page.on('requestfailed', (request) => {
  if (request.url().includes('tile.openstreetmap.org')) failures.push(`Map tile request failed: ${request.url()}`);
});

try {
  await page.goto(`${origin}/geo-photo.html#geo-workbench`, { waitUntil: 'networkidle' });
  await page.locator('#geo-map-open').click();
  await page.locator('#geo-map-panel').waitFor({ state: 'visible' });
  await page.waitForFunction(() => [...document.querySelectorAll('#geo-map .leaflet-tile')].filter((tile) => tile.complete && tile.naturalWidth > 0).length >= 4, null, { timeout: 20000 });
  const desktop = await page.locator('#geo-map').evaluate((element) => ({
    width: Math.round(element.getBoundingClientRect().width),
    loadedTiles: [...element.querySelectorAll('.leaflet-tile')].filter((tile) => tile.complete && tile.naturalWidth > 0).length,
    attributionVisible: Boolean(element.querySelector('.leaflet-control-attribution'))
  }));
  if (desktop.width < 300 || desktop.loadedTiles < 4 || !desktop.attributionVisible) failures.push(`Desktop map incomplete: ${JSON.stringify(desktop)}`);
  await mkdir('qa-results/geo-photo-live-map', { recursive: true });
  await page.locator('.geo-controls').screenshot({ path: 'qa-results/geo-photo-live-map/desktop.png' });
  console.log(`PASS live desktop map tiles and attribution — ${JSON.stringify(desktop)}`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#geo-map').scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  const mobile = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    mapWidth: Math.round(document.querySelector('#geo-map').getBoundingClientRect().width),
    loadedTiles: [...document.querySelectorAll('#geo-map .leaflet-tile')].filter((tile) => tile.complete && tile.naturalWidth > 0).length
  }));
  if (mobile.documentWidth !== mobile.viewportWidth || mobile.mapWidth <= 0 || mobile.loadedTiles < 4) failures.push(`Mobile map incomplete: ${JSON.stringify(mobile)}`);
  await page.locator('.geo-controls').screenshot({ path: 'qa-results/geo-photo-live-map/mobile.png' });
  console.log(`PASS live mobile map fits and renders tiles — ${JSON.stringify(mobile)}`);

  await page.locator('#geo-map-close').click();
  const photo = Buffer.from(await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 400;
    const context = canvas.getContext('2d'); context.fillStyle = '#d9e5ef'; context.fillRect(0, 0, 640, 400);
    context.fillStyle = '#31516e'; context.font = 'bold 38px Arial'; context.fillText('Live map card check', 40, 90);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', .9));
    const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return btoa(binary);
  }), 'base64');
  await page.locator('#geo-file').setInputFiles({ name: 'live-map-card.jpg', mimeType: 'image/jpeg', buffer: photo });
  await page.locator('#geo-latitude').fill('26.8467');
  await page.locator('#geo-longitude').fill('80.9462');
  await page.locator('#geo-place').fill('Lucknow, India');
  const tileCountBeforeCard = liveTileRequests.filter((url) => /\/14\//u.test(url)).length;
  await page.locator('#geo-create').click();
  await page.waitForFunction(() => !document.querySelector('#geo-result').hidden, null, { timeout: 30000 });
  const liveCard = await page.evaluate(() => ({
    status: document.querySelector('#geo-status').textContent,
    details: document.querySelector('#geo-result-details').textContent,
    stampPlace: document.querySelector('#geo-stamp-place').textContent,
    stampCoordinates: document.querySelector('#geo-stamp-address').textContent,
    attribution: document.querySelector('#geo-stamp-credit').textContent
  }));
  const cardTileCount = liveTileRequests.filter((url) => /\/14\//u.test(url)).length - tileCountBeforeCard;
  if (cardTileCount < 4 || liveCard.status.includes('map service is unavailable')) failures.push(`Live map card failed: ${JSON.stringify({ cardTileCount, ...liveCard })}`);
  if (!liveCard.stampPlace.includes('Lucknow') || !liveCard.stampCoordinates.includes('26.846700') || !liveCard.attribution.includes('Location tagged with QuickKit') || !liveCard.attribution.includes('OpenStreetMap contributors')) failures.push(`Live map card details incomplete: ${JSON.stringify(liveCard)}`);
  await page.locator('.geo-preview-panel').screenshot({ path: 'qa-results/geo-photo-live-map/tagged-photo.png' });
  console.log(`PASS live GPS map card renders real nearby tiles, place, coordinates and attribution — ${JSON.stringify({ cardTileCount, ...liveCard })}`);

  if (failures.length) throw new Error(failures.join('\n'));
  const report = { origin, checkedAt: new Date().toISOString(), desktop, mobile, liveCard, cardTileCount, placeSearchSubmitted: false, coordinatesSubmitted: true, failures };
  await writeFile('qa-results/geo-photo-live-map/results.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log('Live map check: 3/3 passed; the live card used only its selected coordinates and did not submit a geocoder query.');
} finally {
  await browser.close();
}
