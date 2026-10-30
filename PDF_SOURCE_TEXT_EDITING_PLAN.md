# QuickKit source-text editing implementation plan

**Priority:** PDF editor first. Keep the existing browser-only application and Cloudflare Pages deployment.  
**Reference decision:** OffPDF is the primary source-text algorithm reference; pdfstudio is the browser-qpdf/WASM writer reference. Both have permissive licenses (MIT and Apache-2.0 respectively). No source is copied until a component boundary, license notice and browser build are verified.

## Product promise

Add a distinct **Edit existing text** mode that changes real text operators inside a PDF when the file structure and font mapping can be verified. It must not label white masks, overlays, OCR text or rasterized pages as true source-text edits. Keep the current annotation, OCR replacement and redaction workflows available for their appropriate cases.

Supported edits will be explicitly bounded. The first browser version will target direct single-line `Tj` text objects in Standard 14 Type1 fonts with WinAnsi encoding, one text-show operation per text object, and printable ASCII replacements that fit the original advance width. The engine must report why it refuses unsupported text; it must never silently switch to an overlay or save a partial set of edits.

## Technical choice and constraints

- OffPDF (`MIT`): strongest verified implementation reference. It walks page content streams, preserves supported glyphs/font codes, rewrites the stream, then verifies the output. Its shipping implementation is a Tauri desktop app and currently shells out to native qpdf and Poppler.
- pdfstudio (`Apache-2.0`): browser qpdf compiled to a 2.2 MB WebAssembly module with a raw CLI path. It demonstrates local client-side qpdf, but does not implement source-text editing. Its current wrapper stages `PdfInput` bytes in an in-memory filesystem; validate whether JSON update documents can be staged as another byte input for qpdf's `--update-from-json` command.
- QuickKit (`Vite`, vanilla JS, PDF.js, pdf-lib): stay in the current stack. Keep documents on-device; do not send PDF bytes to a server.
- A browser implementation requires a compatible PDF stream reader/walker, qpdf-WASM update path, and independent browser verification. OffPDF's current 56k-line engine tree has native qpdf/Poppler process/file boundaries; transplanting it wholesale into the existing static product is not the safe shortcut. The selected browser route is a **new, deliberately narrow JS walker** guided by OffPDF's fail-closed rules, with qpdf-WASM for stream retrieval/writing and PDF.js for output verification. No OffPDF code is copied in the initial implementation.

## Phases

### 0. Source and license audit — complete

- [x] Review OffPDF source editing behavior and limits.
- [x] Verify OffPDF's MIT license and pdfstudio's Apache-2.0 license.
- [x] Confirm `pdf-lib`/Folio-style masking is not equivalent to source-text rewriting.
- [x] Record references and AdSense notes in `reference-notes/pdf-source-text-editing-and-adsense.md`.

### 1. Browser writer feasibility — complete

- [x] Confirm qpdf-WASM can apply `--update-from-json` using a second in-memory byte input as the JSON sidecar; no PDF upload or native executable was used in the proof.
- [x] Replace one simple Helvetica text-show stream from `Original text` to `Changed text` in the fixture, with no mask or rasterization.
- [x] Re-open output with PDF.js and confirm the text layer reads `Changed text`.
- [x] Compare the visible PDF page through PDF.js after replacing and deleting source text; preserve the original Tj text-show operator position and source text runs around it.
- [ ] Measure lazy-loaded WASM size, memory and execution time on desktop and mid-range mobile simulation.
- [ ] Stop and redesign if the writer mutates unrelated objects, cannot run in browser CSP/Cloudflare Pages, or uploads any document bytes.

`pdfstudio@0.4.0` is pinned as the browser qpdf-WASM dependency (Apache-2.0). Its packaged runner is used to retrieve a single filtered content stream and pass qpdf's JSON update document; this runner is an internal package property, so the version stays pinned and browser QA covers the integration. A small compatibility adapter copies resizable WebAssembly memory before Chromium's `TextDecoder` reads it. No PDF bytes leave the browser.

### 2. Safe browser engine

The implementation follows OffPDF's fail-closed product behavior but does not copy its source. The static-site-compatible path is a newly written JavaScript content walker, the pinned qpdf-WASM package, and PDF.js output verification.

- [x] Read page object/font resources and inspect only the selected page's content streams.
- [x] Limit direct editing to PDFs ≤25 MB, one `Tj` text run per text object, standard Type1/WinAnsi fonts, printable ASCII, no custom text spacing or render modes, and replacements no wider than the original text.
- [x] Refuse signed documents, malformed streams, repeated/shared page streams, unsupported fonts/layouts and unsupported encodings; preserve the original input bytes.
- [x] Independently reopen the qpdf output with PDF.js, count expected source strings and block download if the requested text changes are not confirmed.
- [ ] Measure memory and execution time on a real mid-range mobile device and a range of large PDFs.

### 3. User workflow and UI — implemented

- [x] Add “Edit text” mode to scan the current page and list editable lines and refused lines with reasons.
- [x] Select a line, stage replacement or deletion, clear/undo staged edits, then export a separate PDF.
- [x] Keep OCR separate and describe its masked replacement path.
- [x] Explain character, font and width limits; protect neighboring text by refusing overlong replacements.
- [x] Keep upload, editor, export, page navigation and inspector usable at 320 px and wider.

### 4. Acceptance checklist before release

- [x] Replace a supported line and confirm output extraction contains the replacement with other text unchanged.
- [x] Delete a supported line and confirm old text is absent from the output text layer.
- [x] Keep the same source font and page coordinates; a browser check compares PDF.js text transforms before and after, and source text remains selectable in the output.
- [ ] Refuse missing glyphs, subset-font characters not embedded, multi-line reflow, scanned/OCR-only content, Form XObjects/shared streams, Type3/vertical/complex RTL scripts, signed/encrypted PDFs, malformed streams, over-limit files and unsupported geometry with specific reasons.
- [x] On over-width refusal, preserve the original bytes and offer no download.
- [x] Confirm annotations, OCR redaction, page reorder/delete, image-to-PDF and PDF merge workflows in the browser suites.
- [x] Confirm browser network logs show no PDF upload; disclose the qpdf WASM and OCR model downloads.
- [x] Test downloaded output with PDF.js and run desktop, tablet, 390 px and 320 px flows.
- [ ] Test a representative mixed-font resume and a large multi-page PDF on a real mobile device; confirm unsupported lines are refused with useful reasons.

## Release rule

Describe this as direct text editing for the supported subset only. Font-perfect editing and line reflow across arbitrary PDF fonts or complex layout remain unsupported; use the separately labeled OCR masked-replacement route for other pages. Do not imply universal PDF text editing or a guaranteed match for every PDF.
