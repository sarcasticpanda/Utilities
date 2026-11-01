# Project TODO

All three sites are live on Cloudflare Pages, and QuickKit’s PDF editor is live. The earlier Sites URLs remain public fallbacks. A custom domain is optional and not purchased. Product history is in `IMPLEMENTATION_TRACKER.md`; hosting requirements are in `HOSTING_MIGRATION.md`.

## Before the next public update

- [x] Publish the QuickKit multi-range video trim update; stable production full video suite passed 37/37 and focused multi-range suite passed 9/9.
- [x] Publish the Trim/Crop usability fix: visible plus action and saved list for five-plus parts, task-specific timeline visibility, freeform crop draw/move/resize, and zoom in/out. Stable production browser verification passed 45/45 full video and 11/11 focused range checks.
- [ ] Recheck Search Console sitemap fetch status and inspect indexed URLs/impressions after Google recrawls. Current live robots/sitemap and metadata audit passed, but this does not prove indexing.
- [ ] Complete the remaining keyboard, touch, screen-reader, low-memory mobile and file-edge-case checks in `BROWSER_QA_CHECKLIST.md`.
- [x] Add original Open Graph images and practical, internally linked guides across all three sites.
- [ ] Re-run a fresh Lighthouse/CrUX review after the current deployments; the recorded Lighthouse numbers are from 2026-10-31.

## Growth and monetization work

- [ ] Add privacy-safe analytics after selecting a provider and confirming disclosure/consent requirements; do not record files, passwords, images, timesheet details or pay values.
- [ ] Add ads only after approval; keep ad slots separate from upload, calculate and download controls.
- [ ] Review search impressions, page performance and visitor behavior before expanding tool lists or publishing more pages.
- [ ] Check `lunarpandatools.com` and fallback `lunarpanda.tools` in Cloudflare Registrar; verify the exact renewal price and availability before purchase.
- [ ] Attach custom subdomains only after the domain is registered; verify DNS and HTTPS before switching canonical URLs.

## Product backlog

- [ ] WorkKit: consider biweekly timesheets, 5/7-day templates, duplicate-shift entry and multiple breaks after a separate calculation and mobile UX review.
- [x] QuickKit: photo-to-PDF workflow with gallery selection, crop/rotate/filter, reorder, paper settings and local export.
- [x] QuickKit: DOCX print preview, selectable-text PDF-to-DOCX export, all-page text extraction, and image-filter export regression checks.
- [x] QuickKit: English OCR text copy, detected-region redaction and masked editable replacement; raster export removes original page text.
- [x] QuickKit: add browser-only direct PDF text replacement/deletion for a clearly bounded subset, with qpdf-WASM writing, PDF.js output checks, width refusals and OCR fallback. Details and remaining device review: `PDF_SOURCE_TEXT_EDITING_PLAN.md`.
- [x] QuickKit: verify image-to-PDF gallery include/exclude, drag order, crop/rotation/filter, margins, orientation and downloadable page order in browser QA.
- [x] WorkKit: add dated reference-rate conversion to overtime; verify math, source/target currency-only API requests, same-currency handling and refresh.
- [ ] QuickKit: add PDF splitting and additional conversion formats after defining fidelity requirements and mobile memory limits.
- [x] FormReady: implement the Exam Form Kit with source-linked, cycle-labeled presets, custom rules, crop/rotate, JPEG size-range search, signature cleanup, optional stamp and measurable checker. Production QA passed 19/19; current preset cycles are historical, so newer rules must be source-verified before replacing them.
- [x] QuickKit: add up to three soundtrack tracks with independent source trims, output placement, volume and original-audio controls; verify the mixed output with known audio tones in Chromium and Firefox.
- [x] QuickKit: add a local GPS photo tool with manual/current location, optional visible stamp and GPS EXIF read-back verification; test signed coordinates and stamp on/off.
- [x] QuickKit: deploy the soundtrack editor and geo-photo routes; stable production passed 24/24 video checks and 14/14 geo-photo checks. The latest immutable deployment is in `IMPLEMENTATION_TRACKER.md`.
- [x] QuickKit: implement multiple saved trim ranges on one video, keep/remove mode, draggable saved range handles, overlap checks, and preview/export; stable production Chromium checks passed 37/37 full video and 9/9 focused range tests.
- [ ] QuickKit: rework the Q mark to read clearly as a document/tools brand, and add a real feedback form after deciding where feedback should be stored; never display fabricated star ratings.
- [ ] QuickKit: diagnose brand/domain discoverability and Search Console coverage, then improve SEO using measurable query and index data. Search position and AdSense approval are not guaranteed.
- [ ] After the core tools are stable, evaluate a separate social-media utility site with official/authorized access only; do not build it into QuickKit.

## Release facts

- [x] Three Cloudflare Pages sites are public; live status and URLs are in `VISIBILITY_AND_DEPLOYMENT_CHECKLIST.md`.
- [x] All three Pages projects are deployed; the earlier Sites releases remain available as fallback.
- [x] All three builds passed; earlier responsive Chromium sweep passed 79 checks with 0 failures; latest PDF editor passed 40/40 and document/filter workflow passed 15/15 against production. Full cross-site production smoke passed 14 routes with 0 failures, including the converter.
- [x] Publish the document-converter release after visible-browser checks; 15 document/filter checks and 40 PDF-editor checks passed against the production URL.
- [x] Final screenshots and machine-readable QA evidence are in `qa-results/`.

## Current release QA — 2026-11-01

- [x] Full live multi-site regression: 92/92 after correcting a test selector ambiguity introduced by the new FormReady checker copy.
- [x] QuickKit PDF editor 62/62; document conversion/OCR/image-to-PDF 29/29; owner-supplied PDF OCR/DOCX reopen and direct-text edit/delete exports passed. Private-file evidence is kept locally.
- [x] QuickKit video editor/soundtrack mixer 24/24; geo-photo EXIF writer 14/14; final SEO live crawl 19 sitemap URLs / 34 internal routes / 0 failures.
- [x] FormReady Exam Form Kit 19/19 on `https://f6f99981.formready-photo-tools.pages.dev`; new visible browser tab inspected.
- [x] SEO guide browser checks 16/16; live crawl 18 sitemap URLs and 33 linked routes, 0 failures.
- [ ] Search Console must be rechecked for indexing/impressions; the site cannot promise a top-10 position, AdSense approval or revenue.

Search traffic, indexing speed, ad approval and revenue are external outcomes, not promises of a same-day launch.
