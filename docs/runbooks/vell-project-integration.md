# TASK 01 VELL Project Integration

VELL dùng backend FastAPI hiện có, PostgreSQL/SQLAlchemy/Alembic, xác thực JWT cookie và CSRF/Origin. Module được đăng ký tại `app.main` qua một router cha `/api/v1/vell`. Ba API nền tảng và các API job đã có dùng chung namespace này. Không dựng backend mới và không đổi contract catalog, auth, recommendations hoặc saved outfits.

## Dependency của Collection

Repository không có controller, bảng hoặc API độc lập tên Collection. Collection là nhãn điều hướng trước đây của trang catalog `/shop`, dùng `CatalogScreen` và `ProductCard` trong `apps/web/src/components/catalog-screen.tsx`.

| Thành phần | Dependency hiện có | Xử lý |
| --- | --- | --- |
| Listing, filter, pagination | `GET /api/v1/products`, `GET /api/v1/taxonomy`; catalog router/service/repository | Giữ API; giao diện catalog ở `/catalog` |
| Chi tiết sản phẩm | `/shop/{productId}`, `GET /api/v1/products/{productId}`, ProductDrawer | Giữ đường dẫn và contract |
| Ghi sản phẩm, variant, stock | Product CRUD/stock/variant endpoints trong catalog router; quyền ADMIN | Giữ cho nhập và quản trị catalog VELL |
| Import và ảnh | `/api/v1/admin/catalog-imports/*`, `/api/v1/admin/uploads/images`, `/media/*` | Giữ; ảnh upload thật là đầu vào cho VELL |
| AI Stylist/Waitlist | `/api/v1/stylist/plan`, `/api/v1/recommendations`; waitlist lưu browser giữ product/variant IDs | Tái sử dụng; liên kết mở catalog ở `/catalog` |
| Look và sản phẩm thay thế | `/api/v1/recommendations/{recommendation_id}/looks/*`, recommendation look/revision/item snapshots | Giữ; còn tham chiếu sản phẩm, giá và variant |
| Library và history | `/api/v1/outfits/*`, `/api/v1/recommendations`; saved snapshots | Giữ lịch sử và liên kết sản phẩm |
| Auth và profile | `/api/v1/auth/*`, `/api/v1/users/me/profile`, owner checks, USER/ADMIN | Dùng chung; GET config/capabilities/health VELL công khai |
| Runway trang chủ | `shop-the-look.tsx`, `lib/runway.ts`, ảnh illustrative và link detail `/product` | Giữ; ảnh minh họa không được tính vào khả năng catalog thật |

Các bảng có dependency, cần giữ:

| Nhóm | Bảng | Lý do |
| --- | --- | --- |
| Catalog | `products`, `product_variants`, `product_images`, `product_styles`, `product_occasions` | Nguồn hàng, stock, ảnh và product IDs cho recommendation, try-on và saved look |
| Taxonomy | `categories`, `styles`, `occasions`, `colors` | FK của sản phẩm, preferences, rule và outfit |
| Recommendation | `outfit_rules`, `stylist_plans`, `recommendations`, `recommendation_items`, `recommendation_looks`, `recommendation_look_items` | Lịch sử gợi ý, item snapshots, revisions và liên kết nguồn |
| Library | `outfits`, `outfit_items`, `feedback` | Look đã lưu và phản hồi; FK/snapshot còn cần sản phẩm lịch sử |
| Quản trị | `catalog_imports`, `admin_audit_logs`, `idempotency_requests` | Theo dõi import, thay đổi và ngăn ghi trùng |
| Người dùng | `users`, `auth_sessions`, `profiles`, `preferences`, `preference_styles`, `preference_colors` | Authentication, quyền sở hữu và personalization |
| VELL | `vell_try_on_jobs` | Queue và kết quả inference đã triển khai trước TASK 01 |

Không có bảng nào đủ căn cứ để xóa trong TASK 01. Những gì không còn cần ở vị trí Collection là nhãn điều hướng và màn hình listing tại `/shop`; dữ liệu catalog vẫn dùng chung. Dữ liệu DEMO giữ cho admin/test, không đưa vào capabilities catalog thật. Media cũ và snapshot không bị xóa. TASK 01 chỉ thêm code/read-only APIs nên không cần database migration mới.

