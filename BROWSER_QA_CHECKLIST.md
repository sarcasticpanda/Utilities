# Browser QA checklist and evidence

## Editable download filenames — 2026-11-02

- [x] Added a shared, responsive filename field to generated downloads across QuickKit, WorkKit and FormReady. The filename stem is editable while the actual output extension stays fixed to the file format.
- [x] Verified actual renamed downloads for image-to-PDF, image compression, Wi-Fi QR, PDF editor output, PDF merge, WorkKit CSV, and FormReady prepared images. Browser download names matched the chosen value and correct extension.
- [x] Verified PDF-to-DOCX, PDF editor TXT and Word extraction names; DOCX-to-PDF reflects the chosen name in the print preview title; WorkKit print/PDF passes its chosen name to the browser print flow.
- [x] Verified video export rename after compression and geo-tagged JPEG rename after GPS metadata export.
- [x] Mobile layout passed at 390px for Image to PDF, WorkKit and FormReady; the fields fit inside the viewport without horizontal overflow. Screenshots: `qa-results/download-filenames/`.
- [x] Browser regression: filename suite **19/19**, document/OCR/photo suite **36/36**, video suite **47/47**, geo-photo suite **38/38**; all three production builds passed.
- [ ] Native browser print dialogs vary by browser and OS. Confirm the suggested Save as PDF name in a real Chrome/Edge print dialog; users can still change the name there before saving.
- [x] Deployed to the stable Cloudflare Pages aliases. Immutable deployments: QuickKit `https://baa3214b.quickkit-browser-tools.pages.dev`, WorkKit `https://8463d42c.workkit-hours-tools.pages.dev`, FormReady `https://6cb44bdb.formready-photo-tools.pages.dev`.
- [x] Rechecked the live stable aliases: filename suite **19/19**, document/OCR/photo suite **36/36**, video suite **47/47**, and geo-photo suite **38/38**. This includes the download name fields and actual chosen filenames for generated files.

## QuickKit geo-photo place lookup release — 2026-11-01

- [x] Deployed map search, reverse-geocoded place labels and a draggable precision pin to stable QuickKit; immutable deployment: `https://8b151773.quickkit-browser-tools.pages.dev/geo-photo.html`.
- [x] `npm run qa:geo-photo`: **28/28 passed on the immutable production URL**. Covered place search/result selection, draggable and tapped map-pin coordinates, manual coordinates, reverse lookup, GPS EXIF export/read-back, date/stamp options, visible camera flow, GPS timeout messaging, 390px/320px layout and browser errors.
- [x] Live page and geo-photo JavaScript both returned HTTP 200; visible browser tab opened at the immutable release and page controls, place-lookup privacy copy and location fallback were inspected.
- [x] `npm run qa:geo-photo-live-map`: **2/2 passed against the stable production URL**; real map tiles loaded with visible attribution at 1440px and 390px, with no horizontal overflow. This visual check sent no place query or coordinates. Screenshots and report: `qa-results/geo-photo-live-map/`.
- [x] `npm run qa:seo-live`: **19 sitemap URLs / 34 linked routes / 0 failures** across QuickKit, WorkKit and FormReady after deployment.
- [x] Place search and reverse lookup only contact OpenStreetMap after the user presses the respective button. No autocomplete is enabled. The user is told that the returned place label is an approximate map result and does not prove physical presence.
- [ ] Confirm browser permission and the device OS Location Services/Wi-Fi/GPS on a real phone/laptop. Automated geolocation and camera tests use simulated devices; this environment cannot verify the user's live hardware fix.

The browser script and machine-readable evidence are in `scripts/browser-qa.mjs` and `qa-results/browser-qa-results.json`. Final screenshots are in `qa-results/screenshots-polished/`. On 2026-11-01, production all-site interaction and responsive regression passed **92/92**; PDF editor **62/62**; document/photo/PDF **29/29**; video tools **17/17**; FormReady Exam Form Kit **19/19** on immutable release `https://f6f99981.formready-photo-tools.pages.dev`; supplied-PDF OCR/DOCX reopening **8/8**; supplied-PDF direct-text scan plus replacement/deletion export **8 files / 2 actual edits / 0 failures**; SEO guides **16/16**; and live crawl **18 sitemap URLs + 33 linked routes / 0 failures**. The all-site run first caught a strict selector ambiguity after the new checker added a second explanatory details paragraph; the test was corrected to read the output value, then the suite passed. Lighthouse production mobile lab results from 2026-10-31 are in `tmp/lighthouse-*-production-final.json`: QuickKit 77 performance / 100 accessibility / 100 best practices / 100 SEO (LCP 4.1 s, CLS 0, TBT 0); WorkKit 98/100/100/100 (LCP 2.1 s, CLS 0.026, TBT 0); FormReady 98/100/100/100 (LCP 2.0 s, CLS 0.003, TBT 0). These are repeatable lab audits, not real-user CrUX measurements.

