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

function showGapIsSafe(bytes, previousEnd, nextStart) {
  const gap = String.fromCharCode(...bytes.subarray(previousEnd, nextStart));
  return /^(?:\s|%[^\r\n]*(?:\r?\n|$))*$/u.test(gap);
}

function showGapIsHorizontalTextMove(bytes, previousEnd, nextStart) {
  const tokens = [...tokenizeContent(bytes.subarray(previousEnd, nextStart))];
  return tokens.length === 3 && tokens[0].type === 'number' && tokens[1].type === 'number' &&
    tokens[2].type === 'word' && tokens[2].value === 'Td' && Math.abs(tokens[1].value) <= 0.05;
}

function canJoinAdjacentTextShows(previous, next, profile) {
  if (!profile?.supported || previous.invalid || next.invalid || !sameTextStyle(previous, next) ||
      previous.textRenderingMode !== 0 || previous.horizontalScale !== 100 || previous.characterSpacing !== 0 || previous.wordSpacing !== 0 ||
      !Array.isArray(previous.position) || !Array.isArray(next.position) || !Number.isFinite(previous.fontSize)) return false;
  const [a, b] = previous.position;
  const deltaX = next.position[4] - previous.position[4];
  const deltaY = next.position[5] - previous.position[5];
  const basisLength = Math.hypot(a, b);
  if (!basisLength) return false;
  const alongBaseline = ((deltaX * a) + (deltaY * b)) / basisLength;
  const acrossBaseline = Math.abs((deltaX * -b) + (deltaY * a)) / basisLength;
  const tolerance = Math.max(0.45, previous.fontSize * 0.04);
  return alongBaseline > 0 && alongBaseline <= previous.fontSize * 1.8 && acrossBaseline <= tolerance;
}

function sameTextStyle(left, right) {
  return left.fontName === right.fontName && left.fontSize === right.fontSize &&
    left.textRenderingMode === right.textRenderingMode && left.horizontalScale === right.horizontalScale &&
    left.characterSpacing === right.characterSpacing && left.wordSpacing === right.wordSpacing;
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
  let textMatrix = [1, 0, 0, 1, 0, 0];
  let textLineMatrix = [1, 0, 0, 1, 0, 0];
  let leading = 0;
  const moveTextLine = (tx, ty) => {
    const [a, b, c, d, e, f] = textLineMatrix;
    textLineMatrix = [a, b, c, d, e + (tx * a) + (ty * c), f + (tx * b) + (ty * d)];
    textMatrix = [...textLineMatrix];
  };
  for (const token of tokens) {
    if (token.type !== 'word' || ['true', 'false', 'null'].includes(token.value)) { stack.push(token); continue; }
    const operator = token.value;
    if (operator === 'BI') throw new PdfTextEditError('This page uses an inline image in its content stream, which the safe text editor does not support yet.', 'inline-image');
    if (operator === 'BT') {
      if (block) throw new PdfTextEditError('This page has a nested text object and cannot be checked safely.', 'malformed');
      block = { fontName: currentFont, fontSize: currentFontSize, shows: [], unsupported: null, textRenderingMode, horizontalScale, characterSpacing, wordSpacing };
      textMatrix = [1, 0, 0, 1, 0, 0]; textLineMatrix = [1, 0, 0, 1, 0, 0];
    } else if (operator === 'ET') {
      if (block) blocks.push(block);
      block = null;
    } else if (operator === 'Tm') {
      const values = stack.slice(-6);
      if (values.length === 6 && values.every((value) => value?.type === 'number')) {
        textMatrix = values.map((value) => value.value);
        textLineMatrix = [...textMatrix];
      }
    } else if (operator === 'Td' || operator === 'TD') {
      const x = stack.at(-2); const y = stack.at(-1);
      if (x?.type === 'number' && y?.type === 'number') {
        moveTextLine(x.value, y.value);
        if (operator === 'TD') leading = -y.value;
      }
    } else if (operator === 'TL') {
      const value = stack.at(-1);
      if (value?.type === 'number') leading = value.value;
    } else if (operator === 'T*') {
      moveTextLine(0, -leading);
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
      if (block) {
        const state = { fontName: block.fontName, fontSize: block.fontSize, textRenderingMode: block.textRenderingMode, horizontalScale: block.horizontalScale, characterSpacing: block.characterSpacing, wordSpacing: block.wordSpacing };
        block.shows.push(operand?.type === 'string' ? { ...operand, ...state, position: [...textMatrix], operatorStart: operand.start, operatorEnd: token.end, adjustment: 0 } : { ...state, invalid: true });
      }
    } else if (operator === 'TJ') {
      const operand = stack.at(-1);
      if (block && operand?.type === 'array') {
        const inner = streamBytes.subarray(operand.start + 1, operand.end - 1);
        const parts = [...tokenizeContent(inner)];
        const textBytes = [];
        let adjustment = 0;
        let valid = true;
        for (const part of parts) {
          if (part.type === 'string') textBytes.push(...part.bytes);
          else if (part.type === 'number') adjustment += part.value;
          else valid = false;
        }
        const state = { fontName: block.fontName, fontSize: block.fontSize, textRenderingMode: block.textRenderingMode, horizontalScale: block.horizontalScale, characterSpacing: block.characterSpacing, wordSpacing: block.wordSpacing };
        block.shows.push(valid ? { type: 'string', bytes: Uint8Array.from(textBytes), ...state, position: [...textMatrix], operatorStart: operand.start, operatorEnd: token.end, adjustment } : { ...state, invalid: true });
      } else if (block) block.shows.push({ fontName: block.fontName, fontSize: block.fontSize, invalid: true });
    } else if (operator === "'" || operator === '"') {
      if (block) block.shows.push({ invalid: true });
    }
    stack.length = 0;
  }
  if (block) throw new PdfTextEditError('A PDF text object is missing its closing operator.', 'malformed');
  return blocks;
}

