const MIN_LINE_DISTANCE = 2;

function groupTextItems(items) {
  const positioned = items
    .filter((item) => typeof item.str === 'string' && item.str.trim())
    .map((item) => ({
      text: item.str,
      x: Number(item.transform?.[4]) || 0,
      y: Number(item.transform?.[5]) || 0,
      width: Number(item.width) || 0,
      height: Number(item.height) || 10,
      fontName: item.fontName || ''
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const rows = [];
  for (const item of positioned) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= Math.max(MIN_LINE_DISTANCE, Math.min(candidate.height, item.height) * .42));
    if (row) {
      row.items.push(item);
      row.y = (row.y * (row.items.length - 1) + item.y) / row.items.length;
      row.height = Math.max(row.height, item.height);
    } else rows.push({ y: item.y, height: item.height, items: [item] });
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => {
      row.items.sort((a, b) => a.x - b.x);
      let text = '';
      let right = null;
      for (const item of row.items) {
        const value = item.text.replace(/\s+/gu, ' ').trim();
        if (!value) continue;
        const gap = right === null ? 0 : item.x - right;
        if (text && gap > Math.max(1.5, row.height * .12) && !/\s$/u.test(text)) text += ' ';
        text += value;
        right = item.x + item.width;
      }
      return text.trim();
    })
    .filter(Boolean);
}

export async function extractPdfPagesText(pdfjsLib, bytes, onProgress = () => {}) {
  const loadingTask = pdfjsLib.getDocument({ data: bytes, isEvalSupported: false });
  const document = await loadingTask.promise;
  if (document.numPages > 200) {
    await loadingTask.destroy();
    throw new Error('This PDF has more than 200 pages. Split it before extracting text.');
  }
  const pages = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent({ includeMarkedContent: false });
      pages.push({ pageNumber, lines: groupTextItems(content.items) });
      onProgress(pageNumber, document.numPages);
    }
  } finally {
    await loadingTask.destroy();
  }
  return pages;
}

export function formatPdfPagesText(pages) {
  return pages.map(({ pageNumber, lines }) => `Page ${pageNumber}\n${lines.join('\n')}`).join('\n\n');
}
