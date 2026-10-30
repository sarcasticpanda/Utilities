# Visibility and Deployment Checklist

Use one copy of the checks per site's canonical domain. Search visibility is a long-running outcome; this checklist tracks controllable setup and meaningful content, not rankings.

## Product and content

- [ ] One main audience and search intent are clear for the homepage.
- [ ] Every indexable tool page has a working tool and original explanation.
- [ ] Page title, description, H1 and canonical URL are unique and accurate.
- [ ] Examples, FAQs and limitations answer real user questions.
- [ ] Internal links help users move to the next related tool.
- [ ] No mass-generated near-duplicate keyword pages or unsupported claims.
- [ ] Privacy, terms, about, contact and open-source acknowledgements are available.
- [ ] FormReady presets are sourced from official instructions; unsupported requirements are not presented as facts.

## Technical discoverability

- [ ] HTTPS and preferred hostname resolve consistently.
- [ ] `robots.txt` permits intended public pages and references sitemap.
- [ ] Sitemap includes canonical pages only and returns HTTP 200.
- [ ] Canonical tags and metadata match the deployed host.
- [ ] No accidental `noindex`, broken links, missing assets or unintended 404s.
- [ ] Social preview metadata and image are present.
- [ ] Static page text is crawlable without completing a client-side interaction.
- [ ] Page speed and Core Web Vitals reviewed on mobile; large libraries are deferred where possible.

## Publish and follow-up

- [ ] Production build/preview passes.
- [ ] Public homepage and core tool URLs open over HTTPS.
- [ ] Post-deploy browser smoke test completed and recorded in `BROWSER_QA_CHECKLIST.md`.
- [ ] Verify property in Google Search Console when account access is available.
- [ ] Submit sitemap in Search Console and Bing Webmaster Tools when account access is available.
- [ ] Check indexing/crawl errors after launch; record dates and URLs.
- [ ] Monitor queries, locations and pages before expanding content.

## Monetization readiness

- [ ] No advertisement is styled or positioned like upload, calculate, continue, or download.
- [ ] Ad containers reserve space to avoid layout shifts and are disabled until approved.
- [ ] Affiliate links, if any, are relevant and disclosed.
- [ ] No ad clicks, impression reloads or other manufactured engagement.
- [ ] Track ad review status separately; approval and revenue are not guaranteed by publication.

## Deployment log

| Product | Host | Public URL | Build revision | Sitemap URL | Smoke check | Status |
|---|---|---|---|---|---|---|
| WorkKit | pending | pending | pending | pending | pending | Not deployed |
| QuickKit | pending | pending | pending | pending | pending | Not deployed |
| FormReady | pending | pending | pending | pending | pending | Not deployed |
