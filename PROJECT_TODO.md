# Project TODO

This list is the action queue for WorkKit, QuickKit and FormReady. Detailed acceptance is in `IMPLEMENTATION_TRACKER.md`; browser evidence belongs in `BROWSER_QA_CHECKLIST.md`.

## Next actions

- [ ] Record the GitHub remote and initial source revision.
- [x] Set up independent static builds and distinct branded sites.
- [x] Implement the core user journeys and record a 58-check browser QA run (0 failures, 0 errors).
- [ ] Review any reused code, upstream licenses, and product acknowledgements.
- [ ] Complete remaining accessibility, privacy/network, and release checks in `IMPLEMENTATION_TRACKER.md`.
- [ ] Choose hosts and deploy only after the launch gate in the tracker passes.

## Backlog after first release

- [ ] Expand each site's secondary calculators/tools from the master spec.
- [ ] Add a small amount of original, practical guidance to high-intent tool pages.
- [ ] Verify FormReady application presets against official current notices.
- [ ] Add privacy-safe analytics after deciding on consent requirements and provider.
- [ ] Revisit ad placements after real usage and approval; keep controls distinct from ads.
- [ ] Review Search Console and Bing data after pages have been crawled; prioritize changes based on actual impressions and user behavior.

## Not launch blockers

- Search ranking, traffic volume, and ad-network approval are controlled by external services and take time.
- A feature listed as “later/optional” in the master spec stays out of the first launch unless core quality is already secured.
