import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const sites = [
  { name: 'QuickKit', origin: 'https://quickkit-browser-tools.pages.dev' },
  { name: 'WorkKit', origin: 'https://workkit-hours-tools.pages.dev' },
  { name: 'FormReady', origin: 'https://formready-photo-tools.pages.dev' }
];
const failures = [];
const siteResults = [];
const canonical = (html) => html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1] || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical/i)?.[1] || '';
const title = (html) => html.match(/<title>(.*?)<\/title>/is)?.[1]?.replace(/\s+/g, ' ').trim() || '';
const hasDescription = (html) => /<meta[^>]+name=["']description["'][^>]+content=["'][^"']+/i.test(html) || /<meta[^>]+content=["'][^"']+["'][^>]+name=["']description/i.test(html);
const ogImage = (html) => html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1] || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image/i)?.[1] || '';

for (const site of sites) {
  const [robotsResponse, sitemapResponse] = await Promise.all([fetch(`${site.origin}/robots.txt`), fetch(`${site.origin}/sitemap.xml`)]);
  const [robots, sitemap] = await Promise.all([robotsResponse.text(), sitemapResponse.text()]);
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  const pages = [];
  const imageResponse = await fetch(`${site.origin}/og-image.png`);
  const imageBytes = Buffer.from(await imageResponse.arrayBuffer());
  const imageSize = imageBytes.length >= 24 && imageBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? { width: imageBytes.readUInt32BE(16), height: imageBytes.readUInt32BE(20) }
    : { width: 0, height: 0 };
  if (!imageResponse.ok || !imageResponse.headers.get('content-type')?.includes('image/png') || imageSize.width !== 1200 || imageSize.height !== 630) failures.push(`${site.name}: og-image.png must be a 1200×630 PNG`);
  if (!robotsResponse.ok) failures.push(`${site.name}: robots.txt returned ${robotsResponse.status}`);
  if (!sitemapResponse.ok || !urls.length) failures.push(`${site.name}: sitemap.xml returned ${sitemapResponse.status} or has no URLs`);
  if (!robots.toLowerCase().includes(`${site.origin}/sitemap.xml`.toLowerCase())) failures.push(`${site.name}: robots.txt does not point to its sitemap`);
  const sitemapUrlSet = new Set(urls.map((url) => new URL(url).href));
  const queue = [...sitemapUrlSet];
  const visited = new Set();
  while (queue.length) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    const response = await fetch(url, { redirect: 'follow' });
    const html = await response.text();
    const path = new URL(url).pathname;
    const pageOgImage = ogImage(html);
    const page = { path, inSitemap: sitemapUrlSet.has(url), status: response.status, title: title(html), canonical: canonical(html), hasDescription: hasDescription(html), ogImage: pageOgImage, noindex: /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html) };
    pages.push(page);
    if (response.status !== 200 || !page.title || !page.hasDescription || page.noindex || page.canonical !== url || pageOgImage !== `${site.origin}/og-image.png`) failures.push(`${site.name}${path}: status/title/description/indexability/canonical/social-image check failed`);
    if (response.ok) {
      for (const match of html.matchAll(/\bhref=["']([^"']+)["']/gi)) {
        try {
          const target = new URL(match[1], url);
          if (target.origin === site.origin && (target.pathname === '/' || target.pathname.endsWith('.html'))) {
            target.hash = '';
            target.search = '';
            if (!visited.has(target.href)) queue.push(target.href);
          }
        } catch {}
      }
    }
  }
  const contact = await fetch(`${site.origin}/contact.html`).then((response) => response.text());
  const hasPublicFeedback = /github\.com\/sarcasticpanda\/Utilities\/issues/.test(contact);
  if (!hasPublicFeedback) failures.push(`${site.name}: contact page has no public feedback route`);
  siteResults.push({ name: site.name, origin: site.origin, robotsStatus: robotsResponse.status, sitemapStatus: sitemapResponse.status, sitemapUrls: urls.length, robotsHasSitemap: robots.toLowerCase().includes(`${site.origin}/sitemap.xml`.toLowerCase()), ogImage: { status: imageResponse.status, contentType: imageResponse.headers.get('content-type'), ...imageSize }, hasPublicFeedback, pages });
}

const report = { date: new Date().toISOString().slice(0, 10), sitemapUrls: siteResults.reduce((sum, site) => sum + site.sitemapUrls, 0), crawledRoutes: siteResults.reduce((sum, site) => sum + site.pages.length, 0), failures, sites: siteResults };
const reportPath = resolve('qa-results/seo-live-audit.json');
await mkdir(resolve('qa-results'), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`${report.sitemapUrls} sitemap URLs and ${report.crawledRoutes} linked page routes checked across ${sites.length} sites; ${failures.length} failures.`);
for (const site of siteResults) console.log(`${site.name}: robots ${site.robotsStatus}, sitemap ${site.sitemapStatus}, ${site.sitemapUrls} sitemap URLs, ${site.pages.length} linked routes`);
console.log(`Report: ${reportPath}`);
if (failures.length) { failures.forEach((failure) => console.error(`FAIL ${failure}`)); process.exitCode = 1; }
