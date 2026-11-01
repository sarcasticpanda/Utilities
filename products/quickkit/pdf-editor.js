import { PDFDocument, rgb } from 'pdf-lib';
import { createPdfToolkit } from 'pdfstudio';
import qpdfWasmUrl from 'pdfstudio/qpdf.wasm?url';
import { applyEditablePdfText, canEncodePdfText, scanEditablePdfPage } from './pdf-source-text.js';

let pdfjsLib = null;
let pdfjsLoadPromise = null;

async function ensurePdfJs() {
  pdfjsLoadPromise ||= Promise.all([
    import('pdfjs-dist/build/pdf.mjs'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  }).catch((error) => {
    pdfjsLoadPromise = null;
    throw error;
  });
  pdfjsLib = await pdfjsLoadPromise;
  return pdfjsLib;
}

const $ = (selector) => document.querySelector(selector);
const sourceInput = $('#pdf-source');
const dropzone = $('#pdf-dropzone');
const uploadPanel = $('#pdf-upload-panel');
const workspace = $('#pdf-workspace');
const stage = $('#pdf-page-stage');
const pageList = $('#pdf-page-list');
const viewerScroll = $('#pdf-viewer-scroll');
const editorMessage = $('#editor-message');
const editorStatus = $('#pdf-editor-status');
const tools = [...document.querySelectorAll('[data-tool]')];

let sourceBytes = null;
let pdfDocument = null;
let pdfLoadingTask = null;
let originalPageCount = 0;
let pageOrder = [];
let activePosition = 0;
let activeTool = 'select';
let activePageRotation = 0;
let zoom = 1;
let annotationItems = [];
let selectedId = null;
let undoSnapshot = null;
let controlUndoOpen = false;
let renderScale = 1;
let fileName = 'document.pdf';
let itemId = 0;
let lastRenderToken = 0;
let thumbObserver = null;
let signatureHasInk = false;
let ocrWorker = null;
const OCR_PAGE_TIMEOUT_MS = 60000;
let ocrBusy = false;
let ocrCurrentText = '';
let qpdfToolkitPromise = null;
let sourceTextScan = null;
let sourceTextEdits = [];
let extractedPdfPages = [];
let sourceTextPreviewDocument = null;
let sourceTextPreviewTask = null;
let sourceTextPreviewVersion = 0;

const hints = {
  select: 'Select an item to move it. Choose a tool, then click on the page to add it.',
  text: 'Click the page, or focus the page and press Enter to place text at its center. Arrow keys move a selected item.',
  highlight: 'Click the page, or focus the page and press Enter to add a highlight at its center. Arrow keys move a selected item.',
  shape: 'Click the page, or focus the page and press Enter to add a rectangle at its center. Arrow keys move a selected item.',
  image: 'Choose a PNG, JPG or WebP image. It will be placed near the middle of this page.',
  signature: 'Draw a signature in the pad, then place it on this page.',
  redact: 'Drag across text or details to black them out. Download applies the blackout and flattens this page.'
};

function setStatus(text, isError = false) {
  editorStatus.textContent = text;
  editorStatus.style.color = isError ? '#a4503d' : '#4f6f59';
}

function getQpdfToolkit() {
  qpdfToolkitPromise ||= createPdfToolkit({ wasmUrl: qpdfWasmUrl });
  return qpdfToolkitPromise;
}

function updateSourceTextEditCount() {
  const output = $('#pdf-source-text-staged');
  output.hidden = sourceTextEdits.length === 0;
  output.textContent = sourceTextEdits.length ? `${sourceTextEdits.length} direct text ${sourceTextEdits.length === 1 ? 'edit' : 'edits'} appear in the preview and will be saved when you download.` : '';
}

function renderSourceTextScan(scan) {
  sourceTextScan = scan;
  const list = $('#pdf-source-text-list');
  list.replaceChildren();
  const query = $('#pdf-source-text-search').value.trim().toLocaleLowerCase();
  const visibleCandidates = query ? scan.candidates.filter((candidate) => candidate.originalText.toLocaleLowerCase().includes(query)) : scan.candidates;
  for (const candidate of visibleCandidates) {
    const staged = sourceTextEdits.find((edit) => edit.id === candidate.id);
    const row = document.createElement('li'); row.className = 'pdf-source-text-row';
    const original = Object.assign(document.createElement('span'), { className: 'pdf-source-text-original', textContent: candidate.originalText, title: `Original text · ${candidate.fontName} ${candidate.fontSize} pt` });
    const input = Object.assign(document.createElement('input'), { type: 'text', maxLength: 200, value: staged?.text ?? candidate.originalText, ariaLabel: `Replace ${candidate.originalText}` });
    const action = Object.assign(document.createElement('button'), { type: 'button', textContent: staged ? 'Update' : 'Replace' });
    action.addEventListener('click', async () => {
      const text = input.value;
      if (!canEncodePdfText(text, candidate.fontProfile)) {
        $('#pdf-source-text-status').textContent = 'Use one line of characters available in this PDF font. If it is a subset font, some characters may not exist.';
        input.focus(); return;
      }
      await stageSourceTextEdit(candidate, text);
    });
    if (staged) {
      const remove = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Clear edit', ariaLabel: `Clear edit for ${candidate.originalText}` });
      remove.addEventListener('click', async () => { await clearStagedSourceTextEdit(candidate); });
      row.append(original, input, action, remove);
    } else {
      const erase = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Delete text', ariaLabel: `Delete ${candidate.originalText}` });
      erase.addEventListener('click', () => { input.value = ''; action.click(); });
      row.append(original, input, action, erase);
    }
    list.append(row);
  }
  const refusals = $('#pdf-source-text-refusals');
  refusals.replaceChildren();
  scan.unavailable.forEach(({ text, reason }) => {
    const item = document.createElement('li'); item.textContent = text ? `${text} — ${reason}` : reason; refusals.append(item);
  });
  $('#pdf-source-text-unsupported').hidden = scan.unavailable.length === 0;
  if (!scan.candidates.length) {
    const empty = document.createElement('li'); empty.className = 'pdf-source-text-empty';
    empty.textContent = scan.unavailable.length ? 'No text on this page matches the direct-edit limits. See the unsupported lines below.' : 'No directly editable PDF text was found on this page. Scanned pages need OCR first.';
    list.append(empty);
  } else if (!visibleCandidates.length) {
    const empty = document.createElement('li'); empty.className = 'pdf-source-text-empty';
    empty.textContent = 'No editable text runs match this search. Try a shorter word or clear the search.';
    list.append(empty);
  }
  if (currentOriginalPage() === scan.pageIndex) renderDirectTextTargets();
}

async function stageSourceTextEdit(candidate, text) {
  if (!canEncodePdfText(text, candidate.fontProfile)) return false;
  const next = { ...candidate, text };
  rememberUndo();
  sourceTextEdits = sourceTextEdits.filter((edit) => edit.id !== candidate.id);
  if (text !== candidate.originalText) sourceTextEdits.push(next);
  controlUndoOpen = false;
  updateSourceTextEditCount();
  if (sourceTextScan) renderSourceTextScan(sourceTextScan);
  updatePageControls();
  try {
    await refreshSourceTextPreview();
    $('#pdf-source-text-status').textContent = text ? 'Change applied to the page preview. Download to save the edited PDF.' : 'Text removed from the page preview. Download to save the edited PDF.';
    return true;
  } catch (error) {
    setStatus(`The text preview could not be updated: ${error?.message || 'try again or use the text list.'}`, true);
    return false;
  }
}

async function clearStagedSourceTextEdit(candidate) {
  const previousEdits = sourceTextEdits;
  rememberUndo();
  sourceTextEdits = sourceTextEdits.filter((edit) => edit.id !== candidate.id);
  controlUndoOpen = false;
  updateSourceTextEditCount();
  if (sourceTextScan) renderSourceTextScan(sourceTextScan);
  updatePageControls();
  try {
    await refreshSourceTextPreview();
    $('#pdf-source-text-status').textContent = 'Edit cleared. The original text is restored in the page preview.';
  } catch (error) {
    sourceTextEdits = previousEdits;
    updateSourceTextEditCount();
    if (sourceTextScan) renderSourceTextScan(sourceTextScan);
    setStatus(`The page preview could not be restored: ${error?.message || 'try again.'}`, true);
  }
}

async function refreshSourceTextPreview() {
  const version = ++sourceTextPreviewVersion;
  if (!sourceTextEdits.length) {
    const oldTask = sourceTextPreviewTask;
    sourceTextPreviewTask = null; sourceTextPreviewDocument = null;
    await oldTask?.destroy().catch(() => {});
    await renderActivePage(); renderPageList();
    return;
  }
  const downloadButton = $('#download-pdf');
  downloadButton.disabled = true;
  setStatus('Updating the page preview with your text edit…');
  let nextTask = null;
  try {
    await ensurePdfJs();
    const qpdf = await getQpdfToolkit();
    const result = await applyEditablePdfText(sourceBytes, sourceTextEdits, qpdf);
    nextTask = pdfjsLib.getDocument({ data: result.bytes.slice(), isEvalSupported: false });
    const nextDocument = await nextTask.promise;
    if (version !== sourceTextPreviewVersion) { await nextTask.destroy(); return; }
    const oldTask = sourceTextPreviewTask;
    sourceTextPreviewTask = nextTask; sourceTextPreviewDocument = nextDocument; nextTask = null;
    await renderActivePage(); renderPageList();
    await oldTask?.destroy().catch(() => {});
    setStatus('Text edit preview updated. Download to save the PDF.');
  } finally {
    await nextTask?.destroy().catch(() => {});
    downloadButton.disabled = false;
  }
}

function openInlineTextEditor(candidate, rect) {
  stage.querySelector('.pdf-inline-text-editor')?.remove();
  const editor = document.createElement('form'); editor.className = 'pdf-inline-text-editor';
  editor.setAttribute('aria-label', `Edit PDF text: ${candidate.originalText.slice(0, 80)}`);
  const title = document.createElement('strong'); title.textContent = candidate.originalText.slice(0, 90);
  const input = document.createElement('input'); input.type = 'text'; input.maxLength = 200;
  input.value = sourceTextEdits.find((edit) => edit.id === candidate.id)?.text ?? candidate.originalText;
  input.setAttribute('aria-label', 'Replacement text');
  const actions = document.createElement('div'); actions.className = 'pdf-inline-text-actions';
  const save = document.createElement('button'); save.type = 'submit'; save.textContent = 'Apply';
  const clear = document.createElement('button'); clear.type = 'button'; clear.textContent = 'Delete text';
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel';
  const localRect = stage.getBoundingClientRect();
  const left = clamp(rect.left - localRect.left, 4, Math.max(4, stage.clientWidth - 292));
  const targetTop = rect.bottom - localRect.top + 8;
  const top = targetTop + 112 < stage.clientHeight ? targetTop : Math.max(4, rect.top - localRect.top - 112);
  editor.style.left = `${left}px`; editor.style.top = `${top}px`;
  actions.append(save, clear, cancel); editor.append(title, input, actions);
  editor.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!await stageSourceTextEdit(candidate, input.value)) {
      $('#pdf-source-text-status').textContent = 'Use one line of characters available in this PDF font. Some subset-font characters may not exist.';
      input.focus(); return;
    }
    editor.remove();
  });
  clear.addEventListener('click', async () => { if (await stageSourceTextEdit(candidate, '')) editor.remove(); });
  cancel.addEventListener('click', () => editor.remove());
  editor.addEventListener('keydown', (event) => { if (event.key === 'Escape') editor.remove(); });
  stage.append(editor); input.focus(); input.select();
}

