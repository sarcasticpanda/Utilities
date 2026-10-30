import { Encodings, Font, FontNames } from '@pdf-lib/standard-fonts';

const textDecoder = new TextDecoder('windows-1252');
const textEncoder = new TextEncoder();
const maxEditablePdfBytes = 25 * 1024 * 1024;
const standardFonts = new Set(Object.values(FontNames));

export class PdfTextEditError extends Error {
  constructor(message, reason = 'unsupported') {
    super(message);
    this.name = 'PdfTextEditError';
    this.reason = reason;
  }
}

function refId(value) {
  if (typeof value !== 'string' || !/^\d+\s+\d+\s+R$/u.test(value)) return null;
  return value.replace(/\s+/gu, ' ');
}

function getObject(objects, ref) {
  const normalized = refId(ref);
  return normalized ? objects[`obj:${normalized}`]?.value || objects[`obj:${normalized}`] || null : null;
}

function resolve(value, objects) {
  const normalized = refId(value);
  return normalized ? getObject(objects, normalized) : value;
}

function stringBytesToAscii(bytes) {
  if (bytes.some((value) => value < 0x20 || value > 0x7e)) return null;
  return String.fromCharCode(...bytes);
}

function decodeLiteral(bytes, index) {
  const start = index;
  const result = [];
  let depth = 1;
  index++;
  while (index < bytes.length && depth > 0) {
    const value = bytes[index++];
    if (value === 0x5c) {
      if (index >= bytes.length) throw new PdfTextEditError('A PDF text string ends with an incomplete escape.', 'malformed');
      const escaped = bytes[index++];
      const simple = new Map([[0x6e, 0x0a], [0x72, 0x0d], [0x74, 0x09], [0x62, 0x08], [0x66, 0x0c]]);
      if (simple.has(escaped)) result.push(simple.get(escaped));
      else if (escaped === 0x0a) { /* PDF line continuation */ }
      else if (escaped === 0x0d) { if (bytes[index] === 0x0a) index++; }
      else if (escaped >= 0x30 && escaped <= 0x37) {
        let octal = escaped - 0x30;
        for (let count = 0; count < 2 && bytes[index] >= 0x30 && bytes[index] <= 0x37; count++) octal = (octal * 8) + (bytes[index++] - 0x30);
        result.push(octal & 0xff);
      } else result.push(escaped);
    } else if (value === 0x28) { depth++; result.push(value); }
    else if (value === 0x29) { depth--; if (depth) result.push(value); }
    else result.push(value);
  }
  if (depth) throw new PdfTextEditError('A PDF text string is not closed.', 'malformed');
  return { token: { type: 'string', bytes: Uint8Array.from(result), start, end: index }, next: index };
}

function decodeHex(bytes, index) {
  const start = index++;
  let digits = '';
  while (index < bytes.length && bytes[index] !== 0x3e) {
    const value = bytes[index++];
    if ([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20].includes(value)) continue;
    if (!((value >= 0x30 && value <= 0x39) || (value >= 0x41 && value <= 0x46) || (value >= 0x61 && value <= 0x66))) {
      throw new PdfTextEditError('A PDF hexadecimal text string contains an invalid digit.', 'malformed');
    }
    digits += String.fromCharCode(value);
  }
  if (index >= bytes.length) throw new PdfTextEditError('A PDF hexadecimal text string is not closed.', 'malformed');
  index++;
  if (digits.length % 2) digits += '0';
  const result = new Uint8Array(digits.length / 2);
  for (let offset = 0; offset < digits.length; offset += 2) result[offset / 2] = Number.parseInt(digits.slice(offset, offset + 2), 16);
  return { token: { type: 'string', bytes: result, start, end: index }, next: index };
}

function skipComposite(bytes, index, open, close) {
  const start = index;
  const stack = [open === 0x5b ? 'array' : 'dictionary'];
  index += open === 0x5b ? 1 : 2;
  while (index < bytes.length) {
    if (bytes[index] === 0x25) {
      while (index < bytes.length && bytes[index] !== 0x0a && bytes[index] !== 0x0d) index++;
      continue;
    }
    if (bytes[index] === 0x28) { index = decodeLiteral(bytes, index).next; continue; }
    if (bytes[index] === 0x3c && bytes[index + 1] !== 0x3c) { index = decodeHex(bytes, index).next; continue; }
    if (bytes[index] === 0x5b) { stack.push('array'); index++; continue; }
    if (bytes[index] === 0x3c && bytes[index + 1] === 0x3c) { stack.push('dictionary'); index += 2; continue; }
    if (bytes[index] === 0x5d) {
      if (stack.pop() !== 'array') throw new PdfTextEditError('A PDF array or dictionary is malformed.', 'malformed');
      index++;
      if (!stack.length) return { token: { type: 'composite', start, end: index }, next: index };
      continue;
    }
    if (bytes[index] === 0x3e && bytes[index + 1] === 0x3e) {
      if (stack.pop() !== 'dictionary') throw new PdfTextEditError('A PDF array or dictionary is malformed.', 'malformed');
      index += 2;
      if (!stack.length) return { token: { type: 'composite', start, end: index }, next: index };
      continue;
    }
    index++;
  }
  throw new PdfTextEditError('A PDF content array or dictionary is not closed.', 'malformed');
}