function decodeUtf16BeHex(hex) {
  if (!hex || hex.length % 4 !== 0) return null;
  const units = [];
  for (let index = 0; index < hex.length; index += 4) units.push(Number.parseInt(hex.slice(index, index + 4), 16));
  try { return String.fromCharCode(...units); } catch { return null; }
}

function parseToUnicodeCMap(bytes) {
  let source = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) source += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  const codeToUnicode = new Map();
  const add = (sourceHex, targetHex) => {
    if (!sourceHex || sourceHex.length % 2 || sourceHex.length > 4) return;
    const unicode = decodeUtf16BeHex(targetHex);
    if (unicode !== null) codeToUnicode.set(Number.parseInt(sourceHex, 16), unicode);
  };
  for (const block of source.matchAll(/\d+\s+beginbfchar([\s\S]*?)endbfchar/gu)) {
    for (const pair of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/gu)) add(pair[1], pair[2]);
  }
  for (const block of source.matchAll(/\d+\s+beginbfrange([\s\S]*?)endbfrange/gu)) {
    const linePattern = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<([0-9A-Fa-f]+)>|\[([^\]]*)\])/gu;
    for (const range of block[1].matchAll(linePattern)) {
      const first = Number.parseInt(range[1], 16);
      const last = Number.parseInt(range[2], 16);
      if (last < first || last - first > 4096) continue;
      if (range[5] !== undefined) {
        const targets = [...range[5].matchAll(/<([0-9A-Fa-f]+)>/gu)].map((match) => match[1]);
        for (let offset = 0; offset <= last - first && offset < targets.length; offset++) add((first + offset).toString(16).padStart(range[1].length, '0'), targets[offset]);
      } else {
        const targetHex = range[4];
        if (!targetHex || targetHex.length % 4) continue;
        const startValue = BigInt(`0x${targetHex}`);
        for (let offset = 0; offset <= last - first; offset++) {
          const nextHex = (startValue + BigInt(offset)).toString(16).padStart(targetHex.length, '0');
          add((first + offset).toString(16).padStart(range[1].length, '0'), nextHex);
        }
      }
    }
  }
  return codeToUnicode;
}

