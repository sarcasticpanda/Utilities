import { bindDownloadFilename } from '../shared/download-filename.js';

const revealElements = document.querySelectorAll('[data-reveal]');
if (revealElements.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
  gsap.registerPlugin(ScrollTrigger);
  revealElements.forEach((el) => gsap.to(el, { opacity: 1, y: 0, duration: .55, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } }));
}
const formatBytes = (n) => n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
const page = document.body.dataset.page;

if (page === 'image') {
  const fileInput = document.querySelector('#image-file');
  const targetInput = document.querySelector('#target-kb');
  const message = document.querySelector('#image-message');
  const button = document.querySelector('#compress-image');
  let file = null;
  let sourceUrl = null;
  let resultUrl = null;
  document.querySelectorAll('[data-kb]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('[data-kb]').forEach((el) => el.classList.remove('selected'));
    b.classList.add('selected'); targetInput.value = b.dataset.kb;
  }));
  fileInput.addEventListener('change', () => {
    file = fileInput.files?.[0] || null;
    message.textContent = '';
    button.disabled = !file;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = file ? URL.createObjectURL(file) : null;
    const label = document.querySelector('.upload-zone b');
    const helper = document.querySelector('.upload-zone>span:not(.upload-symbol)');
    if (file) { label.textContent = file.name; helper.textContent = `Original size ${formatBytes(file.size)}`; }
    else { label.textContent = 'Choose an image'; helper.textContent = 'JPG, PNG or WebP'; }
  });
  async function encode(canvas, type, quality) {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Your browser could not export this image format.')), type, quality));
  }
  button.addEventListener('click', async () => {
    if (!file) return;
    const targetBytes = Number(targetInput.value) * 1024;
    if (!Number.isFinite(targetBytes) || targetBytes < 1024) { message.textContent = 'Choose a target of at least 1 KB.'; return; }
    button.disabled = true; button.textContent = 'Compressing…'; message.textContent = 'Processing locally in your browser.';
    try {
      const image = new Image(); image.src = sourceUrl; await image.decode();
      let width = image.naturalWidth, height = image.naturalHeight;
      const maxSide = 5000;
      if (Math.max(width, height) > maxSide) { const scale = maxSide / Math.max(width, height); width = Math.round(width * scale); height = Math.round(height * scale); }
      const type = document.querySelector('#output-format').value;
      let best = null;
      for (let dimensionPass = 0; dimensionPass < 9; dimensionPass++) {
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: type !== 'image/jpeg' });
        if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height); }
        ctx.drawImage(image, 0, 0, width, height);
        if (type === 'image/png') best = await encode(canvas, type);
        else {
          let low = .08, high = .94;
          for (let i = 0; i < 8; i++) {
            const q = (low + high) / 2;
            const blob = await encode(canvas, type, q);
            if (blob.size <= targetBytes) { best = blob; low = q; } else high = q;
          }
          if (best && best.size <= targetBytes) break;
          if (!best) best = await encode(canvas, type, .08);
        }
        if (best && best.size <= targetBytes) break;
        width = Math.max(80, Math.round(width * .82)); height = Math.max(80, Math.round(height * .82));
      }
      if (!best) throw new Error('Could not create an output image. Try another format or image.');
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      resultUrl = URL.createObjectURL(best);
      const result = document.querySelector('#image-result');
      const ext = type === 'image/jpeg' ? 'jpg' : type.split('/')[1];
      const status = best.size <= targetBytes ? `At or below ${targetInput.value} KB` : `Closest result; target ${targetInput.value} KB could not be reached`;
      result.innerHTML = `<div class="result-content"><img src="${resultUrl}" alt="Compressed image preview"><div class="result-meta"><span>${formatBytes(file.size)} original</span><span>${formatBytes(best.size)} result</span><span>${width} × ${height}px</span></div><strong>${status}</strong><a class="download-link" href="${resultUrl}" download="quickkit-image.${ext}">Download image</a></div>`;
      bindDownloadFilename(result.querySelector('.download-link'), `quickkit-image.${ext}`);
      message.textContent = '';
    } catch (error) { message.textContent = error instanceof Error ? error.message : 'Image processing failed. Please try another file.'; }
    finally { button.disabled = !file; button.textContent = 'Compress image'; }
  });
  document.querySelector('#reset-image').addEventListener('click', () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl); if (resultUrl) URL.revokeObjectURL(resultUrl);
    sourceUrl = null; resultUrl = null; file = null; fileInput.value = ''; button.disabled = true; message.textContent = '';
    document.querySelector('.upload-zone b').textContent = 'Choose an image'; document.querySelector('.upload-zone>span:not(.upload-symbol)').textContent = 'JPG, PNG or WebP';
    document.querySelector('#image-result').innerHTML = '<div class="result-empty"><span class="empty-icon">IMG</span><b>Your result will appear here</b><span>Choose a file to get started.</span></div>';
  });
}

