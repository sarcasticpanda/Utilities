import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const products = ['quickkit', 'workkit', 'formready'];
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const product of products) {
    const directory = resolve(`products/${product}/public`);
    const svg = await readFile(resolve(directory, 'og-image.svg'), 'utf8');
    await page.setContent(`<style>html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#f3f6fb}</style>${svg}`, { waitUntil: 'load' });
    const bounds = await page.locator('svg').boundingBox();
    if (!bounds || bounds.width !== 1200 || bounds.height !== 630) throw new Error(`${product}: share card must render at 1200x630`);
    await mkdir(directory, { recursive: true });
    await page.screenshot({ path: resolve(directory, 'og-image.png'), type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
    console.log(`Rendered ${product}: ${resolve(directory, 'og-image.png')}`);
  }
} finally {
  await browser.close();
}