function* tokenizeContent(bytes) {
  let index = 0;
  while (index < bytes.length) {
    const value = bytes[index];
    if ([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20].includes(value)) { index++; continue; }
    if (value === 0x25) { while (index < bytes.length && bytes[index] !== 0x0a && bytes[index] !== 0x0d) index++; continue; }
    if (value === 0x28) { const parsed = decodeLiteral(bytes, index); yield parsed.token; index = parsed.next; continue; }
    if (value === 0x3c && bytes[index + 1] !== 0x3c) { const parsed = decodeHex(bytes, index); yield parsed.token; index = parsed.next; continue; }
    if (value === 0x5b) { const parsed = skipComposite(bytes, index, 0x5b, 0x5d); yield { ...parsed.token, type: 'array' }; index = parsed.next; continue; }
    if (value === 0x3c && bytes[index + 1] === 0x3c) { const parsed = skipComposite(bytes, index, 0x3c, 0x3e); yield { ...parsed.token, type: 'dictionary' }; index = parsed.next; continue; }
    if (value === 0x2f) {
      const start = index++;
      while (index < bytes.length && ![0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20, 0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25].includes(bytes[index])) index++;
      yield { type: 'name', value: String.fromCharCode(...bytes.subarray(start, index)), start, end: index };
      continue;
    }
    const start = index;
    while (index < bytes.length && ![0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20, 0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25].includes(bytes[index])) index++;
    if (index === start) { index++; continue; }
    const raw = String.fromCharCode(...bytes.subarray(start, index));
    if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/u.test(raw)) yield { type: 'number', value: Number(raw), start, end: index };
    else yield { type: 'word', value: raw, start, end: index };
  }
}

function parseTextObjects(streamBytes) {
  const tokens = [...tokenizeContent(streamBytes)];
  const stack = [];
  const blocks = [];
  let block = null;
  let currentFont = null;
  let currentFontSize = null;
  let textRenderingMode = 0;
  let horizontalScale = 100;
  let characterSpacing = 0;
  let wordSpacing = 0;
  for (const token of tokens) {
    if (token.type !== 'word' || ['true', 'false', 'null'].includes(token.value)) { stack.push(token); continue; }
    const operator = token.value;
    if (operator === 'BI') throw new PdfTextEditError('This page uses an inline image in its content stream, which the safe text editor does not support yet.', 'inline-image');
    if (operator === 'BT') {
      if (block) throw new PdfTextEditError('This page has a nested text object and cannot be checked safely.', 'malformed');
      block = { fontName: currentFont, fontSize: currentFontSize, shows: [], unsupported: null, textRenderingMode, horizontalScale, characterSpacing, wordSpacing };
    } else if (operator === 'ET') {
      if (block) blocks.push(block);
      block = null;
    } else if (operator === 'Tf') {
      const fontOperand = stack.at(-2);
      if (fontOperand?.type === 'name') currentFont = fontOperand.value;
      const sizeOperand = stack.at(-1);
      if (sizeOperand?.type === 'number') currentFontSize = sizeOperand.value;
      if (block) { block.fontName = currentFont; block.fontSize = currentFontSize; }
    } else if (operator === 'Tr') {
      const mode = stack.at(-1);
      if (mode?.type === 'number') textRenderingMode = mode.value;
      if (block) block.textRenderingMode = textRenderingMode;
    } else if (operator === 'Tz') {
      const scale = stack.at(-1);
      if (scale?.type === 'number') horizontalScale = scale.value;
      if (block) block.horizontalScale = horizontalScale;
    } else if (operator === 'Tc') {
      const spacing = stack.at(-1);
      if (spacing?.type === 'number') characterSpacing = spacing.value;
      if (block) block.characterSpacing = characterSpacing;
    } else if (operator === 'Tw') {
      const spacing = stack.at(-1);
      if (spacing?.type === 'number') wordSpacing = spacing.value;
      if (block) block.wordSpacing = wordSpacing;
    } else if (operator === 'Tj') {
      const operand = stack.at(-1);
      if (block) block.shows.push(operand?.type === 'string' ? { ...operand, operatorEnd: token.end } : { invalid: true });
    } else if (operator === 'TJ' || operator === "'" || operator === '"') {
      if (block) { block.shows.push({ invalid: true }); block.unsupported = 'Text is split across several drawing operations; this first version edits one text run at a time.'; }
    }
    stack.length = 0;
  }
  if (block) throw new PdfTextEditError('A PDF text object is missing its closing operator.', 'malformed');
  return blocks;
}

