# Three Utility Sites — Implementation and release tracker

**Spec:** `UTILITY_SITES_COMPLETE_MASTER.md`
**Public state:** All three products are live on Cloudflare Pages; the previous Sites URLs remain available as fallback.
**Current worktree:** All three Cloudflare Pages sites are live. The latest multi-range video trim release is deployed; QuickKit PDF editing/OCR/conversion, video tools and FormReady Exam Form Kit remain production-browser verified.
**Latest release:** QuickKit multi-range video trim with draggable saved sections, keep/remove mode, overlap prevention and assembled preview/export is deployed to `https://quickkit-browser-tools.pages.dev`.
**Last site release:** 2026-11-02
**Latest confirmed Cloudflare deployments:** The multi-range video release was published directly to the QuickKit Pages project. Stable public URLs are `https://quickkit-browser-tools.pages.dev`, `https://workkit-hours-tools.pages.dev` and `https://formready-photo-tools.pages.dev`; Cloudflare Pages is not connected to the GitHub repository, so Git pushes do not deploy automatically.
**Verification refresh:** 2026-11-02 — stable QuickKit production video suite passed **37/37**, including trim-handle dragging, split-at-playhead, compression, crop, trim, join/reorder, soundtrack mixing, multi-range keep/remove exports, 390/320px layout and browser error checks. FormReady Exam Form Kit passed **19/19** on production. Live SEO crawl checked 19 sitemap URLs and 34 linked routes across three sites with 0 failures. Latest PDF/OCR and geo-photo test evidence remains in the dated sections below; current device limitations and owner checks remain listed in `BROWSER_QA_CHECKLIST.md`.
**Earlier Lighthouse baseline (2026-10-31):** QuickKit PDF editor 77 performance, 100 accessibility, best practices and SEO (LCP 4.1s, CLS 0, TBT 0); WorkKit 98/100/100/100 (LCP 2.1s, CLS 0.026, TBT 0); FormReady 98/100/100/100 (LCP 2.0s, CLS 0.003, TBT 0). These are lab results, not real-user CrUX measurements; the latest deployment has not received a fresh Lighthouse run.

**Current release (2026-11-02):** The Search Console verification files were published for WorkKit and FormReady and owner verification succeeded. Production QA results and the handwriting OCR limitation are recorded above. All three products self-host the Outfit font; QuickKit's lazy-loaded PDF text extractor avoids loading on the initial editor view. Privacy policies disclose conditional ad-cookie use, while ads remain disabled. Detailed browser evidence is in `BROWSER_QA_CHECKLIST.md` and `qa-results/`; release/owner actions are in `GOOGLE_LAUNCH_HANDOFF.md`.

## Release summary

| Product | Public HTTPS site | Cloudflare Pages project | Live checks |
|---|---|---|---|
| WorkKit | https://workkit-hours-tools.pages.dev | workkit-hours-tools | Passed |
| QuickKit | https://quickkit-browser-tools.pages.dev | quickkit-browser-tools | Passed |
| FormReady | https://formready-photo-tools.pages.dev | formready-photo-tools | Passed |

## Completed

- [x] Read the project pack and recorded repo research in `reference-notes/`.
- [x] Used Repomix to inspect ClockMath and adapted its small `toMinutes`, `isOvernight` and `clockMinutes` helper into WorkKit. Upstream commit, attribution and MIT notice are retained.
- [x] Built three distinct, independently deployable static sites with Vite.
- [x] Added responsive navigation, working tool pages, privacy/terms/about/contact and open-source acknowledgements.
- [x] Added origin-matched canonical tags, social metadata, `robots.txt` and `sitemap.xml` to each deployed static bundle.
- [x] Kept file processing in the browser; production requests show no app feature uploads. Cloudflare's first-party browser challenge issues a separate security POST.
- [x] Published all three independent Cloudflare Pages sites; the earlier Sites releases remain as fallback URLs.
- [x] Ran production browser smoke checks after the latest deployment: all 14 Pages routes returned HTTP 200; canonical tags, sitemap and robots files worked; representative PDF, image-to-PDF and currency flows passed, with no JS errors or horizontal overflow.
- [x] Deployed the Word/PDF converter, all-page PDF text extraction, filter preview/export fix, qpdf WASM URL fix and favicon to Cloudflare Pages. Fresh visible-browser tabs confirm the converter on both the immutable deployment URL and stable `pages.dev` alias.
- [x] Previous QuickKit document/filter production suite passed 15/15; PDF editor production suite passed 40/40 before the current local changes.
- [x] Ran the full local Playwright sweep on 2026-10-30: 79 entries, 0 failures; tested all main routes at 1440×900, 768×1024, 390×844 and 320×740.
- [x] Ran a 32-check Chromium PDF editor workflow locally and live, including OCR, editable replacement, actual redaction export, text removal from the redacted page, PDF page management, desktop/mobile layout and local-only file handling.
- [x] Captured final UI screenshots in `qa-results/screenshots-polished/` and production screenshots in `qa-results/production/`.

