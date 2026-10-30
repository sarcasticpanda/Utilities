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

- [x] Specific titles/descriptions for core tool pages.
- [x] Canonical URLs, `robots.txt`, sitemaps and crawlable HTML copy for the planned Pages URLs.
- [x] Helpful tool explanations, privacy pages, terms, about and contact pages.
- [ ] Replace planned hostnames after the final domain is selected and deployed.
- [ ] Verify the custom-domain properties in Google Search Console and Bing Webmaster Tools; submit sitemaps after launch.
- [ ] Add original tutorials that answer real questions (for example, decimal hours, unpaid breaks, resizing to a portal's byte limit), with examples, limits and sources. Avoid thin pages made only to target city/country keyword variants.
- [ ] Add operator-owned support contact and original Open Graph images.
- [ ] Measure mobile Core Web Vitals and search impressions after launch; prioritize the pages that actually earn impressions/clicks.

## Google AdSense: how to add ads

AdSense is the publisher product that can pay for displaying ads on a site. Google Ads is the advertiser product used to pay for campaigns. They are not interchangeable.

1. Publish each property on a domain you control and make sure the contact, privacy, terms and original-useful-content pages are complete.
2. Create/sign in to the AdSense account, add the site URL, enter payment and identity details yourself, and connect the site using the verification method AdSense provides.
3. Wait for Google to verify ownership and review the site. Google's current guidance says this often takes a few days but can take 2–4 weeks; no site or income is guaranteed approval.
4. After approval, use Auto ads to start, preview placements, and exclude any area where ads would interfere with upload, edit, calculate or download controls. If preferred, place ad units manually in reserved areas outside the interactive tool.
5. Publish the generated `ads.txt` file if Google recommends it for the account and verify it is reachable at each site's root.

No AdSense account, ad code, publisher ID, payment information, or ads.txt file has been added. The owner must supply the AdSense-issued code only after approval; do not guess or use a placeholder publisher ID. Current Pages URLs are hosted subdomains (`*.pages.dev`), so try the exact host in AdSense Sites; Google's eligibility rules distinguish ordinary subdomains from subdomains on supported public-suffix platforms. If AdSense rejects a Pages hostname or requires a domain you own, connect a custom domain first. Google verifies ownership and reviews the content before ads can serve. The review can take a few days and sometimes 2–4 weeks.

**What the owner does next:** sign in at [AdSense](https://adsense.google.com/start/), try adding one live hostname under Sites, and follow the verification prompt. Do not add payment details in this repository. If the host is accepted, copy the account-issued publisher ID and verification/ad code; only then can it be safely configured and deployed. Ads do not appear until the account and site are approved and the owner enables ads.

## References

- [Google Search Essentials](https://developers.google.com/search/docs/essentials)
- [Google: title links and search appearance](https://developers.google.com/search/help/site-appearance-faq)
- [Google: snippets and meta descriptions](https://developers.google.com/search/docs/appearance/snippet)
- [AdSense: connect your site and review](https://support.google.com/adsense/answer/7584263)
- [AdSense: sign-up and review](https://support.google.com/adsense/answer/10162)
- [AdSense: set up ads, Auto ads or ad units](https://support.google.com/adsense/answer/7037624)