function normalizedText(value) { return value.normalize('NFKC').replace(/\s+/gu, '').toLocaleLowerCase(); }

async function renderDirectTextTargets() {
  stage.querySelectorAll('.pdf-direct-text-target').forEach((element) => element.remove());
  if (!sourceTextScan || currentOriginalPage() !== sourceTextScan.pageIndex || $('#pdf-source-text-panel').hidden || !pdfDocument) return;
  const token = lastRenderToken; const scan = sourceTextScan;
  try {
    const page = await pdfDocument.getPage(currentOriginalPage() + 1);
    const content = await page.getTextContent();
    if (token !== lastRenderToken || scan !== sourceTextScan || $('#pdf-source-text-panel').hidden) return;
    const viewport = page.getViewport({ scale: renderScale });
    const textItems = content.items.filter((item) => 'str' in item && item.str.trim());
    let searchableText = '';
    const charToItem = [];
    const charToOffset = [];
    textItems.forEach((item, itemIndex) => {
      const normalized = normalizedText(item.str);
      let offset = 0;
      for (const character of normalized) { searchableText += character; charToItem.push(itemIndex); charToOffset.push(offset++); }
    });
    const occupied = []; let count = 0;
    for (const candidate of scan.candidates) {
      const needle = normalizedText(candidate.originalText);
      if (needle.length < 3) continue;
      let start = -1;
      for (let offset = 0; (offset = searchableText.indexOf(needle, offset)) !== -1; offset += Math.max(1, needle.length)) {
        const end = offset + needle.length;
        if (!occupied.some(([from, to]) => offset < to && end > from)) { start = offset; break; }
      }
      if (start < 0) continue;
      const end = start + needle.length;
      occupied.push([start, end]);
      const itemRanges = new Map();
      for (let index = start; index < end; index++) {
        const itemIndex = charToItem[index]; const charOffset = charToOffset[index];
        if (!itemRanges.has(itemIndex)) itemRanges.set(itemIndex, { from: charOffset, to: charOffset + 1 });
        else itemRanges.get(itemIndex).to = charOffset + 1;
      }
      const bounds = [...itemRanges].map(([index, range]) => {
        const textItem = textItems[index];
        const transform = pdfjsLib.Util.transform(viewport.transform, textItem.transform);
        const fontHeight = Math.max(8, Math.hypot(transform[2], transform[3]));
        const itemWidth = Math.max(fontHeight, Math.abs(textItem.width * renderScale));
        const itemLength = Math.max(1, normalizedText(textItem.str).length);
        const fromRatio = range.from / itemLength; const toRatio = range.to / itemLength;
        const leftRatio = textItem.dir === 'rtl' ? 1 - toRatio : fromRatio;
        const rightRatio = textItem.dir === 'rtl' ? 1 - fromRatio : toRatio;
        const left = transform[4] + itemWidth * leftRatio; const top = transform[5] - fontHeight;
        return { left, top, right: transform[4] + itemWidth * rightRatio, bottom: top + fontHeight + 3, fontHeight };
      });
      if (!bounds.length) continue;
      const left = Math.min(...bounds.map((rect) => rect.left));
      const top = Math.max(0, Math.min(...bounds.map((rect) => rect.top)));
      const right = Math.max(...bounds.map((rect) => rect.right));
      const bottom = Math.max(...bounds.map((rect) => rect.bottom));
      const target = document.createElement('button'); target.type = 'button'; target.className = 'pdf-direct-text-target';
      target.textContent = candidate.originalText; target.title = `Click to edit: ${candidate.originalText.slice(0, 120)}`;
      target.setAttribute('aria-label', `Edit PDF text: ${candidate.originalText.slice(0, 120)}`);
      target.style.left = `${left}px`; target.style.top = `${top}px`;
      target.style.width = `${Math.max(8, right - left)}px`; target.style.height = `${Math.max(11, bottom - top)}px`;
      target.addEventListener('click', () => openInlineTextEditor(candidate, target.getBoundingClientRect()));
      stage.append(target); count++;
    }
    $('#pdf-source-text-status').dataset.directTargets = String(count);
  } catch (error) { console.warn('Could not map editable PDF text onto the page:', error); }
}

function resetSourceTextScan() {
  sourceTextScan = null;
  $('#pdf-source-text-list').replaceChildren();
  $('#pdf-source-text-refusals').replaceChildren();
  $('#pdf-source-text-unsupported').hidden = true;
  $('#pdf-source-text-search').value = '';
  $('#pdf-source-text-status').textContent = `Page ${activePosition + 1} selected. Scan this page to find text that can be changed in place.`;
}

async function scanCurrentSourceText() {
  const button = $('#scan-source-text');
  button.disabled = true; button.textContent = 'Scanning…';
  $('#pdf-source-text-status').textContent = `Loading the on-device PDF engine and scanning page ${activePosition + 1}…`;
  try {
    const qpdf = await getQpdfToolkit();
    const scan = await scanEditablePdfPage(sourceBytes, currentOriginalPage(), qpdf);
    renderSourceTextScan(scan);
    $('#pdf-source-text-status').textContent = `Page ${activePosition + 1}: ${scan.candidates.length} directly editable text ${scan.candidates.length === 1 ? 'run' : 'runs'} found. Click supported text on the page or search below.`;
  } catch (error) {
    console.error('PDF source-text scan failed:', error);
    $('#pdf-source-text-list').replaceChildren();
    $('#pdf-source-text-status').textContent = error?.message || 'This page could not be scanned safely. No changes were made.';
  } finally {
    button.disabled = false; button.textContent = 'Scan this page';
  }
}

