# Utility Sites — Complete Master Build Specification
This single file combines the full build instructions, design specifications, features, workflows, SEO plans, open-source references, licensing rules, and handoff instructions for WorkKit, QuickKit, and FormReady.
Use this as the single source of truth for a coding agent.


---

<!-- SOURCE FILE: MASTER_HANDOFF.md -->

# Master Handoff for Coding Agent

You are building three independent web properties from this specification.

Do not ask for product ideation unless something is technically impossible. The desired features, UX and routes are already described.

## Before coding

Read:
1. `shared/AGENT_RULES.md`
2. `shared/LICENSE_AND_REUSE.md`
3. the selected project's `AGENT_PROMPT.md`
4. `DESIGN.md`
5. `FEATURES.md`
6. `WORKFLOW.md`
7. `SEO.md`
8. `REFERENCES.md`

## Repository use

Clone the reference repository into a separate reference directory rather than blindly building directly on top of its Git history if a clean-roomish product structure will make the redesign easier.

Suggested workspace:

```text
workspace/
  references/
    clockmath/
    omnitools/
    imagetoolkit/
    IDPhotoResizer/
    parchment/
  products/
    workkit/
    quickkit/
    formready/
```

The reference folders are for inspection/reuse under their licenses.
The product folders are your independent branded implementations.

## Quality bar

A project is not complete just because the calculation works.

It must also have:
- responsive mobile UI
- original design
- original copy
- accessible controls
- validation/error states
- SEO metadata
- sitemap/robots
- privacy/terms/about/contact
- open-source acknowledgements
- tests for core algorithms
- analytics hooks without sensitive payloads
- empty/inactive ad slots only where appropriate
- no copied third-party branding

## Deployment goal

All core functionality should be deployable on static/free-tier infrastructure whenever possible.
Avoid infrastructure that creates recurring cost without a product need.

## Monetization

The product stays free for the user.
Monetization can later come from:
- display ads
- relevant affiliate partnerships
- optional ad-free/power-user features

Never degrade the core task merely to manufacture more page views.


---

<!-- SOURCE FILE: README.md -->

# Utility Sites Build Pack

This pack defines three separate free utility websites designed around high-intent Google searches and simple browser-side functionality.

## Portfolio

1. **WorkKit** — US-first work-hours, time-card, pay, overtime and scheduling calculators.
2. **QuickKit** — Global/US+India privacy-first image, PDF, QR and text utilities.
3. **FormReady** — India-first photo/signature/document preparation for application forms.

The goal is not to clone another website. The goal is to start from permissively licensed open-source code, retain required license notices, understand the implementation, redesign the product, add original features, write original content, and deploy a materially improved experience.

## Recommended build order

Build the projects independently so each domain has one coherent search intent and audience.

- WorkKit: strongest commercial intent.
- QuickKit: broadest search surface and largest potential traffic.
- FormReady: strongest India-specific problem/keyword fit.

## Common product principles

- Free core tools.
- No login for core use.
- Client-side processing wherever technically possible.
- Mobile-first.
- Fast initial load and strong Core Web Vitals.
- Original branding, layout, copy, FAQs and examples.
- Do not create hundreds of thin keyword pages.
- Every indexable page must contain a working tool plus useful original explanatory content.
- Use a `.com` when validated; a free deployment subdomain is fine during development.
- Never disguise advertisements as buttons or tool controls.
- Preserve open-source license requirements from every reused repository.

## Folder structure

```text
utility_sites_build_pack/
├── README.md
├── shared/
│   ├── AGENT_RULES.md
│   ├── DEPLOYMENT_SEO_CHECKLIST.md
│   └── LICENSE_AND_REUSE.md
├── workkit/
│   ├── AGENT_PROMPT.md
│   ├── DESIGN.md
│   ├── FEATURES.md
│   ├── WORKFLOW.md
│   ├── SEO.md
│   └── REFERENCES.md
├── quickkit/
│   └── ...
└── formready/
    └── ...
```

Give the entire folder for a project to your coding agent and tell it to read `AGENT_PROMPT.md` first.


---

<!-- SOURCE FILE: shared/AGENT_RULES.md -->

# Shared Agent Rules

These rules apply to all three websites.

## 1. Open-source reuse rules

- Reuse code only when the repository license permits the intended use.
- Preserve the original license/copyright notice wherever the license requires it.
- Do not reuse the original site's name, logo, marketing copy, screenshots or distinctive visual identity.
- Treat reference repositories as implementation foundations, not as finished products to republish unchanged.
- Record every reused dependency/repository in `REFERENCES.md`.

## 2. Architecture

Prefer browser-side execution.

Allowed:
- Canvas API
- WebAssembly
- Web Workers
- File API
- IndexedDB/localStorage
- static JSON/config
- lightweight serverless endpoints only when truly necessary

Avoid unless a feature explicitly needs them:
- user accounts
- relational databases
- permanent file uploads
- paid APIs
- AI APIs
- server-side media conversion

## 3. UX

Every tool must support:
1. clear problem statement
2. obvious input
3. immediate validation
4. one primary action
5. visible result
6. copy/download/export as appropriate
7. reset/start-over
8. related tools

Mobile layout must be first-class, not an afterthought.

## 4. SEO

Each indexable tool page must contain:
- unique `<title>`
- unique meta description
- canonical URL
- one H1
- working interactive tool above or near the fold
- concise explanation
- worked example when applicable
- FAQ
- related tools
- structured data only when valid
- crawlable static text around client-side components

Do not generate thin pages by swapping one number or one exam name.

## 5. Privacy