## Test setup

- [x] All three Vite production builds completed successfully.
- [x] Local preview servers returned HTTP 200 for all three home pages.
- [x] Playwright Chromium loaded all primary routes at 1440×900, 768×1024, 390×844 and 320×740.
- [x] 24 screenshots captured: each of the 12 home/tool routes at desktop and phone widths.
- [x] The recorded browser requests contain no non-GET request; local development assets and Google Fonts were requested.
- [x] The browser report records Chromium version, tested routes/viewports and functional scenario results.
- [x] Previous Sites version 3 browser smoke checks are retained below as historical release evidence.
- [ ] Completed-result screenshots are not included for every task page; test values and outcomes are recorded in the JSON report.

## Shared visual and accessibility checks

- [x] No horizontal page overflow on the 12 primary routes at all four tested widths.
- [x] Headers, task content and footers fit the tested viewports.
- [x] Tool routes expose a clear H1 and visible controls at tested widths.
- [x] Page errors and console errors were absent on the layout-sweep routes.
- [ ] Keyboard-only path, focus order and focus visibility need a dedicated pass.
- [ ] Tap target sizes and crop gestures need a real touch-device pass.
- [ ] Reduced-motion preference, contrast and screen-reader output need a dedicated accessibility pass.

## WorkKit

- [x] Add a second shift and calculate overnight hours with a break: 15.50 hours and $310.00 at $20/hour.
- [x] Local draft restores both rows and the hourly rate after reload.
- [x] CSV download is offered with the expected filename.
- [x] 45 hours at $20/hour with a 40-hour threshold estimates $950.00 gross overtime pay.
- [x] Identical start and end times show a clear validation message.
- [x] WorkKit displays both decimal totals and hours/minutes.
- [x] Invalid shifts suppress totals instead of leaving partial weekly results visible.
- [x] Print / Save PDF invokes the browser print flow for a complete timesheet.
- [x] WorkKit formats estimates in USD and INR, persists the selection locally and updates the visible rate symbol.
- [x] Overtime and salary calculators reformat estimates in the selected currency without exchange-rate conversion.
- [ ] Remove/edit boundary checks, excessive breaks, malformed saved data and blocked localStorage need additional scenarios.
- [ ] Connected transfer between separate tool pages needs an explicit check.

## QuickKit

- [x] Image file selection, compression result preview, measured-size summary and download link render.
- [x] Text cleanup trims line whitespace and removes duplicate lines.
- [x] Password generation respects the requested 24-character length.
- [x] Wi-Fi QR canvas decodes with escaped network name and password.
- [x] Two valid one-page PDFs merge into a loadable two-page PDF download.
- [x] Dedicated PDF editor Chromium workflow passes 62 checks, including direct clicking to open an inline editor; immediate preview changes after replacement and deletion; unsupported-width refusal and output text-layer checks; OCR, annotations, pages, mobile widths and local-only processing.
- [x] Direct text changes redraw the page from the edited PDF before download; canvas pixel checks confirm the visible page changes. Live screenshot: `qa-results/pdf-editor-production/on-page-edit-preview-proof.png`.
- [x] PDF editor screenshots inspected at desktop, 390px phone and 320px narrow-phone widths. Evidence: `qa-results/pdf-editor/results.json` and `qa-results/pdf-editor/`.
- [ ] Test large real-world PDFs and low-memory mobile devices; file size is capped at 100 MB but device memory varies.
- [ ] Click/open verification of the image-compressor download, unsupported files, unattainable targets and reset/object-URL cleanup need additional scenarios.
- [ ] Clipboard permissions and copy feedback need a browser permission pass.
- [x] DOCX → PDF preview and print invocation, split text PDF → DOCX, scanned-PDF feedback, all-page text extraction and Word export; `qa:quickkit-documents`. Automated coverage verifies the browser print call, but does not operate the native print dialog.
- [x] Filter changes update the Cropper preview and final downloaded PDF pixels; `qa:quickkit-documents`.
- [x] Extraction results panel stays hidden before use and opens when Extract text is clicked; output contains text across all pages.
- [x] Two-photo queue drag reorder, select/deselect all, applying one filter to every photo, two-page landscape export and 20 mm page margins on both pages; verified from rendered output pixels.
- [x] Direct editor handles adjacent same-style `Tj` runs and simple `TJ` arrays; output text stays selectable after replacement and original text is removed.
- [x] PDF page thumbnail drag changes order and undo restores it.
- [x] Verify current change set against the live Pages site in a fresh visible browser tab after deploy; all-page text extraction displayed four lines from two pages and enabled TXT/Word downloads.
- [ ] DOCX → PDF native Save-as-PDF dialog, keyboard-only path, assistive technology, touch crop gestures, storage failures and large low-memory PDFs need additional manual checks.
- [x] Fresh production release: PDF editor and document converter suites pass 51/51 and 29/29 respectively; OCR ran on all scanned pages and all eight DOCX results reopened. The handwriting/scanned-only sample produced incomplete OCR (about 332 characters across two pages), so human correction is required and accuracy is not accepted as verified.
- [x] Fresh production video suite: compression, trim, join, same-file section cut, audio, export reopen, ordered-frame pixels and mobile overflow pass 17/17 in Chromium. Firefox previously passed 17/17. WebKit capability fallback passed 4/4 but that runner lacks WebCodecs; Safari remains unverified.
- [ ] Performance follow-up: QuickKit's production mobile Lighthouse score is 77. The largest flagged issue is about 240 KiB of unused JavaScript (including the PDF worker); investigate deferring PDF.js/worker loading until a PDF is opened, then rerun feature suites and Lighthouse before deploying.

