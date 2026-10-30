import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { PDFDocument } from 'pdf-lib';

const MAX_IMAGES = 20;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const MAX_PIXELS = 30_000_000;
const MAX_PDF_SIDE = 14_400;
const MM_TO_POINTS = 72 / 25.4;
const formatBytes = (bytes) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const input = document.querySelector('#image-files');
const dropzone = document.querySelector('#image-dropzone');
const gallery = document.querySelector('#image-gallery');
const message = document.querySelector('#image-pdf-message');
const countLabel = document.querySelector('#selection-count');
const pageCountLabel = document.querySelector('#pdf-page-count');
const convertButton = document.querySelector('#convert-images');
const clearButton = document.querySelector('#clear-images');
const result = document.querySelector('#image-pdf-result');
const stage = document.querySelector('#crop-stage');
const activeName = document.querySelector('#active-image-name');
const editStatus = document.querySelector('#edit-status');
const cropControls = ['#rotate-left', '#rotate-right', '#flip-image', '#reset-crop', '#reset-image-edit', '#image-filter', '#brightness', '#contrast', '#apply-edit'].map((selector) => document.querySelector(selector));
const paperSelect = document.querySelector('#paper-size');
const orientationSelect = document.querySelector('#page-orientation');
const marginSelect = document.querySelector('#page-margin');

let items = [];
let activeId = null;
let cropper = null;
let dirty = false;
let generating = false;
let outputUrl = null;
let dragIndex = null;
let ignoreCropEvents = false;