If a file is processed locally, say exactly that:
> Processing happens in your browser; the selected file is not uploaded to our server.

Do not claim this for any feature that actually uploads data.

## 6. Monetization readiness

Prepare layout zones for ads but keep ads disabled in development.

Allowed placements:
- between major content sections
- after a completed result
- within long explanatory content

Never:
- place an ad where users expect a Download/Calculate button
- fake system notifications
- auto-click
- force accidental clicks
- refresh pages/ads to inflate impressions

## 7. Analytics

Track useful product events, not sensitive user data:
- tool_view
- tool_started
- tool_completed
- download_clicked
- related_tool_clicked
- validation_error

Never log uploaded file contents, signatures, photos, passwords, QR secrets, or payroll values as analytics payloads.

## 8. Accessibility

- keyboard-operable controls
- semantic labels
- visible focus states
- sufficient contrast
- useful error messages
- no color-only status indication


---

<!-- SOURCE FILE: shared/LICENSE_AND_REUSE.md -->

# License and Reuse Notes

The selected reference repositories expose MIT licenses in their repositories. Before copying code, inspect the repository's current `LICENSE` file and keep the required copyright/license notice.

## Required behavior

When using code from a reference repository:

1. Keep a copy of its MIT license notice in your repository, for example under:
   `licenses/<source-project>-LICENSE.txt`
2. Keep an attribution note in your repository documentation.
3. Do not imply that the original author endorses your product.
4. Replace original brand assets and original marketing copy.
5. Check third-party library licenses separately; an MIT application can contain dependencies with their own notices.

## Main references

- ClockMath: https://github.com/clockmath/clockmath
- FreeTools / OmniTools: https://github.com/firstlinkai/omnitools
- PicBrew / ImageToolkit: https://github.com/dannycranmer/imagetoolkit
- IDPhotoResizer: https://github.com/mavi-cyber/IDPhotoResizer
- Parchment PDF tools: https://github.com/dannycranmer/parchment


---

<!-- SOURCE FILE: shared/DEPLOYMENT_SEO_CHECKLIST.md -->

# Deployment and SEO Checklist

## Technical

- Production build passes.
- No console errors on core flows.
- Mobile navigation works.
- Tool logic works without a backend when designed to be local.
- Heavy libraries are dynamically imported.
- Media/file work is moved to a Web Worker where it meaningfully prevents UI freezing.
- Pages remain usable on slower mobile hardware.
- Favicon, manifest and social preview image exist.
- HTTPS only.

## Crawlability

- `robots.txt`
- `sitemap.xml`
- canonical links
- descriptive slugs
- no accidental `noindex`
- unique titles/descriptions
- internal links from category pages
- useful 404 page
- static HTML text available to crawlers

## Required trust pages

- About
- Contact
- Privacy
- Terms
- Disclaimer where appropriate
- Open-source acknowledgements

## Search Console

After deployment:
- verify property
- submit sitemap
- inspect main tool URLs
- monitor indexing
- monitor query/country/page impressions
- expand around queries that already earn impressions

## Content quality

For each tool page answer:
- What does this tool do?
- Who is it for?
- What inputs does it need?
- What exactly is the output?
- Is processing local?
- Is there a limitation?
- Is there a worked example?
- What related tool would the user need next?

## Ads

Prepare stable ad containers to reduce layout shift.
Do not put ads inside tool controls.
Do not use background/hidden ad behavior.


---

<!-- SOURCE FILE: workkit/AGENT_PROMPT.md -->

# WorkKit — Coding Agent Master Prompt

Read all markdown files in this folder before changing code.

## Mission

Build an original US-first free work calculator website called **WorkKit** (working name). It should help hourly workers, freelancers, managers and small businesses calculate work hours, time cards, gross pay, overtime, salary conversions and work-related dates without creating an account.

Use **ClockMath** as the primary implementation reference:
https://github.com/clockmath/clockmath

Do not republish ClockMath unchanged. Reuse permitted calculation/architecture ideas and code where helpful, preserve the required license notice, then replace the product identity, navigation, visual design, copy and information architecture.

## Non-negotiable USP

"One free workday toolkit for hours, pay, overtime and work schedules."

The calculators must connect together. Users should be able to move from hours -> pay -> overtime without retyping values when possible.

## Required documents

Follow:
- DESIGN.md
- FEATURES.md
- WORKFLOW.md
- SEO.md
- REFERENCES.md
- ../shared/AGENT_RULES.md
- ../shared/LICENSE_AND_REUSE.md

## Build priority

Core routes:
- `/`
- `/time-card-calculator`
- `/work-hours-calculator`
- `/timesheet-calculator`
- `/time-card-with-lunch`
- `/decimal-hours-calculator`
- `/hourly-to-salary`
- `/salary-to-hourly`
- `/overtime-calculator`
- `/pay-raise-calculator`
- `/business-days-calculator`
- `/time-zone-converter`

Do not add payroll-tax estimation in the first product unless tax rules are sourced and maintained separately.

## Acceptance

The result must feel like a new product, not a reskin:
- original component hierarchy
- original home page
- original brand system
- original copy
- additional calculators
- cross-tool data passing
- responsive mobile UI
- local persistence for timesheets
- no required account


---

<!-- SOURCE FILE: workkit/DESIGN.md -->

# WorkKit Design Specification

## Product identity

Working name: **WorkKit**

Positioning:
> Free work calculators for hours, pay, overtime and scheduling.

Tone:
- calm
- practical
- payroll/workplace friendly
- trustworthy
- not playful/gimmicky

## Visual direction

Use a clean productivity aesthetic.