## FormReady

- [x] A local test image opens the crop interface and exports a 120×140 JPEG.
- [x] Measured dimensions and file size pass the entered requirements in the UI.
- [x] The prepared-image download starts and Clear removes the cropper/result.
- [x] Rotate-left and reset-crop controls work in the local browser flow.
- [x] Physical dimensions convert from 35×45 mm at 300 DPI to 413×531 px.
- [x] Mode-switching no longer throws when the tool intro label is absent; changing requirements clears stale output.
- [x] No preset is labeled verified; the preset list is empty and the independent-service disclaimer is visible.
- [ ] Touch crop/pan/zoom, transparent signature, EXIF rotation, unsupported input and very small size targets need additional scenarios.

## Sign-off

| Product | Layout coverage | Functional evidence | Console/network | Result |
|---|---|---|---|---|
| WorkKit | 4 widths, 4 routes | Overnight + break, local restore, CSV link, overtime, equal-time validation, HH:MM, invalid-total guard, print flow, INR formatting | No non-GET; no layout-sweep console errors | Pass with follow-up checks listed above |
| QuickKit | 4 widths, 7 routes | Image-to-PDF route, image compression result/link, text cleanup, password, decoded QR, valid PDF merge; PDF editor separately tested with 32 functional checks | No non-GET; no layout-sweep console errors | Pass with follow-up checks listed above |
| FormReady | 4 widths, 2 routes | Crop UI, exact output check, download, clear, rotate/reset, physical-unit conversion, stale-result clearing | No non-GET; no layout-sweep console errors | Pass with follow-up checks listed above |

## Production smoke — previous Sites version 3 (historical)

- [x] Public routes returned HTTP 200: WorkKit 4 pages, QuickKit 5 pages, FormReady 2 pages.
- [x] All 11 routes had an H1, matching HTTPS canonical URL, no horizontal overflow and no browser console/page errors.
- [x] Each public sitemap and `robots.txt` returned HTTP 200.
- [x] WorkKit overtime interaction returned $950 for 45 hours at $20/hour after a 40-hour threshold.
- [x] QuickKit text cleanup worked on the deployed page.
- [x] FormReady cropped/test image interaction returned the requested 120×140 dimensions and ready state.
- [x] No application feature upload requests were observed. Three first-party Cloudflare browser security challenge POSTs were observed separately; they are not tool uploads.

Production evidence: `qa-results/production-smoke-results.json`; production desktop/mobile screenshots: `qa-results/production/`.

## Production smoke — Cloudflare Pages release

- [x] All 13 deployed homepage/tool routes returned HTTP 200, valid H1/canonical metadata, no horizontal overflow, and no browser page or console errors.
- [x] Deployed sitemaps and robots.txt files returned HTTP 200.
- [x] WorkKit overtime, QuickKit text cleanup, and FormReady crop flows passed on the public Pages sites.
- [x] QuickKit PDF editor passed all 40 dedicated production checks, including OCR replacement/redaction, local-only file processing, edit/undo, export readability and mobile widths.

