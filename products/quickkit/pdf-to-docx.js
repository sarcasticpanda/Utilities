import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';

function cleanText(value) {
  return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, '').trim();
}

export async function createDocxFromPdfPages(pages, title = 'PDF text') {
  const children = [];
  for (const [index, page] of pages.entries()) {
    if (index > 0) children.push(new Paragraph({ text: '', pageBreakBefore: true }));
    children.push(new Paragraph({ text: `Page ${page.pageNumber}`, heading: HeadingLevel.HEADING_2, spacing: { after: 180 } }));
    for (const line of page.lines) {
      const text = cleanText(line);
      if (text) children.push(new Paragraph({ children: [new TextRun({ text })], spacing: { after: 90 } }));
    }
  }
  if (!children.length) throw new Error('No selectable text was found in this PDF. For scanned pages, run OCR first.');
  const document = new Document({
    title: cleanText(title) || 'PDF text',
    description: 'Text extracted from a PDF by QuickKit. Page layout may differ from the source.',
    sections: [{ properties: {}, children }]
  });
  return Packer.toBlob(document);
}