async function extractDocumentText() {
  if (!sourceBytes || !pdfDocument) return;
  const button = $('#extract-pdf-text');
  const panel = $('#pdf-extract-panel');
  panel.hidden = false;
  button.disabled = true; button.textContent = 'Extracting…';
  $('#pdf-extract-status').textContent = 'Reading text from page 1…';
  $('#pdf-extracted-text').value = '';
  for (const selector of ['#copy-extracted-text', '#download-pdf-text', '#download-pdf-docx']) $(selector).disabled = true;
  try {
    const { extractPdfPagesText, formatPdfPagesText } = await import('./pdf-text-extractor.js');
    const expectedBytes = sourceBytes;
    const pages = await extractPdfPagesText(pdfjsLib, sourceBytes.slice(), (page, total) => {
      $('#pdf-extract-status').textContent = `Reading text from page ${page} of ${total}…`;
    });
    if (sourceBytes !== expectedBytes) return;
    const text = formatPdfPagesText(pages);
    extractedPdfPages = pages;
    $('#pdf-extracted-text').value = text;
    const lineCount = pages.reduce((total, page) => total + page.lines.length, 0);
    if (!lineCount) {
      $('#pdf-extract-status').textContent = 'No selectable text was found. This may be a scanned PDF. Use Find text (OCR) on a page to recognize text.';
      return;
    }
    for (const selector of ['#copy-extracted-text', '#download-pdf-text', '#download-pdf-docx']) $(selector).disabled = false;
    const pagesWithText = pages.filter((page) => page.lines.length).length;
    $('#pdf-extract-status').textContent = `Extracted ${lineCount} text lines from ${pagesWithText} of ${pages.length} pages. Reading order is best-effort; check the result before using it.`;
  } catch (error) {
    console.error('PDF text extraction failed:', error);
    $('#pdf-extract-status').textContent = `Text extraction failed: ${error?.message || 'This PDF may be damaged or unsupported.'}`;
  } finally {
    button.disabled = false; button.textContent = 'Extract text';
  }
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function setTool(tool) {
  if (tool !== 'select' && tool !== 'redact' && pdfDocument && activePageRotation % 360 !== 0) {
    setStatus('Editing rotated pages is not supported. You can still reorder or delete this page, or open an unrotated copy.', true);
    return;
  }
  activeTool = tool;
  tools.forEach((button) => {
    const selected = button.dataset.tool === tool;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  $('#pdf-tool-hint').textContent = hints[tool];
  stage.dataset.tool = tool;
  if (tool !== 'select') clearSelection();
  if (tool === 'image') $('#pdf-image-input').click();
  if (tool === 'signature') $('#signature-dialog').showModal();
  if (['text', 'highlight', 'shape', 'redact'].includes(tool)) stage.focus({ preventScroll: true });
}

function currentOriginalPage() { return pageOrder[activePosition]; }

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function colorWithAlpha(hex, alpha) {
  const value = (hex || '#000000').replace('#', '');
  const red = parseInt(value.slice(0, 2), 16) || 0;
  const green = parseInt(value.slice(2, 4), 16) || 0;
  const blue = parseInt(value.slice(4, 6), 16) || 0;
  return `rgba(${red},${green},${blue},${clamp(alpha, 0, 1)})`;
}

function getActiveItem() { return annotationItems.find((item) => item.id === selectedId) || null; }

function clearSelection() {
  selectedId = null;
  renderOverlays();
  if (sourceTextScan) renderDirectTextTargets();
  $('#inspector-controls').hidden = true;
  $('.inspector-empty').hidden = false;
}

function selectItem(id) {
  selectedId = id;
  updateInspector();
  renderOverlays();
}

function updateInspector() {
  const item = getActiveItem();
  if (!item) {
    $('#inspector-controls').hidden = true;
    $('.inspector-empty').hidden = false;
    return;
  }
  $('.inspector-empty').hidden = true;
  $('#inspector-controls').hidden = false;
  $('#inspector-title').textContent = ({ text: 'Text', highlight: 'Highlight', shape: 'Rectangle', redact: 'Blackout area', image: 'Image', signature: 'Signature' })[item.kind];
  const help = $('#inspector-help');
  help.hidden = !['redact', 'signature', 'shape'].includes(item.kind);
  help.textContent = item.kind === 'signature'
    ? 'Drag the signature to move it. Drag its blue corner handle or use the width and height controls to resize it. Choose an ink color.'
    : item.kind === 'redact'
      ? 'Drag the blackout to move it. Resize from its blue corner handle or use width and height. Change its color here; download flattens the covered area so text underneath cannot be selected or copied.'
      : item.kind === 'shape'
        ? 'Move or resize the selected shape. Choose a rectangle, oval or line, then set its border and optional fill.'
        : '';
  $('#text-setting').hidden = item.kind !== 'text';
  $('#size-setting').hidden = item.kind !== 'text';
  $('#color-setting').hidden = !['text', 'highlight', 'redact', 'signature'].includes(item.kind);
  $('#item-color-label').textContent = ({ text: 'Text color', highlight: 'Highlight color', redact: 'Blackout color', signature: 'Ink color' })[item.kind] || 'Color';
  $('#shape-type-setting').hidden = item.kind !== 'shape';
  $('#shape-transparent-setting').hidden = item.kind !== 'shape';
  $('#shape-fill-setting').hidden = item.kind !== 'shape' || Number(item.fillOpacity) === 0;
  $('#shape-opacity-setting').hidden = item.kind !== 'shape' || Number(item.fillOpacity) === 0;
  $('#shape-border-color-setting').hidden = item.kind !== 'shape';
  $('#shape-border-width-setting').hidden = item.kind !== 'shape';
  $('#width-setting').hidden = item.kind === 'text';
  $('#height-setting').hidden = item.kind === 'text';
  if (item.kind === 'text') {
    $('#item-text').value = item.text;
    $('#item-size').value = item.fontSize;
  }
  if (item.color) $('#item-color').value = item.color;
  $('#item-shape-type').value = item.shapeType || 'rectangle';
  $('#item-shape-transparent').checked = Number(item.fillOpacity) === 0;
  $('#item-shape-fill').value = item.fillColor || '#f2cf4a';
  $('#item-shape-opacity').value = String(Math.round(Number(item.fillOpacity) || 0));
  $('#item-shape-opacity-value').value = `${Math.round(Number(item.fillOpacity) || 0)}%`;
  $('#item-shape-border-color').value = item.borderColor || '#2864b8';
  $('#item-shape-border-width').value = String(Number(item.borderWidth) ?? 2);
  $('#item-shape-border-width-value').value = `${Number(item.borderWidth) ?? 2} pt`;
  $('#item-width').value = Math.round(item.width * 100);
  $('#item-width-value').value = `${Math.round(item.width * 100)}%`;
  $('#item-height').value = Math.round(item.height * 100);
  $('#item-height-value').value = `${Math.round(item.height * 100)}%`;
}

function updatePageControls() {
  const count = pageOrder.length;
  $('#page-indicator').textContent = `Page ${count ? activePosition + 1 : 0} of ${count}`;
  $('#rail-count').textContent = String(count);
  $('#pdf-page-summary').textContent = `${count} ${count === 1 ? 'page' : 'pages'}`;
  $('#page-previous').disabled = activePosition <= 0;
  $('#page-next').disabled = activePosition >= count - 1;
  $('#page-move-up').disabled = activePosition <= 0;
  $('#page-move-down').disabled = activePosition >= count - 1;
  $('#mobile-page-up').disabled = activePosition <= 0;
  $('#mobile-page-down').disabled = activePosition >= count - 1;
  $('#page-delete').disabled = count <= 1;
  $('#mobile-page-delete').disabled = count <= 1;
  $('#zoom-level').value = `${Math.round(zoom * 100)}%`;
  $('#undo-edit').disabled = !undoSnapshot;
  $('#ocr-current-page').disabled = !pdfDocument || ocrBusy;
  $('#extract-pdf-text').disabled = !pdfDocument || ocrBusy;
}

function clearUndoSnapshot() {
  undoSnapshot?.annotationItems.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
  undoSnapshot = null;
  $('#undo-edit').disabled = true;
}

function rememberUndo() {
  clearUndoSnapshot();
  undoSnapshot = {
    pageOrder: [...pageOrder],
    activePosition,
    selectedId,
    sourceTextEdits: sourceTextEdits.map((edit) => ({ ...edit })),
    annotationItems: annotationItems.map((item) => {
      const copy = { ...item, bytes: item.bytes?.slice(), signatureSourceBytes: item.signatureSourceBytes?.slice() };
      if (copy.bytes) copy.previewUrl = URL.createObjectURL(new Blob([copy.bytes], { type: 'image/png' }));
      return copy;
    })
  };
  $('#undo-edit').disabled = false;
}

function undoLastChange() {
  if (!undoSnapshot) return;
  const currentPage = currentOriginalPage();
  const previousOrder = [...pageOrder];
  const previousTextEdits = JSON.stringify(sourceTextEdits);
  annotationItems.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
  pageOrder = undoSnapshot.pageOrder;
  activePosition = undoSnapshot.activePosition;
  selectedId = undoSnapshot.selectedId;
  annotationItems = undoSnapshot.annotationItems;
  sourceTextEdits = undoSnapshot.sourceTextEdits || [];
  undoSnapshot = null;
  $('#undo-edit').disabled = true;
  controlUndoOpen = false;
  updateInspector(); updateSourceTextEditCount(); if (sourceTextScan) renderSourceTextScan(sourceTextScan); renderPageList();
  if (JSON.stringify(sourceTextEdits) !== previousTextEdits) {
    refreshSourceTextPreview().then(() => setStatus('Last change undone. The page preview is restored.')).catch((error) => setStatus(`The preview could not be refreshed: ${error?.message || 'try again.'}`, true));
  } else {
    if (currentOriginalPage() !== currentPage || pageOrder.some((page, index) => page !== previousOrder[index])) renderActivePage();
    else { renderOverlays(); updatePageControls(); }
    setStatus('Last change undone.');
  }
}

function beginControlUndo() {
  if (controlUndoOpen) return;
  rememberUndo();
  controlUndoOpen = true;
}

function renderPageList() {
  thumbObserver?.disconnect();
  pageList.replaceChildren();
  thumbObserver = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const button = entry.target;
        thumbObserver.unobserve(button);
        renderThumbnail(button);
      }
    });
  }, { root: pageList, rootMargin: '80px' }) : null;

  pageOrder.forEach((originalIndex, position) => {
    const item = document.createElement('li');
    item.draggable = true;
    item.dataset.position = String(position);
    const choose = document.createElement('button');
    choose.type = 'button'; choose.className = 'pdf-thumb-button';
    choose.setAttribute('aria-label', `Show page ${position + 1}`);
    choose.setAttribute('aria-current', String(position === activePosition));
    choose.dataset.originalPage = String(originalIndex);
    const canvas = document.createElement('canvas');
    canvas.width = 80; canvas.height = 105; canvas.setAttribute('aria-hidden', 'true');
    const label = Object.assign(document.createElement('span'), { className: 'pdf-thumb-label', textContent: `Page ${position + 1}` });
    choose.append(canvas, label);
    choose.addEventListener('click', () => goToPosition(position));
    item.append(choose);

    const order = document.createElement('div'); order.className = 'pdf-page-order';
    const up = Object.assign(document.createElement('button'), { type: 'button', textContent: '↑', ariaLabel: `Move page ${position + 1} earlier` });
    const down = Object.assign(document.createElement('button'), { type: 'button', textContent: '↓', ariaLabel: `Move page ${position + 1} later` });
    up.disabled = position === 0; down.disabled = position === pageOrder.length - 1;
    up.addEventListener('click', () => movePage(position, position - 1));
    down.addEventListener('click', () => movePage(position, position + 1));
    order.append(up, down); item.append(order); pageList.append(item);
    item.addEventListener('dragstart', (event) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(position));
      item.classList.add('is-dragging');
    });
    item.addEventListener('dragend', () => item.classList.remove('is-dragging'));
    item.addEventListener('dragover', (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; });
    item.addEventListener('drop', (event) => {
      event.preventDefault();
      const from = Number(event.dataTransfer.getData('text/plain'));
      if (Number.isInteger(from)) reorderPage(from, position);
    });
    if (thumbObserver) thumbObserver.observe(choose); else renderThumbnail(choose);
  });
  updatePageControls();
}