## Product scope shipped

### WorkKit

- [x] Add shifts, breaks, overnight work, weekly hours, decimal hours, regular/overtime split and estimated gross pay.
- [x] Keep a local timesheet draft and export CSV.
- [x] Provide separate overtime and hourly-to-salary tools.
- [x] Validate identical shift times instead of silently treating them as a full day.
- [ ] Add linked prefill from one calculator page to another; the weekly overtime split is already shown on the time-card page.
- [ ] Add named time sheets, sharing, timezone conversion and DST-specific calculations if users need them.

### QuickKit

- [x] Convert selected photos to PDF with crop, rotate, filters, reorder, page size/orientation and margins.
- [x] Compress images against a measured KB limit, merge PDFs, count/clean text, generate passwords, and make Wi-Fi QR codes.
- [ ] Nearby transfer of multiple files between devices using a one-time QR/local-network session has not been implemented; it needs a dedicated security, connectivity and cross-device design/test pass.
- [x] Add a local PDF editor with text, highlight, rectangle, image/signature annotations, page previews, page reorder/delete, zoom and PDF download.
- [x] Add direct existing-text editing for supported standard fonts and embedded Type1 fonts with usable ToUnicode maps. A supplied PDF with an embedded subset font was used to verify edits to the source content stream and output text. Replacement glyphs must exist in the embedded subset and fit within the original run width.
- [x] Extend direct editing to embedded Type0/CIDFontType2 Identity-H fonts with usable ToUnicode maps and CID widths; group same-baseline character-by-character `Tj` runs into editable lines. Local private-file QA covered supported text runs across several PDFs and verified on-page edits, updated previews, downloaded PDFs and normalized output text. Private sample filenames and document contents are not part of this public project record.
- [x] Map text click targets across PDF.js text items and prevent overlapping hitboxes. Latest local PDF editor suite passed 51/51, including a clickable split-run text target and mobile layout checks.
- [x] Add OCR text recognition/copy and OCR-assisted redaction; redact exports flatten affected pages so source text is not left extractable beneath the mask. See `qa-results/pdf-editor/results.json`.
- [x] Improve OCR input with grayscale/contrast normalization and bounded upscaling; stop page OCR after 60 seconds and reset the worker so a stuck page cannot block later pages. Timeout/reset path is implemented; supplied pages completed before the limit.
- [x] Extend PDF-to-Word to identify image-only pages, run English OCR in the browser, show editable per-page results, flag low OCR engine scores, support cancel, and export reviewed text together with selectable text. English recognition data is fetched from a CDN; selected documents are not uploaded. Limit: 30 scanned pages per file per run.
- [x] Test the browser flow on eight owner-supplied PDFs: all eight Word downloads reopened. Six files had selectable text; two had image-only pages and OCR text was included in the Word export. Handwriting received low confidence and still requires correction; OCR accuracy is not confirmed.
- [x] Benchmark a browser-based handwritten TrOCR alternative on the supplied academic scan. Tesseract line boxes included ruled lines/adjacent content; manually aligned and blue-ink-cleaned crops still produced incorrect obvious text. The alternative was not shipped. Findings: `reference-notes/handwriting-ocr-benchmark.md`.
- [ ] Accurate handwriting recognition is still an open requirement. Find a handwriting model with clear commercial licensing, create a manually verified transcript for representative supplied pages, and measure character/word error rates plus browser download, inference-time and memory costs before integration.
- [x] Run the updated browser suite: 29/29 checks, covering scanned-only and mixed PDFs, a known OCR marker, reviewed-text DOCX export, empty-output refusal, cancel, and phone layout. Repeatable checks are available through `npm run qa:quickkit-documents`; private-file results remain local.
- [x] Test every image-only page in the two supplied scan PDFs in a local production preview: 4/4 pages returned regions (21, 3, 21 and 3 respectively); all require human review because counts do not prove transcription accuracy. Raw OCR text is not retained.
- [x] On an owner-supplied scanned PDF, OCR regions created an in-page mask and replacement overlay, export produced a readable PDF, and the result reopened in the editor. Private-file evidence remains local.
- [x] Review Sejda/iLovePDF user workflows and open-source PDF text-engine documentation; no competitor code or private API was copied. See `reference-notes/pdf-editor-reference-audit.md`.
- [x] Verify direct page-click source-text edits, list fallback, immediate edited-page preview, searchable replacement, deletion, unchanged surrounding text, over-width refusal, 320 px fit and no PDF upload using a private owner-supplied PDF. The downloaded output was checked for the replacement and removed source text.
- [x] Deploy the image-to-PDF and OCR/replacement/redaction updates to https://quickkit-browser-tools.pages.dev; direct source-text edit, output verification and live image-to-PDF interaction passed.
- [x] Lazy-load the larger PDF and QR libraries.
- [x] Add a dedicated local video workspace for compression, accurate trim, multi-clip join, and same-source section cuts. Browser output chooses a supported MP4 or WebM codec, preserves tested audio, and shows measured result details.
- [x] Run generated video+audio files through Chromium and Firefox: `npm run qa:video-tools` passed 17/17 in both browsers, including color-sampled export order and reordered sequence. Reports: `qa-results/video-tools-browser-smoke.json` and `qa-results/video-tools-browser-smoke-firefox.json`.
- [x] Deploy video tools to the latest immutable production release (`https://52e49277.quickkit-browser-tools.pages.dev`) and rerun the suite on the stable URL; engine code is deferred until the user selects a video.
- [x] Deploy OCR preprocessing/recovery and rerun OCR against all four scanned pages in the supplied merged and academic PDFs. The separate academic-PDF overlay/export/reopen flow passed in production. See `qa-results/quickkit-production-2026-10-31-summary.json`.
- [x] The 17/17 video suite passed against the stable `https://quickkit-browser-tools.pages.dev` alias in Chromium and Firefox. WebKit fallback/mobile checks passed 4/4; this Playwright WebKit build has no WebCodecs and cannot establish Safari editing support.
- [x] Add multi-track video soundtracks: up to three local audio files, source in/out trimming, placement on the joined timeline, per-track volume/remove, independent original-audio mute/volume, and a visible video/audio timeline. Audio mixing is bounded to 4 minutes desktop and 2 minutes narrow viewports.
- [x] Expanded video regression passed 24/24 in Chromium and Firefox locally. Known 523 Hz and 880 Hz samples confirmed placement/source trims; a 440 Hz sample confirmed original-audio level control. Exports reopened; clip order, middle cut, audio track, 390px/320px widths and console checks passed.
- [x] Build geo-photo tool with permission-based or manual coordinates, optional visible place/date stamp, JPEG GPS EXIF, precise rational coordinates and metadata read-back. Source images/location stay local; exact GPS sharing sensitivity is explained in-app and in privacy/terms.
- [x] Geo-photo browser QA passed 14/14 locally: signed GPS metadata exact to <1e-7 degrees, pixel-size preservation, current geolocation flow, stamp on/off, reset, export, 390/320px layout and no browser errors.
- [x] Added piexifjs MIT attribution and split README screenshots into concise video/audio/geo-photo views.
- [ ] Publish expanded QuickKit release and rerun video, geo-photo, PDF editor and document/OCR suites on the stable public URL.
- [ ] Video release checks still needed: real Chrome/Edge/Safari devices, cancellation, corrupt/unsupported files, large files, rotated/variable-rate video and mixed-format joins.
- [x] Add original, practical guides to QuickKit, WorkKit and FormReady and link each from its homepage footer/sitemap.
- [x] All three guides passed 16/16 local Chromium checks for homepage discovery links, copy/title/canonical/tool actions, 390px layout and no browser errors. Screenshots: `qa-results/seo-guides/`.
- [x] Deploy guides and social cards to all three Cloudflare projects; production guide checks passed 16/16 and the live crawl checked all 18 sitemap URLs plus all 33 linked routes for status, canonical, description, title, indexability and social-image metadata. See `qa-results/seo-live-audit.json`.
- [x] QuickKit, WorkKit and FormReady HTTPS URL-prefix properties are verified in Search Console; all three sitemap submissions were accepted. The 2026-11-01 reports currently say “Couldn't fetch” for WorkKit and FormReady despite HTTP 200 valid XML to a Googlebot user agent; investigate/recheck fetch status. QuickKit ownership/sitemap were already set up. Bing verification and AdSense account/site review remain open. No ads are active and these sites are not earning ad revenue. Exact handoff: `GOOGLE_LAUNCH_HANDOFF.md`.
- [ ] Add PDF split, Word/PDF conversion and advanced batch tools only with accurate fidelity limits and mobile-memory checks.

