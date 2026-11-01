const $ = (selector) => document.querySelector(selector);
const fileInput = $('#video-files');
const preview = $('#video-preview');
const inputs = new Map();
let mode = 'compress';
let selected = [];
let segments = [];
let trimRanges = [];
let activeTrimRangeId = null;
let trimDraftActive = true;
let trimIntent = 'keep';
let soundtracks = [];
let soundtrackCounter = 0;
let activeConversion = null;
let activeOutput = null;
let activeOfflineContext = null;
let isProcessing = false;
let cancelRequested = false;
let resultUrl = null;
let sourcePreviewUrl = null;
let segmentCounter = 0;
let queuedJoinTask = 'join';
let mediaEnginePromise;
const filmstripCache = new Map();
let trimDrag = null;
const MAX_FILE_BYTES = 150 * 1024 * 1024;
const MAX_TOTAL_DURATION = 10 * 60;
const MAX_MIX_DURATION_DESKTOP = 240;
const MAX_MIX_DURATION_MOBILE = 120;

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remainder = whole % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}` : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function formatPreciseDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const wholeMinutes = Math.floor(seconds / 60);
  const remainder = (seconds - wholeMinutes * 60).toFixed(2).padStart(5, '0');
  return `${wholeMinutes}:${remainder}`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function setStatus(message, isError = false) {
  const status = $('#video-status');
  status.textContent = message;
  status.classList.toggle('is-error', isError);
}

function currentLimitBytes() {
  return matchMedia('(max-width: 560px)').matches ? 60 * 1024 * 1024 : MAX_FILE_BYTES;
}

function outputDuration() {
  return segments.reduce((sum, segment) => sum + segment.end - segment.start, 0);
}

function releaseInputs() {
  for (const { input } of inputs.values()) input.dispose();
  inputs.clear();
}

function releaseResult() {
  const wasPreviewingResult = resultUrl && preview.src === resultUrl;
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = null;
  $('#video-result').hidden = true;
  $('#video-download').removeAttribute('href');
  if (wasPreviewingResult && sourcePreviewUrl) {
    preview.pause(); preview.src = sourcePreviewUrl; preview.load(); preview.hidden = false;
    $('#video-preview-title').textContent = 'Original video';
    const item = selected[0];
    if (item) $('#video-preview-meta').textContent = `${item.width} × ${item.height} · ${formatDuration(item.duration)}`;
  }
}

function updateMode(nextMode) {
  mode = nextMode;
  document.querySelectorAll('.video-tabs [role=tab]').forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll('.video-mode-panel').forEach((panel) => { panel.hidden = panel.id !== `video-panel-${mode}`; });
  if (mode !== 'crop') {
    $('.video-frame').style.aspectRatio = '';
    preview.style.objectFit = 'contain';
    preview.style.objectPosition = '50% 50%';
  } else updateCropPreview();
  fileInput.multiple = mode === 'join';
  $('#video-upload-title').textContent = mode === 'join' ? 'Choose clips or drop them here' : 'Choose a video or drop it here';
  const limit = formatBytes(currentLimitBytes());
  $('#video-upload-hint').textContent = mode === 'join' ? `MP4, MOV, M4V or WebM · up to ${limit} total` : `MP4, MOV, M4V or WebM · up to ${limit}`;
  if (mode !== 'join' && selected.length > 1) {
    selected = [];
    segments = [];
    soundtracks = [];
    releaseInputs();
    if (sourcePreviewUrl) URL.revokeObjectURL(sourcePreviewUrl);
    sourcePreviewUrl = null;
    $('#video-file-summary').hidden = true;
    preview.hidden = true;
    $('#video-empty').hidden = false;
    setStatus('Choose one video for this task.');
  }
  renderSegments();
  renderSoundtracks();
  updateTimelineControls();
  updateActions();
}

function updateActions() {
  const hasVideo = selected.length > 0;
  $('#video-run-compress').disabled = !hasVideo || busy();
  $('#video-run-trim').disabled = !hasVideo || busy();
  $('#video-run-remove-range').disabled = !hasVideo || busy();
  $('#video-add-trim-range').disabled = !hasVideo || busy();
  $('#video-clear-trim-ranges').disabled = !trimRanges.length || busy();
  $('#video-preview-trim-ranges').disabled = !trimRanges.length || busy();
  $('#video-run-crop').disabled = !hasVideo || busy();
  $('#video-run-join').disabled = segments.length === 0 || busy();
  $('#video-add-segment').disabled = segments.length === 0 || busy();
}

function busy() {
  return isProcessing;
}

function mediaEngine() {
  mediaEnginePromise ||= import('mediabunny');
  return mediaEnginePromise;
}

async function inspectFile(file) {
  if (file.size > currentLimitBytes()) throw new Error(`“${file.name}” is larger than this device’s ${formatBytes(currentLimitBytes())} limit.`);
  const { ALL_FORMATS, BlobSource, Input } = await mediaEngine();
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    if (!(await input.canRead())) throw new Error(`QuickKit can’t read “${file.name}”. Try an MP4, MOV or WebM exported with a browser-supported codec.`);
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error(`“${file.name}” does not contain a video track.`);
    if (!(await videoTrack.canDecode())) throw new Error(`This browser can read the container but cannot decode the video codec in “${file.name}”.`);
    const duration = await input.computeDuration([videoTrack]);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error(`The video duration in “${file.name}” could not be read.`);
    if (duration > MAX_TOTAL_DURATION) throw new Error(`“${file.name}” is longer than the 10-minute processing limit. Trim a shorter source first.`);
    const audioTrack = await input.getPrimaryAudioTrack();
    const audioUsable = audioTrack ? await audioTrack.canDecode() : false;
    const width = await videoTrack.getDisplayWidth();
    const height = await videoTrack.getDisplayHeight();
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) throw new Error(`The video dimensions in “${file.name}” are not supported.`);
    const item = { id: crypto.randomUUID(), file, input, videoTrack, audioTrack: audioUsable ? audioTrack : null, duration, width, height, audioUnsupported: Boolean(audioTrack && !audioUsable) };
    inputs.set(item.id, item);
    return item;
  } catch (error) {
    input.dispose();
    throw error;
  }
}

function showSourcePreview(item) {
  if (sourcePreviewUrl) URL.revokeObjectURL(sourcePreviewUrl);
  sourcePreviewUrl = URL.createObjectURL(item.file);
  preview.src = sourcePreviewUrl;
  preview.hidden = false;
  $('#video-empty').hidden = true;
  $('#video-preview-title').textContent = 'Original video';
  $('#video-preview-meta').textContent = `${item.width} × ${item.height} · ${formatDuration(item.duration)}`;
  $('#video-scrub').max = String(item.duration);
  $('#video-scrub').value = '0';
  $('#video-scrub').disabled = false;
  $('#video-scrub-time').textContent = formatDuration(0);
  $('#video-trim-start').value = '0';
  $('#video-trim-end').value = item.duration.toFixed(2);
  trimRanges = [];
  activeTrimRangeId = null;
  trimDraftActive = true;
  renderTrimRanges();
  $('#video-trim-end').max = String(item.duration);
  $('#video-file-summary').hidden = false;
  $('#video-file-name').textContent = item.file.name;
  $('#video-file-details').textContent = `${formatBytes(item.file.size)} · ${item.width} × ${item.height} · ${formatDuration(item.duration)}${item.audioUnsupported ? ' · audio codec unsupported' : ''}`;
  updateCropPreview();
  syncTrimTimeline();
  updateTimelineControls();
  if (item.audioUnsupported) setStatus('Video can be read, but this browser can’t decode its audio track. Choose a different source to keep audio.', true);
  else setStatus('Video ready. Choose a task to continue.');
}

function addSegment(item, start = 0, end = item.duration) {
  segments.push({ id: `segment-${++segmentCounter}`, itemId: item.id, start, end });
  renderSegments();
}

function renderSegments() {
  const list = $('#video-segments');
  list.replaceChildren();
  segments.forEach((segment, index) => {
    const item = inputs.get(segment.itemId);
    if (!item) return;
    const row = document.createElement('li');
    row.className = 'video-segment';
    row.dataset.segmentId = segment.id;
    const header = document.createElement('div'); header.className = 'video-segment-header';
    const badge = document.createElement('span'); badge.className = 'video-segment-index'; badge.textContent = String(index + 1);
    const name = document.createElement('span'); name.className = 'video-segment-name'; name.textContent = item.file.name;
    const actions = document.createElement('span'); actions.className = 'video-segment-actions';
    const up = document.createElement('button'); up.type = 'button'; up.textContent = '↑'; up.setAttribute('aria-label', `Move clip ${index + 1} up`); up.disabled = index === 0;
    const down = document.createElement('button'); down.type = 'button'; down.textContent = '↓'; down.setAttribute('aria-label', `Move clip ${index + 1} down`); down.disabled = index === segments.length - 1;
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', `Remove clip ${index + 1}`);
    up.addEventListener('click', () => moveSegment(index, index - 1));
    down.addEventListener('click', () => moveSegment(index, index + 1));
    remove.addEventListener('click', () => { segments.splice(index, 1); releaseResult(); renderSegments(); });
    actions.append(up, down, remove); header.append(badge, name, actions);
    const startLabel = document.createElement('label'); startLabel.textContent = 'Keep from (sec)';
    const start = document.createElement('input'); start.type = 'number'; start.min = '0'; start.max = String(item.duration); start.step = '0.1'; start.value = segment.start.toFixed(1);
    start.setAttribute('aria-label', `Clip ${index + 1} keep from seconds`);
    const endLabel = document.createElement('label'); endLabel.textContent = 'Keep to (sec)';
    const end = document.createElement('input'); end.type = 'number'; end.min = '0'; end.max = String(item.duration); end.step = '0.1'; end.value = segment.end.toFixed(1);
    end.setAttribute('aria-label', `Clip ${index + 1} keep to seconds`);
    startLabel.append(start); endLabel.append(end); row.append(header, startLabel, endLabel); list.append(row);
    const sync = () => {
      segment.start = Math.max(0, Math.min(item.duration, Number(start.value) || 0));
      segment.end = Math.max(0, Math.min(item.duration, Number(end.value) || 0));
      releaseResult();
      renderSoundtracks();
      renderVideoTimeline();
      updateActions();
    };
    start.addEventListener('input', sync); end.addEventListener('input', sync);
  });
  renderVideoTimeline();
  updateActions();
}

function makeTimelineLane(label, blocks, duration) {
  const lane = document.createElement('div'); lane.className = 'timeline-lane';
  const name = document.createElement('span'); name.textContent = label;
  const rail = document.createElement('div'); rail.className = 'timeline-rail';
  rail.setAttribute('role', 'group'); rail.setAttribute('aria-label', `${label} timeline`);
  blocks.forEach(({ start, length, text, kind }) => {
    if (!(length > 0) || !(duration > 0)) return;
    const block = document.createElement('span'); block.className = `timeline-block${kind === 'audio' ? ' audio' : ''}`;
    block.style.left = `${Math.max(0, Math.min(100, start / duration * 100))}%`;
    block.style.width = `${Math.max(0.6, Math.min(100, length / duration * 100))}%`;
    block.textContent = text; block.title = `${text} · ${formatDuration(start)}–${formatDuration(Math.min(duration, start + length))}`;
    rail.append(block);
  });
  const playhead = document.createElement('span'); playhead.className = 'timeline-playhead'; playhead.setAttribute('aria-hidden', 'true');
  rail.append(playhead);
  lane.append(name, rail);
  return lane;
}

async function loadFilmstrip(item) {
  if (filmstripCache.has(item.id)) return filmstripCache.get(item.id);
  const task = (async () => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(item.file);
    const canvas = document.createElement('canvas'); canvas.width = 112; canvas.height = 63;
    const context = canvas.getContext('2d', { alpha: false });
    try {
      video.muted = true; video.playsInline = true; video.preload = 'auto';
      await new Promise((resolve, reject) => {
        video.addEventListener('loadedmetadata', resolve, { once: true });
        video.addEventListener('error', () => reject(new Error('Video frames could not be previewed.')), { once: true });
        video.src = url;
      });
      const frames = [];
      for (let index = 0; index < 8; index++) {
        const time = Math.min(Math.max(.01, item.duration - .02), item.duration * (index / 7));
        if (Math.abs(video.currentTime - time) > .03) {
          await new Promise((resolve) => {
            video.addEventListener('seeked', resolve, { once: true });
            video.currentTime = time;
          });
        } else if (video.readyState < 2) {
          await new Promise((resolve) => video.addEventListener('loadeddata', resolve, { once: true }));
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL('image/jpeg', .55));
      }
      return frames;
    } catch {
      return [];
    } finally {
      video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url);
    }
  })();
  filmstripCache.set(item.id, task);
  return task;
}

function appendFilmstrip(rail, item) {
  rail.dataset.itemId = item.id;
  const strip = document.createElement('div'); strip.className = 'timeline-filmstrip'; strip.setAttribute('aria-hidden', 'true');
  rail.prepend(strip);
  loadFilmstrip(item).then((frames) => {
    if (!rail.isConnected || rail.dataset.itemId !== item.id || !frames.length) return;
    strip.replaceChildren(...frames.map((src) => {
      const image = document.createElement('img'); image.src = src; image.alt = ''; image.draggable = false; return image;
    }));
    strip.classList.add('is-ready');
  });
}

function appendTimeRuler(timeline, duration) {
  const row = document.createElement('div'); row.className = 'timeline-ruler-row';
  const label = document.createElement('span'); label.textContent = 'Time';
  const rail = document.createElement('div'); rail.className = 'timeline-ruler'; rail.setAttribute('aria-hidden', 'true');
  [0, .25, .5, .75, 1].forEach((fraction, index) => {
    const mark = document.createElement('span'); mark.className = 'timeline-ruler-mark';
    mark.style.left = `${fraction * 100}%`; mark.textContent = formatDuration(duration * fraction);
    if (index === 4) mark.classList.add('is-end');
    rail.append(mark);
  });
  row.append(label, rail); timeline.append(row);
}

function updateTrimSelectionDom() {
  const selection = $('#video-timeline .timeline-trim-selection:not(.timeline-trim-saved)');
  const source = selected[0];
  if (!selection || !source?.duration) return;
  const start = Number($('#video-trim-start').value) || 0;
  const end = Number($('#video-trim-end').value) || source.duration;
  selection.style.left = `${clamp(start / source.duration, 0, 1) * 100}%`;
  selection.style.width = `${clamp((end - start) / source.duration, 0, 1) * 100}%`;
  const startHandle = selection.querySelector('[data-trim-part="start"]');
  const endHandle = selection.querySelector('[data-trim-part="end"]');
  if (startHandle) { startHandle.setAttribute('aria-valuenow', start.toFixed(2)); startHandle.setAttribute('aria-valuetext', formatPreciseDuration(start)); }
  if (endHandle) { endHandle.setAttribute('aria-valuenow', end.toFixed(2)); endHandle.setAttribute('aria-valuetext', formatPreciseDuration(end)); }
  const duration = source.duration;
  const leftMask = selection.parentElement.querySelector('.timeline-trim-mask-left');
  const rightMask = selection.parentElement.querySelector('.timeline-trim-mask-right');
  if (leftMask) leftMask.style.width = `${clamp(start / duration, 0, 1) * 100}%`;
  if (rightMask) { rightMask.style.left = `${clamp(end / duration, 0, 1) * 100}%`; rightMask.style.width = `${clamp((duration - end) / duration, 0, 1) * 100}%`; }
  const span = end - start;
  $('#video-trim-range-summary').textContent = `${formatPreciseDuration(start)}–${formatPreciseDuration(end)} · ${span.toFixed(2)} s selected`;
  selection.hidden = !trimDraftActive;
}

function renderTrimRanges() {
  const list = $('#video-trim-segments');
  if (!list) return;
  list.replaceChildren();
  list.hidden = trimRanges.length === 0;
  trimRanges.forEach((range, index) => {
    const row = document.createElement('li'); row.className = 'video-trim-range-row'; row.dataset.trimRangeId = range.id;
    const title = document.createElement('strong'); title.textContent = `Part ${index + 1}`;
    const start = document.createElement('input'); start.type = 'number'; start.min = '0'; start.max = String(selected[0]?.duration || 0); start.step = '.01'; start.value = range.start.toFixed(2); start.setAttribute('aria-label', `Part ${index + 1} start time in seconds`);
    const end = document.createElement('input'); end.type = 'number'; end.min = '0'; end.max = String(selected[0]?.duration || 0); end.step = '.01'; end.value = range.end.toFixed(2); end.setAttribute('aria-label', `Part ${index + 1} end time in seconds`);
    const startLabel = document.createElement('label'); startLabel.className = 'video-trim-range-time'; startLabel.append(document.createTextNode('From (seconds)'), start);
    const endLabel = document.createElement('label'); endLabel.className = 'video-trim-range-time'; endLabel.append(document.createTextNode('To (seconds)'), end);
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'video-text-button'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove part ${index + 1}`);
    const select = () => { activeTrimRangeId = range.id; trimDraftActive = false; $('#video-trim-start').value = range.start.toFixed(2); $('#video-trim-end').value = range.end.toFixed(2); syncTrimTimeline(); };
    row.addEventListener('click', (event) => { if (!event.target.closest('input,button')) select(); });
    const sync = () => { activeTrimRangeId = range.id; trimDraftActive = false; range.start = clamp(Number(start.value) || 0, 0, (selected[0]?.duration || 0) - .15); range.end = clamp(Number(end.value) || 0, range.start + .15, selected[0]?.duration || 0); releaseResult(); renderVideoTimeline(); };
    start.addEventListener('focus', select); end.addEventListener('focus', select); start.addEventListener('input', sync); end.addEventListener('input', sync);
    remove.addEventListener('click', () => { trimRanges = trimRanges.filter((part) => part.id !== range.id); if (activeTrimRangeId === range.id) { activeTrimRangeId = null; trimDraftActive = true; } renderTrimRanges(); renderVideoTimeline(); updateActions(); });
    row.append(title, startLabel, endLabel, remove); list.append(row);
  });
  const add = $('#video-add-trim-range');
  if (add) add.textContent = trimDraftActive ? 'Save this range' : 'Add another range';
  const previewButton = $('#video-preview-trim-ranges');
  if (previewButton) { previewButton.hidden = trimRanges.length === 0; previewButton.textContent = trimIntent === 'keep' ? 'Preview kept parts' : 'Preview with cuts removed'; }
  const exportButton = $('#video-run-trim');
  if (exportButton) exportButton.textContent = trimRanges.length ? (trimIntent === 'keep' ? 'Export kept parts' : 'Export with cuts removed') : 'Export trimmed clip';
  updateActions();
}

