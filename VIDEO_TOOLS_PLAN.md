# QuickKit video tools plan

Status: the multi-range trim workflow is deployed to QuickKit and verified against the stable production URL. The full video suite passed 37/37 and the focused multi-range suite passed 9/9, including dragging saved ranges, overlap rejection, phone-width layout, keep-mode output and remove-mode output. Playwright WebKit fallback/mobile checks pass; this WebKit build lacks WebCodecs, so Safari support remains unverified. Large-file, cancellation, codec-mix and real-device checks remain.

## Product goal

Offer a small, browser-based video toolbox that is easy to understand, keeps files on the device, and explains format or device limits before the user spends time processing a large file.

## Expanded video-studio scope — 2026-11-01

User priority: finish a useful video editor first, then add the geo-tagged photo tool. Instagram analysis/downloading is deferred.

### Editor requirements

- [x] Multiple video files and multiple retained sections can be arranged into a single output; source and clip ordering controls already exist.
- [x] Add up to three local soundtrack files, trim each soundtrack's source start/end, set its start time on the joined-video timeline, adjust its volume, remove it, and mix it with the original clip audio.
- [x] Let users mute original clip audio or set its level independently from added tracks.
- [x] Crop videos with original, 16:9, 4:3, square and portrait framing presets plus horizontal/vertical framing controls; verify the exported pixel dimensions and crop content.
- [x] Remove one selected middle section directly while retaining the video before and after it; preview the generated sections before joining/exporting.
- [x] Show a readable video/audio lane timeline with segment ordering and soundtrack placement. Reordering videos has both arrow controls; audio position/source trims use number fields and upload works through file picker or drag/drop.
- [x] Export reopens and plays with the expected clip order, soundtrack timing, source trims, audio levels and total duration. Known-tone analysis tests both correct placement and quiet intervals.
- [x] Explain output re-encoding, browser support and device memory limits. Preserve all source files locally.

### Repository research

