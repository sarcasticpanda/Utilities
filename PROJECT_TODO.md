# Project TODO

All three sites are live on Cloudflare Pages, and QuickKit’s PDF editor is live. The earlier Sites URLs remain public fallbacks. A custom domain is optional and not purchased. Product history is in `IMPLEMENTATION_TRACKER.md`; hosting requirements are in `HOSTING_MIGRATION.md`.

## Before the next public update

- [ ] Add the site operator's support email or owned feedback form to all Contact pages.
- [ ] Complete the remaining keyboard, touch, screen-reader and file-edge-case checks in the browser checklist.
- [ ] Verify search properties and submit the three live sitemaps when the owner is ready to connect Search Console/Bing.
- [ ] Add an `og:image` when a suitable brand preview image is ready.

## Growth and monetization work

- [ ] Add privacy-safe analytics after selecting a provider and confirming disclosure/consent requirements; do not record files, passwords, images, timesheet details or pay values.
- [ ] Add ads only after approval; keep ad slots separate from upload, calculate and download controls.
- [ ] Review search impressions, page performance and visitor behavior before expanding tool lists or publishing more pages.
- [ ] Check `lunarpandatools.com` and fallback `lunarpanda.tools` in Cloudflare Registrar; verify the exact renewal price and availability before purchase.
- [ ] Attach custom subdomains only after the domain is registered; verify DNS and HTTPS before switching canonical URLs.

## Product backlog

- [ ] WorkKit: consider biweekly timesheets, 5/7-day templates, duplicate-shift entry and multiple breaks after a separate calculation and mobile UX review.
- [x] QuickKit: photo-to-PDF workflow with gallery selection, crop/rotate/filter, reorder, paper settings and local export.
- [x] QuickKit: English OCR text copy, detected-region redaction and masked editable replacement; raster export removes original page text.
- [x] QuickKit: add browser-only direct PDF text replacement/deletion for a clearly bounded subset, with qpdf-WASM writing, PDF.js output checks, width refusals and OCR fallback. Details and remaining device review: `PDF_SOURCE_TEXT_EDITING_PLAN.md`.
- [x] QuickKit: verify image-to-PDF gallery include/exclude, drag order, crop/rotation/filter, margins, orientation and downloadable page order in browser QA.
- [x] WorkKit: add dated reference-rate conversion to overtime; verify math, source/target currency-only API requests, same-currency handling and refresh.
- [ ] QuickKit: add PDF splitting and additional conversion formats after defining fidelity requirements and mobile memory limits.
- [ ] FormReady: add user-defined local presets next; add official photo presets only after recording and verifying current official requirements.

## Release facts

- [x] Three Cloudflare Pages sites are public; live status and URLs are in `VISIBILITY_AND_DEPLOYMENT_CHECKLIST.md`.
- [x] All three Pages projects are deployed; the earlier Sites releases remain available as fallback.
- [x] All three builds passed; responsive Chromium sweep passed 79 checks with 0 failures; the PDF editor passed 32 checks locally and live; production smoke passed 13 routes with 0 failures.
- [x] Final screenshots and machine-readable QA evidence are in `qa-results/`.

Search traffic, indexing speed, ad approval and revenue are external outcomes, not promises of a same-day launch.