function renderVideoTimeline() {
  const timeline = $('#video-timeline');
  if (!timeline) return;
  timeline.replaceChildren();
  const source = selected[0];
  const duration = mode === 'trim' ? source?.duration || 0 : segments.length ? outputDuration() : source?.duration || 0;
  timeline.hidden = duration <= 0;
  if (duration <= 0) { updateTimelineControls(); return; }
  let offset = 0;
  const videoBlocks = segments.length ? segments.map((segment, index) => {
    const item = inputs.get(segment.itemId); const length = segment.end - segment.start;
    const block = { start: offset, length, text: `${index + 1}. ${item?.file.name || 'Video clip'}`, kind: 'video' };
    offset += length; return block;
  }) : [{ start: 0, length: source.duration, text: source.file.name, kind: 'video' }];
  appendTimeRuler(timeline, duration);
  const videoLane = makeTimelineLane('Video', mode === 'trim' ? [] : videoBlocks, duration);
  if (source && mode === 'trim') {
    const rail = videoLane.querySelector('.timeline-rail');
    appendFilmstrip(rail, source);
    for (const side of ['left', 'right']) {
      const mask = document.createElement('span'); mask.className = `timeline-trim-mask timeline-trim-mask-${side}`; mask.setAttribute('aria-hidden', 'true'); rail.append(mask);
    }
    for (const range of trimRanges) {
      const saved = document.createElement('div');
      saved.className = `timeline-trim-selection timeline-trim-saved${range.id === activeTrimRangeId ? ' is-active' : ''}`;
      saved.dataset.trimRangeId = range.id;
      saved.style.left = `${range.start / source.duration * 100}%`;
      saved.style.width = `${(range.end - range.start) / source.duration * 100}%`;
      saved.setAttribute('aria-label', `Saved range ${formatPreciseDuration(range.start)} to ${formatPreciseDuration(range.end)}. Drag an edge to adjust.`);
      for (const [part, label] of [['start', 'Trim start'], ['end', 'Trim end']]) {
        const handle = document.createElement('button'); handle.type = 'button'; handle.className = 'timeline-trim-handle';
        handle.dataset.trimPart = part; handle.dataset.trimRangeId = range.id; handle.setAttribute('role', 'slider'); handle.setAttribute('aria-label', `${label} for saved range`);
        handle.setAttribute('aria-orientation', 'horizontal'); handle.setAttribute('aria-valuemin', '0'); handle.setAttribute('aria-valuemax', String(duration));
        handle.setAttribute('aria-valuenow', String(part === 'start' ? range.start : range.end)); handle.setAttribute('aria-valuetext', formatPreciseDuration(part === 'start' ? range.start : range.end));
        handle.addEventListener('keydown', handleTrimKeydown); saved.append(handle);
      }
      rail.append(saved);
    }
    const selection = document.createElement('div'); selection.className = `timeline-trim-selection${activeTrimRangeId ? ' is-draft' : ''}`; selection.hidden = !trimDraftActive;
    selection.setAttribute('aria-label', 'Selected video range. Drag either edge to adjust the trim.');
    for (const [part, label] of [['start', 'Trim start'], ['end', 'Trim end']]) {
      const handle = document.createElement('button'); handle.type = 'button'; handle.className = 'timeline-trim-handle';
      handle.dataset.trimPart = part; handle.setAttribute('role', 'slider'); handle.setAttribute('aria-label', label);
      handle.setAttribute('aria-orientation', 'horizontal'); handle.setAttribute('aria-valuemin', '0');
      handle.setAttribute('aria-valuemax', String(duration)); handle.setAttribute('aria-valuenow', '0'); handle.setAttribute('aria-valuetext', '0:00');
      handle.addEventListener('keydown', handleTrimKeydown);
      selection.append(handle);
    }
    rail.append(selection);
    rail.addEventListener('pointerdown', handleTrimPointerDown);
    rail.addEventListener('pointermove', handleTrimPointerMove);
    rail.addEventListener('pointerup', handleTrimPointerUp);
    rail.addEventListener('pointercancel', handleTrimPointerUp);
  }
  timeline.append(videoLane);
  if (source && mode === 'trim') updateTrimSelectionDom();
  soundtracks.forEach((track, index) => {
    const length = Math.max(0, Math.min(track.sourceEnd - track.sourceStart, duration - track.startAt));
    timeline.append(makeTimelineLane(`Audio ${index + 1}`, [{ start: track.startAt, length, text: track.file.name, kind: 'audio' }], duration));
  });
  updateTimelinePlayback();
  updateTimelineControls();
}

