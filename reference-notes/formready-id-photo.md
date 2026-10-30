# FormReady reference analysis: IDPhotoResizer

## Upstream

- Repository: https://github.com/mavi-cyber/IDPhotoResizer
- The public README describes a small static app built with HTML, CSS, JavaScript and Canvas, with crop, pan/scale, dimension presets and local processing. It advertises an MIT license; confirm the current `LICENSE` before reuse.
- The repository file listing is intentionally simple: `index.html`, `app.js`, `style.css`, `about.html`, and assets.

## What it can teach us

This is a useful focused reference for a touch-friendly portrait crop studio, Canvas export, dimension controls, and a no-build static deployment. Its README lists international passport/visa examples, but those are not authoritative evidence for Indian exam or application requirements.

Inspect `app.js` for source-image loading, crop coordinate calculations, boundary handling, scaling, and canvas export. Inspect `index.html` and `style.css` for the crop controls and responsive behavior. Confirm whether it handles EXIF orientation, high-resolution phone photos, transparent input, memory cleanup, and small-screen gestures before borrowing any implementation.

## FormReady implementation rules

- Build generic custom mode first: select/upload, crop, resize, compress to a measured byte target, validate, download.
- Keep organization/application requirements in versioned data, not component conditionals.
- Only label a preset verified when it links to current official instructions. Competitor presets and international examples are not suitable sources for SSC, UPSC, banking, railway or NTA requirements.
- On mobile, the user should be able to upload from camera/gallery, adjust the crop with touch, see a clear pass/fail checklist, and download without a modal blocking the workflow.
- Explain that FormReady is independent and that the user should check the latest official application notice.
- Never save uploaded photos/signatures in analytics, local storage, or remote services.
