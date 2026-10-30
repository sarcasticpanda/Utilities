import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, rgb } from 'pdf-lib';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

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

const hints = {
  select: 'Select an item to move it. Choose a tool, then click on the page to add it.',
  text: 'Click the page, or focus the page and press Enter to place text at its center. Arrow keys move a selected item.',
  highlight: 'Click the page, or focus the page and press Enter to add a highlight at its center. Arrow keys move a selected item.',
  shape: 'Click the page, or focus the page and press Enter to add a rectangle at its center. Arrow keys move a selected item.',
  image: 'Choose a PNG, JPG or WebP image. It will be placed near the middle of this page.',
  signature: 'Draw a signature in the pad, then place it on this page.'
};

function setStatus(text, isError = false) {
  editorStatus.textContent = text;
  editorStatus.style.color = isError ? '#a4503d' : '#4f6f59';
}

function setTool(tool) {
  if (tool !== 'select' && pdfDocument && activePageRotation % 360 !== 0) {
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
  if (['text', 'highlight', 'shape'].includes(tool)) stage.focus({ preventScroll: true });
}

function currentOriginalPage() { return pageOrder[activePosition]; }

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function getActiveItem() { return annotationItems.find((item) => item.id === selectedId) || null; }

function clearSelection() {
  selectedId = null;
  renderOverlays();
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
  $('#inspector-title').textContent = ({ text: 'Text', highlight: 'Highlight', shape: 'Rectangle', image: 'Image', signature: 'Signature' })[item.kind];
  $('#text-setting').hidden = item.kind !== 'text';
  $('#size-setting').hidden = item.kind !== 'text';
  $('#color-setting').hidden = !['text', 'highlight', 'shape'].includes(item.kind);
  $('#width-setting').hidden = item.kind === 'text' || item.kind === 'signature';
  $('#height-setting').hidden = item.kind === 'text' || item.kind === 'signature';
  if (item.kind === 'text') {
    $('#item-text').value = item.text;
    $('#item-size').value = item.fontSize;
  }
  if (item.color) $('#item-color').value = item.color;
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
    annotationItems: annotationItems.map((item) => {
      const copy = { ...item, bytes: item.bytes?.slice() };
      if (copy.bytes) copy.previewUrl = URL.createObjectURL(new Blob([copy.bytes], { type: 'image/png' }));
      return copy;
    })
  };
  $('#undo-edit').disabled = false;
}

function undoLastChange() {
  if (!undoSnapshot) return;
  annotationItems.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
  pageOrder = undoSnapshot.pageOrder;
  activePosition = undoSnapshot.activePosition;
  selectedId = undoSnapshot.selectedId;
  annotationItems = undoSnapshot.annotationItems;
  undoSnapshot = null;
  $('#undo-edit').disabled = true;
  controlUndoOpen = false;
  updateInspector(); renderPageList(); renderActivePage();
  setStatus('Last change undone.');
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
    if (thumbObserver) thumbObserver.observe(choose); else renderThumbnail(choose);
  });
  updatePageControls();
}

