# Visual and interaction direction

**Status:** inferred and implemented by the agent from the project pack and the user's request for clear, polished tools on every device. The user has not chosen a permanent brand system.

## Product shell

All three sites put the task first: direct navigation, one clear page title, controls grouped by job, a result area beside the controls on wider screens, and a stacked flow on phones. Native buttons, inputs, selects, focus states, readable labels and visible text status carry the interaction. No tool data is sent to a server as part of the core flows.

## Signature move: a route through the task

The visual cue is a restrained route through each workflow: numbered steps, connected outcomes and a clear next action. It carries the orienteering-map idea from the design research without turning the page into a map or changing familiar web controls. The next action remains apparent in the empty state and the result state. The active step is distinct from the stable content beneath it.

## Brand distinction

- **WorkKit:** warm paper, dark ink and muted field green for time and pay summaries.
- **QuickKit:** cool light ground, deep blue controls and small file-type markers for fast utility tasks.
- **FormReady:** warm neutral surface, dark green and clay accents for a calm, careful preparation flow.

These are working identities. A permanent logo, domain, support address and finalized brand names are not supplied.

## Responsive and motion rules

- Keep important controls full-width or comfortably tappable on narrow screens; avoid horizontal scrolling.
- Keep the first action visible early in the page and preserve the same label on desktop and mobile.
- Use short, optional reveal motion only when motion is allowed; reduced-motion users see content immediately.
- Treat PASS/CHECK and error states as text and icon state, not color alone.
- Do not place advertising inside the working form or beside a primary action; advertising remains off until approved.

## Evidence and open questions

- Desktop and mobile screenshot evidence: `qa-results/screenshots/`.
- Browser sizes and functional scenarios: `BROWSER_QA_CHECKLIST.md` and `qa-results/browser-qa-results.json`.
- Permanent design choices, official FormReady presets, live domains and public contact information remain open.
