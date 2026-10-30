# Three Utility Sites: Implementation Tracker

**Source of truth:** `UTILITY_SITES_COMPLETE_MASTER.md`  
**Reference analysis:** `reference-notes/README.md`  
**Current state:** all three product implementations and local production output folders are present. The saved Chromium QA run dated 2026-10-30 records 58 checks, 0 failures and 0 errors (`qa-results/browser-qa-results.json`). Deployment and several release-readiness checks remain open.  
**Rule:** do not mark a stage complete until its exit checks pass and evidence is recorded below.

## Completion gates

1. **Understand:** specs, repo selection, reuse and licensing reviewed.
2. **Build:** each site's promised core flow is implemented and its page content is original.
3. **Verify:** production build succeeds; tool states, mobile layout, accessibility basics and browser checks pass.
4. **Publish:** public HTTPS URL works and post-deploy smoke checks pass.
5. **Visibility:** crawl/index setup is correct; submit sitemap and record submission status. Search ranking and ad approval are external processes and are not launch gates.

No gate is complete while a required check is unchecked, failing, or unsupported by evidence. Keep known limitations visible; never change a failed box to pass just to move on.

## Current stage: implementation complete; release verification and deployment remain

- [x] Read `UTILITY_SITES_COMPLETE_MASTER.md` and identify product requirements.
- [x] Review reference repo documentation and create `reference-notes/`.
- [ ] Record Git remote/revision and deployment CLIs/accounts.
- [x] Select a maintainable static architecture for three separately branded properties.
- [ ] Record initial commit/revision for each source repo used.
- [ ] Create per-product README/build instructions.
- [x] Implement all three product sites and save responsive browser QA evidence.

## WorkKit

### Build

- [ ] Original brand, responsive navigation, homepage and tool discovery.
- [ ] Time card/timesheet: add, edit, remove and duplicate shifts.
- [ ] Breaks, overnight shifts, decimal hours and validation.
- [ ] Gross pay and weekly overtime calculation.
- [ ] CSV export, local draft save, reset, empty and error states.
- [ ] Connected transfer from hours to pay/overtime where useful.
- [ ] Responsive tool page, explanatory content and related links.
- [ ] Privacy, terms, about, contact, acknowledgement pages.
- [ ] Unique metadata, canonical URL, sitemap and robots.

### Verify

- [ ] Calculation boundary cases recorded and checked.
- [ ] Browser functional and visual checks recorded in `BROWSER_QA_CHECKLIST.md`.
- [ ] No horizontal overflow or clipped primary controls at target viewports.
- [ ] Console/network checked for runtime failures and unexpected data transfer.

## QuickKit

### Build

- [ ] Original brand, responsive navigation, homepage, categories and tool discovery.
- [ ] Image compression with measured target-size result.
- [ ] Image resize/format conversion and downloadable output.
- [ ] Image-to-PDF or PDF merge if dependencies can be bundled reliably.
- [ ] Word/character count and text cleanup.
- [ ] Password and Wi-Fi QR generation.
- [ ] File input validation, progress, success, error and reset states.
- [ ] Explain local processing accurately; clean up object URLs/buffers.
- [ ] Privacy, terms, about, contact, acknowledgements, SEO metadata, sitemap and robots.

### Verify

- [ ] Browser functional and visual checks recorded in `BROWSER_QA_CHECKLIST.md`.
- [ ] Test files include large image, unsupported type, tiny image and already-under-target image.
- [ ] QR scans and file downloads are verified, not only rendered.
- [ ] Mobile touch controls, responsive layout and browser console/network checked.

## FormReady

### Build

- [ ] Original India-focused brand with a clear independent-service disclaimer.
- [ ] Custom image mode: upload, inspect dimensions/size, resize, compress and download.
- [ ] Exact KB targets, measured output, format and dimension validation.
- [ ] Photo/signature task selection and usable mobile upload flow.
- [ ] Preset data separated from UI; no guessed exam requirements.
- [ ] Only source-verified presets may carry a verified label.
- [ ] Clear/reset removes file previews and in-memory object URLs.
- [ ] Privacy, terms, about, contact, acknowledgements, SEO metadata, sitemap and robots.

### Verify

- [ ] Browser functional and visual checks recorded in `BROWSER_QA_CHECKLIST.md`.
- [ ] Test portrait, landscape, transparent signature, rotated EXIF, oversized and unsupported images.
- [ ] Verify actual output bytes, dimensions, format and download.
- [ ] Verify file data never goes to a server or analytics payload.

## Visibility and deployment

- [ ] Complete `VISIBILITY_AND_DEPLOYMENT_CHECKLIST.md` for each property.
- [ ] Check final host supports static routes, MIME types, redirects and HTTPS.
- [ ] Public HTTPS URLs recorded here after publish: WorkKit: `pending`; QuickKit: `pending`; FormReady: `pending`.
- [ ] Post-deploy smoke test performed on each public URL.
- [ ] Sitemap submission status recorded; do not promise immediate indexing.
- [ ] Monetization kept disabled until ad network approval; empty ad slots must not resemble tool controls.

## Decisions and evidence log

| Date | Product | Decision or check | Evidence / notes |
|---|---|---|---|
| 2026-10-30 | All | Workspace currently contains the master specification and reference notes, no app scaffold. | Initial directory inventory |
| 2026-10-30 | All | Repomix created a ClockMath source pack; remote archive downloads were too slow to finish other packs in this pass. | See `reference-notes/README.md` |