Production evidence: qa-results/production-smoke-results.json and qa-results/pdf-editor-production/results.json.

Latest full production sweep: `node scripts/production-smoke.mjs` — 14 routes, 0 failures. QuickKit document/filter suite — 15/15 against production; PDF editor — 40/40 against production.

## Real user-file verification — 2026-10-30

Owner-supplied files were exercised in a local production build so their contents stayed on the device. The browser run observed **zero non-GET requests** and zero browser errors. File-specific reports and source documents are kept locally and are not published in this repository.

- [x] A four-page mixed PDF opens; selectable text is extracted where available and image-only pages require OCR.
- [x] A one-page resume sample opens and extracts selectable text; a readable DOCX package is created. The direct-edit scan finds 244 selectable runs in its embedded Type1 fonts; replacement and true text deletion both exported and passed text-layer verification.
- [x] A two-page handwriting sample has no selectable text, so PDF-to-Word correctly stops instead of making a blank file. Locally, OCR found regions on both pages; an OCR replacement mask/overlay was exported and the resulting two-page PDF reopened in the editor. Recognition still needs user review.
- [x] A one-page circular PDF opens, extracts selectable text and offers a Word export.
- [x] A one-page technical PDF opens, extracts 60 lines and offers a Word export.
- [x] A one-page project PDF opens, extracts 65 lines and offers a Word export.
- [x] A one-page PDF and a multi-page technical PDF opened, extracted selectable text and offered Word exports.
- [x] A supplied DOCX preview rendered in the browser. The automated test verifies the browser print/Save-as-PDF flow, but does not operate the native print dialog.
- [x] Supplied image and QR samples loaded into Image to PDF; filters were applied and the exported two-page PDF reopened with landscape pages and a 15 mm margin.
- [x] The synthetic supported-font regression still passes real replacement/deletion and output text-layer checks; PDF editor suite: **44/44**. Document/photo/PDF suite: **23/23**.
- [x] In-place replacement and deletion are verified on owner-supplied PDFs. Replacement characters must exist in the embedded subset and fit within the original line. Embedded Type0/CIDFontType2 Identity-H fonts with usable ToUnicode maps and CID widths are supported; custom/vertical CMaps and unusual transforms may still be refused. Scanned pages still need OCR.
- [ ] Direct editing has not been output-verified on every PDF layout. Do not imply broad compatibility with all embedded fonts or arbitrary replacement glyphs.
- [x] Image-only pages in a supplied mixed PDF were tested with OCR and require human accuracy review.
- [x] Deployed to Cloudflare Pages and repeated source-text replacement/download in a fresh visible tab using an owner-supplied PDF. Production verified the output text layer and showed “Your edited PDF is ready.”

## OCR preprocessing and supplied scan recheck — 2026-10-31

- [x] Wait for each PDF page canvas to finish rendering before starting OCR; this prevents false zero-result readings from the browser test.
- [x] Normalize scanned page OCR input to grayscale, increase contrast, and upscale within a 3,000 px edge cap. Page overlay coordinates remain aligned with the displayed PDF page.
- [x] Add a 60-second per-page OCR timeout and worker reset so one pathological page cannot keep the tool busy indefinitely.
- [x] Local production preview: image-only pages in two supplied PDFs returned 21, 3, 21 and 3 OCR regions. Pages with selectable text were skipped by this scan-only pass.
- [x] Real scanned academic page: OCR selection created a mask and editable replacement overlay within the page bounds; exported two-page PDF was readable and reopened in the editor.
- [x] Browser run recorded zero page/console errors and zero non-GET requests; OCR text itself was not persisted in the audit report.
- [ ] Human review of recognized handwriting, line-by-line OCR accuracy, and visual redaction coverage remains required. Region detection does not guarantee accurate transcription.
- [x] Deployed OCR preprocessing/recovery; production scan and separate replacement/export/reopen checks passed on the supplied PDFs.

## PDF-to-Word OCR review flow — 2026-10-31

