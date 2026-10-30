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

No AdSense account, ad code, publisher ID, payment information, or ads.txt file has been added. The owner must supply the AdSense-issued code only after approval; do not guess or use a placeholder publisher ID. Cloudflare's `pages.dev` is listed as a public suffix, and Google's Sites guidance permits subdomains on public-suffix platforms (for example `site.appspot.com`), so try each exact Pages hostname in **Sites** after the account exists. Google's separate initial sign-up URL guidance is narrower and may not accept a Pages hostname as the account's initial site; if so, create the account without a site and add the Pages host from Sites later, or connect a custom domain. AdSense still has to verify control and approve every site before ads can serve. The review often takes a few days and can take 2–4 weeks.

**What the owner does next:** sign in at [AdSense](https://adsense.google.com/start/), add one live Pages hostname under Sites, and follow the verification prompt. If the sign-up form rejects it, finish account setup without a site and add it from Sites. Do not add payment details in this repository. If Google issues verification/ad code, the owner can provide the publisher ID and code for deployment after approval. Ads do not appear until the account and site are approved and the owner enables ads. Never click your own ads or ask visitors to click them; invalid traffic can disable serving or the account.

Ad revenue is not a fixed amount per visit. It varies with eligible impressions, genuine ad engagement, audience, ad demand and placement. Google requires account verification and payment setup, and pays after the account reaches the threshold for its reporting currency. There is no guaranteed approval, traffic level or income.

## References

- [Google Search Essentials](https://developers.google.com/search/docs/essentials)
- [Google: title links and search appearance](https://developers.google.com/search/help/site-appearance-faq)
- [Google: snippets and meta descriptions](https://developers.google.com/search/docs/appearance/snippet)
- [AdSense: connect your site and review](https://support.google.com/adsense/answer/7584263)
- [AdSense: sign-up and review](https://support.google.com/adsense/answer/10162)
- [AdSense: set up ads, Auto ads or ad units](https://support.google.com/adsense/answer/7037624)
- [AdSense: add a new site](https://support.google.com/adsense/answer/12169212)
- [AdSense: site URL rules at signup](https://support.google.com/adsense/answer/2784438)
- [AdSense: what can be added as a site](https://support.google.com/adsense/answer/12170421)
- [AdSense: payment thresholds](https://support.google.com/adsense/answer/1709871)
- [AdSense: invalid traffic](https://support.google.com/adsense/answer/16737)
- [Public Suffix List](https://publicsuffix.org/list/public_suffix_list.dat)