### FormReady

- [x] Upload, crop, resize, compress and measure a photo/signature against user-entered requirements; download and reset.
- [x] Convert custom millimeter/inch dimensions to pixels at a chosen DPI; rotate left/right and reset the crop.
- [x] Clear stale generated output when requirements change, restrict input to JPG/PNG/WebP under 20 MB, and explain the 5,000 px per-side canvas limit.
- [x] Keep every exam rule linked to its official notice, label expired cycles as historical, explain live-photo steps and the independent-service limitation, and provide custom inputs when current rules are unavailable.
- [ ] Replace historical preset values only after saving a new official notice URL and verifying the current dimensions, format and file-size requirements.
- [x] Build and deploy the exam-first Form Kit with source-linked, cycle-labeled presets, custom requirements, crop/rotate, KB-range JPEG search, signature cleanup, optional name/date strip and measurable checks. Production checks passed 19/19; see `EXAM_FORM_KIT_PLAN.md`.
- [ ] Refresh historical presets only when a new cycle's primary notice and portal requirements are verified. Keep undocumented exams on the custom path.

### WorkKit

- [x] Show total work time as both decimal hours and hours/minutes; suppress partial totals when any entered shift is invalid.
- [x] Add browser print / Save as PDF for complete timesheets, alongside CSV export.
- [x] Add USD, INR, GBP, EUR, CAD, AUD and AED formatting in all WorkKit pay calculators; currency selection does not convert rates.
- [x] Add a separate overtime pay currency view with dated Frankfurter daily reference rates. Pay and hours remain local; only currency codes are sent for lookup. Browser verification is recorded in `WORKKIT_OVERTIME_CURRENCY_PLAN.md`.
- [ ] Add biweekly periods, 5/7-day templates and extra break entries only after a separate calculation and mobile UX review.

