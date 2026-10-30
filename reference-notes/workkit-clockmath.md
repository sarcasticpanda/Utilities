# WorkKit reference analysis: ClockMath

## Upstream

- Repository: https://github.com/clockmath/clockmath
- Stated license: MIT (verify the current `LICENSE` before copying code).
- Stack described by its README: Next.js App Router, React, TypeScript, Tailwind, static export, and a Cloudflare Pages worker for selected APIs.
- Repomix pack: generated from the public repository with the repository README, app routes, components, hooks and libraries included.

## What is useful

ClockMath is the strongest functional reference for WorkKit. Its README describes a work-hours timesheet with breaks and overnight shifts, decimal hours, gross pay, optional weekly overtime, local draft/named-sheet saving, sharing, copying, and CSV export. It also has a standalone overtime tool, decimal-hours conversion, and time-zone conversion.

The `components/TimesheetTool.tsx` implementation confirms several helpful patterns: shift state is separated from calculation helpers in `lib/timesheet`; the weekly overtime split reuses `lib/overtime`; local draft and named sheets are stored separately; share data is encoded in a URL and removed from the address bar after local restoration where storage works; malformed or blocked storage is caught. The break input accepts plain minutes and time-like formats and shows an inline error.

## Files to inspect first during implementation

- `components/TimesheetTool.tsx` — interaction flow, local saving, share/export affordances, and overtime integration.
- `lib/timesheet.ts` — parsing, overnight shifts, break handling, serialization, share encoding, and minute/hour calculations.
- `lib/overtime.ts` — weekly regular/overtime split and rate calculations.
- `components/TimezoneConverter.tsx` plus `lib/time.ts` — timezone UI and conversion logic.
- `app/` — route metadata and page-level SEO structure.
- `tests/` — existing behavior expectations for calculations and worker endpoints.

## Adaptation guidance for WorkKit

- Reuse or independently reproduce the calculation logic only after checking edge cases and tests. Keep pure time/pay calculations outside UI components.
- Use one shared calculation model so the time card can pass hours into pay and overtime tools without re-entry.
- Preserve overnight shifts, breaks, 12/24-hour preferences, local saving, CSV export, and mobile-friendly time entry in the first WorkKit milestone.
- Avoid importing ClockMath's visual identity, station/split-flap components, page copy, articles, analytics setup, or Cloudflare worker wholesale. WorkKit needs its own visual system and simpler deployment choice.
- If implementing share links, never put sensitive payroll details in analytics; consider showing the user exactly what the link contains.

## Risks to review

- Time and daylight-saving behavior is easy to get wrong. Inspect `lib/timesheet.ts` and `lib/time.ts` and create boundary-focused verification for overnight shifts, DST changes, invalid times, and breaks longer than a shift.
- The upstream project has features outside WorkKit's scope (quiz, sleep, market hours, countdown pages, and worker-backed feedback). Exclude them unless they serve WorkKit's stated product.
- The README describes both static export and a small worker. Confirm which routes actually need runtime APIs before choosing hosting.
