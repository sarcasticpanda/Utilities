import { chromium } from 'playwright';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const quickKitOrigin = process.env.QUICKKIT_ORIGIN || 'http://127.0.0.1:4174';
const outputDir = resolve(root, 'qa-results', process.env.QUICKKIT_ORIGIN ? 'pdf-editor-production' : 'pdf-editor');
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const checks = [];
const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
desktop.on('pageerror', (error) => errors.push(error.message));
desktop.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
const requests = [];
desktop.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));

function check(name, pass, detail = '') {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
  checks.push({ name, pass: Boolean(pass), detail });
  if (!pass) errors.push(`${name}: ${detail || 'failed'}`);
}

const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
for (const label of ['Original page one', 'Original page two', 'Original page three']) {
  const page = pdf.addPage([480, 640]);
  page.drawText(label, { x: 45, y: 570, size: 22, font, color: rgb(.12, .2, .3) });
  page.drawText('Sample text for local annotation testing.', { x: 45, y: 530, size: 12, font });
}
const pdfBytes = Buffer.from(await pdf.save());

await desktop.goto(`${quickKitOrigin}/pdf-editor.html`, { waitUntil: 'networkidle' });
const pngBytes = Buffer.from(await desktop.evaluate(async () => {
  const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 110;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#e6eef9'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#2864b8'; ctx.fillRect(18, 17, 124, 76);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}));
check('Editor route loads', (await desktop.locator('h1').innerText()) === 'Edit a PDF, right here');
const home = await desktop.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
check('Editor upload view fits desktop width', home.scrollWidth <= home.width, JSON.stringify(home));
await desktop.screenshot({ path: resolve(outputDir, 'upload-desktop.png'), fullPage: true });

await desktop.locator('#pdf-source').setInputFiles({ name: 'not-a-pdf.txt', mimeType: 'text/plain', buffer: Buffer.from('not pdf') });
check('Unsupported file type shows a clear message', (await desktop.locator('#editor-message').innerText()).includes('Choose a PDF'));
await desktop.locator('#pdf-source').setInputFiles({ name: 'sample-document.pdf', mimeType: 'application/pdf', buffer: pdfBytes });
await desktop.locator('#pdf-workspace').waitFor({ state: 'visible' });
await desktop.locator('.pdf-page-list canvas').first().waitFor();
await desktop.waitForFunction(() => document.querySelector('#pdf-page-stage canvas')?.width > 0);
check('PDF opens with 3 pages and page canvas', (await desktop.locator('#rail-count').innerText()) === '3' && await desktop.locator('#pdf-page-stage canvas').count() === 1);
await desktop.locator('#replace-pdf').click();
await desktop.locator('#pdf-source').setInputFiles({ name: 'damaged.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-not-a-real-file') });
await desktop.waitForFunction(() => document.querySelector('#pdf-editor-status')?.innerText.includes('could not be opened'));
check('Bad replacement file reports an error and keeps the current document', await desktop.locator('#pdf-workspace').isVisible() && (await desktop.locator('#rail-count').innerText()) === '3', await desktop.locator('#pdf-editor-status').innerText());
await desktop.locator('#pdf-editor-status').waitFor({ state: 'visible' });
await desktop.screenshot({ path: resolve(outputDir, 'loaded-desktop.png'), fullPage: true });

await desktop.locator('[data-tool="text"]').click();
await desktop.locator('#pdf-page-stage').press('Enter');
check('Keyboard can place text at the page center', await desktop.locator('.pdf-overlay-text').count() === 1);
const keyboardBefore = await desktop.locator('.pdf-overlay-text').boundingBox();
await desktop.locator('#pdf-page-stage').press('ArrowRight');
const keyboardAfter = await desktop.locator('.pdf-overlay-text').boundingBox();
check('Keyboard arrow keys can move a selected annotation', keyboardAfter.x > keyboardBefore.x);
await desktop.locator('#remove-item').click();
await desktop.locator('[data-tool="text"]').click();
await desktop.locator('#pdf-page-stage').click({ position: { x: 130, y: 125 } });
await desktop.locator('#item-text').fill('Edited title');
await desktop.locator('#item-size').fill('24');
check('Text annotation can be placed and edited', await desktop.locator('.pdf-overlay-text').innerText() === 'Edited title');
const beforeDrag = await desktop.locator('.pdf-overlay-text').boundingBox();
await desktop.mouse.move(beforeDrag.x + 10, beforeDrag.y + 8); await desktop.mouse.down();
await desktop.mouse.move(beforeDrag.x + 55, beforeDrag.y + 30, { steps: 5 }); await desktop.mouse.up();
const afterDrag = await desktop.locator('.pdf-overlay-text').boundingBox();
check('Added text can be dragged to a new position', Math.abs(afterDrag.x - beforeDrag.x) > 20 && Math.abs(afterDrag.y - beforeDrag.y) > 10, `${beforeDrag.x},${beforeDrag.y} → ${afterDrag.x},${afterDrag.y}`);

await desktop.locator('[data-tool="highlight"]').click();
await desktop.locator('#pdf-page-stage').click({ position: { x: 130, y: 205 } });
check('Highlight annotation can be placed', await desktop.locator('.pdf-overlay-highlight').count() === 1);

await desktop.locator('[data-tool="shape"]').click();
await desktop.locator('#pdf-page-stage').click({ position: { x: 220, y: 300 } });
check('Rectangle annotation can be placed', await desktop.locator('.pdf-overlay-shape').count() === 1);
await desktop.locator('#remove-item').click();
check('Selected annotation can be removed', await desktop.locator('.pdf-overlay-shape').count() === 0);
await desktop.locator('#undo-edit').click();
check('Undo restores the last removed annotation', await desktop.locator('.pdf-overlay-shape').count() === 1 && await desktop.locator('#undo-edit').isDisabled() === true);
await desktop.locator('#remove-item').click();

await desktop.locator('[data-tool="image"]').click();
await desktop.locator('#pdf-image-input').setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: pngBytes });
await desktop.locator('.pdf-overlay-image').waitFor();
check('Image annotation can be placed', await desktop.locator('.pdf-overlay-image').count() === 1);

