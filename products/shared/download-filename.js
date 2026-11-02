import './download-filename.css';

const INVALID_FILENAME_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f]/gu;

function splitName(filename) {
  const value = String(filename || '').trim();
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return { base: value || 'download', extension: '' };
  return { base: value.slice(0, dot) || 'download', extension: value.slice(dot + 1) };
}

function safeBaseName(value) {
  return String(value || '')
    .replace(INVALID_FILENAME_CHARACTERS, '-')
    .replace(/\s+/gu, ' ')
    .replace(/^[. ]+|[. ]+$/gu, '')
    .slice(0, 120) || 'download';
}

export function createDownloadFilenameControl(defaultFilename, { label = 'File name', extensionHint = null } = {}) {
  const initial = splitName(defaultFilename);
  const wrapper = document.createElement('label');
  wrapper.className = 'download-filename-control';
  const caption = document.createElement('span');
  caption.className = 'download-filename-caption';
  caption.textContent = label;
  const input = document.createElement('input');
  input.className = 'download-filename-input';
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.value = initial.base;
  input.setAttribute('aria-label', label);
  const extension = document.createElement('span');
  extension.className = 'download-filename-extension';
  extension.textContent = extensionHint ?? (initial.extension ? `.${initial.extension}` : '');
  wrapper.append(caption, input, extension);

  return {
    element: wrapper,
    input,
    getBaseName: () => safeBaseName(input.value),
    getFilename: (nextExtension = initial.extension) => {
      const normalized = String(nextExtension || '').replace(/^\.+/u, '');
      return normalized ? `${safeBaseName(input.value)}.${normalized}` : safeBaseName(input.value);
    },
    setBaseName(value) {
      input.value = String(value || '');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },
    setFilename(filename) {
      const next = splitName(filename);
      input.value = next.base;
      if (next.extension) extension.textContent = `.${next.extension}`;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },
    bind(link) {
      const update = () => { link.download = this.getFilename(); };
      input.addEventListener('input', update);
      const mount = () => {
        if (!link.parentNode || wrapper.parentNode) return false;
        link.before(wrapper);
        return true;
      };
      if (!mount()) {
        // Several tools build their result link off-DOM, then mount it with the
        // result card. Observe that insertion so the filename field is mounted
        // beside the link before the user can use it.
        const observer = new MutationObserver(() => {
          if (mount()) observer.disconnect();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
      }
      update();
      return link;
    },
  };
}

export function bindDownloadFilename(link, filename, options) {
  const control = createDownloadFilenameControl(filename, options);
  control.bind(link);
  return control;
}
