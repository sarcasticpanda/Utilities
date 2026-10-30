# Browser QA Checklist

This file is the browser sign-off record for implemented controls and user-visible claims. A blank item is not a pass. Keep screenshots and notes with the product build or link them in the evidence column.

## Test setup

- [ ] Product and build revision recorded.
- [ ] Dev/preview server started using the documented project command.
- [ ] Browser and version recorded.
- [ ] Desktop viewport: 1440 x 900.
- [ ] Tablet viewport: 768 x 1024.
- [ ] Mobile viewport: 390 x 844.
- [ ] Narrow mobile viewport: 320 x 740.
- [ ] Screenshots captured for initial view and completed result at desktop and mobile.
- [ ] Browser console and network activity reviewed.

## Shared visual and accessibility checks

- [ ] Header, main content, result and footer are visible and not clipped at tested widths.
- [ ] No horizontal page overflow at any viewport.
- [ ] Main task and primary action are clear above the fold.
- [ ] Text wraps cleanly; controls do not overlap or become too small.
- [ ] Touch targets are usable; mobile fields use suitable keyboard/input modes.
- [ ] Keyboard-only navigation reaches every control in a logical order.
- [ ] Focus is visible; labels and error messages are associated with their inputs.
- [ ] Contrast and statuses do not rely on color alone.
- [ ] Motion does not block task completion and respects reduced-motion preference.
- [ ] Reload and back/forward behavior do not lose or corrupt supported state.

## WorkKit scenarios

- [ ] Add/edit/remove/duplicate a shift; totals update as expected.
- [ ] Break subtraction and decimal conversion verified.
- [ ] Overnight shift crossing midnight verified.
- [ ] Invalid/missing time and negative/too-long break show helpful validation.
- [ ] Gross pay and regular/overtime split match checked examples.
- [ ] Empty timesheet, reset, CSV download and local draft restore work.
- [ ] Off-happy-path: malformed saved local data does not crash the tool.
- [ ] Off-happy-path: localStorage blocked or unavailable does not crash the page.
- [ ] Privacy/network claim matches observed requests and analytics payloads.

## QuickKit scenarios

- [ ] Image upload, preview, processing, output-size display and download work.
- [ ] Exact-size compressor reports actual size and handles an unattainable target honestly.
- [ ] Resize/conversion result opens and matches selected format/dimensions.
- [ ] Text count and cleanup update on input and handle empty text.
- [ ] Password generation uses browser randomness; copy action gives feedback.
- [ ] Wi-Fi QR encodes the entered fields and scans with a separate reader.
- [ ] Off-happy-path: unsupported/empty file and very large file produce recoverable messages.
- [ ] Off-happy-path: clearing/changing files releases prior preview/result resources.
- [ ] Any included PDF flow works with multiple files and exports a valid document.
- [ ] Privacy/network claim matches observed requests; selected files are not uploaded.

## FormReady scenarios

- [ ] Upload/paste, preview, crop/position, resize, compression and download work on desktop and touch mobile.
- [ ] File checker reports true format, byte size, dimensions and aspect ratio.
- [ ] Output passes configured constraints and the measured result is displayed.
- [ ] Missing/unsupported image, transparent image and oversized image have clear recovery paths.
- [ ] Preset details, official source link, verified status and independent-site disclaimer are clear.
- [ ] Unverified preset cannot display verified status.
- [ ] Off-happy-path: rotated EXIF image is oriented correctly or limitation is disclosed.
- [ ] Off-happy-path: clear/reset removes preview and previous output.
- [ ] Network panel confirms no image upload; analytics carries no image or requirement-sensitive data.

## Sign-off

| Product | Revision | Desktop fit | Mobile fit | Functional | Console/network | Evidence | Status |
|---|---|---|---|---|---|---|---|
| WorkKit | pending | pending | pending | pending | pending | pending | Not tested |
| QuickKit | pending | pending | pending | pending | pending | pending | Not tested |
| FormReady | pending | pending | pending | pending | pending | pending | Not tested |