function syncTrimTimeline(shouldRender = true) {
  const item = selected[0];
  if (!item) return;
  const start = clamp(Number($('#video-trim-start').value) || 0, 0, Math.max(0, item.duration - .15));
  const end = clamp(Number($('#video-trim-end').value) || item.duration, start + .15, item.duration);
  $('#video-trim-start').value = start.toFixed(2);
  $('#video-trim-end').value = end.toFixed(2);
  $('#video-trim-start').max = String(Math.max(0, item.duration - .15));
  $('#video-trim-end').max = String(item.duration);
  $('#video-reset-trim').disabled = start === 0 && Math.abs(end - item.duration) < .05;
  if (activeTrimRangeId) {
    const active = trimRanges.find((range) => range.id === activeTrimRangeId);
    if (active) { active.start = start; active.end = end; }
    const saved = document.querySelector(`#video-timeline [data-trim-range-id="${activeTrimRangeId}"]`);
    if (saved && item.duration) { saved.style.left = `${start / item.duration * 100}%`; saved.style.width = `${(end - start) / item.duration * 100}%`; }
    const row = document.querySelector(`#video-trim-segments [data-trim-range-id="${activeTrimRangeId}"]`);
    if (row) { const fields = row.querySelectorAll('input'); if (fields[0]) fields[0].value = start.toFixed(2); if (fields[1]) fields[1].value = end.toFixed(2); }
  }
  updateTrimSelectionDom();
  if (shouldRender) renderVideoTimeline();
}

function applyPointerTrim(clientX, drag = trimDrag) {
  if (!drag) return;
  const rect = drag.rail.getBoundingClientRect();
  if (rect.width <= 0) return;
  const fraction = clamp((clientX - rect.left) / rect.width, 0, 1);
  const delta = fraction * drag.duration;
  let start = drag.start; let end = drag.end;
  if (drag.part === 'start') start = clamp(delta, 0, end - .15);
  else if (drag.part === 'end') end = clamp(delta, start + .15, drag.duration);
  else {
    const shift = (clientX - drag.startX) / rect.width * drag.duration;
    start = clamp(drag.start + shift, 0, drag.duration - (drag.end - drag.start));
    end = start + (drag.end - drag.start);
  }
  start = Math.round(start * 100) / 100; end = Math.round(end * 100) / 100;
  drag.didMove ||= Math.abs(start - drag.start) > .04 || Math.abs(end - drag.end) > .04;
  $('#video-trim-start').value = start.toFixed(2);
  $('#video-trim-end').value = end.toFixed(2);
  syncTrimTimeline(false);
}

