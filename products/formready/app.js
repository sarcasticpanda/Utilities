import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';

const revealElements = document.querySelectorAll('[data-reveal]');
if (revealElements.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
  gsap.registerPlugin(ScrollTrigger);
  revealElements.forEach((el) => gsap.to(el, { opacity: 1, y: 0, duration: .55, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } }));
}

if (document.body.dataset.page === 'prepare') {
  const input = document.querySelector('#form-image');
  const info = document.querySelector('#original-info');
  const button = document.querySelector('#prepare-image');
  const result = document.querySelector('#prepare-result');
  const message = document.querySelector('#prepare-message');
  const cropStage = document.querySelector('#crop-stage');
  const cropActions = document.querySelector('#crop-actions');
  const cropSource = document.querySelector('#crop-source');
  const maxSourcePixels = 30_000_000;
  let file = null, sourceUrl = null, outputUrl = null, mode = 'photo', cropper = null;
  const unit = () => document.querySelector('#target-unit')?.value || 'px';
  const dpi = () => Math.max(1, Number(document.querySelector('#target-dpi')?.value) || 300);
  const pixels = (value) => Math.round(value * (unit() === 'mm' ? dpi() / 25.4 : unit() === 'in' ? dpi() : 1));
  const clearResult = () => { if (outputUrl) URL.revokeObjectURL(outputUrl); outputUrl = null; result.innerHTML = '<div class="result-placeholder"><span class="placeholder-icon">IMG</span><b>Your file check appears here</b><span>Choose an image to begin.</span></div>'; };
  const prettyBytes = (bytes) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
  const updateAspect = () => {
    const width = pixels(Number(document.querySelector('#target-width').value));
    const height = pixels(Number(document.querySelector('#target-height').value));
    cropper?.setAspectRatio(width > 0 && height > 0 ? width / height : NaN);
  };
  const revoke = () => { if (cropper) cropper.destroy(); cropper = null; cropStage.hidden = true; if (cropActions) cropActions.hidden = true; if (sourceUrl) URL.revokeObjectURL(sourceUrl); sourceUrl = null; clearResult(); };
  document.querySelector('#target-width').addEventListener('input', updateAspect);
  document.querySelector('#target-height').addEventListener('input', updateAspect);
  document.querySelector('#target-unit')?.addEventListener('change', updateAspect);
  document.querySelector('#target-dpi')?.addEventListener('input', updateAspect);
  document.querySelector('#rotate-left')?.addEventListener('click', () => cropper?.rotate(-90));
  document.querySelector('#rotate-right')?.addEventListener('click', () => cropper?.rotate(90));
  document.querySelector('#reset-crop')?.addEventListener('click', () => { cropper?.reset(); updateAspect(); });
  document.querySelectorAll('#target-width,#target-height,#target-unit,#target-dpi,#max-kb,#form-format').forEach((control) => control.addEventListener('input', clearResult));
  document.querySelectorAll('[data-mode]').forEach((tab) => tab.addEventListener('click', () => {
    document.querySelectorAll('[data-mode]').forEach((t) => t.classList.toggle('active', t === tab));
    document.querySelectorAll('[data-mode]').forEach((t) => t.setAttribute('aria-pressed', String(t === tab)));
    mode = tab.dataset.mode;
    clearResult();
    document.querySelector('#target-width').value = '';
    document.querySelector('#target-height').value = '';
    const eyebrow = document.querySelector('.tool-intro .eyebrow');
    if (eyebrow) eyebrow.textContent = mode === 'photo' ? 'Enter your photo requirements' : mode === 'signature' ? 'Enter your signature requirements' : 'Enter custom image requirements';
    location.hash = mode;
  }));
  const formatChecks = (blobType, desiredType, w, h, targetW, targetH, maxKB, size) => [
    { label: 'Format', value: blobType.split('/')[1]?.toUpperCase() || 'Unknown', pass: blobType === desiredType },
    { label: 'Dimensions', value: `${w} × ${h}px`, pass: (!targetW || w === targetW) && (!targetH || h === targetH) },
    { label: 'File size', value: prettyBytes(size), pass: size <= maxKB * 1024 }
  ];
  async function toBlob(canvas, type, quality) { return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('This browser could not export the selected format.')), type, quality)); }
  input.addEventListener('change', () => {
    revoke(); file = input.files?.[0] || null; message.textContent = '';
    if (!file) { info.textContent = 'No image selected'; button.disabled = true; return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { file = null; input.value = ''; info.textContent = 'No image selected'; message.textContent = 'Choose a JPG, PNG or WebP image.'; button.disabled = true; return; }
    if (file.size > 20 * 1024 * 1024) { file = null; input.value = ''; info.textContent = 'No image selected'; message.textContent = 'Choose an image smaller than 20 MB.'; button.disabled = true; return; }
    sourceUrl = URL.createObjectURL(file); button.disabled = false;
    cropSource.src = sourceUrl; cropStage.hidden = false; if (cropActions) cropActions.hidden = false;
    cropSource.onload = () => {
      info.textContent = `${cropSource.naturalWidth} × ${cropSource.naturalHeight}px · ${prettyBytes(file.size)}`;
      if (cropSource.naturalWidth * cropSource.naturalHeight > maxSourcePixels) {
        message.textContent = 'This image has more than 30 megapixels. Choose a smaller image to avoid using too much device memory.';
        file = null; input.value = ''; button.disabled = true; revoke(); info.textContent = 'No image selected';
        return;
      }
      cropper = new Cropper(cropSource, { viewMode: 1, dragMode: 'move', autoCropArea: .88, responsive: true, restore: false, background: false, aspectRatio: NaN, checkOrientation: true });
      updateAspect();
    };
    cropSource.onerror = () => { message.textContent = 'This image could not be opened. Try a different file.'; button.disabled = true; };
  });
  button.addEventListener('click', async () => {
    if (!file || !sourceUrl) return;
    const targetW = document.querySelector('#target-width').value ? pixels(Number(document.querySelector('#target-width').value)) : null;
    const targetH = document.querySelector('#target-height').value ? pixels(Number(document.querySelector('#target-height').value)) : null;
    const maxKB = Number(document.querySelector('#max-kb').value);
    const type = document.querySelector('#form-format').value;
    const rawW = Number(document.querySelector('#target-width').value);
    const rawH = Number(document.querySelector('#target-height').value);
    const rawDpi = Number(document.querySelector('#target-dpi')?.value || 300);
    if ((rawW && (!Number.isFinite(rawW) || rawW < 1)) || (rawH && (!Number.isFinite(rawH) || rawH < 1)) || (targetW !== null && targetW < 1) || (targetH !== null && targetH < 1) || !Number.isFinite(maxKB) || maxKB < 1) { message.textContent = 'Enter positive dimensions that convert to at least 1 pixel, and a maximum size of at least 1 KB.'; return; }
    if (!Number.isFinite(rawDpi) || rawDpi < 1 || rawDpi > 1200) { message.textContent = 'Enter a print resolution between 1 and 1,200 DPI.'; return; }
    if ((targetW && targetW > 5000) || (targetH && targetH > 5000)) { message.textContent = 'This browser tool supports output dimensions up to 5,000 pixels per side.'; return; }
    button.disabled = true; button.textContent = 'Preparing…'; message.textContent = 'Your image is processing on this device.';
    try {
      const image = new Image(); image.src = sourceUrl; await image.decode();
      const croppedCanvas = cropper?.getCroppedCanvas({ fillColor: type === 'image/jpeg' ? '#fff' : undefined }) || (() => { const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; canvas.getContext('2d').drawImage(image, 0, 0); return canvas; })();
      let width = targetW || croppedCanvas.width, height = targetH || croppedCanvas.height;
      if (targetW && !targetH) height = Math.max(1, Math.round(croppedCanvas.height * targetW / croppedCanvas.width));
      if (targetH && !targetW) width = Math.max(1, Math.round(croppedCanvas.width * targetH / croppedCanvas.height));
      const shrink = Math.min(1, 5000 / Math.max(width, height)); width = Math.max(1, Math.round(width * shrink)); height = Math.max(1, Math.round(height * shrink));
      let blob = null;
      for (let pass = 0; pass < 10; pass++) {
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: type !== 'image/jpeg' });
        if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height); }
        ctx.drawImage(croppedCanvas, 0, 0, width, height);
        if (type === 'image/png') blob = await toBlob(canvas, type);
        else {
          let lo = .07, hi = .94;
          for (let i = 0; i < 9; i++) { const mid = (lo + hi) / 2; const candidate = await toBlob(canvas, type, mid); if (candidate.size <= maxKB * 1024) { blob = candidate; lo = mid; } else hi = mid; }
          if (!blob) blob = await toBlob(canvas, type, .07);
        }
        if (blob.size <= maxKB * 1024) break;
        width = Math.max(1, Math.round(width * .84)); height = Math.max(1, Math.round(height * .84));
      }
      if (!blob) throw new Error('Could not create an output image. Try a different format.');
      if (outputUrl) URL.revokeObjectURL(outputUrl); outputUrl = URL.createObjectURL(blob);
      const checks = formatChecks(blob.type, type, width, height, targetW, targetH, maxKB, blob.size);
      const pass = checks.every((check) => check.pass);
      const container = document.createElement('div'); container.className = 'validation-result';
      const badge = Object.assign(document.createElement('span'), { className: `ready-badge${pass ? '' : ' needs-badge'}`, textContent: pass ? 'Ready to review' : 'Needs attention' });
      const preview = Object.assign(document.createElement('img'), { src: outputUrl, alt: 'Prepared image preview' });
      const checksList = document.createElement('div'); checksList.className = 'checks';
      checks.forEach((check) => { const line = document.createElement('div'); const status = Object.assign(document.createElement('b'), { className: check.pass ? 'check-pass' : 'check-fail', textContent: check.pass ? 'PASS' : 'CHECK' }); const label = Object.assign(document.createElement('span'), { textContent: check.label }); const value = Object.assign(document.createElement('b'), { textContent: check.value }); line.append(status, label, value); checksList.append(line); });
      const details = Object.assign(document.createElement('p'), { className: 'result-details', textContent: `Original: ${prettyBytes(file.size)} · Result: ${prettyBytes(blob.size)} · ${width} × ${height}px` });
      const link = Object.assign(document.createElement('a'), { className: 'download-button', href: outputUrl, download: `formready-${mode}.${type === 'image/jpeg' ? 'jpg' : type.split('/')[1]}`, textContent: 'Download prepared image' });
      container.append(badge, preview, checksList, details, link); result.replaceChildren(container); message.textContent = '';
    } catch (error) { message.textContent = error instanceof Error ? error.message : 'Could not process this image. Please try another file.'; }
    finally { button.disabled = !file; button.textContent = 'Resize and check'; }
  });
  document.querySelector('#clear-image').addEventListener('click', () => {
    revoke(); file = null; input.value = ''; button.disabled = true; message.textContent = ''; info.textContent = 'No image selected';
    result.innerHTML = '<div class="result-placeholder"><span class="placeholder-icon">IMG</span><b>Your file check appears here</b><span>Choose an image to begin.</span></div>';
  });
}