function itemById(id) { return items.find((item) => item.id === id); }
function activeItem() { return itemById(activeId); }
function revokeItem(item) {
  if (item?.sourceUrl) URL.revokeObjectURL(item.sourceUrl);
  if (item?.outputUrl) URL.revokeObjectURL(item.outputUrl);
  item.sourceUrl = null; item.outputUrl = null;
}
function destroyCropper() {
  if (cropper) { cropper.destroy(); cropper = null; }
  stage.replaceChildren();
}
function resetResult() {
  if (outputUrl) URL.revokeObjectURL(outputUrl);
  outputUrl = null;
  result.innerHTML = '<div class="result-empty"><span class="empty-icon">PDF</span><b>Your PDF download will appear here</b><span>Add photos, select pages and create the PDF.</span></div>';
}
function invalidateResult() {
  if (!outputUrl) return;
  resetResult();
  message.textContent = 'Your photos or page settings changed. Create the PDF again to update the download.';
}
function selectedItems() { return items.filter((item) => item.selected); }
function updateCounts() {
  const selected = selectedItems().length;
  countLabel.textContent = items.length ? `${selected} of ${items.length} photos selected` : 'No images added';
  pageCountLabel.textContent = `${selected} ${selected === 1 ? 'page' : 'pages'}`;
  document.querySelector('#select-all').disabled = !items.length || selected === items.length;
  document.querySelector('#deselect-all').disabled = !selected;
  convertButton.disabled = !selected || dirty || generating;
  clearButton.disabled = !items.length || generating;
  cropControls.forEach((control) => { if (control) control.disabled = !activeItem() || generating; });
  document.querySelector('#apply-edit').disabled = !activeItem() || !dirty || generating;
  document.querySelector('#reset-image-edit').disabled = !activeItem() || generating;
}
function setDirty(value) {
  dirty = value;
  const item = activeItem();
  editStatus.textContent = !item ? 'Choose a photo to begin editing.' : value ? 'You have unapplied edits. Apply them before creating the PDF or changing photos.' : item.outputBlob ? 'Edits applied to this photo.' : 'Crop and adjust this photo, then apply your changes.';
  updateCounts();
}
function renderGallery() {
  gallery.replaceChildren();
  items.forEach((item, index) => {
    const row = document.createElement('li');
    row.draggable = true;
    row.dataset.id = item.id;
    row.setAttribute('aria-current', String(item.id === activeId));
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.checked = item.selected; checkbox.setAttribute('aria-label', `Include ${item.file.name} as a PDF page`);
    checkbox.addEventListener('change', () => { item.selected = checkbox.checked; invalidateResult(); updateCounts(); });
    const thumb = document.createElement('img');
    thumb.src = item.outputUrl || item.sourceUrl; thumb.alt = '';
    const details = document.createElement('span');
    details.className = 'gallery-file-name'; details.textContent = item.file.name;
    const metadata = document.createElement('span');
    metadata.className = 'gallery-file-meta'; metadata.textContent = `${formatBytes(item.file.size)}${item.outputBlob ? ' · edited' : ''}`;
    details.append(metadata);
    const actions = document.createElement('span'); actions.className = 'gallery-item-actions';
    const up = document.createElement('button'); up.type = 'button'; up.textContent = '↑'; up.disabled = index === 0; up.setAttribute('aria-label', `Move ${item.file.name} earlier`);
    const down = document.createElement('button'); down.type = 'button'; down.textContent = '↓'; down.disabled = index === items.length - 1; down.setAttribute('aria-label', `Move ${item.file.name} later`);
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', `Remove ${item.file.name}`);
    up.addEventListener('click', () => moveItem(index, index - 1));
    down.addEventListener('click', () => moveItem(index, index + 1));
    remove.addEventListener('click', () => removeItem(item.id));
    actions.append(up, down, remove);
    row.append(checkbox, thumb, details, actions);
    row.addEventListener('click', (event) => {
      if (event.target.closest('button,input')) return;
      openEditor(item.id);
    });
    row.addEventListener('dragstart', (event) => {
      dragIndex = index; row.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index));
    });
    row.addEventListener('dragend', () => { dragIndex = null; row.classList.remove('is-dragging'); });
    row.addEventListener('dragover', (event) => event.preventDefault());
    row.addEventListener('drop', (event) => {
      event.preventDefault();
      const from = Number(event.dataTransfer.getData('text/plain'));
      if (Number.isInteger(from)) moveItem(from, index);
    });
    gallery.append(row);
  });
  updateCounts();
}
function moveItem(from, to) {
  if (dirty) { message.textContent = 'Apply or reset the current photo edits before reordering.'; return; }
  if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return;
  const [item] = items.splice(from, 1); items.splice(to, 0, item);
  invalidateResult(); renderGallery();
}
function removeItem(id) {
  if (dirty) { message.textContent = 'Apply or reset the current photo edits before removing a photo.'; return; }
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return;
  const [removed] = items.splice(index, 1); revokeItem(removed);
  if (activeId === id) {
    destroyCropper(); activeId = null;
    if (items[index] || items[index - 1]) openEditor((items[index] || items[index - 1]).id);
    else { activeName.textContent = 'Select a photo to crop or adjust it.'; editStatus.textContent = 'Choose a photo to begin editing.'; }
  }
  invalidateResult(); renderGallery();
}
function filterString(item) {
  const filters = {
    none: '',
    grayscale: 'grayscale(1)',
    sepia: 'sepia(.82)',
    warm: 'sepia(.22) saturate(1.2)',
    cool: 'saturate(.92) hue-rotate(12deg)'
  };
  return `brightness(${item.brightness / 100}) contrast(${item.contrast / 100}) ${filters[item.filter] || ''}`.trim();
}
function syncFilterControls(item) {
  document.querySelector('#image-filter').value = item.filter;
  document.querySelector('#brightness').value = String(item.brightness);
  document.querySelector('#contrast').value = String(item.contrast);
  document.querySelector('#brightness-value').value = `${item.brightness}%`;
  document.querySelector('#contrast-value').value = `${item.contrast}%`;
}
function openEditor(id) {
  if (dirty) { message.textContent = 'Apply or reset the current photo edits before selecting another photo.'; return; }
  const item = itemById(id); if (!item) return;
  destroyCropper(); activeId = id;
  activeName.textContent = item.file.name;
  syncFilterControls(item);
  const image = document.createElement('img'); image.alt = `Crop preview for ${item.file.name}`; image.src = item.sourceUrl;
  stage.replaceChildren(image);
  ignoreCropEvents = true;
  cropper = new Cropper(image, {
    viewMode: 1, dragMode: 'crop', autoCropArea: 0.92, responsive: true, background: false,
    guides: true, center: true, highlight: true, movable: true, zoomable: true, scalable: true,
    minCropBoxWidth: 20, minCropBoxHeight: 20,
    ready() {
      if (item.cropData) cropper?.setData(item.cropData);
      if (item.rotation) cropper?.rotateTo(item.rotation);
      if (item.scaleX === -1) cropper?.scaleX(-1);
      ignoreCropEvents = false;
    },
    crop() { if (!ignoreCropEvents && activeId === item.id) { setDirty(true); invalidateResult(); } }
  });
  editStatus.textContent = item.outputBlob ? 'Edits applied to this photo.' : 'Drag the crop handles, then apply your changes.';
  renderGallery();
}
function markFilterChanged() {
  const item = activeItem(); if (!item) return;
  item.filter = document.querySelector('#image-filter').value;
  item.brightness = Number(document.querySelector('#brightness').value);
  item.contrast = Number(document.querySelector('#contrast').value);
  document.querySelector('#brightness-value').value = `${item.brightness}%`;
  document.querySelector('#contrast-value').value = `${item.contrast}%`;
  setDirty(true); invalidateResult();
}
async function encodeCanvas(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('This browser could not prepare the edited photo.')), type, quality));
}
async function applyEdit() {
  const item = activeItem(); if (!item || !cropper) return;
  const button = document.querySelector('#apply-edit');
  button.disabled = true; button.textContent = 'Applying…'; message.textContent = 'Preparing this photo on your device.';
  try {
    const cropped = cropper.getCroppedCanvas({ maxWidth: 6000, maxHeight: 6000, imageSmoothingEnabled: true, imageSmoothingQuality: 'high', fillColor: '#fff' });
    if (!cropped || cropped.width * cropped.height > 30_000_000) throw new Error('This crop is too large for a safe browser edit. Choose a smaller crop or image.');
    const canvas = document.createElement('canvas'); canvas.width = cropped.width; canvas.height = cropped.height;
    const context = canvas.getContext('2d');
    context.filter = filterString(item); context.drawImage(cropped, 0, 0);
    const blob = await encodeCanvas(canvas);
    if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
    item.outputBlob = blob; item.outputUrl = URL.createObjectURL(blob);
    item.cropData = cropper.getData(true); item.rotation = cropper.getImageData().rotate;
    item.scaleX = cropper.getImageData().scaleX || 1;
    dirty = false; message.textContent = ''; setDirty(false); renderGallery();
  } catch (error) {
    message.textContent = error instanceof Error ? error.message : 'Could not apply these edits.';
  } finally { button.textContent = 'Apply crop and filter'; updateCounts(); }
}
async function addFiles(files) {
  const additions = [...files]; if (!additions.length) return;
  const currentBytes = items.reduce((sum, item) => sum + item.file.size, 0);
  const accepted = [];
  for (const file of additions) {
    const extOk = /\.(jpe?g|png|webp)$/iu.test(file.name);
    if (!allowedTypes.has(file.type) && !extOk) { message.textContent = `“${file.name}” is not a JPG, PNG or WebP image.`; continue; }
    if (file.size > MAX_FILE_BYTES) { message.textContent = `“${file.name}” is over the 20 MB per-image limit.`; continue; }
    if (items.length + accepted.length >= MAX_IMAGES) { message.textContent = `You can add up to ${MAX_IMAGES} images to one PDF.`; break; }
    const acceptedBytes = accepted.reduce((sum, item) => sum + item.file.size, 0);
    if (currentBytes + acceptedBytes + file.size > MAX_TOTAL_BYTES) { message.textContent = 'These images would exceed the 100 MB total limit.'; break; }
    let bitmap;
    try { bitmap = await createImageBitmap(file); }
    catch { message.textContent = `“${file.name}” could not be opened as an image.`; continue; }
    const pixels = bitmap.width * bitmap.height; bitmap.close();
    if (!pixels || pixels > MAX_PIXELS) { message.textContent = `“${file.name}” is too large to edit safely in a browser (maximum 30 megapixels).`; continue; }
    accepted.push({ id: crypto.randomUUID(), file, selected: true, sourceUrl: URL.createObjectURL(file), outputUrl: null, outputBlob: null, cropData: null, rotation: 0, scaleX: 1, filter: 'none', brightness: 100, contrast: 100 });
  }
  if (!accepted.length) { updateCounts(); return; }
  items.push(...accepted); message.textContent = '';
  if (!activeId) openEditor(accepted[0].id);
  invalidateResult(); renderGallery(); input.value = '';
}
function pageDimensions(item, imageWidth, imageHeight) {
  const formats = { a4: [595.28, 841.89], letter: [612, 792], legal: [612, 1008] };
  let [width, height] = paperSelect.value === 'image' ? [imageWidth * .75, imageHeight * .75] : formats[paperSelect.value];
  if (paperSelect.value === 'image') {
    const scale = Math.min(1, MAX_PDF_SIDE / Math.max(width, height)); width *= scale; height *= scale;
  } else {
    const landscape = orientationSelect.value === 'landscape' || (orientationSelect.value === 'auto' && imageWidth > imageHeight);
    if ((landscape && height > width) || (!landscape && width > height)) [width, height] = [height, width];
  }
  return [width, height];
}
async function imageForPdf(item) {
  const blob = item.outputBlob || item.file;
  const type = blob.type || (item.file.name.toLowerCase().endsWith('.jpg') || item.file.name.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' : item.file.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/webp');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (type === 'image/jpeg') return { image: await PDFDocument.create().then((doc) => doc.embedJpg(bytes)), width: 0, height: 0 };
  if (type === 'image/png') return { image: bytes, type, width: 0, height: 0 };
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0); bitmap.close();
  const png = await encodeCanvas(canvas);
  return { image: new Uint8Array(await png.arrayBuffer()), type: 'image/png', width: canvas.width, height: canvas.height };
}
async function convertImages() {
  const chosen = selectedItems();
  if (!chosen.length || dirty || generating) return;
  generating = true; message.textContent = 'Creating pages and preparing the PDF in your browser.'; convertButton.textContent = 'Creating PDF…'; updateCounts(); resetResult();
  try {
    const pdf = await PDFDocument.create();
    pdf.setTitle('QuickKit photos to PDF');
    for (const item of chosen) {
      const blob = item.outputBlob || item.file;
      const bitmap = await createImageBitmap(blob);
      const imageWidth = bitmap.width, imageHeight = bitmap.height; bitmap.close();
      const [pageWidth, pageHeight] = pageDimensions(item, imageWidth, imageHeight);
      const margin = Number(marginSelect.value) * MM_TO_POINTS;
      if (margin * 2 >= Math.min(pageWidth, pageHeight)) throw new Error('The selected page margin is too large for this page size.');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let embedded;
      const type = blob.type || (item.file.name.toLowerCase().match(/\.(jpe?g|png|webp)$/iu)?.[1]?.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg');
      if (type === 'image/jpeg') embedded = await pdf.embedJpg(bytes);
      else if (type === 'image/png') embedded = await pdf.embedPng(bytes);
      else {
        const canvas = document.createElement('canvas'); canvas.width = imageWidth; canvas.height = imageHeight;
        canvas.getContext('2d').drawImage(await createImageBitmap(blob), 0, 0);
        const png = await encodeCanvas(canvas); embedded = await pdf.embedPng(new Uint8Array(await png.arrayBuffer()));
      }
      const page = pdf.addPage([pageWidth, pageHeight]);
      const availableWidth = pageWidth - margin * 2, availableHeight = pageHeight - margin * 2;
      const scale = Math.min(availableWidth / embedded.width, availableHeight / embedded.height);
      const width = embedded.width * scale, height = embedded.height * scale;
      page.drawImage(embedded, { x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height });
    }
    const bytes = await pdf.save({ useObjectStreams: true });
    const blob = new Blob([bytes], { type: 'application/pdf' }); outputUrl = URL.createObjectURL(blob);
    const content = document.createElement('div'); content.className = 'simple-result';
    const title = document.createElement('strong'); title.textContent = `${pdf.getPageCount()}-page PDF ready`;
    const details = document.createElement('span'); details.textContent = `${formatBytes(blob.size)} · ${paperSelect.options[paperSelect.selectedIndex].text} · ${orientationSelect.options[orientationSelect.selectedIndex].text}`;
    const download = document.createElement('a'); download.className = 'download-link'; download.href = outputUrl; download.download = 'quickkit-images.pdf'; download.textContent = 'Download PDF';
    content.append(title, details, download); result.replaceChildren(content); message.textContent = '';
  } catch (error) {
    message.textContent = error instanceof Error ? error.message : 'Could not create this PDF. Check the selected images and try again.';
  } finally { generating = false; convertButton.textContent = 'Create PDF'; updateCounts(); }
}

input.addEventListener('change', () => addFiles(input.files));
dropzone.addEventListener('dragover', (event) => { event.preventDefault(); dropzone.classList.add('is-dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
dropzone.addEventListener('drop', (event) => { event.preventDefault(); dropzone.classList.remove('is-dragover'); addFiles(event.dataTransfer?.files || []); });
document.querySelector('#select-all').addEventListener('click', () => { items.forEach((item) => { item.selected = true; }); invalidateResult(); renderGallery(); });
document.querySelector('#deselect-all').addEventListener('click', () => { items.forEach((item) => { item.selected = false; }); invalidateResult(); renderGallery(); });
document.querySelector('#rotate-left').addEventListener('click', () => cropper?.rotate(-90));
document.querySelector('#rotate-right').addEventListener('click', () => cropper?.rotate(90));
document.querySelector('#flip-image').addEventListener('click', () => { const item = activeItem(); if (!item || !cropper) return; item.scaleX = item.scaleX === -1 ? 1 : -1; cropper.scaleX(item.scaleX); setDirty(true); invalidateResult(); });
document.querySelector('#reset-crop').addEventListener('click', () => { cropper?.reset(); const item = activeItem(); if (item) { item.cropData = null; item.rotation = 0; item.scaleX = 1; } setDirty(true); invalidateResult(); });
document.querySelector('#reset-image-edit').addEventListener('click', () => {
  const item = activeItem(); if (!item) return;
  if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
  item.outputBlob = null; item.outputUrl = null; item.cropData = null; item.rotation = 0; item.scaleX = 1; item.filter = 'none'; item.brightness = 100; item.contrast = 100;
  document.querySelector('#image-filter').value = 'none'; document.querySelector('#brightness').value = '100'; document.querySelector('#contrast').value = '100';
  syncFilterControls(item); cropper?.reset(); dirty = false; invalidateResult(); message.textContent = ''; setDirty(false); renderGallery();
});
document.querySelector('#image-filter').addEventListener('change', markFilterChanged);
document.querySelector('#brightness').addEventListener('input', markFilterChanged);
document.querySelector('#contrast').addEventListener('input', markFilterChanged);
document.querySelector('#apply-edit').addEventListener('click', applyEdit);
document.querySelector('#convert-images').addEventListener('click', convertImages);
document.querySelector('#clear-images').addEventListener('click', () => {
  if (generating) return;
  items.forEach(revokeItem); items = []; activeId = null; dirty = false; destroyCropper(); resetResult();
  activeName.textContent = 'Select a photo to crop or adjust it.'; editStatus.textContent = 'Choose a photo to begin editing.'; message.textContent = ''; input.value = ''; renderGallery();
});
[paperSelect, orientationSelect, marginSelect].forEach((control) => control.addEventListener('change', () => { invalidateResult(); updateCounts(); }));
window.addEventListener('pagehide', () => { items.forEach(revokeItem); if (outputUrl) URL.revokeObjectURL(outputUrl); });
updateCounts();
