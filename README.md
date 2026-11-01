# LunarPanda Tools

Three focused browser tools for everyday work: edit PDFs, track hours, and prepare application photos. Each product is a separately built static website hosted on Cloudflare Pages.

## Live websites

| Product | What it does | Open |
|---|---|---|
| **QuickKit** | PDF editing, conversion and OCR; photo-to-PDF, image tools, video editing and GPS-tagged photos | [quickkit-browser-tools.pages.dev](https://quickkit-browser-tools.pages.dev/) |
| **WorkKit** | Weekly time cards, overnight shifts, breaks, overtime, pay estimates and dated currency conversion | [workkit-hours-tools.pages.dev](https://workkit-hours-tools.pages.dev/) |
| **FormReady** | Exam and application photo/signature presets, crop, resize, compression and a requirements checker | [formready-photo-tools.pages.dev](https://formready-photo-tools.pages.dev/) |

## Product previews

### QuickKit

<p>Short mobile captures, shown as separate screen sections rather than one long page:</p>
<p><a href="https://quickkit-browser-tools.pages.dev/"><img src="qa-results/readme-parts/quickkit-home-hero.png" alt="QuickKit home, mobile hero section" width="31%"></a> <a href="https://quickkit-browser-tools.pages.dev/#tools"><img src="qa-results/readme-parts/quickkit-home-tools.png" alt="QuickKit home, mobile tool cards" width="31%"></a> <a href="https://quickkit-browser-tools.pages.dev/image-to-pdf.html"><img src="qa-results/readme-parts/quickkit-image-to-pdf-gallery.png" alt="Images to PDF, mobile gallery section" width="31%"></a></p>
<p><a href="https://quickkit-browser-tools.pages.dev/image-to-pdf.html"><img src="qa-results/readme-parts/quickkit-image-to-pdf-edit.png" alt="Images to PDF, mobile crop and editing section" width="31%"></a></p>
<p><a href="https://quickkit-browser-tools.pages.dev/video-tools.html"><img src="qa-results/readme-parts/quickkit-video-multi-trim.png" alt="QuickKit video trim tool with multiple saved ranges" width="72%"></a></p>

### WorkKit

<p><a href="https://workkit-hours-tools.pages.dev/"><img src="qa-results/screenshots/workkit-home-desktop.png" alt="WorkKit desktop homepage screenshot" width="72%"></a></p>
<p><a href="https://workkit-hours-tools.pages.dev/"><img src="qa-results/screenshots/workkit-home-mobile.png" alt="WorkKit mobile homepage screenshot" width="32%"></a></p>

### FormReady

<p><a href="https://formready-photo-tools.pages.dev/"><img src="qa-results/screenshots/formready-home-desktop.png" alt="FormReady desktop homepage screenshot" width="72%"></a></p>
<p><a href="https://formready-photo-tools.pages.dev/"><img src="qa-results/screenshots/formready-home-mobile.png" alt="FormReady mobile homepage screenshot" width="32%"></a></p>

## Highlights

- Responsive pages checked at desktop, tablet and narrow phone sizes.
- QuickKit converts and arranges photos into PDFs, annotates PDF pages, and can directly replace or delete a limited set of supported existing PDF text runs. OCR-assisted replacement/redaction is available for other page content; OCR replacement is approximate, while redaction flattens affected pages on export.
- WorkKit validates shifts and avoids counting overlapping work twice; it saves drafts locally, exports CSV, and can show an overtime estimate in another currency using a dated daily reference rate.
- FormReady measures the generated image dimensions and file size against requirements entered by the visitor.
- File processing happens in the browser; the tools do not upload visitors' files to an application server.
- Privacy, terms, about, contact and third-party acknowledgement pages are included for each product.

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm ci
npm run build
npm run dev:quickkit
```

The other development servers are `npm run dev:workkit` and `npm run dev:formready`. Product-specific builds are available as `npm run build:quickkit`, `npm run build:workkit` and `npm run build:formready`.

Each Vite build is configured in `products/<product>/vite.config.js` and writes to that product's `dist/` directory. QA scripts and recorded results are documented in [BROWSER_QA_CHECKLIST.md](BROWSER_QA_CHECKLIST.md).

## Hosting and search

The public sites use Cloudflare Pages `pages.dev` hostnames. No custom domain is currently connected. Google Search Console ownership is verified for WorkKit and FormReady and sitemap routes are published; actual indexing and rankings depend on search engines.

No Google ads are currently served. AdSense requires the site owner to connect an account, verify the site, and receive approval. A public README or code change does not activate advertising.

## Rights and third-party software

Original LunarPanda Tools source, product names, written content and visual design are proprietary. See [LICENSE](LICENSE). The public repository is viewable and may be forkable through GitHub; the notice does not technically prevent copying. Make the repository private if hiding the source is the priority.

Third-party dependencies retain their own terms. Product-specific notices are in each product's `public/THIRD-PARTY-NOTICES.txt`; the ClockMath helper attribution is in WorkKit's [open-source acknowledgements](https://workkit-hours-tools.pages.dev/open-source-acknowledgements.html).

## Project records

- [Implementation and release tracker](IMPLEMENTATION_TRACKER.md)
- [Browser QA checklist and evidence](BROWSER_QA_CHECKLIST.md)
- [Visibility and deployment checklist](VISIBILITY_AND_DEPLOYMENT_CHECKLIST.md)
- [Project backlog](PROJECT_TODO.md)
- [Hosting and domain plan](HOSTING_MIGRATION.md)
- [Search and AdSense setup plan](SEO_ADSENSE_PLAN.md)