if (page === 'text') {
  const text = document.querySelector('#text-input');
  const message = document.querySelector('#text-message');
  function updateCount() {
    const value = text.value;
    const words = value.trim() ? value.trim().split(/\s+/u).length : 0;
    document.querySelector('#word-count').textContent = words;
    document.querySelector('#char-count').textContent = [...value].length;
    document.querySelector('#read-time').textContent = words ? Math.max(1, Math.ceil(words / 220)) : 0;
  }
  text.addEventListener('input', updateCount);
  document.querySelectorAll('[data-clean]').forEach((button) => button.addEventListener('click', () => {
    const lines = text.value.split(/\r?\n/u);
    if (button.dataset.clean === 'trim') text.value = text.value.split(/\r?\n/u).map((line) => line.replace(/[ \t]+/gu, ' ').trim()).join('\n').trim();
    if (button.dataset.clean === 'blank') text.value = lines.filter((line) => line.trim()).join('\n');
    if (button.dataset.clean === 'duplicates') text.value = [...new Set(lines)].join('\n');
    updateCount(); message.textContent = 'Text updated.';
  }));
  document.querySelector('#copy-text').addEventListener('click', async () => { try { await navigator.clipboard.writeText(text.value); message.textContent = 'Text copied.'; } catch { message.textContent = 'Clipboard access is unavailable. Select and copy the text.'; } });
  document.querySelector('#generate-password').addEventListener('click', () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-_';
    const length = Math.min(64, Math.max(8, Number(document.querySelector('#password-length').value) || 18));
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    document.querySelector('#password-output').textContent = [...bytes].map((n) => alphabet[n % alphabet.length]).join('');
    message.textContent = 'Password generated locally. Save it somewhere secure.';
  });
  document.querySelector('#copy-password').addEventListener('click', async () => { const password = document.querySelector('#password-output').textContent; if (password === 'Choose Generate') return; try { await navigator.clipboard.writeText(password); message.textContent = 'Password copied.'; } catch { message.textContent = 'Clipboard access is unavailable.'; } });
}

