# QuickKit

Browser-based PDF, image, text, password and Wi-Fi QR tools.

**Live site:** https://quickkit-browser-tools.pages.dev/<br>
**Images to PDF:** https://quickkit-browser-tools.pages.dev/image-to-pdf.html<br>
**PDF editor:** https://quickkit-browser-tools.pages.dev/pdf-editor.html

## Screenshots

### Mobile previews, split into short sections

<p><img src="../../qa-results/readme-parts/quickkit-home-hero.png" alt="QuickKit mobile home hero" width="31%"> <img src="../../qa-results/readme-parts/quickkit-home-tools.png" alt="QuickKit mobile tool cards" width="31%"> <img src="../../qa-results/readme-parts/quickkit-image-to-pdf-gallery.png" alt="Images to PDF mobile gallery" width="31%"></p>
<p><img src="../../qa-results/readme-parts/quickkit-image-to-pdf-edit.png" alt="Images to PDF crop and edit controls on mobile" width="31%"> <img src="../../qa-results/readme-parts/quickkit-pdf-editor-replace.png" alt="PDF OCR replacement flow on mobile" width="31%"></p>

## Tools

- Convert and order photos into PDFs; crop, rotate, filter, and set paper size/orientation/margins.
- Edit PDF pages with added text, highlights, rectangles, images and signatures; reorder/delete pages and export a new PDF.
- Replace or delete existing PDF text directly when a line meets the editor's supported structure and font rules. The editor preserves its source position and font and verifies the exported text before download.
- Use OCR to copy recognized text, redact a detected region, or start a masked text replacement with editable overlaid text.
- Run local English OCR to copy recognized text or mark OCR-detected regions for redaction. Redacted pages are flattened on export to remove their source text layer.
- Merge PDFs in the browser.
- Compress an image to a measured file-size target.
- Count and clean text; generate passwords.
- Create a Wi-Fi QR code.

Direct existing-text edits are intentionally limited to single-line, printable ASCII text in supported Standard Type 1/WinAnsi fonts, where the replacement fits the original width. Other fonts, complex scripts, reflow, encrypted/signed PDFs and unsupported layouts are refused; this is not universal font-perfect PDF editing. OCR replacement covers old text with a mask and overlays new text, so font and spacing are approximate and OCR can be wrong. Redacting a page flattens that page, removing its text layer and links and potentially changing visual quality. PDFs are processed on-device; OCR downloads its open-source engine and English model from a public CDN but does not upload the document. The PDF editor lazily downloads its qpdf WebAssembly engine when direct text editing is used.

## Development

From the workspace root, run `npm ci`, then `npm run dev:quickkit`. Build with `npm run build:quickkit`. The PDF editor smoke workflow is `npm run qa:pdf-editor`.

## Project and third-party notices

This product is proprietary; see the workspace [LICENSE](../../LICENSE). Dependencies and selected upstream components retain their own licenses. See `public/THIRD-PARTY-NOTICES.txt` and the live [open-source acknowledgements](https://quickkit-browser-tools.pages.dev/open-source-acknowledgements.html).