function handleTrimPointerDown(event) {
  const item = selected[0];
  if (mode !== 'trim' || !item || event.button !== 0) return;
  const handle = event.target.closest('[data-trim-part]');
  const selection = event.target.closest('.timeline-trim-selection');
  if (!handle && !selection) {
    preview.currentTime = clamp((event.clientX - event.currentTarget.getBoundingClientRect().left) / event.currentTarget.clientWidth, 0, 1) * item.duration;
    updateTimelinePlayback();
    return;
  }
  event.preventDefault();
  const rangeId = handle?.dataset.trimRangeId || selection?.dataset.trimRangeId || null;
  if (rangeId) {
    activeTrimRangeId = rangeId;
    const range = trimRanges.find((entry) => entry.id === rangeId);
    if (range) { $('#video-trim-start').value = range.start.toFixed(2); $('#video-trim-end').value = range.end.toFixed(2); }
  }
  event.currentTarget.setPointerCapture(event.pointerId);
  releaseResult();
  trimDrag = {
    rail: event.currentTarget, pointerId: event.pointerId, part: handle?.dataset.trimPart || 'range', rangeId,
    startX: event.clientX, start: Number($('#video-trim-start').value), end: Number($('#video-trim-end').value),
    duration: item.duration, didMove: false, clickTime: clamp((event.clientX - event.currentTarget.getBoundingClientRect().left) / event.currentTarget.clientWidth, 0, 1) * item.duration
  };
}

function handleTrimPointerMove(event) {
  if (!trimDrag || trimDrag.pointerId !== event.pointerId) return;
  applyPointerTrim(event.clientX);
}

function handleTrimPointerUp(event) {
  if (!trimDrag || trimDrag.pointerId !== event.pointerId) return;
  const drag = trimDrag; trimDrag = null;
  if (!drag.didMove && drag.part === 'range') preview.currentTime = drag.clickTime;
  else if (drag.didMove) preview.currentTime = clamp(preview.currentTime, Number($('#video-trim-start').value), Number($('#video-trim-end').value));
  updateTimelinePlayback();
  if (drag.rangeId) { renderTrimRanges(); renderVideoTimeline(); }
  if (drag.didMove) setStatus(`Keep ${formatPreciseDuration(Number($('#video-trim-start').value))}–${formatPreciseDuration(Number($('#video-trim-end').value))}. Preview the selection or export it.`);
}

function handleTrimKeydown(event) {
  const item = selected[0];
  if (!item) return;
  const part = event.currentTarget.dataset.trimPart;
  const rangeId = event.currentTarget.dataset.trimRangeId;
  if (rangeId) {
    activeTrimRangeId = rangeId;
    const range = trimRanges.find((entry) => entry.id === rangeId);
    if (range) { $('#video-trim-start').value = range.start.toFixed(2); $('#video-trim-end').value = range.end.toFixed(2); }
  }
  let start = Number($('#video-trim-start').value); let end = Number($('#video-trim-end').value);
  const step = event.shiftKey ? 1 : .1;
  if (event.key === 'Home') { if (part === 'start') start = 0; else end = item.duration; }
  else if (event.key === 'End') { if (part === 'start') start = end - .15; else end = item.duration; }
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { if (part === 'start') start -= step; else end -= step; }
  else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { if (part === 'start') start += step; else end += step; }
  else return;
  event.preventDefault();
  if (part === 'start') start = clamp(start, 0, end - .15); else end = clamp(end, start + .15, item.duration);
  $('#video-trim-start').value = start.toFixed(2); $('#video-trim-end').value = end.toFixed(2);
  releaseResult(); syncTrimTimeline(false); preview.currentTime = part === 'start' ? start : end; updateTimelinePlayback();
}

function resetTrimRange() {
  const item = selected[0];
  if (!item) return;
  $('#video-trim-start').value = '0.00'; $('#video-trim-end').value = item.duration.toFixed(2);
  preview.currentTime = 0; releaseResult(); syncTrimTimeline(); updateTimelinePlayback();
}

function addOrSaveTrimRange() {
  const item = selected[0];
  if (!item) return;
  if (!trimDraftActive) {
    const start = clamp(preview.currentTime, 0, Math.max(0, item.duration - .15));
    const end = Math.min(item.duration, start + Math.min(2, item.duration - start));
    activeTrimRangeId = null; trimDraftActive = true;
    $('#video-trim-start').value = start.toFixed(2); $('#video-trim-end').value = end.toFixed(2);
    releaseResult(); syncTrimTimeline();
    setStatus('New range started at the playhead. Drag its handles or enter exact times, then save it.');
    return;
  }
  const start = Number($('#video-trim-start').value); const end = Number($('#video-trim-end').value);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > item.duration || end - start < .15) { setStatus('Choose a range of at least 0.15 seconds inside the video.', true); return; }
  const overlaps = trimRanges.some((range) => range.id !== activeTrimRangeId && start < range.end - .02 && end > range.start + .02);
  if (overlaps) { setStatus('This range overlaps a saved part. Adjust it so each part is separate.', true); return; }
  if (activeTrimRangeId) {
    const current = trimRanges.find((range) => range.id === activeTrimRangeId);
    if (current) { current.start = start; current.end = end; }
  } else trimRanges.push({ id: `trim-${crypto.randomUUID()}`, itemId: item.id, start, end });
  trimRanges.sort((a, b) => a.start - b.start);
  activeTrimRangeId = null; trimDraftActive = false;
  renderTrimRanges(); renderVideoTimeline(); updateActions();
  setStatus(`Part saved. ${trimRanges.length} ${trimRanges.length === 1 ? 'part is' : 'parts are'} ready. Add another range or preview the result.`);
}

function buildTrimOutputSegments() {
  const item = selected[0];
  if (!item) return [];
  const ranges = [...trimRanges].sort((a, b) => a.start - b.start);
  if (!ranges.length) return [];
  if (trimIntent === 'keep') return ranges.map((range) => ({ id: range.id, itemId: item.id, start: range.start, end: range.end }));
  const kept = []; let cursor = 0;
  for (const range of ranges) { if (range.start - cursor >= .15) kept.push({ id: `trim-keep-${kept.length}`, itemId: item.id, start: cursor, end: range.start }); cursor = Math.max(cursor, range.end); }
  if (item.duration - cursor >= .15) kept.push({ id: `trim-keep-${kept.length}`, itemId: item.id, start: cursor, end: item.duration });
  return kept;
}

function previewTrimRanges() {
  const output = buildTrimOutputSegments();
  if (!output.length) { setStatus('There is no playable video left after these cuts. Adjust the selected ranges.', true); return; }
  queuedJoinTask = trimIntent === 'keep' ? 'join' : 'cut';
  runJoin(output, queuedJoinTask);
}

function updateTimelinePlayback() {
  const current = Number.isFinite(preview.currentTime) ? preview.currentTime : 0;
  const duration = selected[0]?.duration || 0;
  $('#video-timecode').textContent = `${formatDuration(current)} / ${formatDuration(duration)}`;
  $('#video-scrub-time').textContent = formatDuration(current);
  const playhead = $('#video-timeline')?.querySelector('.timeline-playhead');
  if (playhead && duration > 0) playhead.style.left = `${clamp(current / duration, 0, 1) * 100}%`;
}

function updateTimelineControls() {
  const dock = $('#video-editor-dock');
  if (!dock) return;
  const ready = selected.length > 0;
  dock.hidden = !ready;
  $('#video-trim-ranges').hidden = !ready || mode !== 'trim';
  $('#video-scrub').disabled = !ready;
  $('#video-playback-toggle').disabled = !ready;
  $('#video-split-at-playhead').disabled = !ready || mode === 'join';
  $('#video-reset-trim').disabled = !ready || mode !== 'trim';
  updateTimelinePlayback();
}

function splitAtPlayhead() {
  const item = selected[0]; const splitAt = preview.currentTime;
  if (!item || splitAt < .15 || item.duration - splitAt < .15) { setStatus('Move the playhead inside the video, leaving at least 0.15 seconds on both sides.', true); return; }
  releaseResult();
  segments = [
    { id: `segment-${++segmentCounter}`, itemId: item.id, start: 0, end: splitAt },
    { id: `segment-${++segmentCounter}`, itemId: item.id, start: splitAt, end: item.duration }
  ];
  queuedJoinTask = 'join';
  updateMode('join');
  renderSegments();
  setStatus(`Split at ${formatDuration(splitAt)}. Remove either section or join both, then export.`);
}