function createUnicodeReverseMap(codeToUnicode) {
  const unicodeToCodes = new Map();
  for (const [code, unicode] of codeToUnicode) {
    if (!unicode) continue;
    if (!unicodeToCodes.has(unicode)) unicodeToCodes.set(unicode, []);
    unicodeToCodes.get(unicode).push(code);
  }
  for (const codes of unicodeToCodes.values()) codes.sort((left, right) => left - right);
  return unicodeToCodes;
}

function decodeMappedBytes(bytes, profile) {
  let text = '';
  for (const code of bytes) {
    const unicode = profile.codeToUnicode.get(code);
    if (unicode === undefined) return null;
    text += unicode;
  }
  return text;
}

function decodeIdentityHBytes(bytes, profile) {
  if (bytes.length % 2) return null;
  let text = '';
  for (let index = 0; index < bytes.length; index += 2) {
    const cid = (bytes[index] << 8) | bytes[index + 1];
    const unicode = profile.codeToUnicode.get(cid);
    if (unicode === undefined) return null;
    text += unicode;
  }
  return text;
}

function encodeMappedText(text, profile) {
  if (!text) return { bytes: new Uint8Array(), glyphWidths: [], textGlyphs: [] };
  const characters = Array.from(text);
  const mappings = [...profile.unicodeToCodes.keys()].sort((left, right) => Array.from(right).length - Array.from(left).length || right.length - left.length);
  const bytes = [];
  const glyphWidths = [];
  const textGlyphs = [];
  for (let index = 0; index < characters.length;) {
    let match = null;
    for (const unicode of mappings) {
      const units = Array.from(unicode);
      if (units.length && characters.slice(index, index + units.length).join('') === unicode) { match = unicode; break; }
    }
    if (match === null) return null;
    const code = profile.unicodeToCodes.get(match)?.[0];
    const width = profile.widthByCode.get(code) ?? profile.defaultWidth;
    if (code === undefined || width === undefined) return null;
    if (profile.kind === 'type0-identity-h') bytes.push((code >> 8) & 0xff, code & 0xff);
    else bytes.push(code);
    glyphWidths.push(width);
    textGlyphs.push(match);
    index += Array.from(match).length;
  }
  return { bytes: Uint8Array.from(bytes), glyphWidths, textGlyphs };
}

function parseCidWidths(value) {
  const widths = new Map();
  if (!Array.isArray(value)) return widths;
  for (let index = 0; index < value.length;) {
    const first = Number(value[index++]);
    if (!Number.isInteger(first) || first < 0 || first > 0xffff || index >= value.length) return null;
    const next = value[index++];
    if (Array.isArray(next)) {
      next.forEach((rawWidth, offset) => {
        const width = Number(rawWidth);
        if (Number.isFinite(width) && width >= 0 && first + offset <= 0xffff) widths.set(first + offset, width);
      });
    } else {
      const last = Number(next);
      const rawWidth = value[index++];
      const width = Number(rawWidth);
      if (!Number.isInteger(last) || last < first || last > 0xffff || !Number.isFinite(width) || width < 0) return null;
      for (let cid = first; cid <= last; cid++) widths.set(cid, width);
    }
  }
  return widths;
}

