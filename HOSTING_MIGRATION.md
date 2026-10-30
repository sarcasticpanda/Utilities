# Cloudflare Pages launch and domain plan

## Current state

- WorkKit, QuickKit and FormReady remain available at their existing `chatgpt.site` addresses.
- Their independent static builds are in `products/{workkit,quickkit,formready}/dist/` after `npm run build`.
- The Cloudflare account is authorized. No custom domain is connected; the three sites use the free `pages.dev` hostnames.
- All three Cloudflare Pages projects have been created and deployed.
- The account's `workers.dev` name is available for Workers; that does not mean the Pages sites have been published.
- Wrangler profile `cloudflare-pages-launch` was verified against account `c3255f0edd72bc4815523bb229ac0fbc` and used for the deploys. The unrelated default profile was not used.
- No domain has been purchased and no billing plan has been changed.

## Brand and domain recommendation

Use one umbrella brand, **LunarPanda Tools**, with three product labels:

- **QuickKit** — PDF, image, text and Wi-Fi QR tools.
- **WorkKit** — timesheets, work-hour/pay estimates and salary conversions.
- **FormReady** — crop, resize and compress application photos/signatures.

Recommended domain to search in Cloudflare Registrar: **`lunarpandatools.com`**. It is broad enough for all three products, readable, and keeps the existing product names intact. If unavailable, try **`lunarpanda.tools`**; its renewal is currently listed higher than `.com`. Search results are not a guarantee until Cloudflare's final checkout availability check.

Cloudflare Registrar's public price table currently lists `.com` at **US$10.46/year** and `.tools` at **US$28.20/year** for registration and renewal. Currency conversion, taxes, and the final account checkout may change the amount. Do not purchase until the owner checks the exact renewal and total in Cloudflare and decides.

After a domain is registered and added as a Cloudflare zone, map product subdomains:

```text
quickkit.lunarpandatools.com
workkit.lunarpandatools.com
formready.lunarpandatools.com
```

Until then, Cloudflare's free `*.pages.dev` hostnames are suitable for launch testing and public use. They are not custom domains.

## Live Cloudflare Pages sites

| Site | Cloudflare Pages project | Planned Pages URL | Current status |
|---|---|---|---|
| QuickKit | `quickkit-browser-tools` | `https://quickkit-browser-tools.pages.dev` | Deployed; final editor update deployed after first launch |
| WorkKit | `workkit-hours-tools` | `https://workkit-hours-tools.pages.dev` | Deployed |
| FormReady | `formready-photo-tools` | `https://formready-photo-tools.pages.dev` | Deployed |

The Vite build sets canonical URLs and sitemaps to the planned Pages URLs. Before connecting a custom domain, regenerate each `site-origin.txt` and SEO files using the final hostnames, rebuild, deploy, and check the returned canonical links, sitemap and robots files.

## Launch checklist

- [x] Build all three static projects successfully.
- [x] Complete local Chromium browser sweep: 75 checks, 0 failures.
- [x] Run dedicated QuickKit PDF editor smoke checks (28 checks).
- [x] Create all three Cloudflare Pages projects and deploy the static builds.
- [x] Run production browser smoke checks: 12 routes and representative tool flows, 0 failures.
- [ ] Choose and check the umbrella domain inside Cloudflare Registrar.
- [ ] Decide whether to register the domain; review renewal price and checkout total first.
- [x] Owner completes OAuth for the intended Cloudflare account; verify account identity before deploying.
- [x] Deploy all three sites with the named profile, not the unrelated default profile.
- [ ] Add each deployment's Cloudflare custom hostname after domain registration; wait for HTTPS activation.
- [x] Smoke-check all site routes, representative tool flows, responsive layout, `robots.txt`, `sitemap.xml`, canonical URLs and the live PDF editor download.
- [x] Keep the existing published Sites available as a fallback; Pages sites are live.
- [ ] Add verified domain properties to Search Console/Bing and submit sitemaps after the final URLs are set.
- [ ] Revisit ads only after useful content, contact details, privacy pages and traffic are in place; approval and income are not guaranteed.

## References

- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare Pages static asset pricing](https://developers.cloudflare.com/pages/functions/pricing/)
- [Cloudflare Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Cloudflare Registrar domain prices](https://pricing.registrar.cloudflare.com/)
- [Cloudflare Registrar domain registration](https://developers.cloudflare.com/registrar/get-started/register-domain/)
- [WorkKit and FormReady competitor review](reference-notes/workkit-formready-competitor-review.md)
