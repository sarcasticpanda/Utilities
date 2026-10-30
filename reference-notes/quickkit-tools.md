# QuickKit reference analysis: image, PDF and multi-tool repositories

## Upstream references

- OmniTools / FreeTools: https://github.com/firstlinkai/omnitools — README describes a Next.js/TypeScript suite of local browser tools; repository advertises MIT.
- PicBrew / ImageToolkit: https://github.com/dannycranmer/imagetoolkit — plain HTML/CSS/JavaScript, Canvas image tools; repository advertises MIT.
- Parchment: https://github.com/dannycranmer/parchment — plain HTML/CSS/JavaScript PDF tools using pdf-lib and PDF.js; repository advertises MIT.

Check each current `LICENSE` and third-party dependency license at the exact revision before copying.

## What each reference is good for

### OmniTools

Useful for understanding a Next.js utility catalog, client-side file-tool organization, dynamic loading, and page-level explanatory content. The README presents a very broad tool set spanning video, audio, PDF, images, text, QR and developer utilities. Its About summary and tool-list introduction give different counts, so do not rely on the advertised total. QuickKit should launch a small, coherent set of tools rather than inherit the breadth or complexity of the whole suite.

### PicBrew / ImageToolkit

Useful for browser Canvas patterns: image compression, resizing, format conversion, crop, rotation, watermark, image-to-PDF, batch handling and ZIP download. The README specifically describes client-side processing. Inspect the relevant image tool pages and JavaScript modules to learn how file input, canvas export, object URLs, format errors and batch cleanup are handled.

### Parchment

Useful for PDF merge/split, page previews/reordering, image-to-PDF, PDF-to-image, rotation and ZIP output. Its README identifies pdf-lib, PDF.js and JSZip as implementation dependencies. Inspect the specific tool pages and scripts before choosing which operations can be done efficiently in a same-day MVP.

## Recommended QuickKit first release

Prioritize image compressor-to-target-size, resize/convert, image-to-PDF, PDF merge, word/character counter, text cleanup, password generator, and Wi-Fi QR. Add PDF splitting only if its page-selection workflow can be implemented and checked well. Leave heavy video/audio and office conversion tools out of the first release.

## Adaptation and UX notes

- Treat “compress to 20/50/100 KB” as a user-centered flow: select target size, show progress, then show actual output size and dimensions. Never imply a target was met unless the resulting blob is measured and validated.
- Keep large file processing lazy-loaded and avoid blocking the interface; report unsupported formats and memory limits clearly, especially on phones.
- Release object URLs and large buffers when the user resets or changes files.
- Make local-only processing claims only for flows verified to avoid file uploads.
- Create unique tool pages with working tools and original explanation; do not generate many near-duplicate SEO pages.
- Make download, reset, reordering and upload controls easy to use by touch and keyboard. Never place ads near primary file actions.