function normalizeFont(fontValue, objects) {
  const font = resolve(fontValue, objects);
  if (!font || typeof font !== 'object') return { supported: false, reason: 'The page font resources could not be read.' };
  const baseFont = String(font['/BaseFont'] || '').replace(/^\//u, '');
  if (font['/Subtype'] !== '/Type1' || font['/FontDescriptor'] || !standardFonts.has(baseFont)) {
    return { supported: false, reason: 'This line uses an embedded or non-standard font. The editor will not substitute a different font.' };
  }
  if (font['/Encoding'] !== '/WinAnsiEncoding') {
    return { supported: false, reason: 'This line does not use a supported WinAnsi font encoding.' };
  }
  return { supported: true, baseFont };
}

function measureStandardText(text, baseFont) {
  let font;
  try { font = Font.load(baseFont); } catch { return null; }
  const glyphs = [];
  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (!Encodings.WinAnsi.canEncodeUnicodeCodePoint(codePoint)) return null;
    glyphs.push(Encodings.WinAnsi.encodeUnicodeCodePoint(codePoint).name);
  }
  let total = 0;
  glyphs.forEach((name, index) => {
    total += font.getWidthOfGlyph(name) || 250;
    const next = glyphs[index + 1];
    if (next) total += font.getXAxisKerningForPair(name, next) || 0;
  });
  return total;
}

function getPageResources(pageObject, objects) {
  let page = pageObject;
  for (let depth = 0; depth < 16 && page; depth++) {
    const resources = resolve(page['/Resources'], objects);
    if (resources) return resources;
    page = resolve(page['/Parent'], objects);
  }
  return null;
}

function hasDigitalSignature(objects) {
  return Object.values(objects).some((record) => {
    const value = record?.value;
    return value && typeof value === 'object' && (
      '/ByteRange' in value || value['/Type'] === '/Sig' || value['/FT'] === '/Sig'
    );
  });
}

function parseStreamRef(ref) {
  const normalized = refId(ref);
  if (!normalized) return null;
  const [objectNumber, generation] = normalized.split(' ').map(Number);
  return { normalized, objectNumber, generation };
}

async function runQpdf(qpdf, inputs, job) {
  const NativeTextDecoder = globalThis.TextDecoder;
  class StableTextDecoder extends NativeTextDecoder {
    decode(input, options) {
      const stableInput = input?.buffer?.resizable ? Uint8Array.from(input) : input;
      return super.decode(stableInput, options);
    }
  }
  globalThis.TextDecoder = StableTextDecoder;
  try { return await qpdf.runner.run(inputs, job); }
  finally { globalThis.TextDecoder = NativeTextDecoder; }
}

async function qpdfJson(qpdf, bytes) {
  const runner = qpdf?.runner;
  if (!runner?.run) throw new PdfTextEditError('The PDF engine did not initialize correctly. Reload and try again.', 'engine');
  const result = await runQpdf(qpdf, [bytes], ({ dir, inputPaths, exec, fs }) => {
    const outputPath = `${dir}/objects.json`;
    const command = exec(['--json', inputPaths[0], outputPath]);
    return { command, output: fs.readFile(outputPath).slice() };
  });
  if (result.command.exitCode !== 0) throw new PdfTextEditError('The PDF has structural warnings or could not be read safely. Its contents were not changed.', 'invalid-pdf');
  try { return JSON.parse(new TextDecoder().decode(result.output)); }
  catch { throw new PdfTextEditError('The PDF engine returned an invalid object map. No edit was made.', 'invalid-pdf'); }
}

