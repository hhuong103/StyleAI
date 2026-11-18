# VELL illustrative assets

Generated with the built-in OpenAI ImageGen tool for this project on 2026-11-18. These are interface illustrations, not retailer merchandise photographs.

- `vell-studio.png`: empty photorealistic high-rise fashion studio; floor-to-ceiling glass windows, city and river skyline, gray concrete floor, taupe stone wall, no people or text.
- `vell-model.png`: fictional adult East Asian woman with a high bun, frontal full-body pose, black leather bomber, white cropped tee, olive cargo trousers, black boots, transparent background.
- `vell-sleep.png`: edit of `vell-model.png`; preserves the fictional model and pose, changes only the outfit to an ivory lounge top, taupe lounge pants and indoor slippers, transparent background.

The API bundles a copy of `vell-model.png` at `apps/api/assets/vell-model.png` as the identity reference for VELL virtual try-on.
- `vell-outfits/{denim,cream,grey,lavender,blue,formal,sage}.png`: generated illustrative edits using the fictional VELL model reference. These visuals are examples only; they are not product images or verified try-on results.

## Additional model presets — 2026-11-18

Six fictional adult models generated with OpenAI ImageGen, saved in `apps/api/assets/` and registered by `app.modules.vell.bootstrap`:
- `vell-minh.png`: male, short textured hair, lean build, relaxed casual outfit.
- `vell-marcus.png`: male, close-cropped hair, athletic build, knit polo and tailored trousers.
- `vell-alex.png`: male, wavy hair and beard, broader build, olive overshirt and boots.
- `vell-linh.png`: female, short bob, petite build, ivory blouse and beige trousers.
- `vell-amara.png`: female, natural curls, fuller build, cream tee and dark jeans.
- `vell-sofia.png`: female, mature appearance and wavy hair, sage shirt and cream trousers.
These are model reference illustrations, not evidence of successful garment inference or real product listings.

## Per-model wardrobes — 2026-11-18

Seven new transparent ImageGen atlases (`vell-outfits/models/*-atlas.png`) use the corresponding existing model reference: Alex, Minh, Marcus, Linh, Amara, Sofia, VELL Utility. Each atlas has six complete outfits in row order Everyday, Athletic, Sleep, Formal, Party, Street. The 42 self-contained SVG viewports embed the original generated PNG without changing its pixels. They show one cell per outfit. Source generation paths are recorded in `docs/wardrobe-sources.json`.

These are fictional editorial outfit illustrations. They are not verified retailer items or virtual try-on inference results. Existing Han shopping mappings must not be reused on them.
