# Browser QA checklist and evidence

The browser script and machine-readable evidence are in `scripts/browser-qa.mjs` and `qa-results/browser-qa-results.json`. Final screenshots are in `qa-results/screenshots-polished/`. The latest full local sweep followed the production build on 2026-10-30 and recorded **79 checks, 0 failures** across 13 routes; the PDF editor workflow passed 32 checks locally and live.

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
- [x] Dedicated PDF editor Chromium workflow passes 32 checks: initial view; invalid upload; page rendering; failed replacement recovery; add/edit/move/remove text; highlight, rectangle, image and signature; page reorder/delete; OCR recognition/copy; editable OCR replacement; redacted page export contains no extractable source text; readable PDF download; 390px and 320px phone fit; no file-upload requests.
- [x] PDF editor screenshots inspected at desktop, 390px phone and 320px narrow-phone widths. Evidence: `qa-results/pdf-editor/results.json` and `qa-results/pdf-editor/`.
- [ ] Test large real-world PDFs and low-memory mobile devices; file size is capped at 100 MB but device memory varies.
- [ ] Click/open verification of the image-compressor download, unsupported files, unattainable targets and reset/object-URL cleanup need additional scenarios.
- [ ] Clipboard permissions and copy feedback need a browser permission pass.

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
- [x] QuickKit PDF editor passed all 32 dedicated production checks, including OCR replacement/redaction, local-only file processing, edit/undo, export readability and mobile widths.

Production evidence: qa-results/production-smoke-results.json and qa-results/pdf-editor-production/results.json.
