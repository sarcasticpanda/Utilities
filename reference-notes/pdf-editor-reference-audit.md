# PDF editor reference audit

Reviewed the publicly visible workflows on 2026-10-30:

- Sejda PDF editor: <https://www.sejda.com/pdf-editor>
- iLovePDF PDF editor: <https://www.ilovepdf.com/edit-pdf>

## Observed product patterns

| Area | Sejda | iLovePDF | QuickKit decision |
|---|---|---|---|
| Start | Upload, drop, or start blank; optional cloud/web input | Choose or drop a PDF; Drive/Dropbox affordances | Local file picker and drag-and-drop only; no third-party account prompts |
| Additions | Text, links, images, shapes, annotations and form controls | Text, shapes, comments/highlights and images | Text, highlight, rectangle, image and drawn signature |
| Page/document workflow | Full-featured editor within a much larger PDF tool catalog | Focused edit, review items, download | One PDF at a time; clear page rail, reorder/delete, zoom, download; keep merge separately linked |
| Privacy | Reference indicates temporary service-side document handling | Upload/progress-based workflow | Keep selected files in-browser and communicate the limitation plainly |
| Scope boundary | Existing-text edits and form authoring appear in its catalog | Its public feature copy promises added content | QuickKit's v1 adds overlay annotations and does not claim arbitrary original text replacement or fillable-form authoring |

## Implementation notes

- Findings come from public product pages and visible UI text; no private API, credentials, or traffic interception was used.
- Repomix is a repository packer, not a third-party web reverse-engineering tool. No Sejda/iLovePDF source or branding was copied.
- QuickKit uses the existing `pdf-lib` package for export and Mozilla `pdfjs-dist` for local rendering. The app loads no PDF processing endpoint.
- The editor uses a focused toolbar, lazy page thumbnails, one active-page canvas and a contextual item inspector. This keeps the task flow compact on phones.
- Password-protected files, rewriting arbitrary existing text, form-field creation, OCR and cloud-drive imports remain out of scope; the interface says so where relevant.
- The loaded editor caps an individual PDF at 100 MB and an inserted image at 20 MB; mobile memory varies by device. The app should be evaluated with larger real documents before removing those limits.

## Browser test inventory

See `../scripts/pdf-editor-smoke.mjs`, `../qa-results/pdf-editor/results.json`, and `../BROWSER_QA_CHECKLIST.md` for cases and local Chromium evidence.
