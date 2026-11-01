# PDF editor reference audit

Reviewed public product pages and open-source project documentation on 2026-10-30. This is a behavior and engineering-pattern review; no private APIs, credentials, intercepted traffic, or competitor source code were used.

## Product references

| Reference | What was observed | What QuickKit uses as a product reference |
|---|---|---|
| [Sejda PDF editor](https://www.sejda.com/pdf-editor) | Select existing PDF text for editing; add text/images/shapes/links; fill forms; annotate; manage files and download. | Clear separation between selecting existing content and adding new annotations. QuickKit implements only the supported content-stream subset and its own page rail/annotation tools. |
| [iLovePDF Edit PDF](https://www.ilovepdf.com/edit-pdf) | Add text, shapes, comments/highlights and images, then download. | Keep the first-run workflow focused and controls familiar. The public description is not evidence of arbitrary original-text editing. |
| [iLovePDF JPG to PDF](https://www.ilovepdf.com/jpg_to_pdf) | Choose/arrange images and set page output before conversion. | Photo queue, page order, page-wide settings and an explicit create/download step. QuickKit adds crop/filter controls suited to this app. |

## Open-source engineering references

| Repository | License / fit | Useful findings and decision |
|---|---|---|
| [AryanBV/pdf-edit-engine](https://github.com/AryanBV/pdf-edit-engine) | MIT project; Python/pikepdf/fonttools/pdfminer stack, so not a drop-in for static browser Pages. | Its docs describe position-aware matching across split content-stream operators, width/kerning checks, font-subset handling and fidelity reports. Used as a design reference for recognizing consecutive text runs and retaining their advance; QuickKit's parser and tests are independently written and much narrower. |
| [storytold/pdfcraft](https://github.com/storytold/pdfcraft) | Rust/wasm-capable project; alpha and explicitly still has limits in existing-text editing. | Documentation illustrates font-aware editing and conservative refusal of ambiguous edits. Too large and immature to replace this site's current editor in this fix. |
| [QrCommunication/gigapdf-lib](https://github.com/QrCommunication/gigapdf-lib) | PolyForm Noncommercial 1.0.0. | Has a browser-WASM SDK but its license is incompatible with an ad-funded commercial service without another license, so it was not adopted. |
| [QrCommunication/gigapdf](https://github.com/QrCommunication/gigapdf) | AGPLv3 full-stack project. | Useful as a self-hosted product reference, but not a lightweight static Pages dependency. No code imported. |

## What was reverse engineered—and what was not

- The **user-visible workflow and feature boundaries** were analyzed from public product pages and docs.
- The **PDF text encoding pattern** was studied from public documentation: text may be split into separate `Tj` operations or represented in a `TJ` array; replacing it safely requires preserving text advance and refusing runs where positioning or styling changes between pieces.
- No competitor source code, private API, branding, or assets were copied. No upstream engine was cloned or integrated in this implementation. Therefore this should not be described as a code reverse-engineering port.
- QuickKit's browser-side parser supports standard Type 1/WinAnsi text, embedded Type1 subset fonts with usable ToUnicode maps, and embedded Type0/CIDFontType2 fonts using Identity-H plus a usable ToUnicode map and CID widths. It groups same-style adjacent `Tj`/`TJ` runs and same-baseline character-by-character text shows, measures glyph advances, refuses missing replacement glyphs or wider text, and adjusts the final `TJ` advance. Owner-supplied PDFs were used for private verification; other font encodings, custom CMaps, vertical text and unusual transforms remain outside the verified scope.

## QuickKit implementation choices and limits

- `pdfjs-dist` renders and extracts selectable text; `pdf-lib` handles existing document and annotation export; `pdfstudio`'s qpdf WebAssembly package applies safe source-stream changes locally.
- OCR uses Tesseract.js for scanned pages. OCR recognition is separate from native PDF text extraction and cannot restore the original font program or layout.
- Direct source-text editing refuses scanned text, unsupported font encodings, glyphs absent from a subset font, style/position changes within a run, and replacements wider than the original. OCR replacement is a visual mask plus new text overlay, distinct from direct source-text editing.
- “Apply same filter to all photos” reuses the active photo's filter and brightness/contrast. Page size, orientation and margin apply to each selected image page. Photo and PDF thumbnail lists support drag reorder; accessible arrow buttons remain available.
- The PDF extract panel stays closed until the user clicks **Extract text**. This avoids displaying an empty result box that appears to be a failed extraction.

## Browser verification

- PDF editor checks: `scripts/pdf-editor-smoke.mjs`.
- Document/image/PDF extraction checks: `scripts/quickkit-document-qa.mjs`.
- Build and browser test evidence: see `BROWSER_QA_CHECKLIST.md`, `IMPLEMENTATION_TRACKER.md`, and generated `qa-results/` reports.
