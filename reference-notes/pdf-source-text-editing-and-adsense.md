# PDF source-text editing and AdSense research

**Reviewed:** 2026-10-30  
**Purpose:** Find a lawful, realistic route from QuickKit's current OCR-assisted mask/overlay workflow to editing existing PDF text objects, and clarify the AdSense path for the three Cloudflare Pages sites.

## Finding: yes, an open-source engine exists

The strongest match found is [OffPDF](https://github.com/McanKul/offpdf), a MIT-licensed desktop PDF suite. Its [Edit text guide](https://github.com/McanKul/offpdf/blob/main/docs/EDIT_TEXT.md) documents a bounded source-content editor that rewrites supported text operators in the PDF's existing font, checks that other glyph positions stay within 0.01 pt, previews the actual output, and refuses edits it cannot verify. Deleting a line is supported by replacing it with an empty string. It does not cover old text with a white box, rasterize pages, or silently fall back to overlays.

This directly answers the earlier claim that there was no public repo demonstrating that capability: **there is one**. The previous QuickKit note about `pdf-lib` being unable to rewrite normal page text remains accurate for the library we currently use, but it is not a limit of every possible PDF engine.

### Important limits in OffPDF

- It edits one line at a time; it does not reflow or wrap paragraphs.
- The page must contain real, directly drawn PDF text. OCR text on a scanned image is not an existing text object and cannot be changed this way.
- It reuses glyphs from the document's existing font. If an embedded subset lacks a character, that text change is refused rather than substituting a font.
- It refuses or limits structures such as reusable Form XObjects, Type3 fonts, vertical/RTL/complex scripts, signed/encrypted PDFs, malformed/unsupported compression, and some unusual geometry.
- Its docs describe a desktop Tauri application. Text analysis uses Rust (`lopdf` plus a custom bounded parser); saving uses the native `qpdf` CLI and verification uses Poppler tools. Those external executables are not available in our static Cloudflare Pages runtime.

The implementation source can be studied under MIT with the required copyright/license notices. We have **not copied or bundled OffPDF code**, added its dependencies, or claimed that QuickKit now has true source-text editing.

## Recommended implementation path

1. Prototype a **browser WebAssembly engine**, keeping PDFs local to the user's device. Use OffPDF's source-text algorithm as a reference or port the needed Rust modules under their MIT terms; do not import the whole desktop application.
2. Establish an output writer/verifier that works in WebAssembly. OffPDF currently shells out to native qpdf and Poppler, so replacing those boundaries is required. [pdfstudio](https://github.com/fayazara/pdfstudio) is an Apache-2.0 example of qpdf compiled to WASM for browser operations, but it does not itself implement existing-text rewriting.
3. Preserve OffPDF's fail-closed behavior: supported line edits only; explain every refusal; never pretend OCR text on a scan is a source text object; keep original bytes unchanged; verify text extraction and visual output before download.
4. Add a small curated corpus covering embedded/subset fonts, missing glyphs, malformed streams, rotated pages, multiple columns, scans, signatures, Unicode and adversarial PDFs. Only enable the feature after those cases pass in the browser and production bundle.
5. Keep the current clearly-labeled overlay/replacement path for scans and unsupported PDFs, with explicit flattened-page warning. Do not label it as exact original-text editing.

**Decision:** This is technically possible and licensable for a commercial/advertising product. It is not a one-line package swap; the browser writer/verifier and robust PDF-parser integration are substantial engineering work. A small WASM feasibility spike is the next concrete step. Do not add MuPDF/AGPL to the hosted product unless the owner chooses to publish the combined source or obtains a commercial license.

## AdSense: practical status and steps

- The three sites are currently on Cloudflare Pages, and no AdSense account code, `ca-pub-...` ID, ads.txt, or live ads are configured.
- Google's official Sites guidance accepts domains and subdomains on public-suffix platforms. The [current Public Suffix List includes `pages.dev`](https://publicsuffix.org/list/public_suffix_list.dat), so the three exact `*.pages.dev` hosts can be tried separately in **AdSense → Sites** after an account exists. Google's account sign-up URL guidance is narrower and may reject a Pages host as the initial URL; if that occurs, create the account without a site and add each host under Sites afterward. A custom domain is optional if Google accepts and verifies the Pages hosts.
- Add each site's root host, connect it with the exact Google-provided verification method, and wait for the site's status to become **Ready**. Google says review often takes a few days and can take 2–4 weeks. Ads are not served before approval.
- Google explicitly expects unique, useful, relevant content and clear navigation. Tool pages need real guidance, examples, limitations, privacy/support information, and a strong usable experience; copied competitor text or thin keyword pages are not a shortcut to approval.
- After approval, choose Auto ads or manual placements. Keep ads away from file upload, calculator inputs, editor controls and download buttons. Add only the publisher-issued ads.txt line if AdSense provides/recommends it.
- Revenue is generated by eligible ad impressions and, for some formats, genuine user clicks. The amount varies with audience, ad demand, format and viewability; there is no reliable fixed rate per visitor. Payment requires tax/identity/address steps and the payment threshold for the account's currency; the exact threshold is shown in AdSense.
- Never click your own ads, buy traffic, use traffic exchanges, or tell people to click ads. Invalid traffic risks ad limits, deductions or account suspension.
- Approval, search position, traffic and revenue are not guaranteed. It is not an instant income source; these sites currently have no ads or AdSense account integration.

See [`SEO_ADSENSE_PLAN.md`](../SEO_ADSENSE_PLAN.md) for the owner-facing checklist and authoritative Google links.