- Reviewed [S07K/cutaway](https://github.com/S07K/cutaway): MIT, local-first React editor, multi-track timeline, drag trim/split, audio, text/effects and browser export. Good interaction/data-model reference; not a framework replacement.
- Reviewed [FairArena/fairarena-video](https://github.com/FairArena/fairarena-video): MIT, client-side WebCodecs/WebGPU editor concept and multi-track controls; useful interaction reference, but a larger product than our first slice.
- Reviewed [zrnge/viz](https://github.com/zrnge/viz) and [wleeaf/Aether-Edits](https://github.com/wleeaf/Aether-Edits): FFmpeg.wasm timeline examples; GitHub API did not identify a license for either, so do not copy their code without confirming explicit licensing.
- Mediabunny's official docs support decoding audio to Web Audio buffers and creating encoded output audio samples. Keep QuickKit's existing Mediabunny pipeline and validate sync/quality in exported files.
- No source code was copied from these projects. Existing editor uses the current Vite/vanilla-JS stack and Mediabunny; maintain that toolchain.

### Later geo-tag photo scope

- [x] Add a local geo-tag photo tool: user-selected photo, explicit location permission or manual coordinates, optional place/date stamp preview, GPS EXIF write/read-back verification, and local download. Never ask for or use location without explicit user action. No map or reverse-geocoding service is used.
- The GPS_Camera reference is a Flutter native app, not a drop-in web module. Its repository has an MIT `LICENSE`; use it for feature ideas/attribution if any code is adapted.

## Implemented and deployed first release

1. **Compress video** — upload one video, choose a smaller resolution and quality preset, show source details, output size and progress, then preview and download the result.
2. **Trim or cut a clip** — choose start and end times with a seekable preview; export the selected interval.
3. **Join clips** — add multiple compatible files, reorder them, preview the sequence, and export one joined video.
4. **Cut out a section** — add the same source more than once in Join and cut, set the ranges to keep, and export the joined result.

The current interface is `products/quickkit/video-tools.html`. It keeps source files local, supports drag/drop, shows the original/result preview, progress and cancel controls, and reports the measured export size and duration. The Mediabunny engine is a deferred chunk: the browser downloads it after a user selects a video. The video page is linked from the QuickKit homepage and sitemap.

### Current processing limits and behavior

- Uses Mediabunny 1.65.0 under MPL-2.0; the bundled license is `products/quickkit/public/LICENSE-MEDIABUNNY.txt` and the attribution is listed on the open-source page.
- Input must have a video codec the active browser can decode. Export chooses MP4 AVC/AAC when available, otherwise WebM VP9/Opus or VP8/Opus when available. Container extensions alone do not guarantee codec support.
- Compression offers original/1080p/720p/480p output height and high/balanced/smaller quality presets. Compression is re-encoding and may enlarge some sources; the UI reports the measured output and does not promise a target ratio.
- Trim re-encodes the selected interval for an accurate cut and may reduce quality.
- Joining re-encodes selected sections to one shared output size/format. Mixed source ratios are fit inside the first clip's canvas; mixed frame rates, rotation metadata and subtitle/data tracks need additional compatibility verification.
- Current caps are 150 MB per total selection on desktop, 60 MB on narrow/mobile layout, at most 10 minutes per input and 10 minutes for a joined result. These are initial safeguards, not tested performance guarantees for every device.

### Local verification

- `npm run build:quickkit` passed on 2026-10-31.
- Fresh production verification against `https://quickkit-browser-tools.pages.dev`: `QUICKKIT_ORIGIN=https://quickkit-browser-tools.pages.dev npm run qa:video-tools` passed **17/17** on 2026-11-01 (Chromium). It measured decoded audio, actual joined frame colors/order, export reopen and same-file middle cut; mobile width and runtime-error checks passed.
- `npm run qa:video-tools` passed 17/17 checks in Playwright Chromium and Firefox using short generated video+audio clips. Checks include compression, trim, audio, two-file join, same-source middle cut, export reopen, 390px mobile overflow, browser errors, and sampled frames proving original and reordered clip sequence.
- Reports: `qa-results/video-tools-browser-smoke.json` and `qa-results/video-tools-browser-smoke-firefox.json`. `npm run qa:video-tools-webkit` passed 4/4 capability/fallback/mobile checks; this Playwright WebKit build does not expose WebCodecs, so it does not verify Safari editing. Test clips are generated in memory; no supplied personal videos are included.
- The stable production route is `https://quickkit-browser-tools.pages.dev/video-tools.html`; production browser smoke runs against this public URL.

### Expanded editor verification — 2026-11-01

- `npm run build:quickkit` passed after crop and remove-range implementation. Fresh stable-production browser verification passed **30/30** for generated video+audio fixtures, including real square output dimensions and outside-frame marker removal, retained before/after video around a removed section, audio, ordered joins, soundtrack placement/mixing and 390/320px responsive checks. Immutable deployment `https://0ee38613.quickkit-browser-tools.pages.dev` passed the same **30/30** suite.
- Geo-photo QA passed **20/20** against immutable deployment `https://70ef03f6.quickkit-browser-tools.pages.dev` and stable production, including 390px camera-button visibility, camera capture/reset, map coordinate selection, export and embedded GPS EXIF read-back.

- `npm run qa:video-tools` passed **24/24** on a local production build in Chromium and Firefox. Generated test clips verify two independent soundtrack source trims, two distinct placement times, actual 523 Hz/880 Hz signal windows in the exported file, original 440 Hz retention and mute-by-volume, track presence, export reopen, clip order/middle cut, and no horizontal overflow at 390/320 px. Browser test result reports and short README screenshots are under `qa-results/`.
- Audio processing is local. Soundtrack mixing is limited to 4 minutes on desktop and 2 minutes on narrow layouts to bound OfflineAudioContext memory. The existing no-edit join path continues to stream original audio samples. Browser/device codecs still vary.
- `npm run qa:geo-photo` passed **14/14** on a local production build. PNG-to-JPEG output keeps pixel dimensions; EXIF coordinates were read back and matched signed decimal coordinates within 0.0000001 degree; test includes geolocation permission, visible stamp on/off, GPS refs/date, reset, downloads, 390/320 px and zero browser errors.
- Video tests verify Chromium and Firefox automation. Geo tests verify Chromium automation. Actual Safari/iOS/Android and real low-memory devices still require physical-device checks.
- The expanded release is deployed to `https://quickkit-browser-tools.pages.dev/video-tools.html` (immutable build: `https://09059e89.quickkit-browser-tools.pages.dev/video-tools.html`). Stable production passed video **24/24** and geo-photo **14/14** after the last metadata-only redeployment. Live PDF/document and cross-site regression suites also passed **62/62**, **29/29**, and **92/92** against the same application code before that metadata-only change.
- Live SEO crawl after the final deployment passed **19 sitemap URLs and 34 linked routes with 0 failures**; the report is `qa-results/seo-live-audit.json`.

### Multi-range trim — 2026-11-02

- [x] Save more than one non-overlapping range from a single source video; edit start/end times or drag each saved range's timeline handles.
- [x] Let users choose whether saved ranges are the sections to keep or the sections to remove.
- [x] Preview and download the assembled output using the existing local join/export engine; validate playable output duration for both keep and remove behavior.
- [x] Reject overlapping selections with an understandable message; keep exact time fields and timeline selections in sync.
- [x] Check the saved-range controls at 390px with no horizontal page overflow.
- [x] `npm run qa:video-tools` passed **37/37** in local Chromium after fixing the existing Join button's event-handler argument.
- [x] `QUICKKIT_ORIGIN=http://127.0.0.1:4181 npm run qa:video-trim-ranges` passed **9/9** in local Chromium; the saved range drag, overlap rejection, mobile width, kept output (about 1.3 seconds) and removed output (about 2.4 seconds) were verified from a generated 3.19-second test clip.
- [x] Rebuild and publish the multi-range release directly to Cloudflare Pages; stable production full video suite passed **37/37**, and the focused range suite passed **9/9**.
- [x] `npm run qa:formready-exam-kit` passed **19/19** against the stable FormReady production URL; `npm run qa:seo-live` checked 19 sitemap URLs and 34 linked routes across all sites with 0 failures.
- [x] Production build completed for WorkKit, QuickKit and FormReady before deployment.
- [ ] Ask the owner to try range drawing and preview on a real phone; browser automation does not prove all touch hardware and codecs.

### Remaining before release

- [x] Test Playwright Chromium and Firefox codec/export behavior and confirm ordered joins from decoded output frames.
- [ ] Test actual Chrome, Edge and Safari on user devices; Playwright WebKit is not Safari.
- [ ] Test cancellation, corrupt/unsupported media, large files, low-memory behavior, portrait/rotated sources, variable frame rates, and mixed-format joins.
- [x] Check clip order before and after reordering from sampled exported frames; verify middle cut output duration and audio.
- [x] Verify crop geometry/export and direct removal of a selected middle section against decoded browser-generated fixtures in both local and live Chromium.
- [ ] Check start/end edge cases and mobile processing performance on a real phone.
- [x] Build, deploy, and retest the prior video release on both the immutable production deployment and stable `pages.dev` alias.
- [x] Publish and production-test the 2026-11-02 multi-range trim update.
- [ ] Update the user-facing limits if measurements on target devices require lower caps.

## Technical discovery notes

- The first implementation uses browser-supported WebCodecs through Mediabunny; cross-browser behavior still needs real testing.
- The license was checked before adding the package; Mediabunny is MPL-2.0.
- Supported codecs are checked at runtime; Chromium generated fixtures passed, but other browsers/devices are not yet verified.
- Measure memory and processing time for typical phone and desktop files. Start with clear file-size/duration limits, progress, cancel, and recoverable errors.
- Confirm whether precise cuts require re-encoding, and disclose any quality loss or keyframe-boundary behavior.
- Verify audio/video synchronization, rotation metadata, portrait clips, variable frame rate, subtitles, and mixed-format joins.

## UX and quality gates

- Keep three task cards and route-specific workflows; don't expose codec jargon in the first screen.
- Make desktop and phone controls touch-friendly, with usable preview, timeline, time fields, keyboard input, and visible progress.
- Validate with generated fixtures and user-owned sample videos only after the local-only processing path is confirmed.
- QA successful exports by reopening them in the browser and checking duration, dimensions, audio, codec and playback; test cancellation, corrupt inputs, unsupported codecs, large files, low memory, and mobile layout.
- Do not advertise a guaranteed compression ratio or lossless cuts unless measured for that exact output.
