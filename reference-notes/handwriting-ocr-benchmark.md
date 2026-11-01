# Handwriting OCR benchmark

**Run date:** 2026-11-01
**Input:** a supplied handwriting-and-scan sample, pages 1–2
**Processing:** local browser benchmark only; no document or OCR transcript was uploaded or retained in this note.

## Result

The shipped Tesseract OCR path detects scanned pages and produces editable review text, but the supplied handwriting is not accurately transcribed. The last production sample recorded an engine score of 40/100 on both pages and only 332 output characters across the two-page file. Treat this as a tested workflow, not an accepted transcription.

I evaluated TrOCR as a possible browser-side handwritten recognizer. Microsoft’s model description specifies single-line image input, so it needs line segmentation first. The first pass used Tesseract line boxes; visual inspection showed those boxes often covered notebook rules, neighboring lines, or diagrams. A second pass used manually aligned crops plus blue-ink background cleanup. Both produced visibly incorrect output on clearly legible lines, including a short uppercase traversal. This model did not improve the supplied document in this benchmark and is not suitable to ship as the default or as a paid feature.

## Decision

- Keep current Tesseract OCR as an explicitly review-required fallback for scanned PDFs.
- Do not present its engine confidence as accuracy; keep the current warning and require users to review/correct OCR output.
- Do not integrate the benchmarked TrOCR pipeline. Its inference did not meet this document’s needs, its first-page output depends on unreliable segmentation, and the Microsoft model page does not provide enough clear licensing information for a commercial ad-supported product. A community ONNX conversion describes itself as MIT licensed, but that alone does not resolve the base model’s training-data terms.
- Before claiming accurate handwriting support, obtain a commercially usable model and verify it against manually transcribed representative pages, reporting character/word error rates as well as real-browser load size, inference time, and memory.

## Reproduction notes

- Rendered both supplied pages locally and inspected the page images.
- Tesseract supplied 17 candidate regions on page 1; many regions visibly included rules or crossed adjacent content.
- Ran `Xenova/trocr-small-handwritten` through Transformers.js on those crops and on manually aligned, background-cleaned crops. The output remained wrong on obvious text.
- Removed raw line crops, rendered source images, model output and the temporary benchmark app after evaluation. Only this summary remains.

## References

- [Microsoft TrOCR model card](https://huggingface.co/microsoft/trocr-small-handwritten) — states the model is for single text-line images.
- [Xenova Transformers.js model card](https://huggingface.co/Xenova/trocr-small-handwritten) — provides the browser pipeline example.
- [Transformers.js pipeline documentation](https://huggingface.co/docs/transformers.js/en/pipelines) — documents browser model downloads and caching.
- [Community INT8 ONNX conversion](https://huggingface.co/oguzhandurmaz/trocr-small-handwritten-onnx-int8) — reports 178 MB weights and line-only input, illustrating the download and segmentation cost.
- [Microsoft TrOCR repository](https://github.com/microsoft/unilm/tree/master/trocr) — source project and license pointer.
- [Open licensing question about the model’s training data](https://github.com/microsoft/unilm/issues/1620) — unresolved community question; not legal advice or a license grant.