async function renderThumbnail(button) {
  if (!pdfDocument || !button.isConnected) return;
  const originalIndex = Number(button.dataset.originalPage);
  try {
    const page = await pdfDocument.getPage(originalIndex + 1);
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
  if (!pdfDocument || !pageOrder.length) return;
  const token = ++lastRenderToken;
  const originalIndex = currentOriginalPage();
  stage.replaceChildren();
  stage.classList.add('is-loading');
  const page = await pdfDocument.getPage(originalIndex + 1);
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
  updatePageControls();
  [...pageList.querySelectorAll('.pdf-thumb-button')].forEach((button, position) => button.setAttribute('aria-current', String(position === activePosition)));
}

function renderOverlays() {
  stage.querySelectorAll('.pdf-overlay').forEach((el) => el.remove());
  if (!stage.clientWidth) return;
  const originalIndex = currentOriginalPage();
  annotationItems.filter((item) => item.page === originalIndex).forEach((item) => {
    let element;
    if (item.kind === 'image' || item.kind === 'signature') {
      element = document.createElement('img');
      element.src = item.previewUrl;
      element.alt = item.kind === 'signature' ? 'Added signature' : 'Added image';
      element.className = `pdf-overlay pdf-overlay-image pdf-overlay-${item.kind}`;
    } else {
      element = document.createElement('div');
      element.className = `pdf-overlay pdf-overlay-${item.kind}`;
      if (item.kind === 'text') {
        element.textContent = item.text;
        element.style.color = item.color;
        element.style.fontSize = `${item.fontSize * (96 / 72) * renderScale}px`;
        element.style.fontFamily = 'Arial, sans-serif';
      }
      if (item.kind === 'shape') element.style.borderColor = item.color;
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
    element.classList.toggle('is-selected', item.id === selectedId);
    element.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      if (activeTool !== 'select') return;
      rememberUndo();
      selectedId = item.id;
      updateInspector();
      stage.querySelectorAll('.pdf-overlay').forEach((overlay) => overlay.classList.toggle('is-selected', overlay.dataset.id === selectedId));
      element.setPointerCapture(event.pointerId);
      const startX = event.clientX; const startY = event.clientY;
      const startLeft = item.x; const startTop = item.y;
      const rect = stage.getBoundingClientRect();
      const move = (moveEvent) => {
        item.x = clamp(startLeft + (moveEvent.clientX - startX) / rect.width, 0, 1 - item.width);
        item.y = clamp(startTop + (moveEvent.clientY - startY) / rect.height, 0, 1 - item.height);
        element.style.left = `${item.x * 100}%`;
        element.style.top = `${item.y * 100}%`;
      };
      const finish = () => {
        element.removeEventListener('pointermove', move);
        element.removeEventListener('pointerup', finish);
        element.removeEventListener('pointercancel', finish);
        updateInspector();
      };
      element.addEventListener('pointermove', move);
      element.addEventListener('pointerup', finish);
      element.addEventListener('pointercancel', finish);
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

function deleteActivePage() {
  if (pageOrder.length <= 1) return setStatus('A PDF needs at least one page.', true);
  rememberUndo();
  const removed = pageOrder.splice(activePosition, 1)[0];
  annotationItems = annotationItems.filter((item) => item.page !== removed);
  activePosition = Math.min(activePosition, pageOrder.length - 1);
  clearSelection(); renderPageList(); renderActivePage();
  setStatus(`Page removed. ${pageOrder.length} pages remain. Download to save your changes.`);
}

function addItem(kind, x, y, extra = {}) {
  rememberUndo();
  const defaults = {
    text: { width: 0.35, height: 0.06, text: 'Text', fontSize: 18, color: '#172536' },
    highlight: { width: 0.3, height: 0.055, color: '#f2cf4a' },
    shape: { width: 0.28, height: 0.12, color: '#2864b8' },
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
  setTool('select');
  setStatus('Edit added. Drag it to position, adjust it in the panel, then download.');
}

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
  addItem('signature', .35, .76, { width: .3, height: .11, bytes, previewUrl: url });
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
    const nextBytes = new Uint8Array(await file.arrayBuffer());
    nextLoadingTask = pdfjsLib.getDocument({ data: nextBytes.slice() });
    const pdfLibPromise = PDFDocument.load(nextBytes.slice());
    const [nextPdfJsDocument] = await Promise.all([nextLoadingTask.promise, pdfLibPromise]);
    if (nextPdfJsDocument.numPages > 200) {
      throw Object.assign(new Error('This PDF has more than 200 pages. Split it into smaller files before editing.'), { name: 'PageLimitError' });
    }
    await pdfLoadingTask?.destroy();
    pdfLoadingTask = nextLoadingTask;
    annotationItems.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    sourceBytes = nextBytes;
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
$('#item-color').addEventListener('input', (event) => { const item = getActiveItem(); if (!item) return; beginControlUndo(); item.color = event.target.value; renderOverlays(); });
$('#item-width').addEventListener('input', (event) => { const item = getActiveItem(); if (!item) return; beginControlUndo(); item.width = Number(event.target.value) / 100; item.x = clamp(item.x, 0, 1 - item.width); $('#item-width-value').value = `${event.target.value}%`; renderOverlays(); });
$('#item-height').addEventListener('input', (event) => { const item = getActiveItem(); if (!item) return; beginControlUndo(); item.height = Number(event.target.value) / 100; item.y = clamp(item.y, 0, 1 - item.height); $('#item-height-value').value = `${event.target.value}%`; renderOverlays(); });
document.querySelectorAll('#item-text,#item-size,#item-color,#item-width,#item-height').forEach((control) => control.addEventListener('change', () => { controlUndoOpen = false; }));
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === 'z' && undoSnapshot && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); undoLastChange(); }
  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) removeSelectedItem();
  if (event.key === 'Escape' && $('#signature-dialog').open) { $('#signature-dialog').close(); setTool('select'); }
});
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (pdfDocument) renderActivePage(); }, 160); });

