# Search visibility and AdSense launch plan

## Positioning

Use one umbrella name, **LunarPanda Tools**, and keep the individual tool brands descriptive:

- **QuickKit** — PDF editor, PDF merger and image tools.
- **WorkKit** — time card, overtime and salary calculators.
- **FormReady** — photo and signature resizer for forms.

Use each page title and visible H1 to say what the page does. Keep the descriptions useful and distinct; do not repeat keyword lists. Current page-title improvements are in the HTML source. Google may choose a different snippet for a query, and ranking/indexing is not guaranteed.

## Audience and search intent

Build the initial content around broadly understood tool terms:

- **US and worldwide WorkKit:** time card calculator, timesheet calculator, overtime pay calculator, hourly-to-salary calculator.
- **India and worldwide FormReady:** resize photo to pixels, photo size in KB, signature resize, photo size in mm/inches at a chosen DPI. Only make government/exam compliance claims when an exact current official source has been checked.
- **QuickKit:** PDF editor, merge PDF files, compress image to KB, image compressor, Wi-Fi QR code.

WorkKit now supports USD, INR, GBP, EUR, CAD, AUD and AED formatting. Choosing a currency only labels/formats the amount; it does not convert exchange rates. Add country-specific overtime rules only after sourcing and validating the relevant official guidance.

## Technical and content work

### Latest production review — 2026-11-01

- [x] Rechecked live technical SEO across 18 sitemap URLs and 33 linked routes on QuickKit, WorkKit and FormReady: canonical/title/description/social metadata, indexability, robots and sitemap responses all passed with 0 crawl failures (`qa-results/seo-live-audit.json`).
- [x] Expanded FormReady's original photo/signature guide with practical answers about inclusive KB ranges, paper cleanup, cycle-specific presets and when to use the optional name/date strip; verified the guide and all three production guides in Chromium at 390px (16/16 checks).
- [ ] Use Search Console after Google recrawls to inspect indexing, queries and impressions. The WorkKit and FormReady sitemap reports previously showed “Couldn't fetch” even though automated requests received valid XML/HTTP 200; this remains an external crawler-status issue to monitor.
- Ranking cannot be forced to top 10 with metadata or a sitemap. Google says meeting its technical requirements does not guarantee crawling, indexing or serving a page; earn visibility through helpful, accurate content and genuine demand, then use Search Console data to decide what to improve.