## Routing và compatibility

- `/vell`: studio VELL, có metadata và stylesheet riêng; header/footer chung được ẩn cho route này.
- `/shop`: server redirect 307 tới `/vell`. Query filter cũ không chuyển sang studio vì không có cùng ý nghĩa; muốn tiếp tục lọc sản phẩm dùng `/catalog?...`.
- `/catalog`: listing/filter sản phẩm; Search, AI Stylist và nút cửa hàng trong VELL mở route này.
- `/shop/{productId}`: giữ trang detail, không redirect theo prefix `/shop/*`.
- `/product`, `/outfits/{lookId}/{productId}`, `/my-looks`, `/history`: giữ nguyên.
- Không tìm thấy route `/collection` hoặc `/collections` trong code được khảo sát. Nếu access logs/bookmarks sau này cho thấy đã từng công bố các URL đó, thêm redirect tường minh tới `/vell`; không thêm redirect wildcard có thể che mất API/detail.
- Nginx chuyển `/api/*` tới FastAPI và `/` tới Next.js; Next.js local rewrites `/api/*` và `/media/*` tới backend. Không cần thêm proxy rule cho VELL.

## APIs nền tảng

Cả ba endpoint là GET công khai, không gửi ảnh tới AI, không ghi database, không trả secrets hoặc đường dẫn nội bộ. Response dùng envelope và `Cache-Control: no-store` hiện có.

### GET /api/v1/vell/health

Kiểm tra kết nối database, migration hiện tại và khả năng truy cập các cột catalog/job cần thiết. Đây là readiness cho tích hợp VELL, không chứng nhận provider Gemini hoặc worker còn hoạt động.

```json
{
  "data": {
    "module": "vell",
    "status": "ready",
    "database": "ready",
    "schema_status": "current"
  },
  "meta": {"request_id": "<request-uuid>"}
}
```

Database thiếu/lỗi hoặc migration chưa khớp trả HTTP 503:

```json
{
  "error": {
    "code": "VELL_NOT_READY",
    "message": "Database/migration VELL chưa sẵn sàng.",
    "details": {}
  },
  "meta": {"request_id": "<request-uuid>"}
}
```

### GET /api/v1/vell/config

Trả API base, frontend/catalog routes, redirect compatibility, preset mặc định nếu ảnh tham chiếu giải mã được, tên provider/model, JWT cookie/CSRF và giới hạn job hiện hành. Không trả API key, JWT secret, database URL hoặc storage path. Endpoint vẫn hoạt động nếu database chưa sẵn sàng.

### GET /api/v1/vell/capabilities

Trả năm tính năng, mỗi tính năng có `implemented`, `configured`, `available`, `reasons`, `modes`, `authentication_required`. Thiếu database/schema/catalog tables trả 503, không tự dựng khả năng thay thế.

| Tính năng | Ý nghĩa dữ liệu |
| --- | --- |
| `model_selection` | `available=false`: mới có một preset cố định, chưa có module chọn/tùy biến nhiều model |
| `recommendation` | Implementation là rule/ranking hiện có; configured khi có rule active, available khi thêm catalog REAL công khai, category active, variant còn hàng và URL listing đúng cấu trúc. Đây là khả năng vận hành engine, không cam kết mọi hoàn cảnh đủ một outfit |
| `virtual_try_on` | Có implementation Gemini và job API; configured khi có key, model ID và ảnh tham chiếu hợp lệ. `available=false` vì chưa có kiểm chứng provider/heartbeat worker trong TASK 01; key không rỗng không chứng minh key còn dùng được. Reasons nêu `PROVIDER_NOT_VERIFIED`, `WORKER_HEALTH_NOT_VERIFIED` và điều kiện cấu hình thiếu |
| `garment_segmentation` | Chưa có implementation, configured/available đều false |
| `shopping_links` | Chỉ chế độ `manual_product_links`: available khi có sản phẩm REAL đủ điều kiện và URL listing đúng cấu trúc. Reasons luôn nêu chưa kiểm tra listing trực tiếp và chưa có Hover-to-Shop; không quảng bá exact garment mapping hoặc URL đã được xác minh trực tuyến |