async function renderThumbnail(button) {
  const displayDocument = sourceTextPreviewDocument || pdfDocument;
  if (!displayDocument || !button.isConnected) return;
  const originalIndex = Number(button.dataset.originalPage);
  try {
    const page = await displayDocument.getPage(originalIndex + 1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(0.17, 76 / base.width, 94 / base.height);
    const viewport = page.getViewport({ scale });
    const canvas = button.querySelector('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width * 1.5));
    canvas.height = Math.max(1, Math.floor(viewport.height * 1.5));
    canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
    await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport: page.getViewport({ scale: scale * 1.5 }) }).promise;
  } catch { /* A failed thumbnail must not block editing the selected page. */ }
}

async function renderActivePage() {
  const displayDocument = sourceTextPreviewDocument || pdfDocument;
  if (!displayDocument || !pageOrder.length) return;
  const token = ++lastRenderToken;
  const originalIndex = currentOriginalPage();
  stage.replaceChildren();
  stage.classList.add('is-loading');
  const page = await displayDocument.getPage(originalIndex + 1);
  activePageRotation = page.rotate || 0;
  const base = page.getViewport({ scale: 1 });
  const available = Math.max(220, viewerScroll.clientWidth - 42);
  renderScale = Math.min(1.3, available / base.width) * zoom;
  const viewport = page.getViewport({ scale: renderScale });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width * dpr);
  canvas.height = Math.ceil(viewport.height * dpr);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  stage.style.width = `${viewport.width}px`;
  stage.style.height = `${viewport.height}px`;
  stage.append(canvas);
  const renderViewport = page.getViewport({ scale: renderScale * dpr });
  await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport: renderViewport }).promise;
  if (token !== lastRenderToken) return;
  stage.classList.remove('is-loading');
  renderOverlays();
  if (sourceTextScan) renderDirectTextTargets();
  $('#pdf-ocr-results').replaceChildren();
  $('#copy-ocr-text').hidden = true; ocrCurrentText = '';
  $('#pdf-ocr-status').textContent = '';
  updatePageControls();
  [...pageList.querySelectorAll('.pdf-thumb-button')].forEach((button, position) => button.setAttribute('aria-current', String(position === activePosition)));
}

async function recognizeCurrentPage() {
  const button = $('#ocr-current-page');
  const sourceCanvas = stage.querySelector('canvas');
  if (!sourceCanvas || stage.classList.contains('is-loading') || ocrBusy) return;
  const recognitionPage = currentOriginalPage();
  const canvas = document.createElement('canvas');
  const scale = Math.min(1.5, 3000 / Math.max(sourceCanvas.width, sourceCanvas.height));
  canvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
  canvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.filter = 'grayscale(1) contrast(1.3)';
  context.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
  context.filter = 'none';
  ocrBusy = true; button.disabled = true; button.textContent = 'Loading OCR…'; button.setAttribute('aria-busy', 'true');
  $('#pdf-ocr-results').replaceChildren();
  const status = $('#pdf-ocr-status');
  status.textContent = 'Loading the free English OCR engine. The PDF stays on your device; OCR assets are downloaded from the public CDN.';
  try {
    const { createWorker } = await import('tesseract.js');
    if (!ocrWorker) ocrWorker = await createWorker('eng', 1, { logger: (progress) => {
      if (progress.status === 'recognizing text') status.textContent = `Recognizing text… ${Math.round((progress.progress || 0) * 100)}%`;
      else if (progress.status === 'loading language traineddata') status.textContent = 'Downloading English recognition data…';
    } });
    let timeoutId;
    let timedOut = false;
    const timeout = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => {
        timedOut = true;
        const error = new Error('OCR took longer than 60 seconds. The page may be unusually complex.');
        error.code = 'OCR_TIMEOUT';
        reject(error);
      }, OCR_PAGE_TIMEOUT_MS);
    });
    let recognition;
    try {
      recognition = await Promise.race([ocrWorker.recognize(canvas, {}, { blocks: true }), timeout]);
    } finally {
      window.clearTimeout(timeoutId);
    }
    const { data } = recognition;
    if (currentOriginalPage() !== recognitionPage) { status.textContent = 'Page changed while OCR was running. Select Find text again on the current page.'; return; }
    const lines = data.blocks?.flatMap((block) => block.paragraphs?.flatMap((paragraph) => paragraph.lines || []) || []) || [];
    const detected = lines.filter((entry) => entry.text?.trim() && entry.bbox && entry.bbox.x1 > entry.bbox.x0 && entry.bbox.y1 > entry.bbox.y0).slice(0, 200);
    const list = $('#pdf-ocr-results');
    if (!detected.length) { status.textContent = 'No text regions were recognized on this page. Try a clearer or larger scan.'; return; }
    detected.forEach((line) => {
      const li = document.createElement('li');
      const recognized = document.createElement('span'); recognized.className = 'pdf-ocr-text'; recognized.textContent = line.text.trim().slice(0, 160);
      const add = document.createElement('button'); add.type = 'button'; add.className = 'pdf-ocr-result'; add.textContent = 'Redact';
      const replace = document.createElement('button'); replace.type = 'button'; replace.className = 'pdf-ocr-result'; replace.textContent = 'Replace text';
      const markRegion = (replacement) => {
        const box = line.bbox;
        const padX = Math.max(2, (box.x1 - box.x0) * .06) / canvas.width;
        const padY = Math.max(2, (box.y1 - box.y0) * .12) / canvas.height;
        const x = clamp(box.x0 / canvas.width - padX, 0, 1);
        const y = clamp(box.y0 / canvas.height - padY, 0, 1);
        const right = clamp(box.x1 / canvas.width + padX, 0, 1);
        const bottom = clamp(box.y1 / canvas.height + padY, 0, 1);
        const width = right - x; const height = bottom - y;
        addItem('redact', x, y, { width, height, color: replacement ? '#ffffff' : '#111111', recognizedText: line.text.trim() });
        if (replacement) {
          const cssHeight = (box.y1 - box.y0) * stage.clientHeight / canvas.height;
          const fontSize = clamp(cssHeight * 72 / (96 * renderScale), 8, 72);
          const textHeight = Math.max(height, fontSize * 96 / 72 * renderScale * 1.5 / stage.clientHeight);
          addItem('text', x, y, { width, height: textHeight, text: line.text.trim(), fontSize, color: '#111111' });
          setStatus('Replacement text is editable in the right-hand settings. Check the OCR and adjust the font size and box before export.');
        } else setStatus('OCR match marked to black out. Check the area before downloading.');
      };
      add.addEventListener('click', () => markRegion(false));
      replace.addEventListener('click', () => markRegion(true));
      li.append(recognized, add, replace); list.append(li);
    });
    ocrCurrentText = detected.map((line) => line.text.trim()).join('\n');
    $('#copy-ocr-text').hidden = false;
    status.textContent = `Found ${detected.length} text regions. Select a result to black it out; check the page because text recognition can be wrong.`;
  } catch (error) {
    if (error?.code === 'OCR_TIMEOUT') {
      const stalledWorker = ocrWorker;
      ocrWorker = null;
      status.textContent = 'OCR timed out on this page. The recognition worker was reset; try again, or use a clearer crop.';
      if (stalledWorker) {
        await Promise.race([
          stalledWorker.terminate().catch(() => {}),
          new Promise((resolve) => window.setTimeout(resolve, 5000))
        ]);
      }
    } else status.textContent = `OCR could not start: ${error?.message || 'check your connection and try again.'}`;
  } finally {
    ocrBusy = false; button.textContent = 'Find text'; button.removeAttribute('aria-busy'); updatePageControls();
  }
}

