import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const colorChanges = {
  workkit: {
    '#f5f3ed':'#edf1ea', '#fbfaf6':'#f5f7f2', '--muted:#73766f':'--muted:#51574f',
    '#77786d':'#50564c', '#7b7e73':'#52574e', '#808278':'#50564d', '#696d63':'#50564c',
    '#85877e':'#52584f', '#74766d':'#53584f', '#696d61':'#50564c', '#8b8d82':'#53584f',
    '#6d7068':'#50564c', '#6d7067':'#50564c', '#777':'#50564c', '#85877e':'#52584f'
  },
  quickkit: {
    '--muted:#677487':'--muted:#4f5d70', '#718098':'#4e5d70', '#657489':'#4c5b6e',
    '#607181':'#4d5b6b', '#748195':'#506075', '#58687b':'#4b5b70', '#8793a1':'#526174',
    '#7d8996':'#526174', '#45556a':'#3f4e60', '#536277':'#49596c', '#68778a':'#4e5c70'
  },
  formready: {
    '#f8f5f1':'#f0f3ef', '#faf8f5':'#f5f7f4', '#fffdfa':'#f8faf7', '#f1ede8':'#eaf0eb',
    '#fcfaf7':'#f3f7f3', '#eee8e1':'#e7eee8', '#e9e4de':'#e0e9e2', '#f2efea':'#e8efea',
    '--muted:#70777b':'--muted:#505a5d', '#8a8881':'#565d58', '#6e7577':'#4f5a5d',
    '#81776f':'#5a504a', '#858884':'#565d57', '#747b7b':'#50595b', '#73797b':'#50585a',
    '#717a7b':'#4f585a', '#92705e':'#614b3e', '#697174':'#50595b', '#8f8379':'#5c514a',
    '#697175':'#4f585b', '#81817a':'#555951', '#5d666a':'#4a5558', '#72797a':'#50585a',
    '#8a8881':'#565d58'
  }
};

for (const [product, replacements] of Object.entries(colorChanges)) {
  const dir = path.join(root, 'products', product);
  const cssPath = path.join(dir, 'styles.css');
  let css = await readFile(cssPath, 'utf8');
  for (const [before, after] of Object.entries(replacements)) css = css.replaceAll(before, after);
  css = css.replace(/font-size:(?:8|9|10|11|12|13)px/gu, 'font-size:14px');
  if (product === 'workkit') css = css.replace('padding:0 9px;border:1px solid #d9d9d1', 'padding:4px 9px;border:1px solid #d9d9d1');
  if (product === 'formready') css = css.replace('border-left:3px solid var(--rust);', 'border-left:0;');
  await writeFile(cssPath, css);
  for (const name of await readdir(dir)) {
    if (!name.endsWith('.html')) continue;
    const htmlPath = path.join(dir, name);
    let html = await readFile(htmlPath, 'utf8');
    html = html.replace(/<p class="eyebrow">[^<]*<\/p>\s*(?=<h1>)/gu, '');
    await writeFile(htmlPath, html);
  }
}