await desktop.locator('[data-tool="signature"]').click();
await desktop.locator('#signature-dialog').waitFor({ state: 'visible' });
const sign = await desktop.locator('#signature-canvas').boundingBox();
await desktop.mouse.move(sign.x + 35, sign.y + 105);
await desktop.mouse.down();
await desktop.mouse.move(sign.x + 120, sign.y + 60, { steps: 7 });
await desktop.mouse.move(sign.x + 225, sign.y + 126, { steps: 8 });
await desktop.mouse.move(sign.x + 330, sign.y + 73, { steps: 8 });
await desktop.mouse.up();
const ink = await desktop.locator('#signature-canvas').evaluate((canvas) => {
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let count = 0; for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count++;
  return count;
});
await desktop.locator('#place-signature').click();
await desktop.locator('.pdf-overlay-signature').waitFor({ state: 'attached' });
check('Drawn signature can be added to the PDF', ink > 100 && await desktop.locator('.pdf-overlay-signature').count() === 1, `ink pixels: ${ink}`);
await desktop.locator('[data-tool="signature"]').click();
await desktop.locator('#typed-signature').fill('தமிழ் signature');
await desktop.locator('#place-typed-signature').click();
check('Typed signature offers a keyboard-accessible signing path', await desktop.locator('.pdf-overlay-text').filter({ hasText: 'தமிழ் signature' }).count() === 1);