if (page === 'qr') {
  const escapeWifi = (value) => [...value].map((ch) => ['\\', ';', ':', ',', '"'].includes(ch) ? `\\${ch}` : ch).join('');
  document.querySelector('#qr-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = document.querySelector('#wifi-name').value;
    const password = document.querySelector('#wifi-password').value;
    const security = document.querySelector('#wifi-security').value;
    const hidden = document.querySelector('#wifi-hidden').checked;
    const payload = `WIFI:T:${security};S:${escapeWifi(name)};P:${security === 'nopass' ? '' : escapeWifi(password)};H:${hidden ? 'true' : 'false'};;`;
    const output = document.querySelector('#qr-output'); output.replaceChildren();
    try {
      const { default: QRCode } = await import('qrcode');
      const canvas = document.createElement('canvas'); await QRCode.toCanvas(canvas, payload, { width: 230, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#172536', light: '#ffffff' } });
      output.append(canvas);
      const link = document.createElement('a'); link.className = 'download-link'; link.download = 'quickkit-wifi-qr.png'; link.textContent = 'Download QR code'; link.href = canvas.toDataURL('image/png'); output.append(link);
      bindDownloadFilename(link, 'quickkit-wifi-qr.png');
    } catch { output.textContent = 'Could not create this QR code. Check the network name and try again.'; }
  });
}

if (page === 'pdf') {
  let files = [];
  const list = document.querySelector('#pdf-list');
  const input = document.querySelector('#pdf-files');
  const mergeButton = document.querySelector('#merge-pdf');
  const message = document.querySelector('#pdf-message');
  function renderList() {
    list.replaceChildren();
    files.forEach((file, index) => {
      const item = document.createElement('li');
      const tag = Object.assign(document.createElement('b'), { className: 'pdf-file-tag', textContent: 'PDF' });
      const name = Object.assign(document.createElement('span'), { textContent: file.name });
      const up = Object.assign(document.createElement('button'), { type: 'button', textContent: '↑', ariaLabel: `Move ${file.name} earlier` });
      const down = Object.assign(document.createElement('button'), { type: 'button', textContent: '↓', ariaLabel: `Move ${file.name} later` });
      const remove = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Remove', ariaLabel: `Remove ${file.name}` });
      up.disabled = index === 0; down.disabled = index === files.length - 1;
      up.addEventListener('click', () => { [files[index - 1], files[index]] = [files[index], files[index - 1]]; renderList(); });
      down.addEventListener('click', () => { [files[index + 1], files[index]] = [files[index], files[index + 1]]; renderList(); });
      remove.addEventListener('click', () => { files.splice(index, 1); renderList(); });
      item.append(tag, name, up, down, remove); list.append(item);
    });
    mergeButton.disabled = files.length < 2;
  }
  input.addEventListener('change', () => {
    const added = [...input.files];
    const bad = added.find((file) => file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'));
    if (bad) { message.textContent = 'Choose PDF files only.'; return; }
    files.push(...added); input.value = ''; message.textContent = ''; renderList();
  });
  mergeButton.addEventListener('click', async () => {
    mergeButton.disabled = true; mergeButton.textContent = 'Merging…'; message.textContent = 'Processing locally in your browser.';
    try {
      const { PDFDocument } = await import('pdf-lib');
      const merged = await PDFDocument.create();
      for (const file of files) {
        const source = await PDFDocument.load(await file.arrayBuffer());
        const pages = await merged.copyPages(source, source.getPageIndices()); pages.forEach((p) => merged.addPage(p));
      }
      const bytes = await merged.save(); const blob = new Blob([bytes], { type: 'application/pdf' }); const url = URL.createObjectURL(blob);
      const result = document.querySelector('#pdf-result'); result.innerHTML = '';
      const content = document.createElement('div'); content.className = 'simple-result';
      const label = Object.assign(document.createElement('strong'), { textContent: `${files.length} files merged` });
      const pages = Object.assign(document.createElement('span'), { textContent: `${merged.getPageCount()} pages · ${formatBytes(blob.size)}` });
      const link = Object.assign(document.createElement('a'), { className: 'download-link', href: url, download: 'quickkit-merged.pdf', textContent: 'Download merged PDF' });
      bindDownloadFilename(link, 'quickkit-merged.pdf');
      content.append(label, pages, link); result.append(content); message.textContent = '';
      link.addEventListener('click', () => setTimeout(() => URL.revokeObjectURL(url), 10000), { once: true });
    } catch { message.textContent = 'Could not read one of these PDFs. Check that it is not damaged or password-protected.'; }
    finally { mergeButton.disabled = files.length < 2; mergeButton.textContent = 'Merge PDFs'; }
  });
}
