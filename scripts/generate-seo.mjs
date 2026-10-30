import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = {
  workkit: ['/', '/time-card-calculator.html', '/overtime-calculator.html', '/salary-converter.html'],
  quickkit: ['/', '/image-to-pdf.html', '/image-compressor.html', '/pdf-editor.html', '/pdf-merge.html', '/text-tools.html', '/wifi-qr.html'],
  formready: ['/', '/image-preparer.html']
};
for (const [product, sitemapPaths] of Object.entries(pages)) {
  const dir = path.join(root, 'products', product);
  const origin = (await readFile(path.join(dir, 'site-origin.txt'), 'utf8')).trim().replace(/\/$/u, '');
  if (!/^https:\/\//u.test(origin)) throw new Error(`Expected a production HTTPS origin for ${product}`);
  for (const name of await readdir(dir)) {
    if (!name.endsWith('.html')) continue;
    const filename = path.join(dir, name);
    let html = await readFile(filename, 'utf8');
    const canonical = `${origin}${name === 'index.html' ? '/' : `/${name}`}`;
    const title = html.match(/<title>([^<]*)<\/title>/iu)?.[1] || product;
    const description = html.match(/<meta name="description" content="([^"]*)"/iu)?.[1] || title;
    const seo = `<link rel="canonical" href="${canonical}"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:type" content="website"><meta property="og:url" content="${canonical}"><meta name="twitter:card" content="summary">`;
    html = html.replace(/<link rel="canonical"[^>]*>|<meta property="og:[^"]*"[^>]*>|<meta name="twitter:card"[^>]*>/giu, '');
    html = html.replace('</head>', `${seo}</head>`);
    await writeFile(filename, html);
  }
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapPaths.map((url) => `  <url><loc>${origin}${url}</loc></url>`).join('\n')}\n</urlset>\n`;
  const publicDir = path.join(dir, 'public');
  await mkdir(publicDir, { recursive: true });
  await writeFile(path.join(publicDir, 'sitemap.xml'), sitemap);
  await writeFile(path.join(publicDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
  await rm(path.join(dir, 'sitemap.xml'), { force: true });
  await rm(path.join(dir, 'robots.txt'), { force: true });
}