- [x] Added browser-local OCR for up to 30 image-only English pages per PDF, editable per-page review, low-score warnings, cancellation, and DOCX export that combines recognized and selectable page text.
- [x] Generated mixed-PDF fixture: known image text was recognized; corrected OCR text and the selectable second page both survived DOCX export and reopen.
- [x] Blank scanned page does not silently create an empty Word file; cancellation stops the worker and restores the converter.
- [x] `npm run qa:quickkit-documents` on stable production: 29/29 browser checks, including 390 px OCR review layout.
- [x] `npm run qa:pdf-ocr-supplied` on stable production: 8/8 supplied PDFs produced Word files that reopened. The two scanned files had two scanned pages each. No raw OCR text is retained in the report.
- [x] Handwritten scanned pages scored 34–46/100 across repeatable runs. Scores vary and are confidence signals, not accuracy measurements; transcription needs user correction.
- [x] Rechecked both pages of the supplied handwritten academic PDF after cropping blank margins, 2× upscaling, grayscale/contrast, adaptive thresholding, ruled-line removal, and Tesseract page-segmentation modes 3 and 6. The variants produced inconsistent text and confidence (including high-confidence empty output and extra false positives); none was a defensible accuracy improvement. No OCR transcript was saved from this experiment. Keep user review and low-confidence warnings; do not silently replace the default with an unvalidated preset.
- [ ] Human verification of every OCR word against the scan is still required. The converter does not claim accurate handwriting recognition or exact source layout.
- [x] Tested a browser TrOCR alternative on the supplied handwriting: bad Tesseract line segmentation and manually aligned/ink-cleaned crops still yielded wrong obvious words. It was rejected for this release; details and licensing caveat are in `reference-notes/handwriting-ocr-benchmark.md`.
- [ ] Handwritten OCR accuracy remains unverified. A future candidate needs clear commercial-use terms, labeled ground truth for supplied sample pages, line/layout segmentation, measured CER/WER, browser load-time and memory checks.

## Direct PDF text editing — Identity-H and split-glyph files — 2026-10-31

- [x] Added safe support for embedded Type0/CIDFontType2 Identity-H fonts when the PDF supplies a usable ToUnicode map, embedded font file and CID widths.
- [x] Grouped same-style, same-baseline adjacent text operations, including character-by-character `Tj` operations, into editable line runs. Added clickable overlays spanning PDF.js text items so these runs can be opened directly from the page.
- [x] Added full normalized page text-layer verification before export; text that cannot be confirmed is not downloaded.
- [x] Scanned the owner-supplied PDFs on production; supported selectable text was exposed for direct editing while image-only pages correctly required OCR.
- [x] Clicked actual page targets, replaced and deleted text, updated previews, downloaded/reopened the PDFs and verified output text. No browser errors or non-GET requests.
- [x] Production `npm run qa:pdf-editor`: 51/51, including split-run on-page target, source replacement/deletion, export validation, 390 px and 320 px layouts.
- [ ] Test further PDFs with custom CID maps, rotated/vertical text and transformed content; unsupported layouts must remain explicitly refused.
- [x] Deployed as `https://b2905689.quickkit-browser-tools.pages.dev`; stable production passed the full PDF editor suite (51/51) and supplied-file inline edit/replacement/deletion checks. Stable site: `https://quickkit-browser-tools.pages.dev/pdf-editor`.

## QuickKit video and geo-photo workspaces — 2026-11-01

- [x] Latest production release `https://70ef03f6.quickkit-browser-tools.pages.dev` deployed; stable alias `https://quickkit-browser-tools.pages.dev` also retested.
- [x] Video browser suite passed **30/30 on the immutable release and 30/30 on stable production**. Added crop presets/framing and direct “remove selected section”; generated output dimensions and frame pixels confirm crop and removed-range behavior. Compression, trim, reorder/join, soundtrack source trims/placement/mix, audio mute, re-opened exports and 390/320px layouts passed.
- [x] Moved the “Use camera” action above the photo preview so it is visible before the fold on mobile; added a nearby camera status for permission, ready, denial and capture states. The live stream appears in the main preview area and the normal photo preview returns after capture, close or reset.
- [x] Geo-photo suite passed **20/20 on the immutable release and 20/20 on stable production**. Camera visibility at 390px, capture and reset cleanup, lazy map selection, exact coordinate handoff to Google Maps, JPEG GPS EXIF read-back, geolocation/stamp options and 390/320px layouts passed. Camera testing used Playwright's fake camera and permission; an actual device camera still needs owner confirmation on that device.
- [x] Opened both deployed pages in fresh visible browser tabs and inspected the available controls and notices.
- [ ] Real phone, real camera, Safari/iOS, low-memory performance, unusual codecs and larger/corrupt media still need device-specific checks.

