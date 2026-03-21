# Render Generator Audit

Current imported generator: [render_doc.py](/C:/1_Work/Работа/Сайты/Боты/Congrats/renderer/legacy/render_doc.py)

## What It Does

- Reads one JSON input file
- Loads template assets from `templates_dir`
- Renders a PNG with Pillow
- Adds watermark, QR, stamp and seal

## Why It Feels Slow

- Every render starts a fresh Python process
- Each render re-parses JSON and re-loads fonts in a new process
- Background, stamp and seal are decoded from disk for each process lifecycle
- Text layout does many repeated `textbbox` and wrap passes
- Final file is always written as PNG, which is heavier than needed for previews

## Fastest Next Improvements

1. Run the renderer as a persistent worker instead of one Python process per job.
2. Separate preview and final pipelines so preview can use lower resolution and JPEG/WebP.
3. Move variant phrase expansion and layout planning out of Pillow into precomputed JSON.
4. Keep background, seal, stamp and fonts warm in memory across jobs.
5. Add benchmark timings around asset load, layout, QR generation and save.

## Recommended Rewrite Direction

- Keep Python/Pillow only for the image composition step.
- Wrap it in a long-lived worker service with a queue.
- Make the input contract explicit and versioned.
- Precompute business content in Node.js and send the renderer only normalized render instructions.
