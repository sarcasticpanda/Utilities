# Three Utility Sites — Implementation and release tracker

**Spec:** `UTILITY_SITES_COMPLETE_MASTER.md`
**Public state:** All three products are live on Cloudflare Pages; the previous Sites URLs remain available as fallback.
**Current worktree:** All three Cloudflare Pages deployments are live; QuickKit’s PDF editor is deployed and verified on the production Pages host.
**Last release:** 2026-10-30
**Current release evidence:** all three products build; the responsive sweep passed 79 checks; QuickKit's OCR/replacement/redaction editor passed 32 checks locally and on its live Pages domain.

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
- [x] Ran production browser smoke checks: all 12 Pages routes returned HTTP 200; canonical tags, sitemap and robots files worked; a representative interactive flow passed for each product.
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
- [x] Add a local PDF editor with text, highlight, rectangle, image/signature annotations, page previews, page reorder/delete, zoom and PDF download.
- [x] Add OCR text recognition/copy and OCR-assisted redaction; redact exports flatten affected pages so source text is not left extractable beneath the mask. See `qa-results/pdf-editor/results.json`.
- [x] Deploy the image-to-PDF and OCR/replacement/redaction updates to https://quickkit-browser-tools.pages.dev; 32 live editor checks passed.
- [x] Lazy-load the larger PDF and QR libraries.
- [ ] Add PDF split, Word/PDF conversion and advanced batch tools only with accurate fidelity limits and mobile-memory checks.

### FormReady

- [x] Upload, crop, resize, compress and measure a photo/signature against user-entered requirements; download and reset.
- [x] Convert custom millimeter/inch dimensions to pixels at a chosen DPI; rotate left/right and reset the crop.
- [x] Clear stale generated output when requirements change, restrict input to JPG/PNG/WebP under 20 MB, and explain the 5,000 px per-side canvas limit.
- [x] Keep the preset data empty rather than inventing application rules; explain the independent-service limitation.
- [ ] Add a preset only after saving an official current source URL and verifying its dimensions, format and file-size requirements.

### WorkKit

- [x] Show total work time as both decimal hours and hours/minutes; suppress partial totals when any entered shift is invalid.
- [x] Add browser print / Save as PDF for complete timesheets, alongside CSV export.
- [x] Add USD, INR, GBP, EUR, CAD, AUD and AED formatting in all WorkKit pay calculators; currency selection does not convert rates.
- [ ] Add biweekly periods, 5/7-day templates and extra break entries only after a separate calculation and mobile UX review.

### Competitor review

- [x] Review public workflows and third-party traffic estimates for calculator.net, QuickBooks Time Card Calculator, TimeCardCentral, ResizePixel and ImResizer.
- [x] Record feature takeaways and originality boundaries in `reference-notes/workkit-formready-competitor-review.md`.

## Launch follow-ups

- [ ] Configure an operator-owned support email or form; Contact pages currently say that a direct support contact is not configured.
- [ ] Optionally connect a custom domain after choosing and registering it; free Pages hostnames are live now. See `HOSTING_MIGRATION.md`.
- [ ] Verify ownership in Google Search Console and Bing Webmaster Tools, then submit each sitemap.
- [ ] Review crawl/index status after launch; indexing and ranking are not immediate or guaranteed.
- [ ] Configure privacy-safe analytics only after selecting a provider and confirming consent/disclosure needs. No analytics is enabled now.
- [ ] Apply for an ad network only after useful traffic/content exists; ad code is not enabled and approval/revenue are not guaranteed.
- [ ] Add an original social preview image; title and description metadata are present, but no `og:image` is configured.
- [ ] Complete keyboard, assistive technology, touch-gesture, storage-failure and image edge-case checks listed in `BROWSER_QA_CHECKLIST.md`.

## Evidence and limits

- Browser pass/fail details: `qa-results/browser-qa-results.json` and `qa-results/production-smoke-results.json`.
- Repeatable browser scripts: `scripts/browser-qa.mjs` and `scripts/production-smoke.mjs`.
- Design direction and remaining product decisions: `DESIGN.md` and `PRODUCT.md`.
- Temporary research artifacts and exact source analysis: `reference-notes/README.md`.
- Local production builds use Vite. The current static apps have no account system, database or server-side file processing.
- Traffic, indexing speed, ad approval and earnings depend on external services and user demand.