function renderSoundtracks() {
  const list = $('#soundtrack-list');
  const dropzone = $('#soundtrack-dropzone');
  if (!list || !dropzone) return;
  list.replaceChildren();
  dropzone.hidden = mode !== 'join';
  const totalDuration = outputDuration();
  if (!soundtracks.length) {
    const empty = document.createElement('li'); empty.className = 'soundtrack-empty';
    empty.textContent = 'No added soundtrack. Original clip audio will be kept unless you mute it.';
    list.append(empty);
  }
  soundtracks.forEach((track, index) => {
    const row = document.createElement('li'); row.className = 'soundtrack-track'; row.dataset.soundtrackId = track.id;
    const header = document.createElement('div'); header.className = 'soundtrack-track-header';
    const name = document.createElement('strong'); name.textContent = `${index + 1}. ${track.file.name}`; name.title = track.file.name;
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'video-text-button'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove soundtrack ${index + 1}`);
    remove.addEventListener('click', () => { soundtracks = soundtracks.filter((candidate) => candidate.id !== track.id); releaseResult(); renderSoundtracks(); });
    header.append(name, remove);
    const makeNumber = (labelText, property, min, max, step = '0.1') => {
      const label = document.createElement('label'); label.textContent = labelText;
      const input = document.createElement('input'); input.type = 'number'; input.min = String(min); input.max = String(max); input.step = step;
      input.value = track[property].toFixed(1); input.setAttribute('aria-label', `Soundtrack ${index + 1} ${labelText.toLowerCase()}`);
      input.addEventListener('input', () => {
        const parsed = Number(input.value);
        if (!Number.isFinite(parsed)) return;
        let bounded = Math.max(min, Math.min(max, parsed));
        if (property === 'sourceStart') bounded = Math.min(bounded, track.sourceEnd - 0.05);
        if (property === 'sourceEnd') bounded = Math.max(bounded, track.sourceStart + 0.05);
        track[property] = Math.max(min, Math.min(max, bounded));
        releaseResult(); renderVideoTimeline();
      });
      label.append(input); return label;
    };
    const startAt = makeNumber('Start on video (sec)', 'startAt', 0, Math.max(0, totalDuration));
    const sourceStart = makeNumber('Use audio from (sec)', 'sourceStart', 0, track.buffer.duration);
    const sourceEnd = makeNumber('Use audio to (sec)', 'sourceEnd', 0, track.buffer.duration);
    const volume = document.createElement('label'); volume.className = 'soundtrack-volume'; volume.textContent = 'Track volume';
    const volumeOutput = document.createElement('output'); volumeOutput.textContent = `${track.volume}%`;
    const slider = document.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = '200'; slider.step = '1'; slider.value = String(track.volume);
    slider.setAttribute('aria-label', `Soundtrack ${index + 1} volume`);
    slider.addEventListener('input', () => { track.volume = Number(slider.value); volumeOutput.textContent = `${track.volume}%`; releaseResult(); });
    volume.append(volumeOutput, slider);
    row.append(header, startAt, sourceStart, sourceEnd, volume); list.append(row);
  });
  $('#original-volume').disabled = !$('#keep-original-audio').checked;
  renderVideoTimeline();
}

async function addSoundtrackFiles(files) {
  const audioFiles = [...files].filter((file) => file.type.startsWith('audio/') || /\.(mp3|wav|aac|m4a|ogg|opus|flac|webm)$/iu.test(file.name));
  if (!audioFiles.length) { setStatus('Choose a supported audio file such as MP3, WAV, AAC, M4A or OGG.', true); return; }
  if (soundtracks.length + audioFiles.length > 3) { setStatus('Add up to 3 soundtrack tracks. Remove a track before adding another.', true); return; }
  const allBytes = selected.reduce((sum, item) => sum + item.file.size, 0) + soundtracks.reduce((sum, item) => sum + item.file.size, 0) + audioFiles.reduce((sum, file) => sum + file.size, 0);
  if (allBytes > currentLimitBytes()) { setStatus(`Videos and audio exceed this device’s ${formatBytes(currentLimitBytes())} combined selection limit.`, true); return; }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) { setStatus('This browser does not provide local audio decoding. Try a current version of Chrome, Edge or Firefox.', true); return; }
  const context = new AudioContextClass({ sampleRate: 48000 });
  try {
    setStatus('Reading soundtrack audio on this device…');
    const decodedTracks = [];
    for (const file of audioFiles) {
      const decoded = await context.decodeAudioData(await file.arrayBuffer());
      decodedTracks.push({ id: `soundtrack-${++soundtrackCounter}`, file, buffer: decoded, sourceStart: 0, sourceEnd: decoded.duration, startAt: 0, volume: 100 });
    }
    soundtracks.push(...decodedTracks);
    releaseResult(); renderSoundtracks(); updateActions();
    setStatus(`${soundtracks.length} soundtrack${soundtracks.length === 1 ? '' : 's'} ready. Set source trims and placement on the video timeline.`);
  } catch (error) {
    setStatus(error?.message ? `This browser could not decode that audio file: ${error.message}` : 'This browser could not decode the selected audio file.', true);
  } finally { await context.close().catch(() => {}); }
}

async function renderMixedAudio(duration) {
  const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OfflineContext) throw new Error('This browser cannot mix audio locally. Try a current desktop version of Chrome, Edge or Firefox.');
  const sampleRate = 48000;
  const context = new OfflineContext(2, Math.ceil(duration * sampleRate), sampleRate);
  activeOfflineContext = context;
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -2;
  compressor.knee.value = 4;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.18;
  compressor.connect(context.destination);

  const keepOriginal = $('#keep-original-audio').checked;
  const originalGain = context.createGain();
  originalGain.gain.value = keepOriginal ? Number($('#original-volume').value) / 100 : 0;
  originalGain.connect(compressor);
  if (keepOriginal && originalGain.gain.value > 0) {
    const { AudioBufferSink } = await mediaEngine();
    let timelineOffset = 0;
    for (const segment of segments) {
      if (cancelRequested) throw new Error('Processing was cancelled.');
      const item = inputs.get(segment.itemId);
      const segmentDuration = segment.end - segment.start;
      if (item?.audioTrack) {
        const sink = new AudioBufferSink(item.audioTrack);
        const origin = await item.input.getFirstTimestamp([item.audioTrack]);
        const mediaStart = origin + segment.start;
        const mediaEnd = origin + segment.end;
        for await (const wrapped of sink.buffers(mediaStart, mediaEnd)) {
          if (cancelRequested) break;
          const overlapStart = Math.max(mediaStart, wrapped.timestamp);
          const overlapEnd = Math.min(mediaEnd, wrapped.timestamp + wrapped.buffer.duration);
          if (overlapEnd - overlapStart > 0.005) {
            const source = context.createBufferSource();
            source.buffer = wrapped.buffer;
            source.connect(originalGain);
            source.start(timelineOffset + overlapStart - mediaStart, overlapStart - wrapped.timestamp, overlapEnd - overlapStart);
          }
        }
      }
      timelineOffset += segmentDuration;
    }
  }

  for (const track of soundtracks) {
    if (cancelRequested) throw new Error('Processing was cancelled.');
    const length = Math.min(track.sourceEnd - track.sourceStart, duration - track.startAt);
    if (length <= 0) continue;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = track.buffer;
    gain.gain.value = track.volume / 100;
    source.connect(gain).connect(compressor);
    source.start(track.startAt, track.sourceStart, length);
  }
  setStatus('Mixing original sound and soundtrack on this device…');
  return await context.startRendering();
}

function moveSegment(from, to) {
  if (to < 0 || to >= segments.length) return;
  const [segment] = segments.splice(from, 1);
  segments.splice(to, 0, segment);
  releaseResult();
  renderSegments();
}

async function chooseFiles(files) {
  const fileList = [...files].filter((file) => file.type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/iu.test(file.name));
  if (!fileList.length) { setStatus('Choose an MP4, MOV, M4V or WebM video.', true); return; }
  if (mode !== 'join' && fileList.length > 1) fileList.splice(1);
  if (mode === 'join') {
    const bytes = fileList.reduce((sum, file) => sum + file.size, selected.reduce((sum, item) => sum + item.file.size, 0)) + soundtracks.reduce((sum, track) => sum + track.file.size, 0);
    if (bytes > currentLimitBytes()) { setStatus(`The combined source videos exceed this device’s ${formatBytes(currentLimitBytes())} limit.`, true); return; }
  }
  if (mode !== 'join') {
    releaseInputs(); selected = []; segments = [];
    if (sourcePreviewUrl) URL.revokeObjectURL(sourcePreviewUrl);
    sourcePreviewUrl = null;
    preview.pause(); preview.removeAttribute('src'); preview.load(); preview.hidden = true;
    $('#video-empty').hidden = false;
    $('#video-file-summary').hidden = true;
  }
  setStatus('Reading video details on this device…');
  releaseResult();
  const loaded = [];
  try {
    for (const file of fileList) loaded.push(await inspectFile(file));
    selected = mode === 'join' ? [...selected, ...loaded] : loaded;
    if (mode === 'join') loaded.forEach((item) => addSegment(item));
    if (selected.length) showSourcePreview(selected[0]);
    updateActions();
  } catch (error) {
    loaded.forEach((item) => { item.input.dispose(); inputs.delete(item.id); });
    setStatus(error?.message || 'This browser could not open the video.', true);
  }
}

function updateProgress(progress, label = 'Processing video') {
  const value = Math.max(0, Math.min(100, Math.round(progress * 100)));
  $('#video-progress').value = value;
  $('#video-progress-value').textContent = `${value}%`;
  $('#video-progress-label').textContent = label;
}

function startProgress(label) {
  isProcessing = true;
  $('#video-progress-panel').hidden = false;
  updateProgress(0, label);
  $('#video-cancel').disabled = false;
  updateActions();
  releaseResult();
}

function finishProgress() {
  $('#video-progress-panel').hidden = true;
  $('#video-progress').value = 0;
  $('#video-cancel').disabled = false;
  activeConversion = null;
  activeOutput = null;
  activeOfflineContext = null;
  isProcessing = false;
  cancelRequested = false;
  updateActions();
}

async function outputProfile(width, height, hasAudio) {
  const { canEncodeAudio, canEncodeVideo, Mp4OutputFormat, Quality, WebMOutputFormat } = await mediaEngine();
  const quality = new Quality($('#video-quality').value);
  if (await canEncodeVideo('avc', { width, height, quality }) && (!hasAudio || await canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: 48000, quality: new Quality('medium') }))) {
    return { videoCodec: 'avc', audioCodec: hasAudio ? 'aac' : null, quality, audioQuality: new Quality('medium'), ext: 'mp4', mime: 'video/mp4', format: new Mp4OutputFormat() };
  }
  if (await canEncodeVideo('vp9', { width, height, quality }) && (!hasAudio || await canEncodeAudio('opus', { numberOfChannels: 2, sampleRate: 48000, quality: new Quality('medium') }))) {
    return { videoCodec: 'vp9', audioCodec: hasAudio ? 'opus' : null, quality, audioQuality: new Quality('medium'), ext: 'webm', mime: 'video/webm', format: new WebMOutputFormat() };
  }
  if (await canEncodeVideo('vp8', { width, height, quality }) && (!hasAudio || await canEncodeAudio('opus', { numberOfChannels: 2, sampleRate: 48000, quality: new Quality('medium') }))) {
    return { videoCodec: 'vp8', audioCodec: hasAudio ? 'opus' : null, quality, audioQuality: new Quality('medium'), ext: 'webm', mime: 'video/webm', format: new WebMOutputFormat() };
  }
  throw new Error('This browser has no supported video encoder for the requested output. Try a current version of Chrome, Edge, Firefox or Safari on a different device.');
}

function outputHeight(item) {
  const option = $('#video-resolution').value;
  const cap = option === 'original' ? Math.max(item.width, item.height) : Number(option);
  const scale = Math.min(1, cap / Math.max(item.width, item.height));
  return Math.max(2, Math.floor((item.height * scale) / 2) * 2);
}

function cropFor(item) {
  const requestedRatio = $('#video-crop-ratio').value;
  if (requestedRatio === 'original') return { left: 0, top: 0, width: item.width, height: item.height };
  const ratio = Number(requestedRatio);
  let width = item.width; let height = item.height;
  if (width / height > ratio) width = height * ratio;
  else height = width / ratio;
  const x = Number($('#video-crop-x').value) / 100;
  const y = Number($('#video-crop-y').value) / 100;
  return {
    left: Math.round((item.width - width) * x),
    top: Math.round((item.height - height) * y),
    width: Math.max(2, Math.round(width)),
    height: Math.max(2, Math.round(height))
  };
}

function updateCropPreview() {
  const item = selected[0];
  const ratioControl = $('#video-crop-ratio');
  const xControl = $('#video-crop-x'); const yControl = $('#video-crop-y');
  if (!ratioControl) return;
  const isOriginal = ratioControl.value === 'original';
  xControl.disabled = isOriginal || !item;
  yControl.disabled = isOriginal || !item;
  $('#video-crop-x-value').textContent = `${xControl.value}%`;
  $('#video-crop-y-value').textContent = `${yControl.value}%`;
  const frame = $('.video-frame');
  if (!item) { $('#video-crop-summary').textContent = 'Choose a video to preview its crop.'; return; }
  const crop = cropFor(item);
  const ratio = crop.width / crop.height;
  frame.style.aspectRatio = String(ratio);
  preview.style.objectFit = isOriginal ? 'contain' : 'cover';
  preview.style.objectPosition = `${xControl.value}% ${yControl.value}%`;
  const scale = Math.min(1, 1080 / Math.max(crop.width, crop.height));
  const outputWidth = Math.max(2, Math.floor(crop.width * scale / 2) * 2);
  const outputHeight = Math.max(2, Math.floor(crop.height * scale / 2) * 2);
  $('#video-crop-summary').textContent = `${crop.width} × ${crop.height} crop · export ${outputWidth} × ${outputHeight}`;
}

function removeSelectedRange() {
  const item = selected[0];
  if (!item) return;
  const start = Number($('#video-trim-start').value);
  const end = Number($('#video-trim-end').value);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > item.duration || end - start < 0.15) {
    setStatus('Enter a section of at least 0.15 seconds to remove, inside the video duration.', true); return;
  }
  const kept = [];
  if (start >= 0.15) kept.push({ id: `segment-${++segmentCounter}`, itemId: item.id, start: 0, end: start });
  if (item.duration - end >= 0.15) kept.push({ id: `segment-${++segmentCounter}`, itemId: item.id, start: end, end: item.duration });
  if (!kept.length) { setStatus('That range covers the whole video. Leave at least 0.15 seconds to keep.', true); return; }
  segments = kept;
  queuedJoinTask = 'cut';
  updateMode('join');
  renderSegments();
  setStatus(`Ready to remove ${formatDuration(start)}–${formatDuration(end)}. Check the kept sections, then export.`);
  $('#video-run-join').focus();
}

async function runConversion(task) {
  const item = selected[0];
  if (!item) return;
  if (task === 'trim' && trimRanges.length) { previewTrimRanges(); return; }
  if (item.audioUnsupported) { setStatus('This browser cannot decode the source audio track. Choose a video with a supported audio codec.', true); return; }
  const start = task === 'trim' ? Number($('#video-trim-start').value) : 0;
  const end = task === 'trim' ? Number($('#video-trim-end').value) : item.duration;
  if (task === 'trim' && (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > item.duration || end - start < 0.15)) { setStatus('Enter a start and end time inside the video. The clip must be at least 0.15 seconds.', true); return; }
  const crop = task === 'crop' ? cropFor(item) : null;
  const cropScale = crop ? Math.min(1, 1080 / Math.max(crop.width, crop.height)) : 1;
  const cropWidth = crop ? Math.max(2, Math.floor(crop.width * cropScale / 2) * 2) : undefined;
  const cropHeight = crop ? Math.max(2, Math.floor(crop.height * cropScale / 2) * 2) : undefined;
  const height = task === 'compress' ? outputHeight(item) : cropHeight;
  const width = task === 'crop' ? cropWidth : height ? Math.max(2, Math.round(height * item.width / item.height / 2) * 2) : item.width;
  startProgress(task === 'trim' ? 'Preparing precise cut' : task === 'crop' ? 'Preparing crop' : 'Checking browser encoders');
  try {
    const { BufferTarget, Conversion, Output } = await mediaEngine();
    const profile = await outputProfile(width, height || item.height, Boolean(item.audioTrack));
    if (item.audioTrack && !profile.audioCodec) throw new Error('This browser cannot encode audio for the selected output. The original audio has been preserved; choose another source or browser.');
    const output = new Output({ format: profile.format, target: new BufferTarget() });
    activeOutput = output;
    const options = {
      input: item.input,
      output,
      video: { codec: profile.videoCodec, quality: profile.quality, ...(task === 'crop' ? { width, height, fit: 'contain', crop } : height ? { height } : {}) },
      ...(profile.audioCodec ? { audio: { codec: profile.audioCodec, quality: profile.audioQuality } } : {}),
      ...(task === 'trim' ? { trim: { start, end } } : {})
    };
    const conversion = await Conversion.init(options);
    if (cancelRequested) throw new Error('Processing was cancelled.');
    if (!conversion.isValid) throw new Error(conversion.discardedTracks.length ? 'The browser cannot preserve one or more tracks in this file. No output was created.' : 'The browser could not prepare this video.');
    activeConversion = conversion;
    conversion.onProgress = (progress) => updateProgress(progress, task === 'trim' ? 'Re-encoding selected clip' : task === 'crop' ? 'Cropping video frames' : 'Compressing video');
    setStatus('Processing in your browser. Keep this tab open until the download is ready.');
    await conversion.execute();
    if (cancelRequested) throw new Error('Processing was cancelled.');
    const blob = new Blob([output.target.buffer], { type: await output.getMimeType() || profile.mime });
    showResult(blob, item.file.name, profile.ext, task, start, end, item.duration);
  } catch (error) {
    if (activeOutput && activeOutput.state !== 'finalized' && activeOutput.state !== 'canceled') await activeOutput.cancel().catch(() => {});
    setStatus(cancelRequested ? 'Processing was cancelled. Your original file is unchanged.' : error?.message || 'The browser could not process this video.', !cancelRequested);
  } finally {
    finishProgress();
  }
}

function showResult(blob, sourceName, extension, task, start, end, fullDuration) {
  releaseResult();
  resultUrl = URL.createObjectURL(blob);
  const baseName = sourceName.replace(/\.[^.]+$/u, '').replace(/[\\/:*?"<>|]+/gu, '-').slice(0, 90) || 'quickkit-video';
  const suffix = task === 'trim' ? '-trimmed' : task === 'crop' ? '-cropped' : task === 'compress' ? '-compressed' : task === 'cut' ? '-cut' : '-joined';
  $('#video-download').href = resultUrl;
  $('#video-download').download = `${baseName}${suffix}.${extension}`;
  $('#video-result').hidden = false;
  const duration = task === 'trim' ? end - start : task === 'join' || task === 'cut' ? (fullDuration || segments.reduce((sum, segment) => sum + segment.end - segment.start, 0)) : fullDuration;
  const ratio = selected[0]?.file.size ? Math.round((1 - blob.size / selected[0].file.size) * 100) : 0;
  const detail = `${formatBytes(blob.size)} · ${formatDuration(duration)}${task === 'compress' ? ratio > 0 ? ` · ${ratio}% smaller` : ` · ${Math.abs(ratio)}% larger` : task === 'crop' ? ` · ${cropDescription()}` : ''}`;
  $('#video-result-title').textContent = task === 'cut' ? 'Unwanted section removed' : task === 'crop' ? 'Cropped video is ready' : 'Your video is ready';
  $('#video-result-details').textContent = detail;
  $('#video-preview-title').textContent = 'Export preview';
  $('#video-preview-meta').textContent = detail;
  preview.src = resultUrl;
  preview.hidden = false;
  $('#video-empty').hidden = true;
  setStatus('Export complete. Preview the result, then download it.');
}

function cropDescription() {
  const option = $('#video-crop-ratio').selectedOptions[0];
  return option?.textContent || 'Crop applied';
}

async function runJoin(segmentsToJoin = segments, joinTaskOverride = null) {
  const joinSegments = segmentsToJoin;
  if (!joinSegments.length) return;
  for (const segment of joinSegments) {
    if (!Number.isFinite(segment.start) || !Number.isFinite(segment.end) || segment.start < 0 || segment.end > inputs.get(segment.itemId).duration || segment.end - segment.start < 0.15) {
      setStatus('Check each clip’s start and end. Every kept section must be at least 0.15 seconds long.', true); return;
    }
  }
  const totalDuration = joinSegments.reduce((sum, segment) => sum + segment.end - segment.start, 0);
  if (totalDuration > MAX_TOTAL_DURATION) { setStatus('The joined result is longer than 10 minutes. Remove clips or use shorter sections.', true); return; }
  const keepOriginalAudio = $('#keep-original-audio').checked;
  if (keepOriginalAudio && joinSegments.some((segment) => inputs.get(segment.itemId).audioUnsupported)) { setStatus('One selected clip has an audio codec this browser cannot decode. Turn off “Keep original video sound” or choose another source.', true); return; }
  const requiresAudioMix = soundtracks.length > 0 || !keepOriginalAudio || Number($('#original-volume').value) !== 100;
  const maxMixDuration = matchMedia('(max-width: 560px)').matches ? MAX_MIX_DURATION_MOBILE : MAX_MIX_DURATION_DESKTOP;
  if (requiresAudioMix && totalDuration > maxMixDuration) {
    setStatus(`Soundtrack mixing is limited to ${formatDuration(maxMixDuration)} on this device to avoid exhausting browser memory. Shorten the edit or mix shorter sections.`, true); return;
  }
  const first = inputs.get(joinSegments[0].itemId);
  const joinTask = joinTaskOverride || queuedJoinTask;
  const maxHeight = Math.min(1080, Math.max(...joinSegments.map((segment) => inputs.get(segment.itemId).height)));
  const targetHeight = Math.max(2, Math.floor(maxHeight / 2) * 2);
  const targetWidth = Math.max(2, Math.floor((targetHeight * first.width / first.height) / 2) * 2);
  startProgress('Preparing joined clips');
  setStatus('Preparing selected video sections in your browser…');
  let output;
  try {
    setStatus('Checking this browser’s video and audio encoders…');
    const { AudioSampleSink, AudioSampleSource, AudioBufferSource, BufferTarget, Output, VideoSampleSink, VideoSampleSource } = await mediaEngine();
    const hasOriginalAudio = keepOriginalAudio && joinSegments.some((segment) => Boolean(inputs.get(segment.itemId).audioTrack));
    const hasAudio = hasOriginalAudio || soundtracks.length > 0;
    const profile = await outputProfile(targetWidth, targetHeight, hasAudio);
    setStatus('Starting the local video export…');
    const targetWidthEven = targetWidth;
    const outputTarget = new BufferTarget();
    output = new Output({ format: profile.format, target: outputTarget });
    activeOutput = output;
    const videoSource = new VideoSampleSource({ codec: profile.videoCodec, quality: profile.quality, transform: { width: targetWidthEven, height: targetHeight, fit: 'contain' } });
    const audioSource = hasAudio ? (requiresAudioMix
      ? new AudioBufferSource({ codec: profile.audioCodec, quality: profile.audioQuality, transform: { numberOfChannels: 2, sampleRate: 48000 } })
      : new AudioSampleSource({ codec: profile.audioCodec, quality: profile.audioQuality, transform: { numberOfChannels: 2, sampleRate: 48000 } })) : null;
    output.addVideoTrack(videoSource);
    if (audioSource) output.addAudioTrack(audioSource);
    await output.start();
    setStatus('Joining the selected video sections…');
    let timelineOffset = 0;
    let videoFrames = 0;
    for (let segmentIndex = 0; segmentIndex < joinSegments.length; segmentIndex++) {
      if (cancelRequested) throw new Error('Processing was cancelled.');
      setStatus(`Processing section ${segmentIndex + 1} of ${joinSegments.length}…`);
      const segment = joinSegments[segmentIndex];
      const item = inputs.get(segment.itemId);
      const videoSink = new VideoSampleSink(item.videoTrack);
      const videoOrigin = await item.input.getFirstTimestamp([item.videoTrack]);
      const audioSink = item.audioTrack && keepOriginalAudio && !requiresAudioMix ? new AudioSampleSink(item.audioTrack) : null;
      const audioOrigin = audioSink ? await item.input.getFirstTimestamp([item.audioTrack]) : 0;
      const segmentDuration = segment.end - segment.start;
      let videoProgress = 0;
      let audioProgress = 0;
      const refresh = (localProgress) => {
        const prior = joinSegments.slice(0, segmentIndex).reduce((sum, part) => sum + part.end - part.start, 0);
        updateProgress(Math.min(.99, (prior + Math.max(videoProgress, audioProgress, localProgress)) / totalDuration), `Joining clip ${segmentIndex + 1} of ${joinSegments.length}`);
      };
      const processVideo = async () => {
        for await (const sample of videoSink.samples(videoOrigin + segment.start, videoOrigin + segment.end)) {
          if (cancelRequested) { sample.close(); break; }
          const relativeTimestamp = sample.timestamp - (videoOrigin + segment.start);
          const shifted = sample.clone();
          shifted.setTimestamp(timelineOffset + relativeTimestamp);
          let transformed;
          try {
            transformed = await shifted.transform({ width: targetWidthEven, height: targetHeight, fit: 'contain' });
            await videoSource.add(transformed);
            videoFrames++;
          } finally {
            transformed?.close(); shifted.close(); sample.close();
          }
          videoProgress = Math.min(segmentDuration, Math.max(videoProgress, relativeTimestamp));
          refresh(videoProgress);
        }
      };
      const processAudio = async () => {
        if (!audioSink || !audioSource) { audioProgress = segmentDuration; return; }
        for await (const sample of audioSink.samples(audioOrigin + segment.start, audioOrigin + segment.end)) {
          if (cancelRequested) { sample.close(); break; }
          const relativeTimestamp = sample.timestamp - (audioOrigin + segment.start);
          const shifted = sample.clone();
          shifted.setTimestamp(timelineOffset + relativeTimestamp);
          try { await audioSource.add(shifted); } finally { shifted.close(); sample.close(); }
          audioProgress = Math.min(segmentDuration, Math.max(audioProgress, relativeTimestamp));
          refresh(audioProgress);
        }
      };
      await Promise.all([processVideo(), processAudio()]);
      if (cancelRequested) throw new Error('Processing was cancelled.');
      timelineOffset += segmentDuration;
    }
    if (!videoFrames) throw new Error('No video frames were found in the chosen sections. Check the start and end times.');
    videoSource.close();
    if (audioSource && requiresAudioMix) {
      const mixedAudio = await renderMixedAudio(totalDuration);
      if (cancelRequested) throw new Error('Processing was cancelled.');
      await audioSource.add(mixedAudio);
      audioSource.close();
    } else if (audioSource) audioSource.close();
    setStatus('Finishing the output file…');
    await output.finalize();
    updateProgress(1, 'Video export ready');
    const blob = new Blob([output.target.buffer], { type: await output.getMimeType() || profile.mime });
    showResult(blob, first.file.name, profile.ext, joinTask, 0, totalDuration, totalDuration);
    queuedJoinTask = 'join';
  } catch (error) {
    if (output && output.state !== 'finalized' && output.state !== 'canceled') await output.cancel().catch(() => {});
    setStatus(cancelRequested ? 'Processing was cancelled. Your original files are unchanged.' : error?.message || 'The browser could not join these clips.', !cancelRequested);
  } finally {
    finishProgress();
  }
}

function clearFiles() {
  if (busy()) return;
  releaseInputs(); releaseResult();
  if (sourcePreviewUrl) URL.revokeObjectURL(sourcePreviewUrl);
  sourcePreviewUrl = null;
  preview.pause(); preview.removeAttribute('src'); preview.load(); preview.hidden = true;
  $('#video-empty').hidden = false; $('#video-file-summary').hidden = true; $('#video-progress-panel').hidden = true;
  $('#video-preview-meta').textContent = 'Your video appears here';
  fileInput.value = ''; $('#soundtrack-files').value = ''; selected = []; segments = []; soundtracks = []; trimRanges = []; activeTrimRangeId = null; trimDraftActive = true; renderSegments(); renderSoundtracks(); renderTrimRanges();
  setStatus('Choose a video to begin. Files stay on your device.');
}

document.querySelectorAll('.video-tabs [role=tab]').forEach((tab) => tab.addEventListener('click', () => updateMode(tab.dataset.mode)));
fileInput.addEventListener('change', (event) => {
  const files = [...event.currentTarget.files];
  event.currentTarget.value = '';
  chooseFiles(files);
});
$('#video-clear').addEventListener('click', clearFiles);
$('#video-run-compress').addEventListener('click', () => runConversion('compress'));
$('#video-run-trim').addEventListener('click', () => runConversion('trim'));
$('#video-run-remove-range').addEventListener('click', removeSelectedRange);
$('#video-run-crop').addEventListener('click', () => runConversion('crop'));
$('#video-run-join').addEventListener('click', () => runJoin());
$('#video-playback-toggle').addEventListener('click', async () => {
  if (!preview.src) return;
  if (preview.paused) await preview.play().catch(() => setStatus('Playback was blocked by this browser. Use the preview controls to start the video.', true));
  else preview.pause();
});
$('#video-split-at-playhead').addEventListener('click', splitAtPlayhead);
$('#soundtrack-files').addEventListener('change', (event) => {
  const files = [...event.currentTarget.files]; event.currentTarget.value = ''; addSoundtrackFiles(files);
});
$('#keep-original-audio').addEventListener('change', () => { releaseResult(); renderSoundtracks(); });
$('#original-volume').addEventListener('input', () => {
  $('#original-volume-value').textContent = `${$('#original-volume').value}%`;
  releaseResult();
});
$('#video-add-segment').addEventListener('click', () => {
  const last = segments.at(-1); const item = last && inputs.get(last.itemId);
  if (item) addSegment(item);
});
$('#video-cancel').addEventListener('click', async () => {
  if (!busy()) return;
  cancelRequested = true;
  $('#video-cancel').disabled = true;
  setStatus('Stopping video processing…');
  if (activeConversion) await activeConversion.cancel().catch(() => {});
  else if (activeOutput && activeOutput.state !== 'canceled' && activeOutput.state !== 'finalized') await activeOutput.cancel().catch(() => {});
});
$('#video-scrub').addEventListener('input', (event) => {
  const value = Number(event.currentTarget.value);
  preview.currentTime = value;
  updateTimelinePlayback();
});
preview.addEventListener('timeupdate', () => {
  if ($('#video-scrub').disabled) return;
  const value = preview.currentTime;
  $('#video-scrub').value = String(value);
  updateTimelinePlayback();
});
preview.addEventListener('play', () => { $('#video-playback-toggle').textContent = 'Pause'; });
preview.addEventListener('pause', () => { $('#video-playback-toggle').textContent = 'Play'; });
$('#video-trim-start').addEventListener('input', () => { releaseResult(); syncTrimTimeline(false); });
$('#video-trim-end').addEventListener('input', () => { releaseResult(); syncTrimTimeline(false); });
$('#video-add-trim-range').addEventListener('click', addOrSaveTrimRange);
$('#video-clear-trim-ranges').addEventListener('click', () => { trimRanges = []; activeTrimRangeId = null; trimDraftActive = true; releaseResult(); renderTrimRanges(); renderVideoTimeline(); setStatus('Saved ranges cleared. Adjust the yellow range or add a new one.'); });
$('#video-preview-trim-ranges').addEventListener('click', previewTrimRanges);
for (const [id, intent] of [['video-trim-keep', 'keep'], ['video-trim-remove', 'remove']]) {
  $(`#${id}`).addEventListener('click', () => {
    trimIntent = intent;
    $('#video-trim-keep').setAttribute('aria-pressed', String(intent === 'keep'));
    $('#video-trim-remove').setAttribute('aria-pressed', String(intent === 'remove'));
    $('#video-trim-intent-help').textContent = intent === 'keep'
      ? 'Saved ranges are joined in order. Switch to “Remove selected parts” to cut those ranges from the original video.'
      : 'Saved ranges will be cut out. The remaining parts before, between and after them are joined in order.';
    renderTrimRanges();
    setStatus(intent === 'keep' ? 'Saved ranges are the parts that will remain in the export.' : 'Saved ranges are the parts that will be cut out of the export.');
  });
}
$('#video-reset-trim').addEventListener('click', resetTrimRange);
$('#video-resolution').addEventListener('change', () => releaseResult());
$('#video-quality').addEventListener('change', () => releaseResult());
$('#video-crop-ratio').addEventListener('change', () => { releaseResult(); updateCropPreview(); });
$('#video-crop-x').addEventListener('input', () => { releaseResult(); updateCropPreview(); });
$('#video-crop-y').addEventListener('input', () => { releaseResult(); updateCropPreview(); });
$('#video-dropzone').addEventListener('dragover', (event) => { event.preventDefault(); event.currentTarget.classList.add('is-dragging'); });
$('#video-dropzone').addEventListener('dragleave', (event) => event.currentTarget.classList.remove('is-dragging'));
$('#video-dropzone').addEventListener('drop', (event) => {
  event.preventDefault(); event.currentTarget.classList.remove('is-dragging'); chooseFiles(event.dataTransfer.files);
});
const soundtrackDropzone = $('#soundtrack-dropzone');
soundtrackDropzone.addEventListener('dragover', (event) => { event.preventDefault(); soundtrackDropzone.classList.add('is-dragging'); });
soundtrackDropzone.addEventListener('dragleave', () => soundtrackDropzone.classList.remove('is-dragging'));
soundtrackDropzone.addEventListener('drop', (event) => { event.preventDefault(); soundtrackDropzone.classList.remove('is-dragging'); addSoundtrackFiles(event.dataTransfer.files); });
preview.addEventListener('error', () => setStatus('This browser can read the file details but cannot play its preview. Try exporting the video from your device as MP4 or WebM.', true));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && busy()) $('#video-cancel').click();
});
updateMode('compress');