function renderOverlays() {
  stage.querySelectorAll('.pdf-overlay').forEach((el) => el.remove());
  if (!stage.clientWidth) return;
  const originalIndex = currentOriginalPage();
  annotationItems.filter((item) => item.page === originalIndex).forEach((item) => {
    let element;
    if (item.kind === 'image') {
      element = document.createElement('img');
      element.src = item.previewUrl;
      element.alt = 'Added image';
      element.className = 'pdf-overlay pdf-overlay-image pdf-overlay-image-item';
    } else if (item.kind === 'signature') {
      element = document.createElement('div');
      element.className = 'pdf-overlay pdf-overlay-signature';
      const image = document.createElement('img');
      image.src = item.previewUrl;
      image.alt = 'Added signature';
      image.className = 'pdf-signature-preview';
      const resizeHandle = document.createElement('span');
      resizeHandle.className = 'pdf-signature-resize-handle';
      resizeHandle.setAttribute('aria-label', 'Resize signature');
      element.append(image, resizeHandle);
    } else {
      element = document.createElement('div');
      element.className = `pdf-overlay pdf-overlay-${item.kind}${item.kind === 'shape' ? ` shape-${item.shapeType || 'rectangle'}` : ''}`;
      if (item.kind === 'text') {
        element.textContent = item.text;
        element.style.color = item.color;
        element.style.fontSize = `${item.fontSize * (96 / 72) * renderScale}px`;
        element.style.fontFamily = 'Arial, sans-serif';
      }
      if (item.kind === 'shape') {
        element.style.borderColor = item.borderColor || '#2864b8';
        element.style.borderWidth = `${Math.max(0, Number(item.borderWidth) || 0)}px`;
        element.style.borderStyle = Number(item.borderWidth) > 0 ? 'solid' : 'none';
        element.style.backgroundColor = colorWithAlpha(item.fillColor || '#f2cf4a', Number(item.fillOpacity || 0) / 100);
        element.style.setProperty('--shape-border-color', item.borderColor || '#2864b8');
        element.style.setProperty('--shape-border-width', `${Math.max(1, Number(item.borderWidth) || 1)}px`);
      }
      if (item.kind === 'redact') { element.style.backgroundColor = item.color || '#111111'; element.title = 'Covered information is removed from the downloaded page image.'; }
    }
    element.dataset.id = item.id;
    element.setAttribute('role', 'button');
    element.setAttribute('aria-label', `Select ${item.kind} annotation`);
    element.tabIndex = 0;
    element.style.left = `${item.x * 100}%`;
    element.style.top = `${item.y * 100}%`;
    element.style.width = `${item.width * 100}%`;
    element.style.height = `${item.height * 100}%`;
    if (item.kind === 'highlight') element.style.backgroundColor = `${item.color}88`;
    const canResize = ['signature', 'redact', 'shape', 'highlight', 'image'].includes(item.kind);
    if (canResize && !element.querySelector('.pdf-signature-resize-handle')) {
      const resizeHandle = document.createElement('span');
      resizeHandle.className = 'pdf-signature-resize-handle';
      resizeHandle.setAttribute('aria-label', `Resize ${item.kind}`);
      element.append(resizeHandle);
    }
    if (canResize) element.classList.add('pdf-overlay-resizable');
    element.classList.toggle('is-selected', item.id === selectedId);
    element.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      const resizing = canResize && event.target.closest('.pdf-signature-resize-handle');
      activeTool = 'select';
      tools.forEach((button) => {
        const selected = button.dataset.tool === 'select';
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
      $('#pdf-tool-hint').textContent = hints.select;
      stage.dataset.tool = 'select';
      rememberUndo();
      selectedId = item.id;
      updateInspector();
      stage.querySelectorAll('.pdf-overlay').forEach((overlay) => overlay.classList.toggle('is-selected', overlay.dataset.id === selectedId));
      event.preventDefault();
      stage.setPointerCapture(event.pointerId);
      const startX = event.clientX; const startY = event.clientY;
      const startLeft = item.x; const startTop = item.y; const startWidth = item.width; const startHeight = item.height;
      const rect = stage.getBoundingClientRect();
      const move = (moveEvent) => {
        if (resizing) {
          item.width = clamp(startWidth + (moveEvent.clientX - startX) / rect.width, .08, .75);
          item.height = clamp(startHeight + (moveEvent.clientY - startY) / rect.height, .03, .45);
          item.x = clamp(startLeft, 0, 1 - item.width);
          item.y = clamp(startTop, 0, 1 - item.height);
          $('#item-width').value = String(Math.round(item.width * 100));
          $('#item-width-value').value = `${Math.round(item.width * 100)}%`;
          $('#item-height').value = String(Math.round(item.height * 100));
          $('#item-height-value').value = `${Math.round(item.height * 100)}%`;
        } else {
          item.x = clamp(startLeft + (moveEvent.clientX - startX) / rect.width, 0, 1 - item.width);
          item.y = clamp(startTop + (moveEvent.clientY - startY) / rect.height, 0, 1 - item.height);
        }
        element.style.left = `${item.x * 100}%`;
        element.style.top = `${item.y * 100}%`;
        element.style.width = `${item.width * 100}%`;
        element.style.height = `${item.height * 100}%`;
      };
      const finish = () => {
        stage.removeEventListener('pointermove', move);
        stage.removeEventListener('pointerup', finish);
        stage.removeEventListener('pointercancel', finish);
        controlUndoOpen = false;
        updateInspector();
      };
      stage.addEventListener('pointermove', move);
      stage.addEventListener('pointerup', finish, { once: true });
      stage.addEventListener('pointercancel', finish, { once: true });
    });
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectItem(item.id); }
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeSelectedItem(item.id); }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        const step = event.shiftKey ? .03 : .01;
        if (event.key === 'ArrowLeft') item.x = clamp(item.x - step, 0, 1 - item.width);
        if (event.key === 'ArrowRight') item.x = clamp(item.x + step, 0, 1 - item.width);
        if (event.key === 'ArrowUp') item.y = clamp(item.y - step, 0, 1 - item.height);
        if (event.key === 'ArrowDown') item.y = clamp(item.y + step, 0, 1 - item.height);
        element.style.left = `${item.x * 100}%`; element.style.top = `${item.y * 100}%`;
        updateInspector();
      }
    });
    stage.append(element);
  });
}

function goToPosition(position) {
  activePosition = clamp(position, 0, pageOrder.length - 1);
  resetSourceTextScan();
  clearSelection();
  renderPageList();
  renderActivePage();
}

function movePage(from, to) {
  if (to < 0 || to >= pageOrder.length) return;
  rememberUndo();
  [pageOrder[from], pageOrder[to]] = [pageOrder[to], pageOrder[from]];
  if (activePosition === from) activePosition = to;
  else if (activePosition === to) activePosition = from;
  renderPageList(); renderActivePage();
  setStatus('Page order updated. Download to save your changes.');
}

function reorderPage(from, to) {
  if (from < 0 || to < 0 || from >= pageOrder.length || to >= pageOrder.length || from === to) return;
  rememberUndo();
  const activeOriginalPage = currentOriginalPage();
  const [moved] = pageOrder.splice(from, 1);
  pageOrder.splice(to, 0, moved);
  activePosition = pageOrder.indexOf(activeOriginalPage);
  renderPageList(); renderActivePage();
  setStatus('Page order updated. Download to save your changes.');
}

function deleteActivePage() {
  if (pageOrder.length <= 1) return setStatus('A PDF needs at least one page.', true);
  rememberUndo();
  const removed = pageOrder.splice(activePosition, 1)[0];
  annotationItems = annotationItems.filter((item) => item.page !== removed);
  sourceTextEdits = sourceTextEdits.filter((edit) => edit.pageIndex !== removed);
  updateSourceTextEditCount();
  activePosition = Math.min(activePosition, pageOrder.length - 1);
  resetSourceTextScan();
  clearSelection(); renderPageList(); renderActivePage();
  setStatus(`Page removed. ${pageOrder.length} pages remain. Download to save your changes.`);
}

function addItem(kind, x, y, extra = {}) {
  rememberUndo();
  const defaults = {
    text: { width: 0.35, height: 0.06, text: 'Text', fontSize: 18, color: '#172536' },
    highlight: { width: 0.3, height: 0.055, color: '#f2cf4a' },
    shape: { width: 0.28, height: 0.12, shapeType: 'rectangle', borderColor: '#2864b8', borderWidth: 2, fillColor: '#f2cf4a', fillOpacity: 0 },
    redact: { width: 0.25, height: 0.045, color: '#000000' },
    image: { width: 0.24, height: 0.18 },
    signature: { width: 0.28, height: 0.12 }
  }[kind];
  const item = { id: `annotation-${++itemId}`, kind, page: currentOriginalPage(), x: clamp(x, 0, .96), y: clamp(y, 0, .96), ...defaults, ...extra };
  item.x = clamp(item.x, 0, 1 - item.width);
  item.y = clamp(item.y, 0, 1 - item.height);
  annotationItems.push(item);
  selectItem(item.id);
  return item;
}

function placeActiveTool(x, y) {
  if (activeTool === 'select' || !pdfDocument) return;
  if (activeTool === 'text') addItem('text', x, y);
  if (activeTool === 'highlight') addItem('highlight', x, y);
  if (activeTool === 'shape') addItem('shape', x, y);
  if (activeTool === 'redact') addItem('redact', x, y);
  setTool('select');
  setStatus('Edit added. Drag it to position, adjust it in the panel, then download.');
}