- [x] Added `/video-tools.html` with compress, trim, join-and-cut tasks, previews, clear status, progress/cancel controls, drag/drop, and a mobile layout. Linked from the homepage and sitemap.
- [x] Production build completed with `npm run build:quickkit`.
- [x] Existing `npm run qa:video-tools`: compression, trim, multi-clip join, same-file cut, export reopen and ordered-frame checks passed before soundtrack work.
- [x] Added up to three local soundtrack tracks; each source can be trimmed, placed on the joined output timeline, removed and volume-adjusted. Original clip audio can be muted or adjusted independently.
- [x] `npm run qa:video-tools`: **24/24 Chromium and Firefox** on a local production build. Tests decoded output and sampled known tones to confirm two soundtracks appear only in their requested time ranges, source trims are used, original audio can be muted, mixed output reopens, and video order remains correct.
- [x] Added `/geo-photo.html`: local photo input, explicit browser geolocation permission or manual GPS, optional location/date stamp, JPEG EXIF GPS embedding and read-back verification, and local download. App policies explain exact-location sharing.
- [x] `npm run qa:geo-photo`: **14/14 Chromium** on a local production build. Signed GPS metadata matched the input coordinates to 1e-7 degrees; PNG became JPEG without changing pixel dimensions; geolocation, stamp on/off, reset, output, 390px and 320px layout passed.
- [x] Updated project screenshots in short sections for the README; screenshot review found and fixed inline checkbox-label wrapping.
- [x] Compression export reopened and played; the output retained an audio track. Compression makes no fixed file-size promise.
- [x] A 0.5–1.7 second trim exported as a playable ~1.2 second clip with audio; output reopened in the tool.
- [x] Two clips joined into a playable ~6.3 second output with audio; output reopened in the tool.
- [x] Two retained intervals from one source joined into a playable ~2.1 second middle-cut output.
- [x] At 390 px viewport, no horizontal page overflow; no page or console errors in the tested run.
- [x] Visible local tab opened at `http://127.0.0.1:4175/video-tools.html` for UI review.
- [x] Deployed the original video tools to `https://52e49277.quickkit-browser-tools.pages.dev`; its original 17/17 suite passed on stable production.
- [x] Playwright WebKit fallback and 390px mobile checks passed 4/4; this WebKit build lacks WebCodecs, so Safari media editing still needs a real Safari test.
- [x] OCR scan recognition was rerun against the supplied files in production: merged PDF pages 2–3 returned 21 and 3 regions; academic PDF pages 1–2 returned 21 and 3 regions. The academic replacement/export/reopen flow passed separately.
- [ ] Human review of OCR transcription accuracy and visual redaction coverage remains required; detected-region counts are not an accuracy guarantee.
- [x] Deployed the expanded soundtrack and geo-photo release to stable QuickKit; latest immutable deployment: `https://09059e89.quickkit-browser-tools.pages.dev`.
- [x] Rechecked stable production: video editor **24/24**, geo-photo **14/14**, PDF editor **62/62**, documents/OCR/image-to-PDF **29/29**, and cross-site regression **92/92**. Video and geo suites were rerun after the final metadata-only redeployment; PDF/document/cross-site live results were from the same application code before that metadata-only change.
- [x] Live SEO crawl after the final deployment: **19 sitemap URLs / 34 linked routes / 0 failures**, including `geo-photo.html`; `robots.txt`, sitemap XML, canonical, title, description, indexability and 1200×630 social image checks passed. Report: `qa-results/seo-live-audit.json`.
- [x] Opened the deployed video editor and geo-photo page in fresh visible browser tabs and reviewed their accessible controls and safety copy.
- [ ] Test real Safari/Edge/iOS/Android devices, cancel/error/large-file behavior, rotation metadata, mixed codecs and variable-frame-rate cases.
- [x] A combined live audit timed out while waiting for the large merged-PDF export to render after re-upload. The OCR scan pass and the academic-PDF export/reopen pass then passed as separate runs.

## SEO content and responsive guide checks — 2026-10-31

