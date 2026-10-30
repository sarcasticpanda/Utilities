# Reference repository notes

These notes support `../UTILITY_SITES_COMPLETE_MASTER.md`. They record what the public reference repositories appear to offer and how they might help the three products. Treat upstream code as a source to inspect, not a finished product to copy.

## How these notes were made

- [Repomix](https://github.com/yamadashy/repomix) was used to create an AI-readable Markdown pack of ClockMath. The generated pack is in the machine temporary folder, not committed into this project.
- The other repositories were reviewed through their public README and file listings for this planning pass. Before code is reused, inspect the exact implementation and current license in the selected upstream revision, then record the commit and retained notices.
- Repository code, README statements, and product specs are evidence to verify. They do not override official application requirements, browser compatibility, or our own UX review.

## Product notes

- [WorkKit / ClockMath](workkit-clockmath.md)
- [QuickKit / image, PDF and multi-tool references](quickkit-tools.md)
- [FormReady / ID photo reference](formready-id-photo.md)
- [Reverse API Engineer assessment](reverse-api-engineer.md)

## Reading order for implementation

1. Read the product and shared requirements in the master specification.
2. Read that product's reference note.
3. Inspect the exact upstream files named by the note and confirm license, behavior, browser support, and privacy implications.
4. Adapt only the necessary implementation. Create original brand, layout, page copy, route structure, and explanations.
5. Record reused code and dependency licenses in the product's acknowledgements.
