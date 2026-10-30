import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
const products = {
  workkit: ['gsap'],
  quickkit: ['gsap', 'pdf-lib', 'qrcode'],
  formready: ['gsap', 'cropperjs']
};
const disclaimer = 'Third-party notices for libraries bundled into this site. The sites are independent implementations; the open-source repositories in reference-notes were studied for product research and their code was not copied.\n\n';

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
  const body = disclaimer + entries.map((entry) => `================================================================================\n${entry.name} ${entry.version}\nLicense: ${entry.license || 'see package metadata'}\n================================================================================\n${entry.licenseText || 'The package does not include a standard license file. See its package metadata and source distribution.'}\n`).join('\n');
  const publicDir = path.join(root, 'products', product, 'public');
  await mkdir(publicDir, { recursive: true });
  await writeFile(path.join(publicDir, 'THIRD-PARTY-NOTICES.txt'), body);
}
