import { chromium } from 'playwright';
import { Document, HeadingLevel, Packer, Paragraph } from 'docx';
import mammoth from 'mammoth';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const origin = process.env.QUICKKIT_ORIGIN || 'http://127.0.0.1:4177';
const fixtureDir = path.resolve('qa-results', 'quickkit-document-fixtures');
await mkdir(fixtureDir, { recursive: true });
const checks = [];
function check(name, pass, detail = '') {
  checks.push({ name, pass: Boolean(pass), detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const wordFixture = await Packer.toBuffer(new Document({ sections: [{ children: [
  new Paragraph({ text: 'QuickKit document test', heading: HeadingLevel.HEADING_1 }),
  new Paragraph({ text: 'DOCX to PDF keeps this selectable sentence.' }),
  new Paragraph({ text: 'Second paragraph with bold-ready plain text.' })
]}] }));
await writeFile(path.join(fixtureDir, 'converter-sample.docx'), wordFixture);

const pdfDoc = await PDFDocument.create();
const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
const first = pdfDoc.addPage([612, 792]);
first.drawText('QuickKit extraction fixture', { x: 50, y: 720, size: 18, font, color: rgb(.1, .2, .3) });
first.drawText('Split', { x: 50, y: 680, size: 13, font });
first.drawText('text', { x: 83, y: 680, size: 13, font });
first.drawText('fragments survive extraction.', { x: 111, y: 680, size: 13, font });
first.drawText('Page one includes selectable text.', { x: 50, y: 640, size: 12, font });
const second = pdfDoc.addPage([612, 792]);
second.drawText('Page two text is preserved.', { x: 50, y: 720, size: 12, font });
const pdfFixture = Buffer.from(await pdfDoc.save());
await writeFile(path.join(fixtureDir, 'selectable-sample.pdf'), pdfFixture);

const emptyPdf = await PDFDocument.create(); emptyPdf.addPage([612, 792]);
const scannedPdfFixture = Buffer.from(await emptyPdf.save());
await writeFile(path.join(fixtureDir, 'image-only-sample.pdf'), scannedPdfFixture);

const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const pageErrors = [];
const failedResponses = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') pageErrors.push(`${message.text()} ${JSON.stringify(message.location())}`); });
page.on('response', (response) => { if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`); });

try {
  await page.goto(`${origin}/document-converter.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('#docx-source').setInputFiles({ name: 'converter-sample.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: wordFixture });
  await page.locator('#print-docx').waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('#print-docx').disabled || document.querySelector('#docx-status').textContent.startsWith('Could not'));
  const docxPreview = await page.frameLocator('#docx-preview').locator('body').innerText().catch(() => '');
  check('DOCX upload produces an actual print preview with text', docxPreview.includes('DOCX to PDF keeps this selectable sentence.'), docxPreview.slice(0, 180));
  const printName = page.locator('#docx-actions .download-filename-input');
  check('DOCX to PDF exposes an editable suggested filename', await printName.isVisible() && await printName.inputValue() === 'converter-sample');
  await printName.fill('renamed-conversion');
  check('DOCX filename updates the browser print-to-PDF document title', await page.evaluate(() => document.querySelector('#docx-preview').contentDocument.title) === 'renamed-conversion');
  await page.evaluate(() => { window.__quickkitPrintCalled = false; document.querySelector('#docx-preview').contentWindow.print = () => { window.__quickkitPrintCalled = true; }; });
  await page.locator('#print-docx').click();
  check('DOCX print / Save as PDF action calls the browser print flow', await page.evaluate(() => window.__quickkitPrintCalled));
  await page.screenshot({ path: path.join(fixtureDir, 'docx-to-pdf-preview.png'), fullPage: true });

  await page.locator('#pdf-source').setInputFiles({ name: 'selectable-sample.pdf', mimeType: 'application/pdf', buffer: pdfFixture });
  await page.locator('#convert-pdf-docx').click();
  await page.waitForFunction(() => document.querySelector('#pdf-result .download-link') || document.querySelector('#pdf-status').textContent.startsWith('PDF to Word failed'), null, { timeout: 45000 });
  const conversionStatus = await page.locator('#pdf-status').innerText();
  if (await page.locator('#pdf-result .download-link').count()) {
    const conversionName = page.locator('#pdf-result .download-filename-input');
    check('PDF to DOCX result card mounts an editable filename', await conversionName.isVisible());
    await conversionName.fill('renamed-word-export');
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#pdf-result .download-link').click();
    const download = await downloadPromise;
    check('PDF to DOCX uses the selected name and keeps the Word extension', download.suggestedFilename() === 'renamed-word-export.docx', download.suggestedFilename());
    const outputPath = path.join(fixtureDir, 'converted-sample.docx');
    await download.saveAs(outputPath);
    const rawText = await mammoth.extractRawText({ buffer: await readFile(outputPath) });
    const outputText = rawText.value.replace(/\s+/gu, ' ').trim();
    check('PDF to DOCX creates a valid Word package with extracted text from both pages', outputText.includes('QuickKit extraction fixture') && outputText.includes('Split text fragments survive extraction.') && outputText.includes('Page two text is preserved.'), outputText);
  } else check('PDF to DOCX reports an actionable error for the text fixture', false, conversionStatus);
  check('PDF to DOCX reports pages and text lines', /Created a Word document/.test(conversionStatus), conversionStatus);

  await page.goto(`${origin}/pdf-editor.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('#pdf-source').setInputFiles({ name: 'selectable-sample.pdf', mimeType: 'application/pdf', buffer: pdfFixture });
  await page.locator('#pdf-workspace').waitFor({ state: 'visible' });
  check('PDF extraction panel stays hidden until extraction is requested', await page.locator('#pdf-extract-panel').isHidden() && await page.locator('#pdf-extracted-text').isHidden().catch(() => true));
  await page.locator('#extract-pdf-text').click();
  check('PDF extraction panel opens when the extraction action starts', await page.locator('#pdf-extract-panel').isVisible());
  await page.waitForFunction(() => document.querySelector('#pdf-extracted-text').value.includes('Page two text is preserved.'));
  const extracted = await page.locator('#pdf-extracted-text').inputValue();
  check('PDF editor extracts text from every page including split text operations', extracted.includes('Split text fragments survive extraction.') && extracted.includes('Page two text is preserved.'), extracted);
  const editorDocxName = page.locator('#pdf-extract-panel .download-filename-control input');
  check('PDF editor extraction exposes an editable shared TXT/Word filename', await editorDocxName.isVisible());
  await editorDocxName.fill('renamed-extracted-text');
  const editorTextDownloadPromise = page.waitForEvent('download');
  await page.locator('#download-pdf-text').click();
  const editorTextDownload = await editorTextDownloadPromise;
  check('PDF editor text export uses the chosen name and .txt extension', editorTextDownload.suggestedFilename() === 'renamed-extracted-text.txt', editorTextDownload.suggestedFilename());
  const editorDocxPromise = page.waitForEvent('download');
  await page.locator('#download-pdf-docx').click();
  const editorDocx = await editorDocxPromise;
  check('PDF editor Word extraction uses the selected name', editorDocx.suggestedFilename() === 'renamed-extracted-text.docx', editorDocx.suggestedFilename());
  const editorDocxPath = path.join(fixtureDir, 'editor-extracted.docx');
  await editorDocx.saveAs(editorDocxPath);
  const editorWordText = (await mammoth.extractRawText({ buffer: await readFile(editorDocxPath) })).value;
  check('PDF editor Word export opens and contains the extracted text', editorWordText.includes('Split text fragments survive extraction.') && editorWordText.includes('Page two text is preserved.'), editorWordText.replace(/\s+/gu, ' ').trim());

  const { PDFDocument: PDFCheck } = await import('pdf-lib');
  const sourcePdf = await PDFCheck.load(pdfFixture);
  check('PDF extraction fixture itself has two real pages and embedded text', sourcePdf.getPageCount() === 2, `pages=${sourcePdf.getPageCount()}`);
  await page.goto(`${origin}/document-converter.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('#pdf-source').setInputFiles({ name: 'image-only-sample.pdf', mimeType: 'application/pdf', buffer: scannedPdfFixture });
  await page.locator('#convert-pdf-docx').click();
  await page.waitForFunction(() => document.querySelector('#pdf-ocr-review').hidden === false || document.querySelector('#pdf-status').textContent.startsWith('OCR stopped'), null, { timeout: 120000 });
  check('Image-only PDF reaches editable OCR review instead of stopping at text extraction', await page.locator('#pdf-ocr-review').isVisible(), await page.locator('#pdf-status').innerText());
  await page.locator('#pdf-ocr-review-list textarea').fill('');
  await page.locator('#create-reviewed-docx').click();
  check('Blank OCR review is refused instead of creating an empty Word document', /No text was found/.test(await page.locator('#pdf-status').innerText()), await page.locator('#pdf-status').innerText());

  const scanImageBytes = Buffer.from(await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 1400; canvas.height = 500;
    const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#111'; context.font = 'bold 64px Arial'; context.fillText('QUICKKIT OCR TEST 741', 80, 190);
    context.font = '40px Arial'; context.fillText('Review this scanned page before export.', 80, 300);
    return new Uint8Array(await (await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))).arrayBuffer());
  }));
  const mixedScanDoc = await PDFDocument.create();
  const scanImage = await mixedScanDoc.embedPng(scanImageBytes);
  const scannedPage = mixedScanDoc.addPage([700, 250]); scannedPage.drawImage(scanImage, { x: 0, y: 0, width: 700, height: 250 });
  const nativePage = mixedScanDoc.addPage([612, 792]); nativePage.drawText('Native text page stays in the same Word export.', { x: 48, y: 720, size: 14, font: await mixedScanDoc.embedFont(StandardFonts.Helvetica) });
  const mixedScanFixture = Buffer.from(await mixedScanDoc.save());
  await page.locator('#pdf-source').setInputFiles({ name: 'mixed-scanned-sample.pdf', mimeType: 'application/pdf', buffer: mixedScanFixture });
  await page.locator('#convert-pdf-docx').click();
  await page.locator('#cancel-pdf-ocr').waitFor({ state: 'visible' });
  await page.locator('#cancel-pdf-ocr').click();
  await page.waitForFunction(() => document.querySelector('#pdf-status').textContent.startsWith('OCR cancelled'));
  check('Cancel scan stops OCR cleanly and restores the converter', await page.locator('#cancel-pdf-ocr').isHidden() && await page.locator('#convert-pdf-docx').isEnabled(), await page.locator('#pdf-status').innerText());
  await page.locator('#pdf-source').setInputFiles({ name: 'mixed-scanned-sample.pdf', mimeType: 'application/pdf', buffer: mixedScanFixture });
  await page.locator('#convert-pdf-docx').click();
  await page.waitForFunction(() => document.querySelector('#pdf-ocr-review').hidden === false || document.querySelector('#pdf-status').textContent.startsWith('OCR stopped'), null, { timeout: 120000 });
  const recognizedSample = await page.locator('#pdf-ocr-review-list textarea').inputValue().catch(() => '');
  check('Browser OCR recognizes a generated image-only page with a known numeric marker', /741/u.test(recognizedSample), `recognizedChars=${recognizedSample.length}; ${await page.locator('#pdf-status').innerText()}`);
  check('Mixed PDF keeps its native text page while scanned text is reviewed', await page.locator('#pdf-ocr-review-list textarea').count() === 1 && await page.locator('#pdf-ocr-review-list label').innerText() === 'Scanned page 1');
  await page.screenshot({ path: path.join(fixtureDir, 'ocr-review-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const ocrMobileFit = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, review: (() => { const rect = document.querySelector('#pdf-ocr-review').getBoundingClientRect(); return { left: rect.left, right: rect.right }; })() }));
  check('OCR review fits a 390px phone viewport without horizontal overflow', ocrMobileFit.scroll <= ocrMobileFit.viewport + 1 && ocrMobileFit.review.left >= 0 && ocrMobileFit.review.right <= 391, JSON.stringify(ocrMobileFit));
  await page.locator('#pdf-ocr-review').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(fixtureDir, 'ocr-review-mobile.png'), fullPage: false });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#pdf-ocr-review-list textarea').fill('OCR reviewed text: 741');
  await page.locator('#create-reviewed-docx').click();
  await page.locator('#pdf-result .download-link').waitFor();
  const reviewedWordDownload = page.waitForEvent('download');
  await page.locator('#pdf-result .download-link').click();
  const reviewedWord = await reviewedWordDownload;
  const reviewedWordPath = path.join(fixtureDir, 'reviewed-ocr-conversion.docx'); await reviewedWord.saveAs(reviewedWordPath);
  const reviewedText = (await mammoth.extractRawText({ buffer: await readFile(reviewedWordPath) })).value;
  check('Reviewed OCR and native page text both survive the DOCX export and reopen', reviewedText.includes('OCR reviewed text: 741') && reviewedText.includes('Native text page stays in the same Word export.'), reviewedText.replace(/\s+/gu, ' ').trim());

  await page.goto(`${origin}/image-to-pdf.html`, { waitUntil: 'domcontentloaded' });
  const imageBytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#c82737'; ctx.fillRect(0, 0, 320, 480); ctx.fillStyle = '#2b70cf'; ctx.fillRect(320, 0, 320, 480);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  const imageBuffer = Buffer.from(imageBytes);
  await page.locator('#image-files').setInputFiles([
    { name: 'two-color-sample.png', mimeType: 'image/png', buffer: imageBuffer },
    { name: 'two-color-second.png', mimeType: 'image/png', buffer: imageBuffer }
  ]);
  await page.locator('#image-gallery li').first().waitFor();
  check('Multiple photos load for one multi-page PDF', await page.locator('#image-gallery li').count() === 2);
  const photoNamesBeforeDrag = await page.locator('#image-gallery .gallery-file-name').evaluateAll((nodes) => nodes.map((node) => node.childNodes[0].textContent.trim()));
  await page.locator('#image-gallery li').first().dragTo(page.locator('#image-gallery li').last());
  const photoNamesAfterDrag = await page.locator('#image-gallery .gallery-file-name').evaluateAll((nodes) => nodes.map((node) => node.childNodes[0].textContent.trim()));
  check('Image gallery drag changes the final page order', photoNamesBeforeDrag.join(',') !== photoNamesAfterDrag.join(',') && photoNamesAfterDrag.at(-1) === photoNamesBeforeDrag[0], `${photoNamesBeforeDrag.join(',')} → ${photoNamesAfterDrag.join(',')}`);
  await page.locator('#deselect-all').click();
  check('Deselect all excludes every photo and disables PDF creation', await page.locator('#image-gallery input[type=checkbox]:checked').count() === 0 && await page.locator('#convert-images').isDisabled());
  await page.locator('#select-all').click();
  check('Select all includes every photo again', await page.locator('#image-gallery input[type=checkbox]:checked').count() === 2);
  await page.locator('#image-filter').selectOption('grayscale');
  const previewFilter = await page.locator('.cropper-canvas img').first().evaluate((image) => getComputedStyle(image).filter);
  check('Image filter visibly updates the crop preview before Apply', previewFilter.includes('grayscale(1)'), previewFilter);
  await page.locator('#apply-edit').click();
  await page.waitForFunction(() => [...document.querySelectorAll('#image-gallery li')].some((item) => item.querySelector('.gallery-file-meta')?.textContent.includes('edited')));
  const editedPixel = await page.locator('#image-gallery li').filter({ hasText: 'two-color-sample.png' }).locator('img').evaluate(async (image) => {
    await image.decode(); const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return { r, g, b, difference: Math.max(r, g, b) - Math.min(r, g, b) };
  });
  check('Applied grayscale filter changes the edited output image pixels', editedPixel.difference <= 3, JSON.stringify(editedPixel));
  await page.locator('#apply-filter-all').click();
  await page.waitForFunction(() => document.querySelector('#image-pdf-message').textContent.includes('Applied the same filter'));
  const bulkFilterPixels = await page.locator('#image-gallery li img').evaluateAll(async (images) => Promise.all(images.map(async (image) => {
    await image.decode(); const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return Math.max(r, g, b) - Math.min(r, g, b);
  })));
  check('Apply same filter updates every image output', bulkFilterPixels.length === 2 && bulkFilterPixels.every((difference) => difference <= 3), JSON.stringify(bulkFilterPixels));
  await page.locator('#page-margin').selectOption('20');
  await page.locator('#page-orientation').selectOption('landscape');
  await page.locator('#convert-images').click();
  await page.locator('#image-pdf-result .download-link').waitFor();
  const imagePdfPromise = page.waitForEvent('download');
  await page.locator('#image-pdf-result .download-link').click();
  const imagePdfDownload = await imagePdfPromise;
  const exportedPdfPath = path.join(fixtureDir, 'filtered-image.pdf'); await imagePdfDownload.saveAs(exportedPdfPath);
  const exportedPdf = await PDFCheck.load(await readFile(exportedPdfPath));
  check('Image-to-PDF export contains two ordered pages with the selected landscape orientation', exportedPdf.getPageCount() === 2 && exportedPdf.getPages().every((pdfPage) => pdfPage.getWidth() > pdfPage.getHeight()), `pages=${exportedPdf.getPageCount()}`);
  await page.goto(`${origin}/pdf-editor.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('#pdf-source').setInputFiles({ name: 'filtered-image.pdf', mimeType: 'application/pdf', buffer: await readFile(exportedPdfPath) });
  await page.locator('#pdf-workspace').waitFor({ state: 'visible' });
  await page.locator('#pdf-page-stage canvas').waitFor({ state: 'visible' });
  const renderedChannels = await page.locator('#pdf-page-stage canvas').first().evaluate((canvas) => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const center = ctx.getImageData(Math.floor(canvas.width / 2) + 15, Math.floor(canvas.height / 2), 1, 1).data;
    const edge = ctx.getImageData(Math.floor(canvas.width / 2), 5, 1, 1).data;
    return { r: center[0], g: center[1], b: center[2], difference: Math.max(center[0], center[1], center[2]) - Math.min(center[0], center[1], center[2]), edge: [...edge] };
  });
  check('Exported PDF renders with the grayscale filter and a visible 20 mm margin', renderedChannels.difference <= 3 && renderedChannels.edge.every((channel) => channel > 245), JSON.stringify(renderedChannels));
  await page.locator('#page-next').click();
  await page.waitForFunction(() => document.querySelector('#page-indicator')?.textContent === 'Page 2 of 2');
  const secondPageEdge = await page.locator('#pdf-page-stage canvas').first().evaluate((canvas) => [...canvas.getContext('2d', { willReadFrequently: true }).getImageData(Math.floor(canvas.width / 2), 5, 1, 1).data]);
  check('Global margin is applied to every selected photo page', secondPageEdge.every((channel) => channel > 245), JSON.stringify(secondPageEdge));

  await page.goto(`${origin}/document-converter.html`, { waitUntil: 'domcontentloaded' });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const layout = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, panels: [...document.querySelectorAll('.document-converter-panel')].map((panel) => ({ left: panel.getBoundingClientRect().left, right: panel.getBoundingClientRect().right })) }));
    check(`Document converter fits ${width}px mobile viewport without horizontal overflow`, layout.scroll <= layout.viewport + 1 && layout.panels.every((panel) => panel.left >= 0 && panel.right <= width + 1), JSON.stringify(layout));
  }

  check('No uncaught page errors or failed resource requests occurred', pageErrors.length === 0 && failedResponses.length === 0, [...pageErrors, ...failedResponses].join(' | '));
  await page.screenshot({ path: path.join(fixtureDir, 'filtered-pdf-visible.png'), fullPage: true });
} finally {
  await browser.close();
}

const results = { generatedAt: new Date().toISOString(), origin, checks, failures: checks.filter((entry) => !entry.pass).length };
await writeFile(path.resolve('qa-results', 'quickkit-document-qa.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify({ checks: checks.length, failures: results.failures }, null, 2));
if (results.failures) process.exitCode = 1;