### Layout
Desktop:
- top navigation
- centered max-width content
- calculator in a prominent card
- result summary adjacent or immediately below
- explanatory content below
- related tools grid

Mobile:
- single column
- sticky primary Calculate action only if it improves usability
- large numeric/time inputs
- result card appears directly after calculation

### Design tokens

Use CSS variables/design tokens rather than hardcoded values.

Suggested conceptual tokens:
- background
- surface
- elevated surface
- primary text
- muted text
- border
- accent
- positive
- warning
- error

Do not copy ClockMath's distinctive branding.

## Homepage

Hero:
- H1: Free work calculators for hours, pay and schedules
- Subtitle: Calculate work hours, time cards, gross pay, overtime, salary conversions and working days without signing up.
- Primary CTA: Calculate work hours
- Secondary CTA: Browse all calculators

Immediately below:
### Popular tools
Cards:
- Time Card Calculator
- Work Hours Calculator
- Overtime Calculator
- Hourly to Salary
- Salary to Hourly
- Business Days

Next:
### One workflow, connected tools
Explain:
1. enter shifts
2. calculate total/decimal hours
3. enter hourly rate
4. estimate gross pay
5. calculate overtime

Next:
### Why WorkKit
- no account
- local autosave
- clear payroll decimals
- mobile friendly
- share/export where useful

## Calculator page anatomy

1. Breadcrumb
2. H1 + one-sentence explanation
3. Calculator
4. Result summary
5. Secondary result details
6. actions: copy / export / reset
7. short "How it works"
8. worked example
9. FAQ
10. related tools

## Time Card interaction

Shift row:
- Date/Day optional
- Start time
- End time
- Break duration
- optional hourly rate override
- remove row

Controls:
- Add shift
- Duplicate previous shift
- Clear
- Calculate

Result:
- total clock duration
- unpaid breaks
- paid hours
- decimal hours
- regular hours
- overtime hours
- gross pay when rate supplied

## Cross-tool continuity

Store a small non-sensitive state object locally:

```ts
{
  weeklyHours?: number,
  hourlyRate?: number,
  annualSalary?: number,
  overtimeMultiplier?: number
}
```

When moving from Time Card -> Overtime, prefill weekly hours.
When moving Hourly -> Salary, preserve hourly rate.
Never send these values to analytics.

## Trust copy

Place near work-hour calculators:
> WorkKit provides arithmetic estimates and is not payroll, legal or tax advice. Workplace overtime rules can vary by jurisdiction and employer policy.

Avoid pretending a generic overtime calculator knows all legal entitlements.


---

<!-- SOURCE FILE: workkit/FEATURES.md -->

# WorkKit Feature Specification

## Core feature group A — Work hours

### Time Card Calculator
Inputs:
- multiple shifts
- start/end
- break minutes
- optional hourly rate

Outputs:
- shift duration
- paid duration
- weekly total
- decimal hours
- gross pay

Must support:
- overnight shifts
- AM/PM and 24-hour input preference
- duplicate shift
- invalid-time validation

### Work Hours Calculator
Fast one-shift version.
Inputs start/end/break.
Output hours/minutes + decimal hours.

### Timesheet Calculator
Multi-day week oriented version.
Support:
- Monday-Sunday rows
- optional second shift per day
- weekly total
- copy summary
- CSV export
- local autosave

### Time Card With Lunch
SEO/use-case variant with lunch visually first-class:
- start
- lunch start/end OR lunch duration
- end
- paid hours

Do not make this page merely duplicate text. The UI should emphasize lunch handling.

### Decimal Hours Calculator
Convert:
- hours + minutes -> decimal hours
- decimal hours -> hours + minutes
Include common payroll conversion table.

## Feature group B — Pay

### Hourly to Salary
Inputs:
- hourly rate
- hours/week
- weeks/year

Outputs:
- weekly
- monthly average
- annual gross

### Salary to Hourly
Inputs:
- annual salary
- hours/week
- weeks/year

Outputs:
- hourly equivalent
- weekly/monthly gross equivalents

### Overtime Calculator
Inputs:
- hourly rate
- total hours
- regular-hour threshold
- multiplier

Outputs:
- regular pay
- overtime pay
- total gross

Default multiplier can be 1.5, but allow edit.
Do not state legal eligibility.

### Pay Raise Calculator
Support:
- old pay + new pay -> percentage raise
- old pay + percentage -> new pay
- annual and hourly modes

## Feature group C — Work calendar

### Business Days Calculator
Inputs:
- start
- end
- include/exclude endpoints
- weekend selection
- optional user-entered holidays

Output:
- calendar days
- weekend days
- entered holidays
- business days

### Time Zone Converter
Reuse robust timezone/DST concepts from reference implementation.
Support multiple destination zones.
Provide copyable converted times.

## Useful secondary features

- recent calculations stored locally
- dark mode optional
- installable PWA
- shareable URLs only when values are non-sensitive and encoded intentionally
- print-friendly result
- CSV for timesheets

## Deliberately excluded

- tax withholding
- benefits calculation
- legal overtime eligibility
- payroll submission
- employee monitoring
- account system

These add maintenance/risk without helping the initial search utility.


---

<!-- SOURCE FILE: workkit/WORKFLOW.md -->

# WorkKit Implementation Workflow

## Step 1 — Inspect reference

Primary reference:
https://github.com/clockmath/clockmath

Inspect specifically:
- `app/` route architecture
- `components/`
- `lib/`
- timesheet implementation
- timezone implementation
- local persistence
- static export configuration
- metadata/sitemap patterns
- PWA setup