- [x] Added a QuickKit PDF text/OCR explainer, a WorkKit hours/overtime guide, and a FormReady photo/signature requirements guide. Each guide links to the matching tool and is linked from its homepage footer and sitemap.
- [x] `npm run build` passed for WorkKit, QuickKit and FormReady with the new guide routes.
- [x] `npm run qa:seo-guides` passed 16/16 Chromium checks across all three production builds: homepage discovery link, HTTP 200, title/H1 and original body content, canonical URL, tool action, 390px mobile overflow and zero browser errors.
- [x] Captured desktop and mobile visual review screenshots in `qa-results/seo-guides/`.
- [x] Deploy the three guides and pass 16/16 browser checks on the stable public sites.
- [x] Audit all 18 sitemap URLs and 33 internally linked live HTML routes across the three sites: every route returned HTTP 200 with a matching canonical, title, description, indexability and social-image metadata; all `robots.txt` and sitemaps returned HTTP 200 and robots referenced the sitemap. Report: `qa-results/seo-live-audit.json`.
- [x] All three URL-prefix properties are verified in Search Console and all sitemap submissions were accepted. On 2026-11-01, WorkKit/FormReady sitemap tables show “Couldn't fetch”; their sitemap URLs return HTTP 200 and valid XML to a Googlebot user agent, so fetch status remains unresolved and needs a later recheck. Live crawl checked all 18 sitemap URLs and 33 linked HTML routes with 0 failures; this does not prove Google indexed them. Ranking/top placement is not guaranteed. See `GOOGLE_LAUNCH_HANDOFF.md`.

## FormReady Exam Form Kit and refreshed SEO — 2026-11-01

- [x] Verified production preset data, source/cycle labels, custom values, export format/dimensions/size checks, inclusive JPEG KB range, signature paper cleanup, optional stamp, impossible-range handling and 390px/320px cropper fit: **19/19** on `https://f6f99981.formready-photo-tools.pages.dev`.
- [x] Opened the deployed Exam Form Kit in a new visible in-app browser tab and inspected the accessible controls, source notes, custom path, crop actions, output checker, disclaimers and footer links.
- [x] Expanded the original FormReady guide with useful, non-guaranteeing answers about KB targets, signature cleanup, historical presets and optional stamping; guide browser checks passed 16/16 on production.
- [x] SEO technical crawl passed: robots/sitemaps returned 200; 18 sitemap URLs and 33 internal routes had valid titles, descriptions, canonical and social metadata with zero crawl failures.
- [ ] Check Search Console for actual indexed URLs, queries and impressions after Google recrawls; submit the updated FormReady sitemap if it is not automatically reprocessed. A sitemap/crawl check is not evidence of indexing or a top-10 result.
- [ ] Remaining device/accessibility checks in this file still require real touch, keyboard, assistive technology and low-memory mobile coverage.
- [ ] AdSense account ownership, identity/payment setup and review require the owner; no placeholder ad code or publisher ID should be deployed.

## AdSense policy readiness update — 2026-10-31

- [x] Added a truthful conditional advertising-cookie disclosure to all three privacy pages. It says ads are currently disabled, describes future Google/partner cookies and links to Google Ads Settings and AboutAds.
- [x] Deployed to QuickKit `https://6980c2c0.quickkit-browser-tools.pages.dev`, WorkKit `https://74b54bd3.workkit-hours-tools.pages.dev` and FormReady `https://f9d913d3.formready-photo-tools.pages.dev`; each privacy page returned HTTP 200 and contained the disclosure.
- [x] Reran production QA against the stable aliases after deployment: PDF editor 51/51, document/photo/PDF 29/29, supplied OCR exports 8/8, supplied PDF native-text scan across all 8 with real edit/delete export verification on 2, video suite 17/17, SEO crawl 0 failures and guides 16/16.
- [ ] Before serving personalized ads to EEA, UK or Swiss visitors, configure a Google-certified CMP integrated with IAB TCF. Google says its AdSense European regulations message is certified; this account step remains pending.
- [ ] AdSense publisher setup, per-site review, exact ad implementation, ads.txt publisher line and WorkKit/FormReady Search Console verification still require the account owner.

## QuickKit visual-control and map-card release — 2026-11-01

