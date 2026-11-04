# Shop-the-look image set

Eight fictional adult fashion models generated with the built-in OpenAI ImageGen tool on 2026-11-04 for this local STYLEAI interface. The source prompts requested full-body studio ecommerce photography with clear, unobstructed garments, no logos, text, watermarks, or real-person identity references.

- `coral-weekend.png`: ivory blouse, cherry A-line skirt, white sneakers.
- `soft-tailoring.png`: sand blazer, ivory knit, cream trousers, brown loafers.
- `modern-utility.png`: forest overshirt, white tee, charcoal cargo trousers, cream sneakers.
- `after-dark.png`: black cropped jacket, midnight satin dress, silver sandals.
- `city-denim-cutout.png`: cropped denim jacket, white tank, indigo wide-leg jeans, silver sneakers.
- `neo-prep-cutout.png`: burgundy varsity cardigan, blue Oxford shirt, charcoal pleated trousers, black loafers.
- `elevated-active-cutout.png`: chartreuse track jacket, black performance top, flared leggings, white runners.
- `monochrome-edge-cutout.png`: black faux-leather bomber, gray knit, wide black trousers, ankle boots.

These images present illustrative DEMO looks. They are not merchant inventory photographs.

## Additional gallery poses

The built-in ImageGen tool generated four additional contact sheets, saved beside the original images as `coral-weekend-poses.png`, `soft-tailoring-poses.png`, `modern-utility-poses.png`, and `after-dark-poses.png`.

Prompt set: for each matching original reference image, preserve the same fictional adult model and exact garments, colors and shoes. Generate two equal portrait panels: left, a three-quarter walking pose; right, a three-quarter back view looking over the shoulder. Show the entire head and shoes with safe margins, matching studio background and soft editorial light. No text, logos, watermarks or added accessories. The gallery displays each panel separately; these are new poses, not crops of the original front view.

Shopee destinations are per-item searches for similar styles, unless `purchaseUrl` is supplied in `src/lib/runway.ts`. Reference prices and sizes do not represent verified merchant stock.

## Transparent runway cutouts

The built-in ImageGen tool produced four 1024×1536 RGBA cutouts saved as `coral-weekend-cutout.png`, `soft-tailoring-cutout.png`, `modern-utility-cutout.png`, and `after-dark-cutout.png`. The original studio images are preserved for product details and galleries.

Prompt set: background-extraction edit of each matching original. Remove only the colored backdrop, circular design, floor and floor shadow; deliver genuine alpha transparency. Preserve model identity, garments, colors, texture, pose, full-body placement and the original 2:3 canvas and margins so the garment interaction map stays aligned. Keep the head and both shoes, natural hair edges; no crop, recenter, logos, text, checkerboard or replacement background.

Four additional 1024×1536 RGBA model images were generated directly as transparent cutouts for the expanded Hot Trend runway. Prompt set: fictional adult fashion model, premium photorealistic ecommerce quality, full body centered on a 2:3 canvas with safe margins, bright studio lighting, clear and unobstructed garments, genuine alpha transparency, no floor or floor shadow, props, logos, text, watermark, bags or hats.

## Expanded Hot Trend gallery poses

The built-in ImageGen tool generated four additional 1536×1024 contact sheets: `city-denim-poses.png`, `neo-prep-poses.png`, `elevated-active-poses.png`, and `monochrome-edge-poses.png`.

Prompt set: use the matching transparent front image as the identity and exact outfit reference. Preserve the same fictional adult model, garments, colors, materials, hair and shoes. Generate exactly two equal portrait panels on a clean ecommerce studio background: left, a full-body three-quarter walking pose; right, a full-body three-quarter back view looking over one shoulder. Keep equal subject scale, the full head and both shoes with safe margins. No text, logos, watermarks, bags, hats or added accessories. These contact sheets enable the three-view product detail gallery for all four newer looks.