Ví dụ một capability chưa triển khai:

```json
{
  "implemented": false,
  "configured": false,
  "available": false,
  "reasons": ["NOT_IMPLEMENTED"],
  "modes": [],
  "authentication_required": true
}
```

Các API job giữ nguyên tại `/api/v1/vell/try-on`, `/{job_id}`, `/{job_id}/cancel`; không có prefix lặp `/vell/vell` hoặc `/api/v1/api/v1`. Chi tiết job ở [tài liệu Try-On Jobs](vell-try-on-jobs.md).

## Kiểm thử

- `apps/api/tests/test_vell_integration.py`: readiness healthy/outdated/missing schema; không lộ secret; capabilities thiếu key/model/reference; không coi DEMO hoặc URL search là catalog thật; response legacy catalog/taxonomy/live không đổi; không có câu SQL ghi/xóa khi gọi API mới; giữ auth và validation legacy; giữ contract job.
- `apps/api/tests/test_vell_jobs.py`, `test_virtual_tryon.py`: regression cho namespace job và adapter cũ.
- `apps/web/tests/vell.spec.ts`: `/shop → /vell`, `/catalog` truy cập được, desktop/mobile studio và tương tác hiện có.

Lệnh local: `python -m pytest tests/test_vell_integration.py tests/test_vell_jobs.py tests/test_virtual_tryon.py -q` từ `apps/api`. Chạy PostgreSQL/full suite theo [hướng dẫn kiểm thử job](vell-try-on-jobs.md), đặt `GEMINI_API_KEY` rỗng để không phụ thuộc cấu hình thật. Không cần gọi inference tính phí để kiểm thử TASK 01.

## Kết quả TASK 01 ngày 18 tháng 11 năm 2026

Source mới gồm `integration_router.py`, `integration_schemas.py`, `integration_service.py`, `integration_repository.py` trong `apps/api/app/modules/vell/` và `apps/api/tests/test_vell_integration.py`. Router VELL hiện có được sửa để mount router nền tảng và router job dưới cùng prefix. Đã xuất lại `contracts/openapi.json`, `packages/api-client/schema.d.ts`, `apps/web/src/lib/schema.d.ts`; README liên kết tài liệu này. Không sửa các module nghiệp vụ Collection/catalog và không thêm migration trong TASK 01.

- `ruff check apps/api scripts`: qua. Ruff format cho module VELL và test tích hợp mới: qua.
- `pytest tests/test_vell_integration.py tests/test_vell_jobs.py tests/test_virtual_tryon.py -q`: 21 qua.
- Toàn bộ pytest trong Docker, database PostgreSQL `fashion_test`: 112 qua, 2 lỗi đã ghi nhận ở lượt trước tại `test_policies.py` (`test_explicit_form_takes_precedence_over_text`, `test_taxonomy_cycle_rule_publish_and_image_validation`). Không thay đổi hai module nghiệp vụ ngoài phạm vi TASK 01.
- `npm run typecheck`, `npm run build`: qua.
- `E2E_BASE_URL=http://localhost:3002 npx playwright test --config=playwright.vell.config.ts`: 6 qua trên desktop/mobile.
- `npm run format:check`: còn 25 file frontend ngoài phạm vi chưa khớp định dạng. Backend toàn repo còn cảnh báo Ruff format ở `auth/security.py` đã được ghi nhận trong báo cáo job trước. Không tuyên bố toàn bộ CI đã xanh.
- Smoke trên bản Docker cập nhật: `/api/v1/vell/health`, `/config`, `/capabilities` đều HTTP 200; health báo database ready/schema current; `/api/v1/taxonomy` HTTP 200; `/shop` HTTP 307 với Location `/vell`.

Nếu recreate container API nhưng giữ nguyên proxy Nginx, địa chỉ IP cũ có thể còn được Nginx cache gây 502. Lần cập nhật này đã chạy `docker compose exec -T proxy nginx -s reload` và xác nhận ba endpoint hoạt động lại; thao tác này không thay đổi database hay API contract.
