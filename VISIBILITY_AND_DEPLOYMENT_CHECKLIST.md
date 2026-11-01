# Visibility and deployment checklist

Search visibility is a long-running outcome. This log tracks the parts we can verify and the external setup that still needs the site owner's accounts or details.

## Product and content

- [x] Each homepage states its primary use and links to working tools.
- [x] Tool pages have original explanatory copy and the tool near the top of the page.
- [x] Page titles, descriptions, H1s and canonical URLs are present and match the live host.
- [x] Privacy, terms, about, contact and open-source acknowledgements are available.
- [x] FormReady has no unverified preset claims and explains that it is independent.
- [ ] Contact pages still need an operator-owned email address or feedback channel.

## Technical discoverability

- [x] All three Cloudflare Pages sites resolve over HTTPS and are public.
- [x] `robots.txt` permits public pages and links to the matching sitemap.
- [x] Each sitemap includes its homepage and working tool pages; all three return HTTP 200.
- [x] Canonical tags and social title/description metadata match each deployed origin.
- [x] Core page text is static and readable without completing a client-side interaction.
- [x] Social preview images (`og:image`) are configured on all three sites.
- [ ] Mobile Core Web Vitals and real-user performance are not measured yet.
- [x] Google Search Console ownership was verified for WorkKit and FormReady; sitemaps are published. Recheck fetch/index reports after Google recrawls.

## Publish and follow-up

- [x] Production builds completed for all products.
- [x] Previous Sites version 3 passed its 11-route live smoke test; the current Pages release passed all 13 routes below.
- [x] Production tool interactions passed for one representative flow per product.
- [ ] Verify indexing and crawl reports after Search Console/Bing access is connected.
- [ ] Monitor search terms, regions and landing pages before adding more content.

## Monetization readiness

- [x] No ads are enabled or styled like an upload, calculate or download action.
- [x] No affiliate links are present.
- [ ] Select and disclose an analytics provider before adding privacy-safe event measurement.
- [ ] Apply for an ad network after content, contact details and traffic are ready; approval and earnings are not guaranteed by publication.

## Deployment log

| Product | Host | Public URL | Sitemap | Live smoke | Status |
|---|---|---|---|---|---|
| WorkKit | Cloudflare Pages | https://workkit-hours-tools.pages.dev | [sitemap.xml](https://workkit-hours-tools.pages.dev/sitemap.xml) | Passed | Public |
| QuickKit | Cloudflare Pages | https://quickkit-browser-tools.pages.dev | [sitemap.xml](https://quickkit-browser-tools.pages.dev/sitemap.xml) | Passed | Public |
| FormReady | Cloudflare Pages | https://formready-photo-tools.pages.dev | [sitemap.xml](https://formready-photo-tools.pages.dev/sitemap.xml) | Passed | Public |

## Latest publish — 2 November 2026

- QuickKit, WorkKit and FormReady were rebuilt and deployed directly to their existing Cloudflare Pages projects.
- Production verification passed: cross-site browser QA 92/92, QuickKit video editor 37/37, multi-range trim 9/9, FormReady Exam Form Kit 19/19, and the technical SEO crawl 19 sitemap URLs / 34 linked routes / 0 failures.
- Cloudflare Pages is not connected to GitHub. The GitHub push records the source and docs but does not trigger a deployment; future production updates must be deployed to Cloudflare separately unless Git integration is configured.

Custom domains are not connected. Traffic, ranking, immediate indexing, ad approval and income depend on external services and user demand.

## Cloudflare Pages launch — 30 October 2026

- [x] Cloudflare account was authorized and verified; profile cloudflare-pages-launch deployed all three projects.
- [x] QuickKit, WorkKit and FormReady production builds deployed to their free pages.dev hosts.
- [x] Local Chromium QA passed 79 checks with 0 failures.
- [x] QuickKit PDF editor OCR/replacement/redaction workflow passed 32 checks locally and on the live Pages host.
- [x] QuickKit image-to-PDF is included in its sitemap and deployed on Pages.
- [x] Three-site responsive browser QA passed 79 checks with no failures.
- [x] Production browser smoke passed 13 routes and representative flows with 0 failures.
- [x] No application files are uploaded by the browser tools; file processing stays local.
- [ ] Domain registration and custom DNS are optional, separate and still pending. No purchase has been made.
