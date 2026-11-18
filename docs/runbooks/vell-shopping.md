# VELL — links on garments

## Scope

The eight fixed illustrative outfits now have 18 hand-authored clickable garment regions, using 15 distinct official product detail URLs from H&M and UNIQLO. Every suggestion is explicitly `SIMILAR`: style/color resemblance is an editorial judgment, not a claim that the illustration depicts that SKU. No retailer records, prices, stock, AI results or catalog verification records are fabricated.

The user explicitly approved similar products labelled “Tương tự” on hover. Product names, colors and URLs were researched on official retailer pages on 2026-11-18. Source URLs are stored directly in `apps/web/src/lib/vell-shopping.ts`; these are the provenance links as well as the destinations. They are regional stores (US, UK, Ireland, India); region is shown in the tooltip. Stock, supported shipping countries, pricing and size availability must be checked at the retailer. A reachable product page does not guarantee checkout availability. These links have no affiliate parameters.

## Implementation

- `src/lib/vell-shopping.ts`: editorial product references and normalized polygons per fixed illustration. Update this mapping when replacing an illustrative image or retiring a product URL. Do not reuse these shapes for other models or generated images.
- `src/components/vell-shopping-overlay.tsx`: real SVG anchors, highlight on hover/keyboard focus, labelled tooltip, HTTPS-only destinations, new tab with `noopener noreferrer`. Native links also support mobile taps. Escape dismisses the tooltip.
- `src/components/vell-studio.tsx`: binds links to the actually loaded avatar; removes hit areas during the outfit transition and on load failure. SVG uses the image's natural dimensions and matching contain/bottom alignment, inheriting the avatar zoom. Demo links disappear when selecting an unrelated model.
- Existing generated results still use `/api/v1/vell/try-on-results/{job_id}/shopping-regions`, requiring reviewed segmentation and unexpired verified product mappings. Responses are bound to the active job; demo suggestions never enter this verified pathway. No backend capability flags are changed.
- No database migration or existing catalog data change is needed.

## Checks

`npm --prefix apps/web run typecheck`

`docker compose build web`

From `apps/web`, with `E2E_BASE_URL=http://localhost:3002`:

`node node_modules/@playwright/test/cli.js test --config playwright.vell.config.ts --reporter=line`

The navigation test intercepts retailer pages to verify the exact destination and absence of `window.opener`; it is not an availability test. Browser coverage includes desktop/mobile, similarity disclosure, restoration of per-outfit links, keyboard dismissal, model changes, failed image loads, and zoom alignment. Existing studio tests cover the outfit transition, saved looks, filters, model picker, and old Collection redirect.

## Not covered

Shoes/accessories and standalone additional model reference images do not yet have editorial product mappings. Real catalog/AI shopping still needs actual product verification and reviewed segmentation. Retailer URLs are curated, not continuously monitored; recheck and replace them as products change. The repository's verified backend currently allows Shopee URLs; this change does not silently widen that policy to these editorial links.

## Additional wardrobes

All 42 added fixed outfits now have editorial shopping mappings: 91 garment hotspots for seven model wardrobes (four male, three female). `src/lib/vell-wardrobe-shopping.ts` holds 23 official H&M product page references researched on 2026-11-18, plus gender/occasion-specific garment mappings and atlas viewport hit areas. All are explicitly SIMILAR. A single pyjama product is a set, so its shirt and trousers intentionally share one destination. Product pages may have unavailable sizes/stock; market and the instruction to check sizes/shipping remain in the tooltip. No stock or price is asserted.

The existing overlay, HTTPS validation, focus/hover tooltip, safe new-tab navigation, transition guards and zoom alignment are reused. The combined illustration map now covers 50 outfits (Han's 8 plus 42). Generated results continue using reviewed backend mappings. No backend change or database migration is required.

Tests now check labels and outbound navigation for every added outfit on desktop/mobile, and retain URL validation and the original studio behavior checks. New model references are mapped only after selecting a fixed outfit. Source artwork remains unchanged.

On small screens, the avatar height reserves space for the profile panel so it cannot cover the shirt shopping markers at default zoom. Native SVG link navigation is retained.