Do not copy:
- name/logo
- home-page copy
- article text
- distinctive branding

## Step 2 — Establish clean product shell

Create:
```text
app/
  page.tsx
  time-card-calculator/page.tsx
  work-hours-calculator/page.tsx
  timesheet-calculator/page.tsx
  time-card-with-lunch/page.tsx
  decimal-hours-calculator/page.tsx
  hourly-to-salary/page.tsx
  salary-to-hourly/page.tsx
  overtime-calculator/page.tsx
  pay-raise-calculator/page.tsx
  business-days-calculator/page.tsx
  time-zone-converter/page.tsx
  about/page.tsx
  privacy/page.tsx
  terms/page.tsx
  contact/page.tsx
components/
  calculator/
  layout/
  results/
  seo/
lib/
  calculations/
  persistence/
  formatting/
  validation/
```

## Step 3 — Centralize formulas

Do not duplicate formulas inside UI components.

Example:
```text
lib/calculations/work-hours.ts
lib/calculations/pay.ts
lib/calculations/overtime.ts
lib/calculations/business-days.ts
```

Each function should be pure and unit-testable.

## Step 4 — Build shared calculator primitives

- NumberField
- MoneyField
- TimeField
- DurationField
- ShiftRow
- ResultMetric
- ResultPanel
- CalculatorActions
- RelatedTools

## Step 5 — Implement calculation tests

Test:
- same-day shift
- overnight shift
- break > shift error
- zero break
- decimal conversion
- weekly totals
- overtime threshold boundaries
- salary/hourly round trip
- leap/calendar boundaries for business days

## Step 6 — Build SEO content data

Keep explanatory copy separate from formula code.
Each page has:
- summary
- example
- FAQ
- related links

Avoid programmatically cloning nearly identical text.

## Step 7 — Analytics hooks

Events:
- calculator_started
- calculator_completed
- export_clicked
- related_tool_clicked

No pay values or hours in event properties.

## Step 8 — Ad placeholders

Create:
```tsx
<AdSlot placement="after-result" />
<AdSlot placement="mid-content" />
```
Render nothing until an ad provider is configured.
Reserve stable height only where appropriate.

## Step 9 — Final quality

- keyboard test
- iPhone-width test
- Android-width test
- desktop test
- DST timezone test
- invalid input test
- offline/local persistence test


---

<!-- SOURCE FILE: workkit/SEO.md -->

# WorkKit SEO Strategy

## Market

Primary: United States.
Secondary: other English-speaking markets and India for generic calculators.

## Search intent

The user is not looking for an article. They want a calculation immediately.
Put the functioning calculator before long-form content.

## Priority keyword clusters

### Work hours
Primary concepts:
- time card calculator
- work hours calculator
- hours worked calculator
- timesheet calculator
- time clock calculator

Long-tail:
- free time card calculator
- time card calculator with lunch
- time card calculator with breaks
- weekly time card calculator
- biweekly time card calculator
- work hours calculator with lunch
- decimal hours calculator

### Pay
- hourly to salary calculator
- salary to hourly calculator
- annual salary to hourly
- pay raise calculator
- overtime calculator
- gross pay calculator

### Calendar/time
- business days calculator
- working days calculator
- time zone converter
- meeting time converter

## Keyword evidence

External keyword datasets show substantial US demand around:
- `time card calculator`
- `work hours calculator`
- `hours worked calculator`
- `salary to hourly calculator`

Use these as directional market-validation signals, not guarantees of ranking.

## Page title patterns

Examples:
- Time Card Calculator With Breaks | WorkKit
- Work Hours Calculator — Hours, Minutes & Decimal Time | WorkKit
- Hourly to Salary Calculator | WorkKit
- Overtime Pay Calculator | WorkKit

## Content rules

Every calculator page should contain an original worked example.
Examples should be realistic but not presented as legal/payroll advice.

## Internal linking

Time card -> decimal hours -> overtime -> hourly/salary.
Business days -> time zone converter.
Salary -> raise calculator.

## Avoid

- one page for every possible hourly wage
- one page for every number of work hours
- location-specific overtime claims without researched law
- copied calculator descriptions from competitors


---

<!-- SOURCE FILE: workkit/REFERENCES.md -->

# WorkKit References

## Primary open-source reference

### ClockMath
GitHub:
https://github.com/clockmath/clockmath

Use as reference for:
- work-hours/timesheet calculations
- timezone conversion
- local persistence
- PWA
- Next.js static-export structure
- SEO metadata architecture

Repository exposes an MIT license. Preserve required license notice when reusing code.

## Market/search references

Time card/work-hours keyword data:
https://www.seodata.dev/keyword/time-card-calculator

Competitive organic validation:
https://www.semrush.com/website/getharvest.com/overview/
https://ahrefstop.com/websites/calculatehours.com

Salary keyword validation:
https://www.semrush.com/website/salary.com/overview/

## Competitor UX references — inspiration only

- https://www.calculatehours.com/
- https://clockify.me/
- https://www.getharvest.com/

Do not copy their protected text, branding or layout.


---

<!-- SOURCE FILE: quickkit/AGENT_PROMPT.md -->

# QuickKit — Coding Agent Master Prompt

Read every markdown file in this folder and the shared rules before implementation.

## Mission

Build **QuickKit** (working name), a fast privacy-first collection of everyday browser utilities for global, US and Indian users.

Primary open-source reference:
https://github.com/firstlinkai/omnitools

Supplemental references:
- PDF: https://github.com/dannycranmer/parchment
- Images: https://github.com/dannycranmer/imagetoolkit

