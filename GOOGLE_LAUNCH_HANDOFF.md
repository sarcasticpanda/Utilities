# Google Search and AdSense handoff

This checklist covers the owner-only Google account steps for the live Cloudflare Pages sites. Do not send passwords, one-time codes, identity documents or payment details through this project.

## Current site readiness

- All three Cloudflare Pages projects are live on the stable URLs below.
- `robots.txt`, sitemap, canonical URLs, title, description, social image and linked internal routes were checked live. The current audit covers 18 sitemap URLs and 33 linked HTML routes with no failures (`qa-results/seo-live-audit.json`).
- Three original guides are live and passed the 16-check browser QA (`qa-results/seo-guide-browser-smoke.json`).
- Contact, About, Privacy, Terms and open-source pages are linked from the site footers.
- The privacy pages now state that ads are currently off and explain the cookie/opt-out approach conditionally. Before ads are enabled, update each policy to reflect the actual ad vendors, account settings and consent setup.
- Global ad serving needs a consent plan. For personalized Google ads to people in the EEA, UK or Switzerland, Google requires a Google-certified CMP integrated with the IAB TCF. Google AdSense's Privacy & messaging offers a certified European regulations message; configure it from the publisher account before enabling those ads.
- All three URL-prefix properties are verified in Google Search Console; QuickKit, WorkKit and FormReady sitemap submissions were accepted. On 2026-11-01, WorkKit and FormReady sitemap tables report “Couldn't fetch”. Direct requests to all three sitemap URLs using a Googlebot user agent returned HTTP 200, `application/xml` and valid XML (QuickKit 10 URLs, WorkKit 5, FormReady 3). Recheck the GSC fetch status; acceptance is not confirmation that Google has crawled or indexed the URLs.
- No AdSense site entry, ad code, publisher ID or `ads.txt` has been added. The current signed-in Google account reports no access to an AdSense account; check whether a different Google account owns the publisher account before creating anything. The sites are not earning AdSense revenue.
- Search/indexing and AdSense approval status are unknown until the owner uses the Google dashboards. The browser audit proves reachability, not indexing or approval.

## Search Console: verify and submit sitemaps

1. Sign in to [Google Search Console](https://search.google.com/search-console/) with the Google account that should own the sites.
2. All three are already verified as **URL-prefix properties** using these exact HTTPS roots:
   - `https://workkit-hours-tools.pages.dev/`
   - `https://formready-photo-tools.pages.dev/`
3. The WorkKit and FormReady HTML verification files are deployed in each site root. Keep them there to retain ownership verification. A Domain property needs DNS access to the domain; `pages.dev` is Cloudflare's platform domain, so URL-prefix verification is used here.
4. All three sitemap submissions are recorded. The Search Console table currently says “Couldn't fetch” for WorkKit and FormReady. Both public XML files return HTTP 200 to Googlebot and parse correctly; check the report again after Google retries. If it remains an error, open the sitemap row for details and investigate the specific fetch issue:
   - `https://workkit-hours-tools.pages.dev/sitemap.xml`
   - `https://formready-photo-tools.pages.dev/sitemap.xml`
5. Use URL Inspection on the home page and the most important tool/guide URLs to review Google's status. Submit an indexing request only where the dashboard offers it. A sitemap or request does not guarantee crawling, indexing or ranking.
6. For Bing Webmaster Tools, sign in and use its Google Search Console import if available, or verify each HTTPS site separately and submit the same sitemap URLs.

## AdSense: add sites and request review

1. Sign in to the one AdSense account that should own the sites. Google permits one AdSense account per publisher; check for an existing account before creating another.
2. Add the sites under **Sites**, using the project hostnames:
   - `quickkit-browser-tools.pages.dev`
   - `workkit-hours-tools.pages.dev`
   - `formready-photo-tools.pages.dev`
3. If the initial signup form refuses a `pages.dev` hostname, create or continue the account without a site, then add the project hostnames on the Sites page. `pages.dev` is currently listed as a Public Suffix List platform suffix; Google's Sites workflow allows subdomains on listed platforms. This does not promise AdSense will accept or approve any particular site.
4. Follow the exact verification method AdSense shows. Send me only the site-verification code/snippet needed for implementation; never send credentials, identity details, tax data or payout information.
5. Enter identity and payout information directly in Google's account. Do not add a made-up `ads.txt` line or placeholder publisher ID. Google supplies the account-specific line if it requires `ads.txt`.
6. Review original content, clear navigation, privacy/terms/contact, and policy compliance before requesting review. Google decides eligibility and may request changes. There is no guaranteed approval, timeline, traffic or earnings.
7. For personalized ads in the EEA, UK or Switzerland, configure a Google-certified CMP integrated with IAB TCF. Google's Privacy & messaging European regulations message is one available certified option. Make sure consent is collected before the relevant ad requests and that the privacy pages match the actual vendors and settings.
8. Do not add ads until Google approves a site and marks it **Ready**. If approved, share the relevant publisher/ad snippet so I can add clearly separated placements away from upload, edit, calculation and download controls. Never click your own ads or encourage visitors to click them.

## Official references

- [Search Console ownership verification](https://support.google.com/webmasters/answer/9008080)
- [Google sitemap submission and indexing](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [AdSense site readiness](https://support.google.com/adsense/answer/7299563)
- [AdSense site management and supported platform subdomains](https://support.google.com/adsense/answer/12170421)
- [AdSense signup URL rules](https://support.google.com/adsense/answer/2784438)
- [AdSense site review and Ready status](https://support.google.com/adsense/answer/12131223)
- [Google-certified CMP requirements for EEA, UK and Switzerland](https://support.google.com/adsense/answer/13554116)
- [AdSense Privacy & messaging CMP setup](https://support.google.com/adsense/answer/7670013)
- [Current Public Suffix List](https://publicsuffix.org/list/public_suffix_list.dat)