async function getFontProfile(fontValue, objects, qpdf, bytes, cache) {
  const ref = refId(fontValue);
  const cacheKey = ref || (typeof fontValue === 'string' ? fontValue : JSON.stringify(fontValue));
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const font = resolve(fontValue, objects);
  if (!font || typeof font !== 'object') return { supported: false, reason: 'The page font resources could not be read.' };
  const baseFont = String(font['/BaseFont'] || '').replace(/^\//u, '');
  if (font['/Subtype'] === '/Type1' && !font['/FontDescriptor'] && standardFonts.has(baseFont) && font['/Encoding'] === '/WinAnsiEncoding') {
    const profile = { supported: true, kind: 'standard', baseFont };
    cache.set(cacheKey, profile);
    return profile;
  }
  const widths = resolve(font['/Widths'], objects);
  if (font['/Subtype'] === '/Type1' && font['/FontDescriptor'] && refId(font['/ToUnicode']) && Array.isArray(widths) && Number.isInteger(font['/FirstChar'])) {
    const cmapRef = parseStreamRef(font['/ToUnicode']);
    if (!cmapRef) return { supported: false, reason: 'The embedded font has no usable Unicode map.' };
    const cmapBytes = await qpdfStream(qpdf, bytes, cmapRef.objectNumber);
    if (cmapBytes.byteLength > 2 * 1024 * 1024) return { supported: false, reason: 'The embedded font Unicode map is larger than the safe editing limit.' };
    const codeToUnicode = parseToUnicodeCMap(cmapBytes);
    if (!codeToUnicode.size || [...codeToUnicode.keys()].some((code) => code > 255)) return { supported: false, reason: 'This embedded Type 1 font uses a Unicode map the editor cannot safely encode.' };
    const widthByCode = new Map();
    widths.forEach((width, index) => {
      const value = Number(width);
      if (Number.isFinite(value) && value > 0) widthByCode.set(font['/FirstChar'] + index, value);
    });
    if (!widthByCode.size) return { supported: false, reason: 'The embedded font does not provide measurable glyph widths.' };
    const profile = { supported: true, kind: 'simple-cmap', baseFont, codeToUnicode, unicodeToCodes: createUnicodeReverseMap(codeToUnicode), widthByCode };
    cache.set(cacheKey, profile);
    return profile;
  }
  if (font['/Subtype'] === '/Type0' && font['/Encoding'] === '/Identity-H' && refId(font['/ToUnicode'])) {
    const descendants = resolve(font['/DescendantFonts'], objects);
    const descendant = Array.isArray(descendants) ? resolve(descendants[0], objects) : null;
    const descriptor = descendant && resolve(descendant['/FontDescriptor'], objects);
    const cidWidths = descendant && parseCidWidths(resolve(descendant['/W'], objects));
    const defaultWidth = Number(descendant?.['/DW'] ?? 1000);
    if (descendant?.['/Subtype'] !== '/CIDFontType2' || !descriptor || !('/FontFile2' in descriptor) || !cidWidths || !Number.isFinite(defaultWidth) || defaultWidth < 0) {
      return { supported: false, reason: 'This Identity-H font does not provide a supported embedded CID font and measurable widths.' };
    }
    const cmapRef = parseStreamRef(font['/ToUnicode']);
    if (!cmapRef) return { supported: false, reason: 'The Identity-H font has no usable Unicode map.' };
    const cmapBytes = await qpdfStream(qpdf, bytes, cmapRef.objectNumber);
    if (cmapBytes.byteLength > 2 * 1024 * 1024) return { supported: false, reason: 'The Identity-H font Unicode map is larger than the safe editing limit.' };
    const codeToUnicode = parseToUnicodeCMap(cmapBytes);
    if (!codeToUnicode.size || [...codeToUnicode.keys()].some((code) => code > 0xffff)) {
      return { supported: false, reason: 'This Identity-H font uses a Unicode map the editor cannot safely encode.' };
    }
    const profile = {
      supported: true,
      kind: 'type0-identity-h',
      baseFont,
      codeToUnicode,
      unicodeToCodes: createUnicodeReverseMap(codeToUnicode),
      widthByCode: cidWidths,
      defaultWidth
    };
    cache.set(cacheKey, profile);
    return profile;
  }
  return { supported: false, reason: 'This font encoding cannot be changed safely in this browser.' };
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

function measureMappedBytes(bytes, profile) {
  let width = 0;
  for (const code of bytes) {
    const glyphWidth = profile.widthByCode.get(code);
    if (!Number.isFinite(glyphWidth)) return null;
    width += glyphWidth;
  }
  return width;
}

function measureTextWithProfile(text, profile) {
  if (profile.kind === 'standard') return measureStandardText(text, profile.baseFont);
  const encoded = encodeMappedText(text, profile);
  return encoded ? encoded.glyphWidths.reduce((sum, width) => sum + width, 0) : null;
}

export function canEncodePdfText(text, profile) {
  if (typeof text !== 'string' || /[\r\n]/u.test(text) || !profile?.supported) return false;
  if (profile.kind === 'standard' && /[^\x20-\x7e]/u.test(text)) return false;
  return measureTextWithProfile(text, profile) !== null;
}

function encodePdfRun(text, profile, adjustment = 0) {
  if (profile.kind === 'standard') return encodeLiteralAscii(text, adjustment);
  const encoded = encodeMappedText(text, profile);
  if (!encoded) throw new PdfTextEditError('The embedded PDF font does not contain every replacement character.', 'encoding');
  const hex = [...encoded.bytes].map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase();
  if (!hex) return `[${adjustment.toFixed(3)}] TJ`;
  const textHex = `<${hex}>`;
  return Math.abs(adjustment) < 0.5 ? `${textHex} Tj` : `[${textHex} ${adjustment.toFixed(3)}] TJ`;
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
  const fontProfileCache = new Map();
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
      const groups = [];
      for (const run of block.shows) {
        const previous = groups.at(-1)?.runs.at(-1);
        let canJoin = previous && !run.invalid && !previous.invalid && sameTextStyle(previous, run) && showGapIsSafe(content, previous.operatorEnd, run.operatorStart);
        if (!canJoin && previous && !run.invalid && !previous.invalid && sameTextStyle(previous, run) && showGapIsHorizontalTextMove(content, previous.operatorEnd, run.operatorStart)) {
          const fontResource = fonts?.[previous.fontName];
          const font = fontResource ? await getFontProfile(fontResource, objects, qpdf, bytes, fontProfileCache) : null;
          canJoin = canJoinAdjacentTextShows(previous, run, font);
        }
        if (canJoin) groups.at(-1).runs.push(run);
        else groups.push({ runs: [run] });
      }
      for (const group of groups) {
        const runs = group.runs;
        const allTextBytes = Uint8Array.from(runs.flatMap((run) => run.bytes ? [...run.bytes] : []));
        const show = runs[0];
        const fontResource = show.fontName && fonts?.[show.fontName];
        const font = fontResource ? await getFontProfile(fontResource, objects, qpdf, bytes, fontProfileCache) : { supported: false, reason: 'The page font could not be resolved.' };
        const decodeText = font.kind === 'simple-cmap' ? decodeMappedBytes : font.kind === 'type0-identity-h' ? decodeIdentityHBytes : stringBytesToAscii;
        const text = font.supported ? decodeText(allTextBytes, font) : null;
        if (runs.some((run) => run.invalid)) { unavailable.push({ text: text ?? '', reason: 'This text-drawing operation uses an unsupported PDF string format.' }); continue; }
        if (!font.supported) { unavailable.push({ text: text ?? '', reason: font.reason }); continue; }
        if (text === null || !text.trim()) { unavailable.push({ reason: font.kind === 'simple-cmap' ? 'This text contains glyphs missing from the embedded font Unicode map.' : 'This text uses characters outside the safe printable-ASCII subset.' }); continue; }
        if (show.textRenderingMode !== 0 || show.horizontalScale !== 100 || show.characterSpacing !== 0 || show.wordSpacing !== 0) {
          unavailable.push({ text, reason: 'This text run uses a text-rendering effect or custom spacing that is not supported yet.' }); continue;
        }
        if (!Number.isFinite(show.fontSize) || show.fontSize <= 0) { unavailable.push({ text, reason: 'The original font size could not be confirmed.' }); continue; }
        if (json.pages.some((page, index) => index !== pageIndex && page.contents?.includes(stream.normalized))) {
          unavailable.push({ text, reason: 'This content stream is shared by multiple pages, so changing it could alter another page.' }); continue;
        }
        let widthUnits = 0;
        for (const run of runs) {
          const runText = decodeText(run.bytes, font);
          const runWidth = runText === null ? null : measureTextWithProfile(runText, font);
          if (runWidth === null) { widthUnits = null; break; }
          widthUnits += runWidth - run.adjustment;
        }
        if (widthUnits === null || widthUnits <= 0) { unavailable.push({ text, reason: 'The selected font cannot measure this text run safely.' }); continue; }
        candidates.push({
          id: `p${pageIndex}-${stream.normalized.replaceAll(' ', '-')}-${runs[0].operatorStart}`,
          pageIndex,
          streamRef: stream.normalized,
          streamObjectNumber: stream.objectNumber,
          operatorStart: runs[0].operatorStart,
          operatorEnd: runs.at(-1).operatorEnd,
          originalText: text,
          fontName: font.baseFont,
          fontResourceName: show.fontName,
          fontProfile: font,
          widthUnits,
          fontSize: show.fontSize
        });
      }
    }
  }
  return { pageIndex, pageRef, candidates, unavailable, pageCount: pages.length };
}

