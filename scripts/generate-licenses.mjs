import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
const products = {
  workkit: ['gsap'],
  quickkit: ['gsap', 'cropperjs', 'pdf-lib', 'pdfjs-dist', 'qrcode', 'tesseract.js'],
  formready: ['gsap', 'cropperjs']
};
const productNotes = {
  workkit: 'ClockMath attribution: the toMinutes, isOvernight and clockMinutes helper logic in time.js is adapted from lib/timesheet.ts at https://github.com/clockmath/clockmath/tree/d5d0c2b3143efdf03d24350e1362fa638bb500da. The source is distributed under the MIT License; its full notice follows.\n\n',
  quickkit: 'The reference repositories in reference-notes were studied for product research; no code from those repositories is included in QuickKit.\n\n',
  formready: 'The reference repositories in reference-notes were studied for product research; no code from those repositories is included in FormReady.\n\n'
};

for (const [product, roots] of Object.entries(products)) {
  const visited = new Set();
  const entries = [];
  const visit = async (packageName, parentKey = '') => {
    const expected = parentKey ? path.posix.join(parentKey, 'node_modules', packageName) : path.posix.join('node_modules', packageName);
    const candidates = [expected, ...Object.keys(lock.packages).filter((candidate) => candidate.endsWith(`/node_modules/${packageName}`))];
    const key = candidates.find((candidate) => lock.packages[candidate] && existsSync(path.join(root, candidate, 'package.json')));
    const entry = key && lock.packages[key];
    if (!entry || visited.has(key)) return;
    visited.add(key);
    const dir = path.join(root, key);
    const pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
    const licenseFiles = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'COPYING'];
    let licenseText = '';
    for (const filename of licenseFiles) {
      const file = path.join(dir, filename);
      if (existsSync(file)) { licenseText = await readFile(file, 'utf8'); break; }
    }
    entries.push({ name: pkg.name, version: pkg.version, license: typeof pkg.license === 'string' ? pkg.license : JSON.stringify(pkg.license), licenseText });
    for (const child of Object.keys(entry.dependencies || {})) await visit(child, key);
  };
  for (const name of roots) await visit(name);
  const gsapNote = 'GSAP is provided under the Standard “No Charge” License. Its terms permit commercial use subject to stated restrictions; see https://gsap.com/community/standard-license/.\n\n';
  const clockMathLicense = product === 'workkit' ? `\n================================================================================\nClockMath time calculation helpers (adapted)\nSource: https://github.com/clockmath/clockmath/tree/d5d0c2b3143efdf03d24350e1362fa638bb500da\n================================================================================\n${await readFile(path.join(root, 'licenses', 'clockmath-LICENSE.txt'), 'utf8')}\n` : '';
  const body = 'Third-party notices for code bundled into this site.\n\n' + productNotes[product] + gsapNote + entries.map((entry) => `================================================================================\n${entry.name} ${entry.version}\nLicense: ${entry.license || 'see package metadata'}\n================================================================================\n${entry.licenseText || 'The package does not include a standard license file. See its package metadata and source distribution.'}\n`).join('\n') + clockMathLicense;
  const publicDir = path.join(root, 'products', product, 'public');
  await mkdir(publicDir, { recursive: true });
  await writeFile(path.join(publicDir, 'THIRD-PARTY-NOTICES.txt'), body);
}