### Competitor review

- [x] Review public workflows and third-party traffic estimates for calculator.net, QuickBooks Time Card Calculator, TimeCardCentral, ResizePixel and ImResizer.
- [x] Record feature takeaways and originality boundaries in `reference-notes/workkit-formready-competitor-review.md`.

## Launch follow-ups

- [x] Link Contact pages to the public Utilities GitHub issue tracker; no personal email is exposed.
- [ ] Optionally connect a custom domain after choosing and registering it; free Pages hostnames are live now. See `HOSTING_MIGRATION.md`.
- [x] Verify all three sites in Google Search Console and submit their sitemaps. WorkKit and FormReady sitemap fetch status still needs follow-up; submission is not proof of indexing. QuickKit setup is complete.
- [ ] Review crawl/index status after launch; indexing and ranking are not immediate or guaranteed.
- [ ] Configure privacy-safe analytics only after selecting a provider and confirming consent/disclosure needs. No analytics is enabled now.
- [ ] Apply for an ad network only after useful traffic/content exists; ad code is not enabled and approval/revenue are not guaranteed.
- [x] Publish original 1200×630 social preview PNGs and `og:image`/Twitter metadata on all sitemapped pages.
- [ ] Complete keyboard, assistive technology, touch-gesture, storage-failure and image edge-case checks listed in `BROWSER_QA_CHECKLIST.md`.
- [x] Deploy and recheck QuickKit text extraction, same-style text-run editing, page/photo reordering and bulk-filter changes in a fresh visible production browser tab; immutable deploy `https://bc29f5ca.quickkit-browser-tools.pages.dev`.
- [x] Deploy on-page direct text editing and immediate preview; pass the 50-check PDF editor suite and 23-check document/photo suite against `https://quickkit-browser-tools.pages.dev`. Visible production browser verifies direct page-click replacement, deletion and updated preview. New immutable deployment: `https://c16ede3e.quickkit-browser-tools.pages.dev`. Screenshot: `qa-results/pdf-editor-production/on-page-edit-preview-proof.png`.

## Evidence and limits

- Browser pass/fail details: `qa-results/browser-qa-results.json` and `qa-results/production-smoke-results.json`.
- Repeatable browser scripts: `scripts/browser-qa.mjs` and `scripts/production-smoke.mjs`.
- Design direction and remaining product decisions: `DESIGN.md` and `PRODUCT.md`.
- Temporary research artifacts and exact source analysis: `reference-notes/README.md`.
- Local production builds use Vite. The current static apps have no account system, database or server-side file processing.
- Traffic, indexing speed, ad approval and earnings depend on external services and user demand.
- AdSense eligibility notes for `pages.dev` and the three site-by-site approval flow are in `SEO_ADSENSE_PLAN.md`; none of the sites currently serves ads.

## Private sample-file QA clarification — 2026-10-30

Owner-supplied PDFs, a DOCX, an image and a QR image were tested in a local production build. The files and file-specific reports remain on the owner's device and are intentionally excluded from this public repository. The browser observed no file-upload requests or runtime errors.

- The PDF samples exercised selectable-text extraction, DOCX export, image-only pages requiring OCR, supported direct text replacement/deletion, and image-to-PDF filters and page settings.
- OCR detected regions on image-only pages after grayscale/contrast preprocessing. OCR replacement creates a mask and editable overlay; it does **not** edit scanned pixels directly. Every transcription and mask needs visual review.
- Direct editing remains limited by font maps, glyph coverage and line width. It does not make every PDF font editable; Type0/CID and image-only documents may need separate editing/OCR flows.
- DOCX print preview does not automate the browser's native print dialog. Image-to-PDF export reopened with the tested page settings.
- Private sample replacement/deletion exports were reopened and checked for expected text-layer changes. OCR output still requires visual review.