export async function scanEditablePdfPage(bytes, pageIndex, qpdf) {
  const json = await qpdfJson(qpdf, bytes);
  return analyzePage(bytes, pageIndex, qpdf, json);
}

function encodeLiteralAscii(text, adjustment = 0) {
  if (typeof text !== 'string' || /[^\x20-\x7e]/u.test(text)) throw new PdfTextEditError('Use one line of printable English characters for this font. Line breaks and non-ASCII characters are not supported in this first version.', 'encoding');
  const literal = `(${text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')})`;
  return Math.abs(adjustment) < 0.5 ? `${literal} Tj` : `[${literal} ${adjustment.toFixed(3)}] TJ`;
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
    if (!candidate) throw new PdfTextEditError('The selected text run could not be found in the source PDF. Re-scan the page before exporting.', 'stale');
    if (candidate.originalText !== edit.originalText) throw new PdfTextEditError('The selected text run changed in the source PDF. Re-scan the page before exporting.', 'stale');
    const nextWidth = measureTextWithProfile(text, candidate.fontProfile);
    if (nextWidth === null) throw new PdfTextEditError('The selected font cannot encode every character in the replacement.', 'encoding');
    if (nextWidth > candidate.widthUnits + 0.5) throw new PdfTextEditError('That replacement is wider than the original line. Shorten it to keep it from colliding with nearby content.', 'width');
    if (!streamEdits.has(candidate.streamRef)) {
      const parsed = parseStreamRef(candidate.streamRef);
      const stream = await qpdfStream(qpdf, bytes, parsed.objectNumber);
      streamEdits.set(candidate.streamRef, { objectNumber: parsed.objectNumber, stream, ranges: [] });
    }
    const entry = streamEdits.get(candidate.streamRef);
    entry.ranges.push({ start: candidate.operatorStart, end: candidate.operatorEnd, text, profile: candidate.fontProfile, adjustment: nextWidth - candidate.widthUnits });
    changedTexts.push({ ...edit, text });
  }
  const updateObjects = {};
  for (const [streamRef, entry] of streamEdits) {
    let updated = entry.stream;
    const ranges = [...entry.ranges].sort((left, right) => right.start - left.start);
    for (const range of ranges) {
      const replacement = textEncoder.encode(encodePdfRun(range.text, range.profile, range.adjustment));
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
