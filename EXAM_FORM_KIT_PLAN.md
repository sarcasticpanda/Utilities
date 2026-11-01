# Exam Form Kit — source audit and build status

**Status:** Deployed and verified in production
**Source review:** 2026-11-01
**Target:** FormReady at `products/formready/`

## Product rules

The checker verifies only measurable file properties. It does not identify the applicant, verify recentness, determine if a signature is genuine or clear, reproduce portal camera capture, or guarantee application acceptance. Historical cycles are labeled in the selector and source panel. Always follow the latest official notice and portal instructions.

Files are processed in the browser and are not uploaded. File sizes are measured in bytes and displayed as 1,024-byte KB; a portal may round differently. The result advises users to leave room inside strict limits.

## Implemented flow

1. Select an exam cycle and document type or enter custom requirements.
2. Review the source notice, cycle, rule note and live-capture warning before uploading.
3. Crop with a source-backed preferred or approximate ratio; rotate and reset the crop.
4. Export JPG with a bounded quality search for minimum/maximum byte ranges. Fixed dimensions stay fixed; impossible ranges are reported rather than padded. PNG/WebP remain available for custom rules.
5. Check file format, dimensions and size. Preferred dimensions are labeled preferred. Manual image review is called out separately.
6. Optionally whiten a signature scan and add a name/date strip. Both are opt-in, and the strip warns users to use it only when current instructions request it.

## Source audit and selector entries

All selector entries are historical as of the check date. They are useful starting points, not current-cycle advice.

| Exam cycle | Verified rules included | Boundaries shown in the tool |
|---|---|---|
| IBPS PO/MT XVI 2026 | Photo 200 × 230 px preferred, 20–50 KB JPEG; signature 140 × 60 px preferred, 10–20 KB; thumb 240 × 240 px at 200 DPI / 3 × 3 cm, 20–50 KB; declaration 800 × 400 px at 200 DPI / 10 × 5 cm, 50–100 KB. Live-photo capture is also required. | Preferred dimensions are identified as preferred. The tool does not replace live capture or verify handwriting/identity. |
| SSC CGL 2026 | Signature JPEG 10–20 KB, about 6 × 2 cm. The application captures the photo live. | Signature-only, approximate 3:1 crop; no static-photo preset. |
| SSC CHSL 2025 | Signature JPG 10–20 KB, about 4 × 2 cm. The application captures the photo live. | Signature-only, approximate 2:1 crop; no static-photo preset. |
| RRB Level 1 CEN 09/2025 | Signature JPG/JPEG 30–49 KB, minimum 140 × 60 px; application photo is captured live. | Signature-only, minimum dimensions are checked and not treated as an exact crop. |

### Official primary sources

- [IBPS PO/MT XVI detailed notice](https://www.ibps.in/wp-content/uploads/Detailed-Notification_CRP-PO-XVI_Final_V1_30.06.2026.pdf)
- [SSC CGL 2026 notice](https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_cgl_2026.pdf)
- [SSC CHSL 2025 notice](https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_chsl_2025.pdf)
- [RRB Level 1 CEN 09/2025 notice](https://www.rrbcdg.gov.in/uploads/2025/09-LVL1/092025-CEN.pdf)
- [UPSC CSE 2026 notice](https://www.upsc.gov.in/sites/default/files/Notif-CSP-2026-Engl-060226Rev.pdf) — live-photo and multiple-signature instructions; exact upload values defer to the portal.
- [NTA NEET UG 2024 bulletin](https://exams.nta.ac.in/NEET/images/NEET%20UG%202024%20IB-version%202%20final.pdf) — historical only; not used as a current preset.

UPSC 2026, NEET/JEE/CUET 2026/2027, PAN, SSC GD/other cycles do not have active presets yet because current exact upload values were not verified for those respective portals/notices. The custom path supports user-entered rules. Older name/date requirements are not presented as current UPSC rules; the optional strip remains off until a user chooses it and confirms their current notice asks for it.

## Verification

- `npm run build:formready` passed after implementation.
- `npm run build` passed for WorkKit, QuickKit and FormReady.
- `npm run qa:formready-exam-kit` passed 19/19 on immutable production release `https://f6f99981.formready-photo-tools.pages.dev`: source/cycle data, preset values, physical-unit labels, JPEG export within an inclusive size range, download, signature cleanup pixels, stamp, unattainable-size refusal, 390 px and 320 px layouts, zero browser errors and zero file-upload requests.
- Opened the release in a fresh visible browser tab and inspected the presets, notices, crop controls, output checker, caveats and navigation.
- The production SEO guide browser suite passed 16/16; the three-site live crawl checked 18 sitemap URLs and 33 internal routes with 0 failures.
- Full three-site interaction regression passed 92/92. The additional checker explanation exposed an ambiguous test selector; the test was fixed and the full run passed.

## Next work

- [x] Deploy the verified build and repeat the Exam Form Kit suite on the immutable Pages URL; stable alias had already passed 19/19 before the guide-only update.
- [x] Run the full three-site production regression and PDF extraction suite after deployment.
- [ ] Add new presets only from current primary notice/portal sources; refresh historical records when new cycles publish.
- [x] Expand the source-cautious photo/signature guide with answers about KB ranges, cleanup, old cycles, and stamp use.
- [ ] Recheck Search Console indexing and impressions after crawl. Search position, traffic and AdSense approval are not guaranteed.