async function qpdfStream(qpdf, bytes, objectNumber) {
  const result = await runQpdf(qpdf, [bytes], ({ exec, inputPaths }) => exec([`--show-object=${objectNumber}`, '--filtered-stream-data', inputPaths[0]]));
  if (result.exitCode !== 0) throw new PdfTextEditError('A page content stream could not be decoded safely. No edit was made.', 'invalid-stream');
  return result.stdout;
}

async function analyzePage(bytes, pageIndex, qpdf, json) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('PDF bytes must be a Uint8Array.');
  if (bytes.byteLength > maxEditablePdfBytes) throw new PdfTextEditError('Direct text editing is limited to PDF files up to 25 MB on this device. Other editor tools can still be used.', 'file-limit');
  const pages = json.pages;
  if (!Array.isArray(pages) || !Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= pages.length) {
    throw new PdfTextEditError('The selected page could not be inspected.', 'page');
  }
  const objects = json.qpdf?.[1];
  if (!objects) throw new PdfTextEditError('The PDF object table could not be read safely.', 'invalid-pdf');
  if (hasDigitalSignature(objects)) throw new PdfTextEditError('This PDF contains a digital signature. Editing it would invalidate that signature, so no direct text changes are allowed.', 'signed-pdf');
  const pageRef = pages[pageIndex].object;
  const pageObject = getObject(objects, pageRef);
  const resources = pageObject && getPageResources(pageObject, objects);
  const fonts = resolve(resources?.['/Font'], objects);
  const contentRefs = pages[pageIndex].contents || [];
  const candidates = [];
  const unavailable = [];
  const streamCache = new Map();
  const streamUseCounts = new Map();
  contentRefs.forEach((ref) => { const normalized = refId(ref); if (normalized) streamUseCounts.set(normalized, (streamUseCounts.get(normalized) || 0) + 1); });

  for (const contentRef of contentRefs) {
    const stream = parseStreamRef(contentRef);
    if (!stream) { unavailable.push({ reason: 'The page content is stored in an unsupported structure.' }); continue; }
    if (streamUseCounts.get(stream.normalized) > 1) { unavailable.push({ reason: 'This content stream is used more than once on the page, so editing it could duplicate the change.' }); continue; }
    if (!streamCache.has(stream.normalized)) streamCache.set(stream.normalized, await qpdfStream(qpdf, bytes, stream.objectNumber));
    const content = streamCache.get(stream.normalized);
    const blocks = parseTextObjects(content);
    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
      const block = blocks[blockIndex];
      if (!block.shows.length) continue;
      const show = block.shows[0];
      if (block.shows.length !== 1 || show.invalid || block.unsupported) {
        unavailable.push({ text: show?.bytes ? textDecoder.decode(show.bytes) : '', reason: block.unsupported || 'This text object contains more than one text-drawing operation.' });
        continue;
      }
      const text = stringBytesToAscii(show.bytes);
      if (text === null || !text.trim()) {
        unavailable.push({ reason: 'This line uses characters outside the safe printable-ASCII subset.' });
        continue;
      }
      if (block.textRenderingMode !== 0 || block.horizontalScale !== 100 || block.characterSpacing !== 0 || block.wordSpacing !== 0) {
        unavailable.push({ text, reason: 'This line uses a text-rendering effect or custom spacing that is not supported yet.' });
        continue;
      }
      const fontResource = block.fontName && fonts?.[block.fontName];
      if (!fontResource) { unavailable.push({ text, reason: 'The page font could not be resolved.' }); continue; }
      const font = normalizeFont(fontResource, objects);
      if (!font.supported) { unavailable.push({ text, reason: font.reason }); continue; }
      if (!Number.isFinite(block.fontSize) || block.fontSize <= 0) { unavailable.push({ text, reason: 'The original font size could not be confirmed.' }); continue; }
      if (json.pages.some((page, index) => index !== pageIndex && page.contents?.includes(stream.normalized))) {
        unavailable.push({ text, reason: 'This content stream is shared by multiple pages, so changing it could alter another page.' });
        continue;
      }
      const widthUnits = measureStandardText(text, font.baseFont);
      if (widthUnits === null) { unavailable.push({ text, reason: 'The selected font cannot encode every character in this line.' }); continue; }
      candidates.push({
        id: `p${pageIndex}-${stream.normalized.replaceAll(' ', '-')}-${show.start}`,
        pageIndex,
        streamRef: stream.normalized,
        streamObjectNumber: stream.objectNumber,
        operatorStart: show.start,
        operatorEnd: show.operatorEnd,
        originalText: text,
        fontName: font.baseFont,
        fontResourceName: block.fontName,
        widthUnits,
        fontSize: block.fontSize
      });
    }
  }
  return { pageIndex, pageRef, candidates, unavailable, pageCount: pages.length };
}