Do not publish 100 tools just because the reference has them. Build a focused, polished set around real search behavior.

## USP

"Useful file and everyday tools that work instantly in your browser."

Secondary USP:
"Your files stay on your device."

Only state the privacy claim for tools that are truly local.

## Required launch categories

- Images
- PDF
- QR
- Text
- Everyday

The highest-priority differentiator is **target-size compression**:
20 KB / 50 KB / 100 KB / 200 KB / custom KB.

## Required routes

- `/image-compressor`
- `/image-resizer`
- `/compress-image-to-20kb`
- `/compress-image-to-50kb`
- `/compress-image-to-100kb`
- `/jpg-to-png`
- `/png-to-jpg`
- `/webp-to-jpg`
- `/heic-to-jpg`
- `/image-to-pdf`
- `/merge-pdf`
- `/split-pdf`
- `/pdf-to-images`
- `/qr-generator`
- `/wifi-qr`
- `/word-counter`
- `/text-cleaner`
- `/password-generator`
- `/date-calculator`

Exact-KB pages must load meaningful preset behavior; they must not be thin copies.


---

<!-- SOURCE FILE: quickkit/DESIGN.md -->

# QuickKit Design Specification

## Product identity

Working name: **QuickKit**

Positioning:
> Fast, private everyday tools. No account, no upload queue, no unnecessary steps.

Visual character:
- lightweight
- crisp
- utility-first
- friendly but not childish
- highly scannable

## Homepage

Hero:
- H1: Quick tools for files, images, PDFs, QR codes and text
- Search box: "Search tools..."
- privacy message: "Local-first: supported file tools process on your device."

### Popular tools grid
- Compress Image
- Resize Image
- Image to PDF
- Merge PDF
- Wi-Fi QR
- Word Counter

### Categories
Images / PDF / QR / Text / Everyday

### Target-size module
Prominently show:
- Compress to 20 KB
- 50 KB
- 100 KB
- 200 KB
- Custom KB

This is a key India-oriented differentiator but remains globally useful.

## Tool page anatomy

1. breadcrumb/category
2. H1
3. short privacy/format information
4. drop zone/input
5. controls
6. process action
7. result
8. download/copy
9. explanation
10. FAQ
11. related tools

## File drop component

States:
- idle
- hover
- loaded
- processing
- success
- error

Show:
- filename
- original size
- relevant dimensions/type
- remove/replace

Never upload automatically.

## Result design

For compression:
```text
Original: 4.8 MB
Result:   96.4 KB
Saved:    98%
Dimensions: 1600 × 1200
[Download]
```

For target-size:
```text
Target: <= 100 KB
Result: 97.6 KB ✓
```

If target cannot be achieved without severe dimension reduction, explain what changed.

## Privacy badge

Use a consistent badge:
"Processed locally"
Tooltip:
"This tool processes the selected file in your browser. The file is not sent to our server."

Only render this for verified local tools.

## Navigation

Desktop:
logo | Images | PDF | QR | Text | All Tools | Search

Mobile:
logo + search + category drawer

Avoid an overloaded mega-menu.

## Ads

Tool itself should remain visually dominant.
Never insert an ad between the primary action and its immediate result in a way that confuses the user.


---

<!-- SOURCE FILE: quickkit/FEATURES.md -->

# QuickKit Feature Specification

## Images

### Image Compressor
Formats:
- JPEG
- PNG
- WebP where browser support allows

Controls:
- quality
- max width/height optional
- preserve aspect ratio

Outputs:
- preview
- original/result size
- savings %
- download

### Target-Size Image Compressor — flagship differentiator

Presets:
- 20 KB
- 50 KB
- 100 KB
- 200 KB
- 500 KB
- custom

Algorithm:
1. decode image
2. choose output format
3. binary-search encoder quality
4. if minimum reasonable quality still exceeds target, progressively reduce dimensions
5. stop within target tolerance
6. display any dimension reduction clearly

Never claim an exact byte target if encoder behavior makes it impossible; say `<= target`.

### Image Resizer
- width/height
- lock aspect ratio
- percent
- social presets
- output format

### Converters
- JPG -> PNG
- PNG -> JPG
- WebP -> JPG
- HEIC -> JPG when a client-side HEIC decoder is included

### Image to PDF
- multiple images
- reorder
- page size
- orientation
- margins
- output one PDF

## PDF

Use client-side pdf-lib/PDF.js patterns.

### Merge
- multiple PDFs
- reorder
- remove
- merge

### Split
- ranges
- specific pages
- optionally one PDF per page

### PDF to Images
- PNG/JPEG
- page selection
- scale
- ZIP

Potential later additions:
- rotate
- reorder
- page numbers
- watermark

Do not overload launch scope.

## QR

### Generic QR
Input types:
- URL
- text
- email
- phone
- SMS

Options:
- size
- error correction
- foreground/background
- PNG/SVG download if supported

### Wi-Fi QR
Fields:
- SSID
- password
- security: WPA/WPA2, WEP, none
- hidden network

Generate standard Wi-Fi QR payload locally.
Do not log SSID/password.

## Text

### Word Counter
Live:
- words
- characters
- characters without spaces
- sentences
- paragraphs
- estimated reading time

### Text Cleaner
Actions:
- remove extra spaces
- remove empty lines
- trim lines
- remove duplicate lines
- normalize line endings
- copy result

### Password Generator
Everything local.
Options:
- length
- uppercase
- lowercase
- digits
- symbols
- avoid ambiguous characters

Use cryptographically secure random generation via Web Crypto API, not `Math.random()`.

## Everyday