let redactStart = null;
stage.addEventListener('pointerdown', (event) => {
  if (activeTool !== 'redact' || !pdfDocument || event.target.closest('.pdf-overlay')) return;
  const rect = stage.getBoundingClientRect();
  redactStart = { x: clamp((event.clientX - rect.left) / rect.width, 0, 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1), rect, pointerId: event.pointerId };
  stage.setPointerCapture(event.pointerId);
});
stage.addEventListener('pointerup', (event) => {
  if (!redactStart || redactStart.pointerId !== event.pointerId) return;
  const start = redactStart; redactStart = null;
  const endX = clamp((event.clientX - start.rect.left) / start.rect.width, 0, 1);
  const endY = clamp((event.clientY - start.rect.top) / start.rect.height, 0, 1);
  const x = Math.min(start.x, endX); const y = Math.min(start.y, endY);
  const width = Math.abs(endX - start.x); const height = Math.abs(endY - start.y);
  if (width > .006 && height > .003) {
    addItem('redact', x, y, { width, height, color: '#111111' });
    setTool('select');
    setStatus('Blackout added. Check the covered area, then download to apply it. The page will be flattened so the covered text cannot be selected or copied.');
  }
});

stage.addEventListener('click', (event) => {
  if (activeTool === 'select' || !pdfDocument || event.target.closest('.pdf-overlay')) return;
  const rect = stage.getBoundingClientRect();
  const x = clamp((event.clientX - rect.left) / rect.width, 0, .95);
  const y = clamp((event.clientY - rect.top) / rect.height, 0, .95);
  placeActiveTool(x, y);
});