export async function scanEditablePdfPage(bytes, pageIndex, qpdf) {
  const json = await qpdfJson(qpdf, bytes);
  return analyzePage(bytes, pageIndex, qpdf, json);
}

function encodeLiteralAscii(text) {
  if (typeof text !== 'string' || /[^\x20-\x7e]/u.test(text)) throw new PdfTextEditError('Use one line of printable English characters for this font. Line breaks and non-ASCII characters are not supported in this first version.', 'encoding');
  return `(${text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')}) Tj`;
}

function replaceByteRange(source, start, end, replacement) {
  const result = new Uint8Array(source.length - (end - start) + replacement.length);
  result.set(source.subarray(0, start), 0);
  result.set(replacement, start);
  result.set(source.subarray(end), start + replacement.length);
  return result;
}

function base64(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

function parseEditText(edit) {
  if (!edit || typeof edit.text !== 'string') throw new PdfTextEditError('One of the requested edits is invalid.', 'edit');
  return edit.text;
}

export async function applyEditablePdfText(bytes, edits, qpdf) {
  if (!Array.isArray(edits) || edits.length === 0) return bytes.slice();
  const json = await qpdfJson(qpdf, bytes);
  const objects = json.qpdf?.[1];
  const maxObjectId = json.qpdf?.[0]?.maxobjectid;
  if (!objects || !Number.isInteger(maxObjectId)) throw new PdfTextEditError('The PDF update map is incomplete. No edit was made.', 'invalid-pdf');
  const analysisByPage = new Map();
  for (const edit of edits) {
    if (!analysisByPage.has(edit.pageIndex)) analysisByPage.set(edit.pageIndex, await analyzePage(bytes, edit.pageIndex, qpdf, json));
  }
  const streamEdits = new Map();
  const changedTexts = [];
  for (const edit of edits) {
    const text = parseEditText(edit);
    const candidate = analysisByPage.get(edit.pageIndex).candidates.find((item) => item.id === edit.id);
    if (!candidate || candidate.originalText !== edit.originalText) throw new PdfTextEditError('The selected line no longer matches the PDF. Re-scan it before exporting.', 'stale');
    const nextWidth = measureStandardText(text, candidate.fontName);
    if (nextWidth === null) throw new PdfTextEditError('The selected font cannot encode every character in the replacement.', 'encoding');
    if (nextWidth > candidate.widthUnits + 0.5) throw new PdfTextEditError('That replacement is wider than the original line. Shorten it to keep it from colliding with nearby content.', 'width');
    if (!streamEdits.has(candidate.streamRef)) {
      const parsed = parseStreamRef(candidate.streamRef);
      const stream = await qpdfStream(qpdf, bytes, parsed.objectNumber);
      streamEdits.set(candidate.streamRef, { objectNumber: parsed.objectNumber, stream, ranges: [] });
    }
    const entry = streamEdits.get(candidate.streamRef);
    entry.ranges.push({ start: candidate.operatorStart, end: candidate.operatorEnd, text });
    changedTexts.push({ ...edit, text });
  }
  const updateObjects = {};
  for (const [streamRef, entry] of streamEdits) {
    let updated = entry.stream;
    const ranges = [...entry.ranges].sort((left, right) => right.start - left.start);
    for (const range of ranges) {
      const replacement = textEncoder.encode(encodeLiteralAscii(range.text));
      updated = replaceByteRange(updated, range.start, range.end, replacement);
    }
    updateObjects[`obj:${streamRef}`] = { stream: { dict: {}, data: base64(updated) } };
  }
  const updateJson = textEncoder.encode(JSON.stringify({ qpdf: [{ jsonversion: 2, pushedinheritedpageresources: false, calledgetallpages: false, maxobjectid: maxObjectId }, updateObjects] }));
  const runner = qpdf?.runner;
  const result = await runQpdf(qpdf, [bytes, updateJson], ({ dir, inputPaths, exec, fs }) => {
    const outputPath = `${dir}/edited.pdf`;
    const command = exec(['--decode-level=none', '--compress-streams=n', `--update-from-json=${inputPaths[1]}`, inputPaths[0], outputPath]);
    return { command, output: command.exitCode === 0 ? fs.readFile(outputPath).slice() : null };
  });
  if (result.command.exitCode !== 0 || !result.output) throw new PdfTextEditError('qpdf could not apply the text changes. The original PDF is unchanged.', 'write');
  return { bytes: result.output, edits: changedTexts };
}