function pdfColor(hex) {
  const value = hex.replace('#', '');
  return rgb(parseInt(value.slice(0, 2), 16) / 255, parseInt(value.slice(2, 4), 16) / 255, parseInt(value.slice(4, 6), 16) / 255);
}

async function buildOutput() {
  const input = await PDFDocument.load(sourceBytes.slice());
  const output = await PDFDocument.create();
  const pages = await output.copyPages(input, pageOrder);
  pages.forEach((page) => output.addPage(page));
  for (let position = 0; position < pageOrder.length; position++) {
    const page = output.getPage(position);
    const { width, height } = page.getSize();
    const originalIndex = pageOrder[position];
    const items = annotationItems.filter((item) => item.page === originalIndex);
    for (const item of items) {
      const x = item.x * width;
      const w = item.width * width;
      const h = item.height * height;
      const yTop = item.y * height;
      if (item.kind === 'text') {
        const size = clamp(Number(item.fontSize) || 18, 8, 96);
        const scale = 3;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.ceil(w * scale)); canvas.height = Math.max(1, Math.ceil(h * scale));
        const context = canvas.getContext('2d');
        context.scale(scale, scale); context.fillStyle = item.color || '#172536'; context.font = `${size}px ${item.fontFamily || 'Arial, sans-serif'}`; context.textBaseline = 'top';
        item.text.split('\n').forEach((line, index) => context.fillText(line, 0, index * size * 1.2, Math.max(1, w)));
        const textBlob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not render text for this PDF.')), 'image/png'));
        const textImage = await output.embedPng(new Uint8Array(await textBlob.arrayBuffer()));
        page.drawImage(textImage, { x, y: height - yTop - h, width: w, height: h });
      } else if (item.kind === 'highlight') {
        page.drawRectangle({ x, y: height - yTop - h, width: w, height: h, color: pdfColor(item.color), opacity: .34, borderWidth: 0 });
      } else if (item.kind === 'shape') {
        page.drawRectangle({ x, y: height - yTop - h, width: w, height: h, borderColor: pdfColor(item.color), borderWidth: 1.5, color: rgb(1, 1, 1), opacity: 0, borderOpacity: 1 });
      } else if (item.kind === 'image' || item.kind === 'signature') {
        const image = await output.embedPng(item.bytes);
        page.drawImage(image, { x, y: height - yTop - h, width: w, height: h });
      }
    }
  }
  return output.save();
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
    console.error(error);
    setStatus(error?.message || 'Could not export this PDF. Try a smaller or unencrypted file.', true);
  } finally { button.disabled = false; button.textContent = 'Download PDF'; }
});