### Date Calculator
Modes:
- days between dates
- add/subtract days
- age from date
- optionally business-day link to WorkKit rather than duplicating a large implementation

## Batch behavior

Where practical:
- multiple images
- ZIP downloads
- cancel processing
- worker-based processing

## Performance

Dynamically load heavy dependencies:
- PDF.js
- pdf-lib
- HEIC decoder
- ZIP libraries

Do not ship video/audio FFmpeg to users who only open an image page.


---

<!-- SOURCE FILE: quickkit/WORKFLOW.md -->

# QuickKit Implementation Workflow

## Step 1 — Inspect primary reference

https://github.com/firstlinkai/omnitools

Inspect:
- `app/`
- `components/`
- `lib/`
- lazy/dynamic loading
- existing tool registry
- image logic
- PDF logic
- SEO/page architecture

The reference has many tools. Do not inherit feature bloat automatically.

## Step 2 — Inspect focused references

Image:
https://github.com/dannycranmer/imagetoolkit

PDF:
https://github.com/dannycranmer/parchment

Use these to compare simple browser-side implementations.

## Step 3 — Create a tool registry

Example:

```ts
type Tool = {
  slug: string
  name: string
  description: string
  category: "image" | "pdf" | "qr" | "text" | "everyday"
  keywords: string[]
  privacy: "local" | "network"
  component: () => Promise<...>
}
```

Use one registry for:
- homepage cards
- all-tools page
- related tools
- search
- sitemap metadata

## Step 4 — Separate processors from UI

```text
lib/processors/image/
lib/processors/pdf/
lib/processors/qr/
lib/processors/text/
```

Processors should not depend on React.

## Step 5 — Implement target-KB compression

Create dedicated tests/assets:
- small JPEG
- large JPEG
- PNG photo
- transparent PNG
- portrait
- landscape

Test:
- target already satisfied
- target just below current
- very aggressive target
- transparent image conversion warning
- dimension reduction fallback

## Step 6 — Build shared file UI

Components:
- DropZone
- FileSummary
- Progress
- TargetSizePicker
- ImagePreview
- ResultCard
- DownloadButton
- LocalProcessingBadge

## Step 7 — Add individual SEO routes

Exact-KB routes reuse the compressor component with preset target, but:
- unique useful introduction
- preset automatically selected
- specific troubleshooting
- unique FAQ where appropriate
- canonical handling

## Step 8 — Privacy review

Open browser network panel and verify local-only tools make no file-upload requests.
Do this before rendering "processed locally."

## Step 9 — Performance review

- route-level code splitting
- dynamic import heavy libraries
- no FFmpeg unless a media tool is actually retained
- minimize homepage JS
- compress static assets

## Step 10 — Ad readiness

Insert inactive AdSlot components only after layout is stable.
Avoid layout shifts.


---

<!-- SOURCE FILE: quickkit/SEO.md -->

# QuickKit SEO Strategy

## Markets

- United States: generic image/file utilities and workplace/creator use.
- India: exact-KB image/PDF needs and common upload constraints.
- Global: format conversion, QR, word/text utilities.

## Priority search clusters

### Images — US/global
- image compressor
- photo compressor
- compress image online
- compress jpeg
- reduce jpg file size
- image resizer
- resize image
- webp to jpg
- heic to jpg

External datasets show large US search demand for image compression/resizing terms. This validates the category but also means competition is strong.

### Exact-size — India
- compress image to 20kb
- compress image to 50kb
- compress image to 100kb
- image compressor in kb
- reduce image size in kb
- pdf kb reducer
- compress pdf to 200kb

Exact-size intent is valuable because the user has a concrete upload constraint.

### QR
Do not make generic `qr code generator` the only acquisition strategy; it is extremely competitive.

Prefer:
- wifi qr code generator
- wifi qr code
- create wifi qr code
- static qr code generator

### Text
- word counter
- character counter
- remove duplicate lines
- text cleaner
- password generator

## Route strategy

Use one strong page per distinct intent.

Good:
- `/image-compressor`
- `/compress-image-to-20kb`
- `/wifi-qr`

Bad:
- `/compress-image-to-21kb`
- `/compress-image-to-22kb`
- hundreds of mechanically generated variants

## Page copy

Tool pages should answer the immediate problem in the first screen.
Long explanations come after the tool.

## Internal linking examples

20KB -> 50KB -> custom KB -> image resizer.
HEIC -> JPG -> compressor -> image to PDF.
Wi-Fi QR -> QR generator.
Word counter -> text cleaner.

## Search snippets

Use concrete outputs:
"Compress JPG, PNG or WebP to 100 KB or less directly in your browser."

Avoid:
"Best #1 free ultimate compressor" type copy.


---

<!-- SOURCE FILE: quickkit/REFERENCES.md -->

# QuickKit References

## Primary open-source reference

### FreeTools / OmniTools
https://github.com/firstlinkai/omnitools

Useful for:
- Next.js tool architecture
- client-side file processing
- privacy-first patterns
- image/PDF/text utility implementations
- dynamic loading

Repository exposes an MIT license.

## Supplemental open-source references

### PicBrew / ImageToolkit
https://github.com/dannycranmer/imagetoolkit

Useful for:
- Canvas image processing
- resize/compress/convert/crop
- batch/ZIP concepts
- image-to-PDF

MIT licensed.

### Parchment
https://github.com/dannycranmer/parchment

Useful for:
- PDF merge/split
- PDF-to-image
- client-side pdf-lib/PDF.js architecture

MIT licensed.

## Search/market references

Image compressor demand:
https://www.seodata.dev/keyword/image-compressor

