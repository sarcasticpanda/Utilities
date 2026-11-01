import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth/mammoth.browser.js';
import DOMPurify from 'dompurify';
import { createDocxFromPdfPages } from './pdf-to-docx.js';
import { extractPdfPagesText } from './pdf-text-extractor.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const $ = (selector) => document.querySelector(selector);
const docxInput = $('#docx-source');
const pdfInput = $('#pdf-source');
const docxDropzone = $('#docx-dropzone');
const pdfDropzone = $('#pdf-dropzone');
const docxFrame = $('#docx-preview');
let docxFile = null;
let docxHtml = '';
let resultUrl = null;

function renderDocxPreview(content) {
  const safeHtml = DOMPurify.sanitize(content, { USE_PROFILES: { html: true } });
  return new Promise((resolve) => {
    docxFrame.addEventListener('load', resolve, { once: true });
    docxFrame.srcdoc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Word document preview</title><style>
    *{box-sizing:border-box}body{max-width:820px;margin:0 auto;padding:38px 42px;background:#fff;color:#202938;font:11pt/1.45 Arial,Helvetica,sans-serif;overflow-wrap:anywhere}h1,h2,h3,h4{margin:1.2em 0 .5em;line-height:1.2}p{margin:.55em 0}ul,ol{padding-left:1.5em}table{width:100%;border-collapse:collapse;margin:12px 0}td,th{border:1px solid #9aa7b7;padding:5px 7px;vertical-align:top}img{max-width:100%;height:auto}blockquote{margin:12px 0;padding-left:13px;border-left:3px solid #c6d3e1;color:#526174}@page{margin:18mm}@media print{body{max-width:none;margin:0;padding:0;background:white;color:#111}a{color:inherit;text-decoration:none}tr,img{break-inside:avoid}}
    </style></head><body>${safeHtml}</body></html>`;
  });
}

function setDropState(zone, active) { zone.classList.toggle('is-dragging', active); }

function handleDrop(zone, input, callback) {
  zone.addEventListener('dragover', (event) => { event.preventDefault(); setDropState(zone, true); });
  zone.addEventListener('dragleave', () => setDropState(zone, false));
  zone.addEventListener('drop', (event) => {
    event.preventDefault(); setDropState(zone, false);
    const file = event.dataTransfer?.files?.[0];
    if (file) { input.files = event.dataTransfer.files; callback(file); }
  });
}

async function prepareDocx(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.docx')) { $('#docx-status').textContent = 'Choose a .docx Word file. Older .doc files are not supported.'; $('#print-docx').disabled = true; return; }
  if (file.size > 30 * 1024 * 1024) { $('#docx-status').textContent = 'This Word document is over the 30 MB limit. Choose a smaller file.'; $('#print-docx').disabled = true; return; }
  docxFile = file; docxHtml = '';
  $('#docx-status').textContent = 'Reading the Word document and preparing a print preview…';
  $('#print-docx').disabled = true; $('#clear-docx').disabled = false;
  try {
    const { value, messages = [] } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    if (!value.replace(/<[^>]*>/gu, '').trim()) throw new Error('No readable document text was found.');
    docxHtml = value;
    await renderDocxPreview(value);
    docxFrame.hidden = false;
    $('#print-docx').disabled = false;
    $('#docx-status').textContent = messages.length
      ? `Preview ready with ${messages.length} layout note${messages.length === 1 ? '' : 's'}. Review it, then choose Save as PDF in the print dialog.`
      : 'Preview ready. Review it, then choose Save as PDF in the print dialog.';
  } catch (error) {
    docxFrame.hidden = true;
    $('#docx-status').textContent = `Could not read this Word document: ${error?.message || 'Choose another .docx file.'}`;
  }
}

docxInput.addEventListener('change', () => prepareDocx(docxInput.files?.[0]));
handleDrop(docxDropzone, docxInput, prepareDocx);
$('#print-docx').addEventListener('click', () => {
  if (!docxFile || !docxHtml || !docxFrame.contentWindow) return;
  docxFrame.contentWindow.focus();
  docxFrame.contentWindow.print();
});
$('#clear-docx').addEventListener('click', () => {
  docxFile = null; docxHtml = ''; docxInput.value = '';
  docxFrame.srcdoc = ''; docxFrame.hidden = true;
  $('#print-docx').disabled = true; $('#clear-docx').disabled = true;
  $('#docx-status').textContent = 'Choose a .docx file to make a print-ready preview.';
});

function cleanupPdfResult() {
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = null; $('#pdf-result').replaceChildren(); $('#pdf-result').hidden = true;
}

let extractedPdfPages = null;
let pdfOcrWorker = null;
let cancelPdfOcr = false;
let pdfConversionGeneration = 0;
const OCR_MAX_SCANNED_PAGES = 30;
const OCR_PAGE_TIMEOUT_MS = 90000;

function resetPdfConversion() {
  pdfConversionGeneration += 1; cancelPdfOcr = true;
  const staleWorker = pdfOcrWorker; pdfOcrWorker = null;
  if (staleWorker) staleWorker.terminate().catch(() => {});
  cleanupPdfResult(); extractedPdfPages = null; cancelPdfOcr = false;
  $('#pdf-ocr-review').hidden = true; $('#pdf-ocr-review-list').replaceChildren();
  $('#cancel-pdf-ocr').hidden = true; $('#create-reviewed-docx').disabled = false;
  $('#convert-pdf-docx').textContent = 'Extract text and scan pages';
}

function safeDocxBaseName(file) {
  return file.name.replace(/\.pdf$/iu, '').replace(/[^\p{L}\p{N}._-]+/gu, '-').slice(0, 100) || 'document';
}

async function createWordDownload(file, pages) {
  const lineCount = pages.reduce((total, page) => total + page.lines.length, 0);
  if (!lineCount) throw new Error('No text was found. Enter or review recognized text before creating the Word file.');
  const blob = await createDocxFromPdfPages(pages, file.name.replace(/\.pdf$/iu, ''));
  cleanupPdfResult(); resultUrl = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.className = 'download-link'; link.href = resultUrl;
  link.download = `${safeDocxBaseName(file)}-converted.docx`; link.textContent = 'Download editable Word file';
  $('#pdf-result').replaceChildren(link); $('#pdf-result').hidden = false;
  $('#pdf-status').textContent = `Created a Word document from ${lineCount} text lines on ${pages.filter((page) => page.lines.length).length} of ${pages.length} pages. Review its reading order and layout in Word.`;
}

async function renderOcrReview(scannedPages) {
  const container = $('#pdf-ocr-review-list'); container.replaceChildren();
  for (const page of scannedPages) {
    const section = document.createElement('section'); section.className = 'pdf-ocr-review-page';
    const label = document.createElement('label'); label.htmlFor = `ocr-page-${page.pageNumber}`; label.textContent = `Scanned page ${page.pageNumber}`;
    const note = document.createElement('small');
    if (page.ocrConfidence === null) note.textContent = 'English OCR completed. Check every line before export.';
    else if (page.ocrConfidence < 60) {
      note.classList.add('is-low-confidence');
      note.textContent = `Low OCR engine score: ${page.ocrConfidence}/100. Handwriting or poor image quality may be misread; verify every character. This is not an accuracy score.`;
    } else note.textContent = `OCR engine score: ${page.ocrConfidence}/100. It is not an accuracy score; check every line before export.`;
    const textarea = document.createElement('textarea'); textarea.id = label.htmlFor; textarea.dataset.pageNumber = String(page.pageNumber);
    textarea.value = page.ocrText || ''; textarea.spellcheck = false;
    textarea.setAttribute('aria-label', `Recognized text from scanned page ${page.pageNumber}`);
    section.append(label, note, textarea); container.append(section);
  }
  $('#pdf-ocr-review').hidden = false;
  $('#pdf-status').textContent = `OCR finished on ${scannedPages.length} scanned page${scannedPages.length === 1 ? '' : 's'}. Review and correct the text below before exporting; selectable text from other pages is already included.`;
}

async function recognizeScannedPages(file, scannedPages, jobId) {
  if (scannedPages.length > OCR_MAX_SCANNED_PAGES) throw new Error(`This file has ${scannedPages.length} image-only pages. OCR is limited to ${OCR_MAX_SCANNED_PAGES} scanned pages per run; split the PDF and try again.`);
  cancelPdfOcr = false; $('#cancel-pdf-ocr').hidden = false; $('#convert-pdf-docx').disabled = true;
  let documentTask; let worker;
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    $('#pdf-status').textContent = 'Loading the English OCR engine. Your document stays in this browser; English recognition data is downloaded from a public CDN.';
    const { createWorker } = await import('tesseract.js');
    worker = await createWorker('eng', 1, { logger: (progress) => {
      if (jobId !== pdfConversionGeneration) return;
      if (progress.status === 'recognizing text') $('#pdf-status').textContent = `Recognizing scanned pages… ${Math.round((progress.progress || 0) * 100)}%`;
      else if (progress.status === 'loading language traineddata') $('#pdf-status').textContent = 'Downloading English recognition data…';
    } });
    if (jobId === pdfConversionGeneration) pdfOcrWorker = worker;
    if (cancelPdfOcr || jobId !== pdfConversionGeneration) throw new Error('OCR cancelled.');
    documentTask = pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false });
    const pdf = await documentTask.promise;
    for (const pageData of scannedPages) {
      if (cancelPdfOcr || jobId !== pdfConversionGeneration) throw new Error('OCR cancelled.');
      const page = await pdf.getPage(pageData.pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(3, 2400 / Math.max(baseViewport.width, baseViewport.height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('This browser could not create an OCR canvas.');
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.filter = 'grayscale(1) contrast(1.3)';
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      context.filter = 'none';
      let timeoutId; let recognition;
      const recognizeTask = worker.recognize(canvas);
      try {
        recognition = await Promise.race([recognizeTask, new Promise((_, reject) => {
          timeoutId = window.setTimeout(() => reject(new Error(`OCR timed out on page ${pageData.pageNumber}.`)), OCR_PAGE_TIMEOUT_MS);
        })]);
      } finally { window.clearTimeout(timeoutId); canvas.width = 0; canvas.height = 0; }
      if (cancelPdfOcr || jobId !== pdfConversionGeneration) throw new Error('OCR cancelled.');
      pageData.ocrText = recognition.data.text?.trim() || '';
      pageData.ocrConfidence = Number.isFinite(recognition.data.confidence) ? Math.round(recognition.data.confidence) : null;
    }
    if (jobId === pdfConversionGeneration) await renderOcrReview(scannedPages);
  } catch (error) {
    if (jobId === pdfConversionGeneration) {
      $('#pdf-status').textContent = cancelPdfOcr || error?.message === 'OCR cancelled.' ? 'OCR cancelled. Select the PDF again to start over.' : `OCR stopped: ${error?.message || 'The scanned pages could not be recognized.'} You can retry by selecting the PDF again.`;
      extractedPdfPages = null;
    }
  } finally {
    if (documentTask) await documentTask.destroy().catch(() => {});
    if (worker) await worker.terminate().catch(() => {});
    if (pdfOcrWorker === worker) pdfOcrWorker = null;
    if (jobId === pdfConversionGeneration) {
      $('#cancel-pdf-ocr').hidden = true; $('#convert-pdf-docx').disabled = !pdfInput.files?.length;
      $('#convert-pdf-docx').textContent = 'Extract text and scan pages';
    }
  }
}

async function convertPdfToDocx(file) {
  resetPdfConversion();
  if (!file) return;
  if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) { $('#pdf-status').textContent = 'Choose a PDF file.'; $('#convert-pdf-docx').disabled = true; return; }
  if (file.size > 100 * 1024 * 1024) { $('#pdf-status').textContent = 'This PDF is over the 100 MB limit. Choose a smaller file.'; $('#convert-pdf-docx').disabled = true; return; }
  $('#pdf-status').textContent = `${file.name} is ready to extract selectable text and scan image-only pages.`;
  $('#convert-pdf-docx').disabled = false;
}

pdfInput.addEventListener('change', () => convertPdfToDocx(pdfInput.files?.[0]));
handleDrop(pdfDropzone, pdfInput, convertPdfToDocx);
$('#convert-pdf-docx').addEventListener('click', async () => {
  const file = pdfInput.files?.[0]; if (!file) return;
  const jobId = ++pdfConversionGeneration;
  const button = $('#convert-pdf-docx'); button.disabled = true; button.textContent = 'Extracting…';
  $('#pdf-status').textContent = 'Reading text from the PDF in this browser…'; cleanupPdfResult();
  try {
    const pages = await extractPdfPagesText(pdfjsLib, new Uint8Array(await file.arrayBuffer()), (page, total) => { if (jobId === pdfConversionGeneration) $('#pdf-status').textContent = `Reading page ${page} of ${total}…`; });
    if (jobId !== pdfConversionGeneration) return;
    extractedPdfPages = pages;
    const scannedPages = pages.filter((page) => !page.lines.length);
    if (scannedPages.length) await recognizeScannedPages(file, scannedPages, jobId);
    else await createWordDownload(file, pages);
  } catch (error) { if (jobId === pdfConversionGeneration) $('#pdf-status').textContent = `PDF to Word failed: ${error?.message || 'This file may be damaged or unsupported.'}`; }
  finally { if (jobId === pdfConversionGeneration && $('#cancel-pdf-ocr').hidden) { button.disabled = !pdfInput.files?.length; button.textContent = 'Extract text and scan pages'; } }
});

$('#cancel-pdf-ocr').addEventListener('click', async () => {
  cancelPdfOcr = true; $('#pdf-status').textContent = 'Stopping OCR…';
  const worker = pdfOcrWorker; pdfOcrWorker = null;
  if (worker) await worker.terminate().catch(() => {});
});

$('#create-reviewed-docx').addEventListener('click', async () => {
  const file = pdfInput.files?.[0]; if (!file || !extractedPdfPages) return;
  const button = $('#create-reviewed-docx'); button.disabled = true; button.textContent = 'Creating Word file…';
  try {
    for (const textarea of $('#pdf-ocr-review-list').querySelectorAll('textarea[data-page-number]')) {
      const page = extractedPdfPages.find((entry) => entry.pageNumber === Number(textarea.dataset.pageNumber));
      if (page) page.lines = textarea.value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
    }
    await createWordDownload(file, extractedPdfPages);
  } catch (error) { $('#pdf-status').textContent = `Word export failed: ${error?.message || 'Review the recognized text and try again.'}`; }
  finally { button.disabled = false; button.textContent = 'Create Word file from reviewed text'; }
});

window.addEventListener('pagehide', () => { cleanupPdfResult(); pdfOcrWorker?.terminate(); });