stage.addEventListener('keydown', (event) => {
  if (activeTool !== 'select' && ['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    placeActiveTool(.36, .36);
    return;
  }
  if (!selectedId || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  const item = getActiveItem();
  if (!item) return;
  event.preventDefault();
  const step = event.shiftKey ? .03 : .01;
  if (event.key === 'ArrowLeft') item.x = clamp(item.x - step, 0, 1 - item.width);
  if (event.key === 'ArrowRight') item.x = clamp(item.x + step, 0, 1 - item.width);
  if (event.key === 'ArrowUp') item.y = clamp(item.y - step, 0, 1 - item.height);
  if (event.key === 'ArrowDown') item.y = clamp(item.y + step, 0, 1 - item.height);
  const overlay = stage.querySelector(`[data-id="${item.id}"]`);
  if (overlay) { overlay.style.left = `${item.x * 100}%`; overlay.style.top = `${item.y * 100}%`; }
  updateInspector();
});

function removeSelectedItem(id = selectedId) {
  const item = annotationItems.find((candidate) => candidate.id === id);
  if (!item) return;
  rememberUndo();
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  annotationItems = annotationItems.filter((candidate) => candidate.id !== id);
  clearSelection();
  setStatus('Item removed. Download to save your changes.');
}

async function recolorSignature(item, color) {
  const sourceBytes = item.signatureSourceBytes || item.bytes;
  const bitmap = await createImageBitmap(new Blob([sourceBytes], { type: 'image/png' }));
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  context.drawImage(bitmap, 0, 0); bitmap.close();
  context.globalCompositeOperation = 'source-in';
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not recolor this signature.')), 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

async function normalizeImage(file) {
  if (!/^image\/(png|jpeg|webp)$/u.test(file.type)) throw new Error('Choose a PNG, JPG or WebP image.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Choose an image smaller than 20 MB.');
  const bitmap = await createImageBitmap(file);
  const maxSide = 2400;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not prepare this image.')), 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

$('#pdf-image-input').addEventListener('change', async (event) => {
  const file = event.target.files?.[0]; event.target.value = '';
  if (!file) { setTool('select'); return; }
  try {
    const bytes = await normalizeImage(file);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
    addItem('image', .36, .36, { width: .28, height: .2, bytes, previewUrl: url });
    setStatus('Image added. Drag it to position or adjust its size.');
  } catch (error) { setStatus(error.message || 'Could not add this image.', true); }
  setTool('select');
});

const signatureCanvas = $('#signature-canvas');
const signatureContext = signatureCanvas.getContext('2d');
signatureContext.strokeStyle = '#172536'; signatureContext.lineWidth = 4; signatureContext.lineCap = 'round'; signatureContext.lineJoin = 'round';
let signatureDrawing = false;
function signaturePoint(event) {
  const rect = signatureCanvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * signatureCanvas.width / rect.width, y: (event.clientY - rect.top) * signatureCanvas.height / rect.height };
}
signatureCanvas.addEventListener('pointerdown', (event) => { signatureDrawing = true; signatureCanvas.setPointerCapture(event.pointerId); const p = signaturePoint(event); signatureContext.beginPath(); signatureContext.moveTo(p.x, p.y); });
signatureCanvas.addEventListener('pointermove', (event) => { if (!signatureDrawing) return; const p = signaturePoint(event); signatureContext.lineTo(p.x, p.y); signatureContext.stroke(); signatureHasInk = true; });
for (const type of ['pointerup', 'pointercancel']) signatureCanvas.addEventListener(type, () => { signatureDrawing = false; });
$('#clear-signature').addEventListener('click', () => { signatureContext.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height); signatureHasInk = false; });
$('#close-signature').addEventListener('click', () => { $('#signature-dialog').close(); setTool('select'); });
$('#place-signature').addEventListener('click', async () => {
  if (!signatureHasInk) return setStatus('Draw your signature before placing it.', true);
  const blob = await new Promise((resolve) => signatureCanvas.toBlob(resolve, 'image/png'));
  if (!blob) return setStatus('Could not prepare this signature.', true);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const url = URL.createObjectURL(blob);
  addItem('signature', .35, .76, { width: .3, height: .11, color: '#172536', bytes, signatureSourceBytes: bytes.slice(), previewUrl: url });
  $('#signature-dialog').close(); setTool('select');
  setStatus('Signature added. Drag it to position, then download your PDF.');
});
$('#place-typed-signature').addEventListener('click', () => {
  const text = $('#typed-signature').value.trim();
  if (!text) { $('#typed-signature').focus(); return setStatus('Type a name before placing the signature.', true); }
  addItem('text', .28, .76, { width: .48, height: .1, text, fontSize: 24, color: '#172536', fontFamily: 'cursive' });
  $('#typed-signature').value = '';
  $('#signature-dialog').close(); setTool('select');
  setStatus('Typed signature added. Move it into place, then download your PDF.');
});
$('#undo-edit').addEventListener('click', undoLastChange);

async function loadFile(file) {
  editorMessage.textContent = ''; editorStatus.textContent = '';
  if (!file) return;
  const hadOpenDocument = Boolean(pdfDocument);
  const showInputError = (message) => hadOpenDocument ? setStatus(message, true) : (editorMessage.textContent = message);
  if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) { showInputError('Choose a PDF file.'); return; }
  if (file.size > 100 * 1024 * 1024) { showInputError('This file is over the 100 MB limit. Choose a smaller PDF.'); return; }
  const previousButtonText = $('#download-pdf').textContent;
  let nextLoadingTask = null;
  $('#download-pdf').disabled = true; $('#download-pdf').textContent = 'Opening…';
  try {
    await ensurePdfJs();
    const nextBytes = new Uint8Array(await file.arrayBuffer());
    nextLoadingTask = pdfjsLib.getDocument({ data: nextBytes.slice() });
    const pdfLibPromise = PDFDocument.load(nextBytes.slice());
    const [nextPdfJsDocument] = await Promise.all([nextLoadingTask.promise, pdfLibPromise]);
    if (nextPdfJsDocument.numPages > 200) {
      throw Object.assign(new Error('This PDF has more than 200 pages. Split it into smaller files before editing.'), { name: 'PageLimitError' });
    }
    await pdfLoadingTask?.destroy();
    sourceTextPreviewVersion++;
    await sourceTextPreviewTask?.destroy().catch(() => {});
    sourceTextPreviewTask = null; sourceTextPreviewDocument = null;
    pdfLoadingTask = nextLoadingTask;
    annotationItems.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    sourceBytes = nextBytes;
    sourceTextEdits = []; sourceTextScan = null; updateSourceTextEditCount();
    extractedPdfPages = []; $('#pdf-extract-panel').hidden = true; $('#pdf-extracted-text').value = '';
    $('#pdf-extract-status').textContent = 'Extract text from every page to copy it or create an editable Word document.';
    for (const selector of ['#copy-extracted-text', '#download-pdf-text', '#download-pdf-docx']) $(selector).disabled = true;
    $('#pdf-source-text-list').replaceChildren(); $('#pdf-source-text-search').value = ''; $('#pdf-source-text-status').textContent = 'Scan the selected page to find text that can be changed in place.';
    pdfDocument = nextPdfJsDocument;
    originalPageCount = pdfDocument.numPages;
    pageOrder = Array.from({ length: originalPageCount }, (_, index) => index);
    annotationItems = []; selectedId = null; itemId = 0; activePosition = 0; zoom = 1; fileName = file.name;
    $('#pdf-file-name').textContent = file.name;
    uploadPanel.hidden = true; workspace.hidden = false;
    renderPageList(); await renderActivePage();
    $('#download-pdf').disabled = false;
    $('#download-pdf').textContent = 'Download PDF';
    setStatus('PDF ready. Add items, reorder pages, or delete pages.');
  } catch (error) {
    await nextLoadingTask?.destroy().catch(() => {});
    const explanation = error?.name === 'PasswordException' ? 'Password-protected PDFs are not supported yet.' : error?.name === 'PageLimitError' ? error.message : 'This PDF could not be opened. It may be damaged, encrypted or use an unsupported feature.';
    if (hadOpenDocument) setStatus(explanation, true);
    else editorMessage.textContent = explanation;
    $('#download-pdf').disabled = false; $('#download-pdf').textContent = hadOpenDocument ? previousButtonText : 'Download PDF';
  }
}

sourceInput.addEventListener('change', () => { const file = sourceInput.files?.[0]; sourceInput.value = ''; loadFile(file); });
$('#replace-pdf').addEventListener('click', () => sourceInput.click());
dropzone.addEventListener('dragover', (event) => { event.preventDefault(); dropzone.classList.add('is-dragging'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragging'));
dropzone.addEventListener('drop', (event) => { event.preventDefault(); dropzone.classList.remove('is-dragging'); loadFile(event.dataTransfer.files?.[0]); });
tools.forEach((button) => button.addEventListener('click', () => setTool(button.dataset.tool)));
$('#edit-source-text').addEventListener('click', () => {
  const panel = $('#pdf-source-text-panel');
  panel.hidden = !panel.hidden;
  $('#edit-source-text').setAttribute('aria-expanded', String(!panel.hidden));
  if (!panel.hidden) { $('#scan-source-text').focus(); renderDirectTextTargets(); }
  else stage.querySelectorAll('.pdf-direct-text-target,.pdf-inline-text-editor').forEach((element) => element.remove());
});
$('#pdf-source-text-search').addEventListener('input', () => { if (sourceTextScan) renderSourceTextScan(sourceTextScan); });
$('#scan-source-text').addEventListener('click', scanCurrentSourceText);
$('#ocr-current-page').addEventListener('click', recognizeCurrentPage);
$('#extract-pdf-text').addEventListener('click', extractDocumentText);
$('#copy-extracted-text').addEventListener('click', async () => {
  const text = $('#pdf-extracted-text').value;
  if (!text) return;
  try { await navigator.clipboard.writeText(text); $('#pdf-extract-status').textContent = 'Extracted text copied to the clipboard.'; }
  catch { $('#pdf-extract-status').textContent = 'Clipboard access was blocked. Select the text above and copy it manually.'; }
});
$('#download-pdf-text').addEventListener('click', () => {
  const text = $('#pdf-extracted-text').value;
  if (!text) return;
  const baseName = fileName.replace(/\.pdf$/iu, '').replace(/[^\p{L}\p{N}._-]+/gu, '-').slice(0, 100) || 'document';
  saveBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${baseName}-text.txt`);
});
$('#download-pdf-docx').addEventListener('click', async () => {
  if (!extractedPdfPages.length) return;
  const button = $('#download-pdf-docx'); button.disabled = true; button.textContent = 'Creating Word file…';
  try {
    const { createDocxFromPdfPages } = await import('./pdf-to-docx.js');
    const blob = await createDocxFromPdfPages(extractedPdfPages, fileName.replace(/\.pdf$/iu, ''));
    const baseName = fileName.replace(/\.pdf$/iu, '').replace(/[^\p{L}\p{N}._-]+/gu, '-').slice(0, 100) || 'document';
    saveBlob(blob, `${baseName}-converted.docx`);
    $('#pdf-extract-status').textContent = 'Word document downloaded. Text and page order are included; exact PDF layout, images and tables may need cleanup.';
  } catch (error) {
    $('#pdf-extract-status').textContent = `Could not create the Word file: ${error?.message || 'Try a smaller PDF.'}`;
  } finally { button.disabled = false; button.textContent = 'Download Word file'; }
});
$('#copy-ocr-text').addEventListener('click', async () => {
  if (!ocrCurrentText) return;
  try { await navigator.clipboard.writeText(ocrCurrentText); $('#pdf-ocr-status').textContent = 'Recognized text copied to the clipboard.'; }
  catch { $('#pdf-ocr-status').textContent = 'Clipboard access was blocked by this browser. Select the recognized text above and copy it manually.'; }
});
$('#page-previous').addEventListener('click', () => goToPosition(activePosition - 1));
$('#page-next').addEventListener('click', () => goToPosition(activePosition + 1));
$('#page-move-up').addEventListener('click', () => movePage(activePosition, activePosition - 1));
$('#page-move-down').addEventListener('click', () => movePage(activePosition, activePosition + 1));
$('#mobile-page-up').addEventListener('click', () => movePage(activePosition, activePosition - 1));
$('#mobile-page-down').addEventListener('click', () => movePage(activePosition, activePosition + 1));
$('#page-delete').addEventListener('click', deleteActivePage);
$('#mobile-page-delete').addEventListener('click', deleteActivePage);
$('#zoom-out').addEventListener('click', () => { zoom = clamp(zoom - .1, .6, 1.7); renderActivePage(); updatePageControls(); });
$('#zoom-in').addEventListener('click', () => { zoom = clamp(zoom + .1, .6, 1.7); renderActivePage(); updatePageControls(); });
$('#remove-item').addEventListener('click', () => removeSelectedItem());
$('#item-text').addEventListener('input', (event) => { const item = getActiveItem(); if (!item) return; beginControlUndo(); item.text = event.target.value; renderOverlays(); });
$('#item-size').addEventListener('input', (event) => { const item = getActiveItem(); if (!item) return; beginControlUndo(); item.fontSize = clamp(Number(event.target.value) || 18, 8, 96); renderOverlays(); });
$('#item-color').addEventListener('input', async (event) => {
  const item = getActiveItem(); if (!item) return;
  beginControlUndo();
  const color = event.target.value;
  if (item.kind !== 'signature') { item.color = color; renderOverlays(); return; }
  const revision = item.signatureColorRevision = (item.signatureColorRevision || 0) + 1;
  try {
    const bytes = await recolorSignature(item, color);
    if (item.signatureColorRevision !== revision) return;
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    item.bytes = bytes; item.color = color;
    item.previewUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
    renderOverlays();
  } catch (error) { setStatus(error.message || 'Could not recolor the signature.', true); }
});
$('#item-width').addEventListener('input', (event) => { const item = getActiveItem(); if (!item) return; beginControlUndo(); item.width = Number(event.target.value) / 100; item.x = clamp(item.x, 0, 1 - item.width); $('#item-width-value').value = `${event.target.value}%`; renderOverlays(); });
$('#item-height').addEventListener('input', (event) => { const item = getActiveItem(); if (!item) return; beginControlUndo(); item.height = Number(event.target.value) / 100; item.y = clamp(item.y, 0, 1 - item.height); $('#item-height-value').value = `${event.target.value}%`; renderOverlays(); });
$('#item-shape-type').addEventListener('change', (event) => { const item = getActiveItem(); if (!item || item.kind !== 'shape') return; beginControlUndo(); item.shapeType = event.target.value; renderOverlays(); });
$('#item-shape-transparent').addEventListener('change', (event) => {
  const item = getActiveItem(); if (!item || item.kind !== 'shape') return;
  beginControlUndo(); item.fillOpacity = event.target.checked ? 0 : Math.max(35, Number(item.fillOpacity) || 0);
  $('#item-shape-opacity').value = String(item.fillOpacity); $('#item-shape-opacity-value').value = `${item.fillOpacity}%`;
  updateInspector(); renderOverlays();
});
$('#item-shape-fill').addEventListener('input', (event) => { const item = getActiveItem(); if (!item || item.kind !== 'shape') return; beginControlUndo(); item.fillColor = event.target.value; renderOverlays(); });
$('#item-shape-opacity').addEventListener('input', (event) => {
  const item = getActiveItem(); if (!item || item.kind !== 'shape') return;
  beginControlUndo(); item.fillOpacity = Number(event.target.value); $('#item-shape-opacity-value').value = `${item.fillOpacity}%`;
  $('#item-shape-transparent').checked = item.fillOpacity === 0; updateInspector(); renderOverlays();
});
$('#item-shape-border-color').addEventListener('input', (event) => { const item = getActiveItem(); if (!item || item.kind !== 'shape') return; beginControlUndo(); item.borderColor = event.target.value; renderOverlays(); });
$('#item-shape-border-width').addEventListener('input', (event) => {
  const item = getActiveItem(); if (!item || item.kind !== 'shape') return;
  beginControlUndo(); item.borderWidth = Number(event.target.value); $('#item-shape-border-width-value').value = `${item.borderWidth} pt`; renderOverlays();
});
document.querySelectorAll('#item-text,#item-size,#item-color,#item-width,#item-height,#item-shape-type,#item-shape-transparent,#item-shape-fill,#item-shape-opacity,#item-shape-border-color,#item-shape-border-width').forEach((control) => control.addEventListener('change', () => { controlUndoOpen = false; }));
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === 'z' && undoSnapshot && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); undoLastChange(); }
  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) removeSelectedItem();
  if (event.key === 'Escape' && $('#signature-dialog').open) { $('#signature-dialog').close(); setTool('select'); }
});
window.addEventListener('beforeunload', () => { ocrWorker?.terminate(); });
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (pdfDocument) renderActivePage(); }, 160); });

function pdfColor(hex) {
  const value = hex.replace('#', '');
  return rgb(parseInt(value.slice(0, 2), 16) / 255, parseInt(value.slice(2, 4), 16) / 255, parseInt(value.slice(4, 6), 16) / 255);
}

async function addVectorOverlays(page, output, items) {
  const { width, height } = page.getSize();
  for (const item of items) {
    const x = item.x * width; const w = item.width * width; const h = item.height * height; const yTop = item.y * height;
    if (item.kind === 'text') {
      const size = clamp(Number(item.fontSize) || 18, 8, 96); const scale = 3;
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.ceil(w * scale)); canvas.height = Math.max(1, Math.ceil(h * scale));
      const context = canvas.getContext('2d'); context.scale(scale, scale); context.fillStyle = item.color || '#172536'; context.font = `${size}px ${item.fontFamily || 'Arial, sans-serif'}`; context.textBaseline = 'top';
      item.text.split('\n').forEach((line, index) => context.fillText(line, 0, index * size * 1.2, Math.max(1, w)));
      const textBlob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not render text for this PDF.')), 'image/png'));
      page.drawImage(await output.embedPng(new Uint8Array(await textBlob.arrayBuffer())), { x, y: height - yTop - h, width: w, height: h });
    } else if (item.kind === 'highlight') {
      page.drawRectangle({ x, y: height - yTop - h, width: w, height: h, color: pdfColor(item.color), opacity: .34, borderWidth: 0 });
    } else if (item.kind === 'shape') {
      const shapeOptions = { x, y: height - yTop - h, width: w, height: h, borderColor: pdfColor(item.borderColor || '#2864b8'), borderWidth: Number(item.borderWidth) || 0, borderOpacity: 1, color: pdfColor(item.fillColor || '#f2cf4a'), opacity: clamp(Number(item.fillOpacity) || 0, 0, 100) / 100 };
      if (item.shapeType === 'line') page.drawLine({ start: { x, y: height - yTop }, end: { x: x + w, y: height - yTop - h }, thickness: Math.max(.5, Number(item.borderWidth) || .5), color: pdfColor(item.borderColor || '#2864b8') });
      else if (item.shapeType === 'ellipse') page.drawEllipse(shapeOptions);
      else page.drawRectangle(shapeOptions);
    } else if (item.kind === 'image' || item.kind === 'signature') {
      page.drawImage(await output.embedPng(item.bytes), { x, y: height - yTop - h, width: w, height: h });
    }
  }
}

async function addRasterizedRedactionPage(output, input, sourceDocument, originalIndex, items) {
  const sourcePage = await sourceDocument.getPage(originalIndex + 1);
  const base = sourcePage.getViewport({ scale: 1 });
  const safeScale = Math.min(2, Math.sqrt(16_000_000 / (base.width * base.height)));
  const viewport = sourcePage.getViewport({ scale: Math.max(.6, safeScale) });
  const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  await sourcePage.render({ canvas, canvasContext: context, viewport }).promise;
  const pdfPage = input.getPage(originalIndex);
  const size = pdfPage.getSize();
  const pixelScale = Math.min(viewport.width / size.width, viewport.height / size.height);
  for (const item of items) {
    const x = item.x * canvas.width; const y = item.y * canvas.height; const w = item.width * canvas.width; const h = item.height * canvas.height;
    if (item.kind === 'redact') { context.fillStyle = item.color || '#111111'; context.fillRect(x, y, w, h); }
    else if (item.kind === 'highlight') { context.fillStyle = `${item.color || '#f2cf4a'}55`; context.fillRect(x, y, w, h); }
    else if (item.kind === 'shape') {
      context.lineWidth = Math.max(.5, Number(item.borderWidth) || .5) * pixelScale;
      context.strokeStyle = item.borderColor || '#2864b8';
      if (item.shapeType === 'line') { context.beginPath(); context.moveTo(x, y); context.lineTo(x + w, y + h); context.stroke(); }
      else if (item.shapeType === 'ellipse') {
        context.beginPath(); context.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        if (Number(item.fillOpacity) > 0) { context.globalAlpha = clamp(Number(item.fillOpacity), 0, 100) / 100; context.fillStyle = item.fillColor || '#f2cf4a'; context.fill(); context.globalAlpha = 1; }
        if (Number(item.borderWidth) > 0) context.stroke();
      } else {
        if (Number(item.fillOpacity) > 0) { context.globalAlpha = clamp(Number(item.fillOpacity), 0, 100) / 100; context.fillStyle = item.fillColor || '#f2cf4a'; context.fillRect(x, y, w, h); context.globalAlpha = 1; }
        if (Number(item.borderWidth) > 0) context.strokeRect(x, y, w, h);
      }
    }
    else if (item.kind === 'text') {
      context.fillStyle = item.color || '#172536'; context.font = `${clamp(Number(item.fontSize) || 18, 8, 96) * pixelScale}px ${item.fontFamily || 'Arial, sans-serif'}`; context.textBaseline = 'top';
      item.text.split('\n').forEach((line, index) => context.fillText(line, x, y + index * clamp(Number(item.fontSize) || 18, 8, 96) * pixelScale * 1.2, Math.max(1, w)));
    } else if (item.kind === 'image' || item.kind === 'signature') {
      const bitmap = await createImageBitmap(new Blob([item.bytes], { type: 'image/png' })); context.drawImage(bitmap, x, y, w, h); bitmap.close();
    }
  }
  const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not flatten the redacted page. Try a smaller page.')), 'image/png'));
  const image = await output.embedPng(new Uint8Array(await blob.arrayBuffer()));
  const pageWidth = viewport.width / (96 / 72 * Math.max(.6, safeScale));
  const pageHeight = viewport.height / (96 / 72 * Math.max(.6, safeScale));
  const page = output.addPage([pageWidth, pageHeight]);
  page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });
}

async function verifySourceTextOutput(bytes) {
  if (!sourceTextEdits.length) return;
  const outputTask = pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false });
  const outputDocument = await outputTask.promise;
  try {
    const editsByPage = new Map();
    sourceTextEdits.forEach((edit) => {
      if (!editsByPage.has(edit.pageIndex)) editsByPage.set(edit.pageIndex, []);
      editsByPage.get(edit.pageIndex).push(edit);
    });
    for (const [pageIndex, edits] of editsByPage) {
      const originalPage = await pdfDocument.getPage(pageIndex + 1);
      const outputPage = await outputDocument.getPage(pageIndex + 1);
      const originalText = (await originalPage.getTextContent()).items.map((item) => item.str).join(' ').normalize('NFKC').replace(/\s+/gu, '').toLocaleLowerCase();
      const outputText = (await outputPage.getTextContent()).items.map((item) => item.str).join(' ').normalize('NFKC').replace(/\s+/gu, '').toLocaleLowerCase();
      let expectedText = originalText;
      const occupiedRanges = [];
      const verificationEdits = [];
      for (const edit of edits) {
        const original = edit.originalText.normalize('NFKC').replace(/\s+/gu, '').toLocaleLowerCase();
        let start = -1;
        for (let offset = 0; (offset = originalText.indexOf(original, offset)) !== -1; offset += Math.max(1, original.length)) {
          if (!occupiedRanges.some(([from, to]) => offset < to && offset + original.length > from)) { start = offset; break; }
        }
        if (start < 0) throw new Error('Could not verify the selected source text in the PDF text layer. No file was downloaded.');
        occupiedRanges.push([start, start + original.length]);
        verificationEdits.push({ start, originalLength: original.length, replacement: edit.text.normalize('NFKC').replace(/\s+/gu, '').toLocaleLowerCase() });
      }
      verificationEdits.sort((left, right) => right.start - left.start);
      for (const edit of verificationEdits) expectedText = `${expectedText.slice(0, edit.start)}${edit.replacement}${expectedText.slice(edit.start + edit.originalLength)}`;
      if (outputText !== expectedText) throw new Error('The PDF reader could not confirm the requested text edits. No file was downloaded.');
    }
  } finally { await outputTask.destroy(); }
}

async function buildOutput() {
  let workingBytes = sourceBytes;
  if (sourceTextEdits.length) {
    setStatus('Writing existing text into the PDF, then checking the saved text layer…');
    const qpdf = await getQpdfToolkit();
    const result = await applyEditablePdfText(sourceBytes, sourceTextEdits, qpdf);
    await verifySourceTextOutput(result.bytes);
    workingBytes = result.bytes;
  }
  const sourceTask = workingBytes === sourceBytes ? null : pdfjsLib.getDocument({ data: workingBytes.slice(), isEvalSupported: false });
  const sourceDocument = sourceTask ? await sourceTask.promise : pdfDocument;
  try {
    const input = await PDFDocument.load(workingBytes.slice());
    const output = await PDFDocument.create();
    for (const originalIndex of pageOrder) {
      const items = annotationItems.filter((item) => item.page === originalIndex);
      if (items.some((item) => item.kind === 'redact')) {
        await addRasterizedRedactionPage(output, input, sourceDocument, originalIndex, items);
      } else {
        const [page] = await output.copyPages(input, [originalIndex]); output.addPage(page);
        await addVectorOverlays(page, output, items);
      }
    }
    return await output.save();
  } finally { await sourceTask?.destroy(); }
}

$('#download-pdf').addEventListener('click', async () => {
  if (!sourceBytes) return;
  const button = $('#download-pdf'); button.disabled = true; button.textContent = 'Preparing…';
  setStatus('Creating your edited PDF locally…');
  try {
    const bytes = await buildOutput();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = fileName.replace(/\.pdf$/iu, '') + '-edited.pdf';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    button.textContent = 'Download PDF';
    setStatus('Your edited PDF is ready.');
  } catch (error) {
    if (error?.name !== 'PdfTextEditError') console.error(error);
    setStatus(error?.message || 'Could not export this PDF. Try a smaller or unencrypted file.', true);
  } finally { button.disabled = false; button.textContent = 'Download PDF'; }
});