JPEG compression:
https://www.seodata.dev/keyword/compress-jpeg

Image utility competitor traffic:
https://ahrefstop.com/websites/imageresizer.com

India exact-size PDF demand:
https://www.semrush.com/website/freecompress.com/overview/

Wi-Fi QR validation:
https://www.semrush.com/website/qifi.org/overview/

Generic QR competition:
https://www.kwstrends.com/keywords/us/qr-code-generator


---

<!-- SOURCE FILE: formready/AGENT_PROMPT.md -->

# FormReady — Coding Agent Master Prompt

Read all project and shared markdown files before implementation.

## Mission

Build **FormReady** (working name), an India-first mobile website that prepares photos, signatures and simple document images for online application forms.

The product is not merely an image resizer. The USP is:
> "Choose the form, upload the photo/signature, and get a file that matches the configured requirements."

Primary image reference:
https://github.com/dannycranmer/imagetoolkit

ID-photo/crop reference:
https://github.com/mavi-cyber/IDPhotoResizer

Do not blindly copy exam dimensions from competitors. Store all presets in a versioned configuration with an official-source field and only mark a preset "verified" after checking the relevant official instructions.

## Core product modes

1. Exact KB compressor
2. Signature resizer
3. Photo resizer
4. Passport/ID photo crop
5. Application preset mode
6. Custom specification mode
7. Image dimension/file-size checker

## Audience

India-first:
- government job applicants
- competitive exam applicants
- banking/railway applicants
- students
- cyber-cafe operators
- parents helping applicants

## Product principle

The user should not need to understand pixels, aspect ratios or compression quality unless they choose Custom mode.


---

<!-- SOURCE FILE: formready/DESIGN.md -->

# FormReady Design Specification

## Product identity

Working name: **FormReady**

Positioning:
> Make your photo, signature or document ready for an online application.

Tone:
- reassuring
- precise
- simple
- mobile-first
- non-governmental

Never visually imply affiliation with an exam board or government authority.

## Homepage

Hero:
H1: Get your application photo or signature ready
Subtitle: Choose a preset or enter the required size. Crop, resize and compress locally in your browser.

Primary choices as large cards:
- Photo
- Signature
- Exact KB
- Application Presets
- Passport/ID
- Custom

### Preset search
"Search application or exam..."

Display only configured/verified presets by default.
Allow "show unverified/custom templates" only if clearly labeled.

## Primary user flow

```text
Choose preset
   ↓
Choose Photo / Signature / Document
   ↓
Upload or paste image
   ↓
Crop/position if needed
   ↓
Automatic resize/compress
   ↓
Validation checklist
   ↓
Download
```

## Validation result card

Example visual model:

```text
READY

Format       JPG       ✓
Dimensions   configured ✓
File size    configured ✓
Aspect ratio configured ✓

[Download file]
```

If not ready:

```text
NEEDS ATTENTION

File size: 34 KB
Required: <= 20 KB

[Optimize]
```

Use both icon + text, not color alone.

## Mobile design

This is the primary experience.

- large upload area
- camera/gallery friendly
- crop handles usable with touch
- bottom primary action
- no sidebars
- minimal copy before task completion
- no intrusive modal before upload

## Privacy

For local flows:
> Your image stays on this device. Processing happens in your browser.

## Disclaimer

Near presets:
> FormReady is an independent utility and is not affiliated with any examination board or government agency. Always compare the output with the latest instructions on the official application page.

## Advertising

Never place an ad where it resembles:
- Download
- Upload
- Continue
- Apply
- Submit

This audience is especially likely to be stressed/in a hurry; deceptive placement would destroy trust.


---

<!-- SOURCE FILE: formready/FEATURES.md -->

# FormReady Feature Specification

## 1. Exact KB compressor

Inputs:
- image
- target maximum KB
- optional dimensions
- output format

Presets:
- 10 KB
- 20 KB
- 50 KB
- 100 KB
- 200 KB
- custom

Display:
- original file size
- result file size
- original/result dimensions
- quality/dimension change summary

Reuse the same robust target-size engine concept as QuickKit if both projects are maintained by you.

## 2. Signature resizer

Input methods:
- file picker
- drag/drop
- clipboard paste where supported

Editing:
- crop to signature
- optional background cleanup threshold
- rotate
- padding
- target dimensions
- target file size
- JPG output

Modes:
- application preset
- custom

## 3. Photo resizer

Editing:
- crop
- zoom
- pan
- rotate
- aspect guide
- target dimensions
- target KB
- format

Do not add AI face manipulation initially.

## 4. Passport/ID crop

Use simple composition guides.
Presets may include general international document dimensions only when sourced.
Make clear that biometric/head-position rules can be more complex than pixel dimensions.

## 5. Application presets

Potential categories:
- SSC
- UPSC
- banking
- railway
- NTA exams
- state recruitment
- university admissions

Important:
Do not hardcode guessed requirements into UI components.

Use `data/presets.json`.

Schema:

```json
{
  "id": "example-signature",
  "organization": "Example",
  "application": "Example Application",
  "assetType": "signature",
  "format": ["jpg", "jpeg"],
  "widthPx": null,
  "heightPx": null,
  "minKB": null,
  "maxKB": null,
  "aspectRatio": null,
  "officialSource": null,
  "verified": false,
  "notes": ""
}
```

Fields may be null when the official instruction doesn't constrain them.

Only show a green "Verified preset" badge when:
- `verified: true`
- `officialSource` exists

## 6. Custom mode

User can manually specify:
- width
- height
- unit: px
- max KB
- min KB optional
- output JPG/PNG/WebP
- aspect lock

