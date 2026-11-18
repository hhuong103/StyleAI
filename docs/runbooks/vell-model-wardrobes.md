# VELL per-model wardrobes

Added 42 generated editorial outfits for Alex, Minh, Marcus, Linh, Amara, Sofia and VELL Utility. Each has Everyday, Athletic, Sleep, Formal, Party and Street; All lists all six. Han retains the existing eight outfits. The selected model scopes outfit cards. Selecting a model clears unrelated undo/redo, selects its Everyday look and resets the category to All. Saved illustrative looks resolve their owning model when restored; Reset stays within that model. Avatar transition/zoom and lighting remain supported.

Assets: seven ImageGen transparent atlases with source reference identities, and 42 self-contained SVG cell viewports under `apps/web/public/images/vell-outfits/models/`. Model faces/builds were visually reviewed against references. Generation is illustrative and does not certify exact identity or retailer garments. New outfits have no copied Han shopping mappings. No database migration is required, and no AI capability flags change.

Changed: `vell-studio.tsx`, `tests/vell.spec.ts`, `VELL_ASSETS.md`; added model wardrobe assets and `docs/wardrobe-sources.json`. Existing API model presets and auth/recommendation flows are reused.

Validation: web typecheck, production Docker build, formatting/diff checks, Playwright desktop/mobile studio suite including all seven models and all six categories.