await desktop.locator('#page-move-down').click();
check('Page can be reordered', (await desktop.locator('#page-indicator').innerText()) === 'Page 2 of 3');
await desktop.locator('#page-next').click();
await desktop.locator('#page-delete').click();
check('Page can be deleted without removing the last page', (await desktop.locator('#rail-count').innerText()) === '2');
check('No horizontal overflow on desktop', await desktop.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
await desktop.screenshot({ path: resolve(outputDir, 'edited-desktop.png'), fullPage: true });

const downloadWait = desktop.waitForEvent('download');
await desktop.locator('#download-pdf').click();
const download = await downloadWait;
const filePath = await download.path();
const resultBytes = await readFile(filePath);
const output = await PDFDocument.load(resultBytes);
check('Edited PDF downloads and is readable', output.getPageCount() === 2 && resultBytes.subarray(0, 5).toString() === '%PDF-', `pages: ${output.getPageCount()}, bytes: ${resultBytes.length}`);
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const outputForText = await pdfjs.getDocument({ data: new Uint8Array(resultBytes), standardFontDataUrl: `${resolve(root, 'node_modules/pdfjs-dist/standard_fonts')}/`, disableFontFace: true, isEvalSupported: false }).promise;
const orderText = [];
for (let i = 1; i <= outputForText.numPages; i++) {
  const content = await (await outputForText.getPage(i)).getTextContent();
  orderText.push(content.items.map((item) => item.str).join(' '));
}
const annotationImages = output.getPages().some((page) => (page.node.normalizedEntries().XObject?.entries().length || 0) > 0);
check('Export preserves page order and original text; new text is embedded as an image', orderText[0].includes('Original page two') && orderText[1].includes('Original page one') && annotationImages, orderText.join(' | '));
await desktop.locator('#ocr-current-page').click();
await desktop.waitForFunction(() => document.querySelector('#pdf-ocr-status')?.innerText.includes('Found') || document.querySelector('#pdf-ocr-status')?.innerText.includes('could not start'), null, { timeout: 120000 });
const ocrStatus = await desktop.locator('#pdf-ocr-status').innerText();
const ocrFoundText = (await desktop.locator('#pdf-ocr-results').innerText()).includes('Original page one');
check('OCR recognizes text on a PDF page locally', ocrFoundText, ocrStatus);
if (ocrFoundText) {
  const originalLine = desktop.locator('#pdf-ocr-results li').filter({ hasText: 'Original page one' }).first();
  await originalLine.locator('button').nth(1).click();
  check('OCR can create a masked, editable text replacement', await desktop.locator('.pdf-overlay-redact').count() === 1 && await desktop.locator('#item-text').inputValue() === 'Original page one');
  await desktop.locator('#item-text').fill('Replacement text');
  check('Replacement text can be edited and previewed', await desktop.locator('.pdf-overlay-text').filter({ hasText: 'Replacement text' }).count() === 1);
  const redactedDownloadWait = desktop.waitForEvent('download');
  await desktop.locator('#download-pdf').click();
  const redactedDownload = await redactedDownloadWait;
  const redactedBytes = new Uint8Array(await readFile(await redactedDownload.path()));
  const redactedPdf = await pdfjs.getDocument({ data: redactedBytes, standardFontDataUrl: `${resolve(root, 'node_modules/pdfjs-dist/standard_fonts')}/`, disableFontFace: true, isEvalSupported: false }).promise;
  const redactedPageText = (await (await redactedPdf.getPage(2)).getTextContent()).items.map((item) => item.str).join(' ');
  check('Rasterized redaction removes original searchable text from that page', redactedPageText.trim().length === 0, redactedPageText);
}

const directEditPdf = await PDFDocument.create();
const directEditFont = await directEditPdf.embedFont(StandardFonts.Helvetica);
const directEditPage = directEditPdf.addPage([480, 640]);
directEditPage.drawText('Original searchable line', { x: 45, y: 570, size: 20, font: directEditFont });
directEditPage.drawText('Remove this exact text', { x: 45, y: 530, size: 14, font: directEditFont });
directEditPage.drawText('Keep this unchanged', { x: 45, y: 490, size: 12, font: directEditFont });
await desktop.locator('#replace-pdf').click();
await desktop.locator('#pdf-source').setInputFiles({ name: 'source-text-edit.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await directEditPdf.save()) });
await desktop.waitForFunction(() => document.querySelector('#pdf-file-name')?.textContent === 'source-text-edit.pdf' && document.querySelector('#pdf-page-stage canvas')?.width > 0);
await desktop.locator('#edit-source-text').click();
await desktop.locator('#scan-source-text').click();
await desktop.waitForFunction(() => document.querySelectorAll('#pdf-source-text-list .pdf-source-text-row').length === 3);
check('Direct PDF text scan lists supported single-line source text', await desktop.locator('#pdf-source-text-list .pdf-source-text-row').count() === 3, await desktop.locator('#pdf-source-text-status').innerText());
const replaceRow = desktop.locator('.pdf-source-text-row').filter({ hasText: 'Original searchable line' });
await replaceRow.locator('input').fill('New searchable line');
await replaceRow.getByRole('button', { name: 'Replace' }).click();
const deleteRow = desktop.locator('.pdf-source-text-row').filter({ hasText: 'Remove this exact text' });
await deleteRow.getByRole('button', { name: 'Delete Remove this exact text' }).click();
check('Replacement and deletion are staged as source-text edits', (await desktop.locator('#pdf-source-text-staged').innerText()).includes('2 direct text edits'));
const tooWideRow = desktop.locator('.pdf-source-text-row').filter({ hasText: 'Keep this unchanged' });
await tooWideRow.locator('input').fill('This replacement is deliberately far wider than the source line');
await tooWideRow.getByRole('button', { name: 'Replace' }).click();
const oversizedExport = desktop.waitForFunction(() => document.querySelector('#pdf-editor-status')?.innerText.includes('wider than the original line'));
await desktop.locator('#download-pdf').click();
await oversizedExport;
check('A wider replacement is refused before a download is created', (await desktop.locator('#pdf-editor-status').innerText()).includes('wider than the original line'));
await tooWideRow.locator('input').fill('Keep this line');
await tooWideRow.getByRole('button', { name: 'Update' }).click();
const directEditDownloadWait = desktop.waitForEvent('download');
await desktop.locator('#download-pdf').click();
const directEditDownload = await directEditDownloadWait;
const directEditBytes = new Uint8Array(await readFile(await directEditDownload.path()));
const directEditOutputTask = pdfjs.getDocument({ data: directEditBytes, standardFontDataUrl: `${resolve(root, 'node_modules/pdfjs-dist/standard_fonts')}/`, disableFontFace: true, isEvalSupported: false });
const directEditOutput = await directEditOutputTask.promise;
const directEditItems = (await (await directEditOutput.getPage(1)).getTextContent()).items;
const directEditText = directEditItems.map((item) => item.str);
check('Downloaded PDF contains replacement text and no deleted source text', directEditText.includes('New searchable line') && !directEditText.includes('Original searchable line') && !directEditText.includes('Remove this exact text'), directEditText.join(' | '));
check('Unedited source text remains selectable', directEditText.includes('Keep this line'));
const directSourceTask = pdfjs.getDocument({ data: new Uint8Array(await directEditPdf.save()), standardFontDataUrl: `${resolve(root, 'node_modules/pdfjs-dist/standard_fonts')}/`, disableFontFace: true, isEvalSupported: false });
const directSourceDoc = await directSourceTask.promise;
const directSourceItems = (await (await directSourceDoc.getPage(1)).getTextContent()).items;
const originalLine = directSourceItems.find((item) => item.str === 'Original searchable line');
const replacementLine = directEditItems.find((item) => item.str === 'New searchable line');
check('Direct text replacement keeps its source page coordinates', Boolean(originalLine && replacementLine && originalLine.transform.every((value, index) => Math.abs(value - replacementLine.transform[index]) < 0.01)), `${JSON.stringify(originalLine?.transform)} → ${JSON.stringify(replacementLine?.transform)}`);
await directSourceTask.destroy();
await directEditOutputTask.destroy();

const onePage = await PDFDocument.create(); onePage.addPage([480, 640]);
await desktop.locator('#replace-pdf').click();
await desktop.locator('#pdf-source').setInputFiles({ name: 'one-page.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await onePage.save()) });
await desktop.waitForFunction(() => document.querySelector('#rail-count')?.textContent === '1');
check('The final remaining page cannot be deleted', await desktop.locator('#page-delete').isDisabled() && await desktop.locator('#mobile-page-delete').isDisabled());

const rotated = await PDFDocument.create();
const rotatedPage = rotated.addPage([480, 640]); rotatedPage.setRotation(degrees(90));
await desktop.locator('#replace-pdf').click();
await desktop.locator('#pdf-source').setInputFiles({ name: 'rotated-page.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await rotated.save()) });
await desktop.waitForFunction(() => document.querySelector('#pdf-file-name')?.textContent === 'rotated-page.pdf' && document.querySelector('#pdf-page-stage canvas')?.width > 0);
await desktop.locator('[data-tool="text"]').click();
const rotatedStatus = await desktop.locator('#pdf-editor-status').innerText();
const rotatedAnnotationCount = await desktop.locator('.pdf-overlay-text').count();
check('Rotated pages clearly block annotations instead of exporting misplaced content', rotatedStatus.includes('Editing rotated pages is not supported') && rotatedAnnotationCount === 0, `${rotatedStatus}; annotations ${rotatedAnnotationCount}`);

const tooManyPages = await PDFDocument.create();
for (let i = 0; i < 201; i++) tooManyPages.addPage([100, 100]);
await desktop.locator('#replace-pdf').click();
await desktop.locator('#pdf-source').setInputFiles({ name: 'large-page-count.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await tooManyPages.save()) });
await desktop.waitForFunction(() => document.querySelector('#pdf-editor-status')?.innerText.includes('more than 200 pages'));
check('PDF editor rejects documents over its page limit with a clear message', (await desktop.locator('#pdf-editor-status').innerText()).includes('Split it into smaller files'));

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
mobile.on('pageerror', (error) => errors.push(`mobile: ${error.message}`));
mobile.on('console', (message) => { if (message.type() === 'error') errors.push(`mobile: ${message.text()}`); });
await mobile.goto(`${quickKitOrigin}/pdf-editor.html`, { waitUntil: 'networkidle' });
await mobile.locator('#pdf-source').setInputFiles({ name: 'sample-document.pdf', mimeType: 'application/pdf', buffer: pdfBytes });
await mobile.locator('#pdf-workspace').waitFor({ state: 'visible' });
await mobile.waitForFunction(() => document.querySelector('#pdf-page-stage canvas')?.width > 0);
const mobileFit = await mobile.evaluate(() => {
  const rects = ['.pdf-editor-topbar', '.pdf-toolbar', '.pdf-page-rail', '.pdf-viewer-toolbar', '.pdf-page-stage', '.pdf-top-actions'].map((selector) => {
    const r = document.querySelector(selector).getBoundingClientRect(); return { selector, left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) };
  });
  return { width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, rects };
});
check('Loaded editor fits mobile width without clipping', mobileFit.scrollWidth <= mobileFit.width && mobileFit.rects.every((rect) => rect.left >= -1 && rect.right <= mobileFit.width + 1 && rect.width > 0 && rect.height > 0), JSON.stringify(mobileFit));
check('Essential editing and download controls are visible on mobile', await mobile.locator('[data-tool="text"]').isVisible() && await mobile.locator('#download-pdf').isVisible() && await mobile.locator('#pdf-page-stage').isVisible());
await mobile.locator('#edit-source-text').click();
await mobile.locator('#scan-source-text').click();
await mobile.waitForFunction(() => document.querySelectorAll('#pdf-source-text-list .pdf-source-text-row').length > 0);
const mobileTextPanel = await mobile.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, panel: (() => { const r = document.querySelector('#pdf-source-text-panel').getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width }; })(), rows: [...document.querySelectorAll('.pdf-source-text-row')].map((row) => { const buttons = [...row.querySelectorAll('button')].map((button) => { const r = button.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }); return { buttons, separate: buttons.length === 2 && (buttons[0].right <= buttons[1].left || buttons[1].right <= buttons[0].left || buttons[0].bottom <= buttons[1].top || buttons[1].bottom <= buttons[0].top) }; }) }));
check('Source-text edit and delete controls fit and do not overlap on mobile', mobileTextPanel.scrollWidth <= mobileTextPanel.width && mobileTextPanel.panel.left >= -1 && mobileTextPanel.panel.right <= mobileTextPanel.width + 1 && mobileTextPanel.rows.every((row) => row.separate), JSON.stringify(mobileTextPanel));
await mobile.screenshot({ path: resolve(outputDir, 'loaded-mobile.png'), fullPage: true });
await mobile.setViewportSize({ width: 320, height: 740 });
const narrowFit = await mobile.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, toolbar: (() => { const r = document.querySelector('.pdf-toolbar').getBoundingClientRect(); return { left: r.left, right: r.right }; })(), download: (() => { const r = document.querySelector('#download-pdf').getBoundingClientRect(); return { left: r.left, right: r.right }; })() }));
check('Editor fits a narrow 320px phone viewport', narrowFit.scrollWidth <= narrowFit.width && narrowFit.toolbar.left >= 0 && narrowFit.toolbar.right <= narrowFit.width && narrowFit.download.left >= 0 && narrowFit.download.right <= narrowFit.width, JSON.stringify(narrowFit));
const narrowTextActions = await mobile.evaluate(() => [...document.querySelectorAll('.pdf-source-text-row')].map((row) => { const buttons = [...row.querySelectorAll('button')].map((button) => { const r = button.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }); return buttons.length === 2 && (buttons[0].right <= buttons[1].left || buttons[1].right <= buttons[0].left || buttons[0].bottom <= buttons[1].top || buttons[1].bottom <= buttons[0].top); }));
check('Source-text actions remain separate at 320px', narrowTextActions.length > 0 && narrowTextActions.every(Boolean), JSON.stringify(narrowTextActions));
await mobile.screenshot({ path: resolve(outputDir, 'loaded-narrow-mobile.png'), fullPage: true });

const nonGet = requests.filter((request) => request.method !== 'GET' && !request.url.startsWith('blob:') && !request.url.startsWith('data:'));
check('PDF file processing makes no upload requests', nonGet.length === 0, JSON.stringify(nonGet));
await writeFile(resolve(outputDir, 'results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), origin: quickKitOrigin, browser: browser.version(), checks, errors }, null, 2));
await mobile.close(); await desktop.close(); await browser.close();
console.log(JSON.stringify({ checks: checks.length, passed: checks.filter((item) => item.pass).length, failures: errors.length, errors }, null, 2));
if (errors.length) process.exitCode = 1;