- [x] Published application build `https://59a62cd4.quickkit-browser-tools.pages.dev` and passed the full PDF/video/geo suites there. Final geo-photo release `https://c141eea5.quickkit-browser-tools.pages.dev` adds available neighbourhood/city details and defaults the stamp to the lower-left; it passed 36/36 geo checks and 3/3 real-map checks. PDF/video app code remains as verified on `59a62cd4`.
- [x] PDF editor production workflow on application build `59a62cd4`: 66/66. Verified blackout width/color, shape kind/fill/opacity/border color/border width, signature drag/resize/ink color/delete, OCR, source-text edit/delete/export, mobile and narrow-phone layouts.
- [x] Video tools production workflow on application build `59a62cd4`: 34/34. Verified viewport-fixed bottom timeline, scrub/playback, trim handles, split, crop, compression, middle cut, join/reorder, soundtrack timing/mix and playable downloads at desktop/phone widths.
- [x] Geo-photo production workflow on final release `c141eea5`: 36/36, including automatic nearest-place lookup for current location. Verified requested front/rear camera mode, capture-and-tag, browser location, GPS EXIF read-back, optional map stamp, map choice, place lookup, lower-left default, locality/city detail line in the preview and rendered JPEG, and 390px/320px layouts.
- [x] Real OpenStreetMap map-card production check: 3/3 on final release `c141eea5`. Map card loads the four zoom-14 tiles around the selected coordinate when photo creation is requested, renders a pin and includes visible © OpenStreetMap attribution; no place lookup is sent by that check.
- [x] Browser-built QuickKit production assets with `npm run build:quickkit`; generated video/PDF photo outputs reopened and validated by browser suites.
- [ ] Test camera switching and location accuracy on physical front/rear cameras and a phone with real GPS. Automated tests use a browser fake camera and mocked geolocation; hardware accuracy can vary.
- [ ] Monitor map provider availability and tile-use terms. OpenStreetMap Standard tile service is best-effort, attribution must remain visible, and map tiles are loaded only for a user-requested map view/card.

## Multi-range trim and full-site production release — 2026-11-02

- [x] Deployed the latest source directly to Cloudflare Pages. Cloudflare Git integration is not connected, so publishing is a separate step from the GitHub push.
- [x] QuickKit full video browser suite passed **37/37** against the stable production URL. Coverage includes draggable filmstrip trim handles, split-at-playhead, compression, crop, precise single trim, joins and reordering, soundtrack placement/mixing, playable exports, 390/320 px layouts and no browser runtime errors.
- [x] Focused multi-range test passed **9/9** against production: two non-overlapping saved ranges, drag-to-adjust handles, overlap rejection, phone layout, playable keep-mode output and playable remove-mode output.
- [x] FormReady Exam Form Kit passed **19/19** against production, including preset-based dimensions and file-size checks, signature cleanup, download and 390/320 px layouts.
- [x] Full cross-site production regression passed **92/92** across WorkKit, QuickKit and FormReady, including timesheet calculations/currency conversion, image-to-PDF selection/order/filter/export, QR decoding, PDF merge, and FormReady conversion/crop flows.
- [x] Live technical SEO crawl checked **19 sitemap URLs and 34 linked routes** across the three sites with 0 failures.
- [ ] Physical phone camera/GPS, Safari/iOS and low-memory or large-file behavior still require owner device checks. Browser automation cannot guarantee the behavior of every device or codec.
- [ ] Search Console indexing/impressions, search ranking, AdSense approval and revenue remain external follow-up; the crawl is not proof of ranking or indexing.

## Trim and crop usability correction — 2026-11-02

- [x] Put the visible plus action beside Keep/Remove in the Trim panel; keep exact time fields, saved parts, clear, preview and export in the dock. Five separate ranges save and show in the editable list.
- [x] Remove the duplicate one-off cut box; Remove selected parts now cuts every saved range through the same Trim flow.
- [x] Separate task UI: timeline dock is hidden in Compress and Crop, shown in Trim and Edit and join.
- [x] Crop can draw, move and resize a freeform selection directly on the original frame. Zoom range is 50–300%; browser QA checks both directions, exact crop geometry and exported pixels/dimensions.
- [x] Local production Chromium: full video suite **45/45**, focused multi-range suite **11/11**.
- [x] Stable QuickKit production URL after deployment: full video suite **45/45**, focused multi-range suite **11/11**. Synthetic generated videos only; no supplied personal video was uploaded.
- [ ] Real-device touch, Safari/iOS codec behavior, large files and constrained-memory performance still require owner checks.

## Word-to-PDF mobile action layout — 2026-11-03

- [x] On tablet and phone widths, stack the editable PDF filename, full-width Print / Save as PDF action, and Clear control in a readable order; add separation before the print preview.
- [x] Browser-verified the control order, panel fit, preview gap, and no horizontal page overflow at 600px, 390px and 320px.
- [x] Full QuickKit document browser suite passed **39/39** locally and **39/39** against `https://quickkit-browser-tools.pages.dev` after the Cloudflare deployment. Existing PDF extraction/OCR, image-to-PDF filter/order/margin, and DOCX print-flow checks passed in the same run.
- [x] Captured the phone layout at `qa-results/quickkit-document-fixtures/docx-to-pdf-mobile.png`.
- [ ] Native print dialog and Save as PDF behavior should still be confirmed on the owner’s device; automated QA verifies that the browser print flow is invoked and the selected filename is applied to the print document title.