- [x] Specific titles/descriptions for core tool pages.
- [x] Canonical URLs, `robots.txt`, sitemaps and crawlable HTML copy on the live Pages URLs; expanded live audit checked all 18 sitemap URLs and 33 internally linked HTML routes across the three properties with 0 failures (`qa-results/seo-live-audit.json`).
- [x] Self-host Outfit WOFF2 on all three sites, remove render-blocking Google Fonts CSS requests, and preload the local font; production pages no longer need Google Fonts to render.
- [x] Production Lighthouse mobile lab baseline after deployment (2026-10-31): QuickKit PDF editor 77 performance, 100 accessibility, 100 best practices, 100 SEO; WorkKit time-card calculator 98/100/100/100; FormReady image-preparer 98/100/100/100. LCP: 4.1 s, 2.1 s, 2.0 s respectively; CLS 0, 0.026, 0.003; TBT 0 ms on all. Reports: `tmp/lighthouse-quickkit-production-final.json`, `tmp/lighthouse-workkit-production-final.json`, `tmp/lighthouse-formready-production-final.json`. These are Lighthouse lab runs and do not replace Search Console or real-user CrUX measurements.
- [x] Helpful tool explanations, privacy pages, terms, about and contact pages.
- [x] Privacy pages explain current ad-disabled status and conditionally disclose Google/partner advertising cookies, personalization controls and opt-out links; verified HTTP 200 on all three production sites after deployment. Update the disclosures to the actual configured vendors before enabling ads.
- [ ] Before serving personalized ads to EEA, UK or Swiss visitors, configure a Google-certified CMP integrated with IAB TCF. Google AdSense Privacy & messaging's European regulations message is a certified option. Do not send relevant ad requests before consent is configured.
- [x] Keep the current Cloudflare Pages hostnames and make every canonical/sitemap URL match them. No custom domain has been purchased or attached.
- [x] Verify all three HTTPS URL-prefix properties in Google Search Console and submit all three sitemaps. On 2026-11-01, Google currently shows “Couldn't fetch” for WorkKit and FormReady although each sitemap returns valid XML with HTTP 200 to a Googlebot user agent. Recheck fetch status; submission does not prove crawling or indexing. Bing Webmaster Tools verification remains open. A URL-prefix property can use an HTML file or meta verification method; a `pages.dev` DNS zone is not the owner's zone.
- [x] Add three original, linked guides with examples and limits: [PDF text editing/OCR](https://quickkit-browser-tools.pages.dev/pdf-text-and-ocr-guide.html), [work hours/breaks/overtime](https://workkit-hours-tools.pages.dev/time-card-and-overtime-guide.html), and [form-photo/signature dimensions/file size](https://formready-photo-tools.pages.dev/photo-signature-file-size-guide.html). Browser check: `qa-results/seo-guide-browser-smoke.json`.
- [x] Link each Contact page to the public Utilities GitHub issue tracker without publishing a personal email; add original 1200×630 Open Graph PNG cards to every page.
- [ ] Measure mobile Core Web Vitals and search impressions after Search Console is verified; prioritize pages with real impressions/clicks.

## Google AdSense: how to add ads

AdSense is the publisher product that can pay for displaying ads on a site. Google Ads is the advertiser product used to pay for campaigns. They are not interchangeable.

1. Publish each property on a domain you control and make sure the contact, privacy, terms and original-useful-content pages are complete.
2. Create/sign in to the AdSense account, add the site URL, enter payment and identity details yourself, and connect the site using the verification method AdSense provides.
3. Wait for Google to verify ownership and review the site. Google's current guidance says this often takes a few days but can take 2–4 weeks; no site or income is guaranteed approval.
4. After approval, use Auto ads to start, preview placements, and exclude any area where ads would interfere with upload, edit, calculate or download controls. If preferred, place ad units manually in reserved areas outside the interactive tool.
5. Publish the generated `ads.txt` file if Google recommends it for the account and verify it is reachable at each site's root.

No AdSense account, ad code, publisher ID, payment information, or ads.txt file has been added. The three original guides and 33 crawlable internal routes improve readiness, but Google does not promise approval; its review checks useful original content, navigation, ownership and policy compliance. If the signup form rejects a Pages hostname, create/continue the account without a site and add the exact hostname through **Sites**. `pages.dev` is listed in the Public Suffix List, and Google's Sites workflow accepts subdomains on listed platforms; this still does not guarantee Google will approve a particular site. Use the verification method AdSense presents. Each site must reach **Ready** before it can serve ads. Google recommends ads.txt and supplies the exact publisher line after account creation; wait for that ID instead of adding a placeholder. The privacy pages now state that ads are off and describe future ad cookies conditionally; update them again to match actual vendors and settings before monetization. For personalized Google ads in the EEA, UK and Switzerland, configure a Google-certified CMP integrated with IAB TCF; Google's Privacy & messaging European regulations message is a certified option. Search Console verification and AdSense account/payment setup require the owner to sign in. Do not paste bank, identity or payment details into this repository. See `GOOGLE_LAUNCH_HANDOFF.md` for the exact account checklist.

**What the owner does next:** follow `GOOGLE_LAUNCH_HANDOFF.md`: verify all three HTTPS URL-prefix properties in Search Console, submit each sitemap, then add the exact Pages hostnames in AdSense Sites. Send only the verification artifact or site/ad snippet needed for implementation. Enter payout/identity details directly in Google's site. Ads do not appear before approval and `Ready` status. Never click your own ads or ask visitors to click them; invalid traffic can disable serving or the account.

Google says sitemap submission is a crawl hint, not a guarantee of indexing or improved ranking. Its AdSense readiness guidance asks for unique, relevant content and clear navigation; the guides above are practical additions, but the sites have not been reviewed by AdSense and may need more original content before applying. Google Search, AdSense approval, traffic and earnings remain unguaranteed.

Ad revenue is not a fixed amount per visit. It varies with eligible impressions, genuine ad engagement, audience, ad demand and placement. Google requires account verification and payment setup, and pays after the account reaches the threshold for its reporting currency. There is no guaranteed approval, traffic level or income.

## References

- [Google Search Essentials](https://developers.google.com/search/docs/essentials)
- [Google: build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google Search: crawling and indexing FAQ](https://developers.google.com/search/help/crawling-index-faq)
- [Search Console: verify site ownership](https://support.google.com/webmasters/answer/9008080)
- [Google: title links and search appearance](https://developers.google.com/search/help/site-appearance-faq)
- [Google: snippets and meta descriptions](https://developers.google.com/search/docs/appearance/snippet)
- [AdSense: connect your site and review](https://support.google.com/adsense/answer/7584263)
- [AdSense: what makes a site ready](https://support.google.com/adsense/answer/7299563)
- [AdSense: site management and platform subdomains](https://support.google.com/adsense/answer/12170421)
- [AdSense: add a new site](https://support.google.com/adsense/answer/12169212)
- [AdSense: site approval status](https://support.google.com/adsense/answer/12170222)
- [AdSense: ads.txt setup](https://support.google.com/adsense/answer/12171612)
- [AdSense: sign-up and review](https://support.google.com/adsense/answer/10162)
- [AdSense: set up ads, Auto ads or ad units](https://support.google.com/adsense/answer/7037624)
- [AdSense: add a new site](https://support.google.com/adsense/answer/12169212)
- [AdSense: what can be added as a site](https://support.google.com/adsense/answer/12170421)
- [AdSense: site URL rules at signup](https://support.google.com/adsense/answer/2784438)
- [AdSense: payment thresholds](https://support.google.com/adsense/answer/1709871)
- [AdSense: invalid traffic](https://support.google.com/adsense/answer/16737)
- [Google-certified CMP requirements for EEA, UK and Switzerland](https://support.google.com/adsense/answer/13554116)
- [AdSense Privacy & messaging CMP setup](https://support.google.com/adsense/answer/7670013)
- [Public Suffix List](https://publicsuffix.org/list/public_suffix_list.dat)
