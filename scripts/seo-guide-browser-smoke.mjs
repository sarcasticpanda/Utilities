import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const sites = [
  { name: 'QuickKit', origin: process.env.QUICKKIT_ORIGIN || 'http://127.0.0.1:4175', publicOrigin: 'https://quickkit-browser-tools.pages.dev', path: '/pdf-text-and-ocr-guide.html', link: 'PDF & OCR guide', phrase: 'pdf text editing and ocr' },
  { name: 'WorkKit', origin: process.env.WORKKIT_ORIGIN || 'http://127.0.0.1:4177', publicOrigin: 'https://workkit-hours-tools.pages.dev', path: '/time-card-and-overtime-guide.html', link: 'Hours guide', phrase: 'work hours, breaks and overtime' },
  { name: 'FormReady', origin: process.env.FORMREADY_ORIGIN || 'http://127.0.0.1:4178', publicOrigin: 'https://formready-photo-tools.pages.dev', path: '/photo-signature-file-size-guide.html', link: 'Photo requirements guide', phrase: 'photo or signature for an online form' }
];
const browser = await chromium.launch({ headless: true });
const errors = [];
const checks = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass: Boolean(pass), detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

try {
  for (const site of sites) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', (error) => errors.push(`${site.name}: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(`${site.name}: ${message.text()}`); });
    await page.goto(`${site.origin}/`, { waitUntil: 'networkidle' });
    check(`${site.name} homepage links to its guide`, await page.getByRole('link', { name: site.link }).count() > 0);
    const response = await page.goto(`${site.origin}${site.path}`, { waitUntil: 'networkidle' });
    const pageData = await page.evaluate(() => ({
      title: document.title,
      h1: document.querySelector('h1')?.innerText.trim() || '',
      canonical: document.querySelector('link[rel="canonical"]')?.href || '',
      textLength: document.querySelector('main')?.innerText.length || 0,
      noindex: /noindex/i.test(document.querySelector('meta[name="robots"]')?.content || ''),
      links: [...document.querySelectorAll('main a[href]')].map((link) => ({ text: link.innerText.trim(), href: link.href }))
    }));
    check(`${site.name} guide responds and has original page content`, response?.status() === 200 && pageData.title.length > 15 && pageData.h1.toLowerCase().includes(site.phrase) && pageData.textLength > 1100 && !pageData.noindex, `${response?.status()} · ${pageData.textLength} characters`);
    check(`${site.name} guide canonical matches its public URL`, pageData.canonical === `${site.publicOrigin}${site.path}`, pageData.canonical);
    check(`${site.name} guide has a working tool action`, pageData.links.some((link) => new URL(link.href).origin === site.origin && !link.href.endsWith(site.path)));
    const screenshotDir = resolve('qa-results/seo-guides');
    await mkdir(screenshotDir, { recursive: true });
    await page.screenshot({ path: resolve(screenshotDir, `${site.name.toLowerCase()}-desktop.png`), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    const layout = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    check(`${site.name} guide fits a 390px viewport`, layout.scroll <= layout.client + 1, `${layout.scroll}px / ${layout.client}px`);
    await page.screenshot({ path: resolve(screenshotDir, `${site.name.toLowerCase()}-mobile.png`), fullPage: true });
    await page.close();
  }
  check('no page or console errors', errors.length === 0, errors.join(' | '));
} catch (error) {
  errors.push(error?.message || String(error));
  checks.push({ name: 'browser QA completes', pass: false, detail: error?.message || String(error) });
  console.error(error?.stack || error);
} finally {
  await browser.close();
}

const failed = checks.filter((item) => !item.pass);
const result = { date: new Date().toISOString().slice(0, 10), browser: 'Playwright Chromium', sites: sites.map(({ name, origin, publicOrigin, path }) => ({ name, origin, publicOrigin, path })), checks, errors };
const reportPath = resolve('qa-results/seo-guide-browser-smoke.json');
await mkdir(resolve('qa-results'), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(`\nGuide browser QA: ${checks.length - failed.length}/${checks.length} passed; ${failed.length} failed.\nReport: ${reportPath}`);
if (failed.length) process.exitCode = 1;
