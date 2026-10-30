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

async function convertPdfToDocx(file) {
  cleanupPdfResult();
  if (!file) return;
  if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) { $('#pdf-status').textContent = 'Choose a PDF file.'; $('#convert-pdf-docx').disabled = true; return; }
  if (file.size > 100 * 1024 * 1024) { $('#pdf-status').textContent = 'This PDF is over the 100 MB limit. Choose a smaller file.'; $('#convert-pdf-docx').disabled = true; return; }
  $('#pdf-status').textContent = `${file.name} is ready to extract.`;
  $('#convert-pdf-docx').disabled = false;
}

pdfInput.addEventListener('change', () => convertPdfToDocx(pdfInput.files?.[0]));
handleDrop(pdfDropzone, pdfInput, convertPdfToDocx);
$('#convert-pdf-docx').addEventListener('click', async () => {
  const file = pdfInput.files?.[0];
  if (!file) return;
  const button = $('#convert-pdf-docx'); button.disabled = true; button.textContent = 'Extracting…';
  $('#pdf-status').textContent = 'Reading text from the PDF in this browser…';
  cleanupPdfResult();
  try {
    const pages = await extractPdfPagesText(pdfjsLib, new Uint8Array(await file.arrayBuffer()), (page, total) => {
      $('#pdf-status').textContent = `Reading page ${page} of ${total}…`;
    });
    const lineCount = pages.reduce((total, page) => total + page.lines.length, 0);
    if (!lineCount) throw new Error('No selectable text was found. This may be a scanned PDF; run OCR in the PDF editor first.');
    const blob = await createDocxFromPdfPages(pages, file.name.replace(/\.pdf$/iu, ''));
    resultUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.className = 'download-link'; link.href = resultUrl;
    link.download = file.name.replace(/\.pdf$/iu, '').replace(/[^\p{L}\p{N}._-]+/gu, '-').slice(0, 100) + '-converted.docx';
    link.textContent = 'Download editable Word file';
    $('#pdf-result').replaceChildren(link); $('#pdf-result').hidden = false;
    $('#pdf-status').textContent = `Created a Word document from ${lineCount} text lines on ${pages.filter((page) => page.lines.length).length} of ${pages.length} pages. Review reading order and layout in Word.`;
  } catch (error) {
    $('#pdf-status').textContent = `PDF to Word failed: ${error?.message || 'This file may be damaged or unsupported.'}`;
  } finally { button.disabled = !pdfInput.files?.length; button.textContent = 'Extract text and create Word file'; }
});

window.addEventListener('pagehide', cleanupPdfResult);
