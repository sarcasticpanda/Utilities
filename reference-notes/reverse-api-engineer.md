# Reverse API Engineer: fit for this project

## Upstream

- Repository: https://github.com/kalil0321/reverse-api-engineer
- The repository advertises an MIT license; verify its current `LICENSE` before installing or redistributing any files.
- Its documented workflow drives a browser, captures network traffic (HAR), then uses a configured model to generate a typed client for endpoints used by a website.

## What it is—and is not

This is a tool for discovering and documenting a website's network API. It is not primarily a source-code repository analyzer, and it does not automatically produce a trustworthy architecture guide for ClockMath, OmniTools, PicBrew, Parchment, or IDPhotoResizer.

For our three products, most core calculations and image/PDF processing are intentionally local in the browser. That makes an undocumented third-party API a poor foundation: it can change, may have usage restrictions, can introduce privacy concerns, and adds an external dependency the product specifications do not require.

## Appropriate use

Use it only if a clearly justified feature needs to understand a public website's network behavior—for example, to evaluate whether a documented, permitted public endpoint exists. Do not use it to collect private data, bypass access controls, or build a core product around an undocumented endpoint.

For understanding source repositories and giving a coding agent context, use a source packer such as [Repomix](https://github.com/yamadashy/repomix), then write source-grounded notes with paths and verified claims. Repomix's generated pack is raw context, not automatically correct documentation.
