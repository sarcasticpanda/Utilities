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
  await page.evaluate(() => { window.__quickkitPrintCalled = false; document.querySelector('#docx-preview').contentWindow.print = () => { window.__quickkitPrintCalled = true; }; });
  await page.locator('#print-docx').click();
  check('DOCX print / Save as PDF action calls the browser print flow', await page.evaluate(() => window.__quickkitPrintCalled));
  await page.screenshot({ path: path.join(fixtureDir, 'docx-to-pdf-preview.png'), fullPage: true });

  await page.locator('#pdf-source').setInputFiles({ name: 'selectable-sample.pdf', mimeType: 'application/pdf', buffer: pdfFixture });
  await page.locator('#convert-pdf-docx').click();
  await page.waitForFunction(() => document.querySelector('#pdf-result .download-link') || document.querySelector('#pdf-status').textContent.startsWith('PDF to Word failed'), null, { timeout: 45000 });
  const conversionStatus = await page.locator('#pdf-status').innerText();
  if (await page.locator('#pdf-result .download-link').count()) {
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#pdf-result .download-link').click();
    const download = await downloadPromise;
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
  await page.locator('#extract-pdf-text').click();
  await page.waitForFunction(() => document.querySelector('#pdf-extracted-text').value.includes('Page two text is preserved.'));
  const extracted = await page.locator('#pdf-extracted-text').inputValue();
  check('PDF editor extracts text from every page including split text operations', extracted.includes('Split text fragments survive extraction.') && extracted.includes('Page two text is preserved.'), extracted);
  const editorDocxPromise = page.waitForEvent('download');
  await page.locator('#download-pdf-docx').click();
  const editorDocx = await editorDocxPromise;
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
  await page.waitForFunction(() => document.querySelector('#pdf-status').textContent.includes('PDF to Word failed'));
  check('Image-only PDF fails clearly instead of producing a blank Word document', /No selectable text was found/.test(await page.locator('#pdf-status').innerText()), await page.locator('#pdf-status').innerText());

  await page.goto(`${origin}/image-to-pdf.html`, { waitUntil: 'domcontentloaded' });
  const imageBytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#c82737'; ctx.fillRect(0, 0, 320, 480); ctx.fillStyle = '#2b70cf'; ctx.fillRect(320, 0, 320, 480);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  const imageBuffer = Buffer.from(imageBytes);
  await page.locator('#image-files').setInputFiles({ name: 'two-color-sample.png', mimeType: 'image/png', buffer: imageBuffer });
  await page.locator('#image-gallery li').waitFor();
  await page.locator('#image-filter').selectOption('grayscale');
  const previewFilter = await page.locator('.cropper-canvas img').first().evaluate((image) => getComputedStyle(image).filter);
  check('Image filter visibly updates the crop preview before Apply', previewFilter.includes('grayscale(1)'), previewFilter);
  await page.locator('#apply-edit').click();
  await page.waitForFunction(() => document.querySelector('#image-gallery img')?.src.startsWith('blob:') && document.querySelector('#image-gallery li .gallery-file-meta')?.textContent.includes('edited'));
  const editedPixel = await page.locator('#image-gallery li img').first().evaluate(async (image) => {
    await image.decode(); const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return { r, g, b, difference: Math.max(r, g, b) - Math.min(r, g, b) };
  });
  check('Applied grayscale filter changes the edited output image pixels', editedPixel.difference <= 3, JSON.stringify(editedPixel));
  await page.locator('#convert-images').click();
  await page.locator('#image-pdf-result .download-link').waitFor();
  const imagePdfPromise = page.waitForEvent('download');
  await page.locator('#image-pdf-result .download-link').click();
  const imagePdfDownload = await imagePdfPromise;
  const exportedPdfPath = path.join(fixtureDir, 'filtered-image.pdf'); await imagePdfDownload.saveAs(exportedPdfPath);
  const exportedPdf = await PDFCheck.load(await readFile(exportedPdfPath));
  check('Image-to-PDF export contains one page with the selected landscape orientation', exportedPdf.getPageCount() === 1 && exportedPdf.getPage(0).getWidth() > exportedPdf.getPage(0).getHeight(), `pages=${exportedPdf.getPageCount()}`);
  await page.goto(`${origin}/pdf-editor.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('#pdf-source').setInputFiles({ name: 'filtered-image.pdf', mimeType: 'application/pdf', buffer: await readFile(exportedPdfPath) });
  await page.locator('#pdf-workspace').waitFor({ state: 'visible' });
  await page.locator('#pdf-page-stage canvas').waitFor({ state: 'visible' });
  const renderedChannels = await page.locator('#pdf-page-stage canvas').first().evaluate((canvas) => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const { data } = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1);
    return { r: data[0], g: data[1], b: data[2], difference: Math.max(data[0], data[1], data[2]) - Math.min(data[0], data[1], data[2]) };
  });
  check('Exported PDF renders with the grayscale filter applied', renderedChannels.difference <= 3, JSON.stringify(renderedChannels));

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
