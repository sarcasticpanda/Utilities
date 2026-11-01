import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import presetData from './data/presets.json';

const revealElements = document.querySelectorAll('[data-reveal]');
if (revealElements.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
  gsap.registerPlugin(ScrollTrigger);
  revealElements.forEach((el) => gsap.to(el, { opacity: 1, y: 0, duration: .55, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } }));
}

if (document.body.dataset.page === 'prepare') {
  const $ = (selector) => document.querySelector(selector);
  const input = $('#form-image'), info = $('#original-info'), button = $('#prepare-image');
  const result = $('#prepare-result'), message = $('#prepare-message'), cropStage = $('#crop-stage');
  const cropActions = $('#crop-actions'), cropSource = $('#crop-source'), presetSelect = $('#exam-preset');
  const maxSourcePixels = 30_000_000;
  let file = null, sourceUrl = null, outputUrl = null, mode = 'photo', cropper = null, activePreset = null;
  const unit = () => $('#target-unit')?.value || 'px';
  const dpi = () => Math.max(1, Number($('#target-dpi')?.value) || 300);
  const pixels = (value) => Math.round(value * (unit() === 'mm' ? dpi() / 25.4 : unit() === 'in' ? dpi() : 1));
  const updateUnitLabels = () => {
    const suffix = unit() === 'px' ? 'px' : unit();
    $('#target-width-label').textContent = `Width (${suffix})`;
    $('#target-height-label').textContent = `Height (${suffix})`;
  };
  const prettyBytes = (bytes) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
  const clearResult = () => {
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = null;
    result.innerHTML = '<div class="result-placeholder"><span class="placeholder-icon">IMG</span><b>Your checks appear here</b><span>Choose a preset or enter the current notice requirements, then select an image.</span></div>';
  };
  const updateAspect = () => {
    const width = pixels(Number($('#target-width').value));
    const height = pixels(Number($('#target-height').value));
    cropper?.setAspectRatio(activePreset?.aspectRatio || (width > 0 && height > 0 ? width / height : NaN));
  };
  const revoke = () => {
    if (cropper) cropper.destroy();
    cropper = null;
    cropStage.hidden = true;
    if (cropActions) cropActions.hidden = true;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = null;
    clearResult();
  };
  const setMode = (newMode) => {
    mode = newMode;
    document.querySelectorAll('[data-mode]').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
      tab.setAttribute('aria-pressed', String(tab.dataset.mode === mode));
    });
    $('#signature-options').hidden = mode !== 'signature';
    clearResult();
  };
  const applyPreset = (preset) => {
    activePreset = preset || null;
    if (!preset) {
      $('#preset-source').textContent = 'No exam preset selected. Check your current application notice for its rules.';
      $('#target-width').value = '';
      $('#target-height').value = '';
      $('#min-kb').value = '';
      $('#max-kb').value = '100';
      $('#form-format').value = 'image/jpeg';
      $('#target-unit').value = 'px';
      updateUnitLabels();
      setMode('photo');
      updateAspect();
      return;
    }
    setMode(preset.document === 'photo' ? 'photo' : 'signature');
    $('#target-unit').value = 'px';
    $('#target-width').value = preset.width || '';
    $('#target-height').value = preset.height || '';
    $('#min-kb').value = preset.minKB;
    $('#max-kb').value = preset.maxKB;
    $('#form-format').value = preset.mime;
    updateUnitLabels();
    const status = preset.status === 'historical' ? 'Historical cycle — verify against the latest notice before use. ' : '';
    const dimensions = preset.width && preset.height ? ` ${preset.dimensionType === 'preferred' ? 'Preferred' : 'Required'} dimensions: ${preset.width} × ${preset.height}px.` : preset.aspectRatio ? ` Approximate crop ratio: ${preset.aspectRatio}:1.` : preset.minWidth ? ` Minimum dimensions: ${preset.minWidth} × ${preset.minHeight}px.` : '';
    const source = document.createElement('a');
    source.href = preset.sourceUrl;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = 'Official source';
    const note = document.createElement('span');
    note.textContent = `${status}${preset.note}${dimensions} Checked ${presetSelect.dataset.checkedAt}. `;
    $('#preset-source').replaceChildren(note, source);
    updateAspect();
  };

  presetSelect.dataset.checkedAt = presetData.checkedAt;
  for (const preset of presetData.presets) {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.label;
    presetSelect.append(option);
  }
  presetSelect.addEventListener('change', () => applyPreset(presetData.presets.find((item) => item.id === presetSelect.value) || null));

  $('#target-width').addEventListener('input', updateAspect);
  $('#target-height').addEventListener('input', updateAspect);
  $('#target-unit')?.addEventListener('change', () => { updateUnitLabels(); updateAspect(); });
  $('#target-dpi')?.addEventListener('input', updateAspect);
  $('#rotate-left')?.addEventListener('click', () => cropper?.rotate(-90));
  $('#rotate-right')?.addEventListener('click', () => cropper?.rotate(90));
  $('#reset-crop')?.addEventListener('click', () => { cropper?.reset(); updateAspect(); });
  $('#add-stamp').addEventListener('change', () => { $('#stamp-fields').hidden = !$('#add-stamp').checked; clearResult(); });
  document.querySelectorAll('#target-width,#target-height,#target-unit,#target-dpi,#min-kb,#max-kb,#form-format,#clean-signature,#quality-review,#stamp-name,#stamp-date').forEach((control) => control.addEventListener('input', clearResult));
  document.querySelectorAll('[data-mode]').forEach((tab) => tab.addEventListener('click', () => {
    presetSelect.value = 'custom';
    applyPreset(null);
    setMode(tab.dataset.mode);
  }));

  async function toBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('This browser could not export the selected format.')), type, quality));
  }
  function cleanSignature(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < image.data.length; i += 4) {
      if (image.data[i + 3] === 0) continue;
      const luminance = .299 * image.data[i] + .587 * image.data[i + 1] + .114 * image.data[i + 2];
      const ink = luminance > 170 ? 255 : Math.max(0, Math.min(90, Math.round(luminance * .35)));
      const alpha = image.data[i + 3];
      image.data[i] = image.data[i + 1] = image.data[i + 2] = ink;
      image.data[i + 3] = alpha;
    }
    ctx.putImageData(image, 0, 0);
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
  }
  function stampCanvas(source, width, height, type) {
    if (!$('#add-stamp').checked) return source;
    const name = $('#stamp-name').value.trim(), date = $('#stamp-date').value;
    if (!name || !date) throw new Error('Enter both a name and date for the optional strip. Use it only if your current notice asks for it.');
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = type === 'image/jpeg' ? '#fff' : 'transparent'; ctx.fillRect(0, 0, width, height);
    const stripHeight = Math.max(18, Math.round(height * .15));
    ctx.drawImage(source, 0, 0, width, height - stripHeight);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, height - stripHeight, width, stripHeight);
    ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${Math.max(9, Math.round(stripHeight * .32))}px Arial`;
    ctx.fillText(`${name} · ${date}`, width / 2, height - stripHeight / 2, width - 8);
    return canvas;
  }
  async function encodeWithinRange(canvas, type, minKB, maxKB, fixedDimensions) {
    const minBytes = minKB * 1024, maxBytes = maxKB * 1024;
    if (type === 'image/png') return { blob: await toBlob(canvas, type), exactSize: false };
    let current = canvas, blob = null;
    for (let dimensionPass = 0; dimensionPass < (fixedDimensions ? 1 : 8); dimensionPass++) {
      let low = .03, high = .99, best = null;
      for (let i = 0; i < 13; i++) {
        const quality = (low + high) / 2;
        const candidate = await toBlob(current, type, quality);
        if (candidate.size >= minBytes && candidate.size <= maxBytes) {
          best = candidate;
          if (candidate.size < (minBytes + maxBytes) / 2) low = quality; else high = quality;
        } else if (candidate.size < minBytes) low = quality;
        else high = quality;
      }
      blob = best || await toBlob(current, type, .03);
      if (blob.size <= maxBytes && (blob.size >= minBytes || !minKB)) return { blob, exactSize: blob.size >= minBytes };
      if (fixedDimensions || blob.size < minBytes) break;
      const smaller = document.createElement('canvas');
      smaller.width = Math.max(1, Math.round(current.width * .82));
      smaller.height = Math.max(1, Math.round(current.height * .82));
      smaller.getContext('2d').drawImage(current, 0, 0, smaller.width, smaller.height);
      current = smaller;
    }
    return { blob, exactSize: Boolean(blob && blob.size >= minBytes && blob.size <= maxBytes) };
  }

  input.addEventListener('change', () => {
    revoke(); file = input.files?.[0] || null; message.textContent = '';
    if (!file) { info.textContent = 'No image selected'; button.disabled = true; return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { file = null; input.value = ''; info.textContent = 'No image selected'; message.textContent = 'Choose a JPG, PNG or WebP image.'; button.disabled = true; return; }
    if (file.size > 20 * 1024 * 1024) { file = null; input.value = ''; info.textContent = 'No image selected'; message.textContent = 'Choose an image smaller than 20 MB.'; button.disabled = true; return; }
    sourceUrl = URL.createObjectURL(file); button.disabled = false; cropSource.src = sourceUrl; cropStage.hidden = false; if (cropActions) cropActions.hidden = false;
    cropSource.onload = () => {
      info.textContent = `${cropSource.naturalWidth} × ${cropSource.naturalHeight}px · ${prettyBytes(file.size)}`;
      if (cropSource.naturalWidth * cropSource.naturalHeight > maxSourcePixels) {
        message.textContent = 'This image has more than 30 megapixels. Choose a smaller image to avoid using too much device memory.';
        file = null; input.value = ''; button.disabled = true; revoke(); info.textContent = 'No image selected'; return;
      }
      cropper = new Cropper(cropSource, { viewMode: 1, dragMode: 'move', autoCropArea: .88, responsive: true, restore: false, background: false, aspectRatio: NaN, checkOrientation: true });
      updateAspect();
    };
    cropSource.onerror = () => { message.textContent = 'This image could not be opened. Try a different file.'; button.disabled = true; };
  });

  button.addEventListener('click', async () => {
    if (!file || !sourceUrl) return;
    const rawW = Number($('#target-width').value), rawH = Number($('#target-height').value);
    const targetW = $('#target-width').value ? pixels(rawW) : null, targetH = $('#target-height').value ? pixels(rawH) : null;
    const minKB = $('#min-kb').value === '' ? 0 : Number($('#min-kb').value), maxKB = Number($('#max-kb').value), type = $('#form-format').value;
    const rawDpi = Number($('#target-dpi')?.value || 300);
    if ((rawW && (!Number.isFinite(rawW) || rawW < 1)) || (rawH && (!Number.isFinite(rawH) || rawH < 1)) || (targetW !== null && targetW < 1) || (targetH !== null && targetH < 1) || !Number.isFinite(maxKB) || maxKB < 1 || !Number.isFinite(minKB) || minKB < 0 || minKB >= maxKB) { message.textContent = 'Enter positive dimensions and a valid file-size range where the minimum is lower than the maximum.'; return; }
    if (!Number.isFinite(rawDpi) || rawDpi < 1 || rawDpi > 1200) { message.textContent = 'Enter a print resolution between 1 and 1,200 DPI.'; return; }
    if ((targetW && targetW > 5000) || (targetH && targetH > 5000)) { message.textContent = 'This browser tool supports output dimensions up to 5,000 pixels per side.'; return; }
    button.disabled = true; button.textContent = 'Preparing…'; message.textContent = 'Your image is processing on this device.';
    try {
      const image = new Image(); image.src = sourceUrl; await image.decode();
      const cropped = cropper?.getCroppedCanvas({ fillColor: '#fff' }) || (() => { const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; canvas.getContext('2d').drawImage(image, 0, 0); return canvas; })();
      let width = targetW || cropped.width, height = targetH || cropped.height;
      if (targetW && !targetH) height = Math.max(1, Math.round(cropped.height * targetW / cropped.width));
      if (targetH && !targetW) width = Math.max(1, Math.round(cropped.width * targetH / cropped.height));
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height); ctx.drawImage(cropped, 0, 0, width, height);
      if (mode === 'signature' && $('#clean-signature').checked) cleanSignature(canvas);
      const stamped = stampCanvas(canvas, width, height, type);
      const { blob } = await encodeWithinRange(stamped, type, minKB, maxKB, Boolean(targetW && targetH));
      if (outputUrl) URL.revokeObjectURL(outputUrl); outputUrl = URL.createObjectURL(blob);
      const actualWidth = stamped.width, actualHeight = stamped.height;
      const dimensionPass = activePreset?.dimensionType === 'minimum'
        ? actualWidth >= activePreset.minWidth && actualHeight >= activePreset.minHeight
        : (!targetW || actualWidth === targetW) && (!targetH || actualHeight === targetH);
      const formatPass = blob.type === type && (activePreset?.mime ? blob.type === activePreset.mime : true);
      const sizePass = blob.size <= maxKB * 1024 && (!minKB || blob.size >= minKB * 1024);
      const preferredPass = activePreset?.dimensionType === 'preferred' ? actualWidth === activePreset.width && actualHeight === activePreset.height : null;
      const checks = [
        { label: 'Format', value: blob.type.split('/')[1]?.toUpperCase() || 'Unknown', pass: formatPass },
        { label: activePreset?.dimensionType === 'preferred' ? 'Preferred dimensions' : 'Dimensions', value: activePreset?.dimensionType === 'minimum' ? `${actualWidth} × ${actualHeight}px (min ${activePreset.minWidth} × ${activePreset.minHeight})` : `${actualWidth} × ${actualHeight}px`, pass: activePreset?.dimensionType === 'preferred' ? true : dimensionPass, kind: preferredPass === false ? 'preferred' : '' },
        { label: 'File size', value: `${prettyBytes(blob.size)}${minKB ? ` · required ${minKB}–${maxKB} KB` : ` · max ${maxKB} KB`}`, pass: sizePass }
      ];
      if (activePreset?.dimensionType === 'preferred') checks[1].value += preferredPass ? ' · preferred size met' : ` · ${activePreset.width} × ${activePreset.height}px preferred`;
      checks.push({ label: 'Image quality', value: $('#quality-review').checked ? 'Reviewed by you' : 'Please review before upload', pass: true, kind: 'manual' });
      const machinePass = checks.slice(0, 3).every((check) => check.pass);
      const container = document.createElement('div'); container.className = 'validation-result';
      const badge = Object.assign(document.createElement('span'), { className: `ready-badge${machinePass ? '' : ' needs-badge'}`, textContent: machinePass ? 'Ready to review' : 'Needs attention' });
      const preview = Object.assign(document.createElement('img'), { src: outputUrl, alt: 'Prepared image preview' });
      const checksList = document.createElement('div'); checksList.className = 'checks';
      checks.forEach((check) => {
        const line = document.createElement('div');
        const status = Object.assign(document.createElement('b'), { className: check.kind === 'manual' || check.kind === 'preferred' ? 'check-review' : check.pass ? 'check-pass' : 'check-fail', textContent: check.kind === 'manual' ? 'REVIEW' : check.kind === 'preferred' ? 'PREFERRED' : check.pass ? 'PASS' : 'FIX' });
        const label = Object.assign(document.createElement('span'), { textContent: check.label });
        const value = Object.assign(document.createElement('b'), { textContent: check.value });
        line.append(status, label, value); checksList.append(line);
      });
      const note = Object.assign(document.createElement('p'), { className: 'result-details', textContent: 'This checks measurable file rules only. Inspect the image yourself and confirm the latest application notice; no tool can guarantee portal acceptance.' });
      const details = Object.assign(document.createElement('p'), { className: 'result-details', textContent: `Output: ${actualWidth} × ${actualHeight}px · ${prettyBytes(blob.size)}${activePreset ? ` · ${activePreset.exam} ${activePreset.cycle}` : ''}` });
      const link = Object.assign(document.createElement('a'), { className: 'download-button', href: outputUrl, download: `formready-${mode}.${type === 'image/jpeg' ? 'jpg' : type.split('/')[1]}`, textContent: 'Download prepared image' });
      container.append(badge, preview, checksList, details);
      if (activePreset) {
        const source = Object.assign(document.createElement('a'), { href: activePreset.sourceUrl, target: '_blank', rel: 'noopener noreferrer', className: 'source-result-link', textContent: `Check source: ${activePreset.sourceTitle}` });
        container.append(source);
      }
      container.append(note, link); result.replaceChildren(container); message.textContent = '';
    } catch (error) { message.textContent = error instanceof Error ? error.message : 'Could not process this image. Please try another file.'; }
    finally { button.disabled = !file; button.textContent = 'Prepare and check file'; }
  });
  $('#clear-image').addEventListener('click', () => {
    revoke(); file = null; input.value = ''; button.disabled = true; message.textContent = ''; info.textContent = 'No image selected'; $('#quality-review').checked = false; $('#clean-signature').checked = false; $('#add-stamp').checked = false; $('#stamp-fields').hidden = true;
  });
}
