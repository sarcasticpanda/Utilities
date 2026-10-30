# FormReady

Prepare an application photo or signature by cropping, resizing and checking its dimensions and file size.

**Live site:** https://formready-photo-tools.pages.dev/

## Screenshots

### Homepage

<p><img src="../../qa-results/screenshots/formready-home-desktop.png" alt="FormReady homepage on desktop" width="76%"></p>
<p><img src="../../qa-results/screenshots/formready-home-mobile.png" alt="FormReady homepage on a mobile phone" width="34%"></p>

### Photo and signature preparer

<p><img src="../../qa-results/screenshots/formready-image-preparer-desktop.png" alt="FormReady image preparer on desktop" width="76%"></p>
<p><img src="../../qa-results/screenshots/formready-image-preparer-mobile.png" alt="FormReady image preparer on a mobile phone" width="34%"></p>

## How it works

Choose a JPEG, PNG or WebP image, crop it, enter the required width/height and maximum file size, then download the measured output. Physical dimensions can be converted from millimeters or inches using a selected DPI. Image editing stays in the browser.

FormReady is an independent general-purpose tool. It is not affiliated with a government agency, examination board or application portal. The visitor must enter current requirements; the tool does not guarantee that an application will accept an image.

## Development

From the workspace root, run `npm ci`, then `npm run dev:formready`. Build with `npm run build:formready`.

## Project and third-party notices

This product is proprietary; see the workspace [LICENSE](../../LICENSE). Dependencies retain their own terms, documented in `public/THIRD-PARTY-NOTICES.txt` and the live [open-source acknowledgements](https://formready-photo-tools.pages.dev/open-source-acknowledgements.html).