## 7. File checker

Upload existing file and report:
- type
- width/height
- size KB
- aspect ratio
- whether it passes selected preset

This is useful even when no transformation is necessary.

## 8. Naming

Download names should be useful:
`formready-signature.jpg`
`formready-photo.jpg`

Do not use exam trademarks in filenames unless needed to identify the user's selected preset.

## 9. Batch utility for cyber cafes — later/optional

Allow multiple separate applicants to be processed without retaining files.
A "New applicant" action clears all state.

Do not mix files between sessions.

## Security/privacy

- revoke object URLs after use
- clear large buffers
- never store uploaded images in analytics/localStorage
- avoid sending files to any remote service


---

<!-- SOURCE FILE: formready/WORKFLOW.md -->

# FormReady Implementation Workflow

## Step 1 — Inspect references

Image processing:
https://github.com/dannycranmer/imagetoolkit

Inspect:
- compressor
- resizer
- crop
- converter
- image-to-PDF only if retained
- Canvas utility functions

ID crop:
https://github.com/mavi-cyber/IDPhotoResizer

Inspect:
- touch crop/zoom behavior
- preset architecture
- Canvas export
- dimension validation

Preserve required MIT notices for copied code.

## Step 2 — Build a clean preset-driven architecture

```text
src/
  components/
    UploadPanel
    CropStudio
    TargetSizeControl
    RequirementChecklist
    PresetPicker
    ResultDownload
  lib/
    image/
      decode
      crop
      resize
      compress
      targetSize
      export
    validation/
      validatePreset
  data/
    presets.json
  pages/routes/
```

If using vanilla HTML instead of a framework, preserve the same logical separation.

## Step 3 — Build Custom mode first

Before exam presets, ensure these generic functions work:
- crop
- resize
- exact/max KB
- format
- validation
- download

Application presets should only configure these generic engines.

## Step 4 — Build preset validation

Function:
```ts
validateAsset(fileMetadata, preset) -> {
  pass: boolean,
  checks: [...]
}
```

Checks can include:
- MIME/format
- bytes
- dimensions
- aspect ratio

## Step 5 — Build source/verification model

Every preset must store its source.
Admin/developer process:
1. find official instruction
2. copy only factual constraints into JSON
3. save official URL
4. set verified true
5. test with boundary files

Do not scrape competitor requirements into the product automatically.

## Step 6 — Add preset landing pages selectively

Only create an indexable landing page when:
- preset is verified
- there is distinct user intent
- page contains real instructions and a functioning configured tool

Do not mass-generate pages for every possible exam string.

## Step 7 — Test difficult images

- huge phone photo
- portrait screenshot
- transparent signature PNG
- tiny signature
- rotated EXIF photo
- very dark scan
- file already below target
- unsupported type

## Step 8 — Privacy verification

Confirm no upload request occurs during normal processing.
Do not include third-party scripts that capture file inputs.

## Step 9 — Trust/UX review

Make it obvious:
- what requirement is configured
- whether result passes
- that official source should be checked
- site is independent, not an official application portal


---

<!-- SOURCE FILE: formready/SEO.md -->

# FormReady SEO Strategy

## Market

India.

## Search intent

Users frequently know the destination requirement, not the image-editing technique.

Examples:
- need signature under a KB limit
- need photo resized for an application
- need exact dimensions
- need to check whether an image meets requirements

Therefore target **problem + requirement + application intent**, not just generic "image editor."

## Core clusters

### Exact KB
- compress image to 20kb
- compress image to 50kb
- compress image to 100kb
- image compressor in kb
- reduce image size in kb

### Signature
- signature resizer
- signature compressor
- signature resize 20kb
- resize signature online
- signature size checker

### Application intent
Only after preset verification:
- SSC signature resizer
- SSC photo resizer
- UPSC photo resizer
- banking exam signature resizer
- railway signature resizer
- NEET/JEE photo or signature size queries

### General
- government form photo resizer
- online application photo resizer
- passport photo resizer India
- image dimension checker

## Page design for search

Example `/signature-resizer`:
- tool immediately
- preset/custom toggle
- explanation of dimensions vs file size
- how to create a clean signature image
- FAQ
- related: exact KB / photo / checker

Example preset page:
- identify selected application
- show configured requirements
- source link
- tool preconfigured
- troubleshooting
- independent-site disclaimer

## Avoid

- claiming "official"
- copying exam-board logos
- stuffing every exam name into one page
- publishing unverified requirements as facts
- hundreds of auto-generated exam pages


---

<!-- SOURCE FILE: formready/REFERENCES.md -->

# FormReady References

## Primary open-source reference

### PicBrew / ImageToolkit
https://github.com/dannycranmer/imagetoolkit

Useful for:
- compression
- resize
- crop
- conversion
- Canvas-based local processing
- batch/ZIP concepts

MIT licensed.

## Secondary open-source reference

### IDPhotoResizer
https://github.com/mavi-cyber/IDPhotoResizer

Useful for:
- crop studio
- document dimension presets
- local Canvas processing
- touch-oriented portrait crop

MIT licensed.

## Market/UX references

Example of India-specific signature/preset UX:
https://signatureresizerr.com/

India exact-size PDF/image demand reference:
https://www.semrush.com/website/freecompress.com/overview/

General image-resizer traffic evidence:
https://ahrefstop.com/websites/imageresizer.com

## Important source policy

Competitor sites are not authoritative sources for official application requirements.
For each FormReady preset, use the relevant organization's official application instructions/notification as the source and store that URL in `presets.json`.
