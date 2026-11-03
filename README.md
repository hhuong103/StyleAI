# STYLEAI — Fashion AI MVP

MVP full-stack từ hai tài liệu Phase 1: **Next.js 16 + React/TypeScript → FastAPI → PostgreSQL**, SQLAlchemy/Alembic, Docker Compose. UI tiếng Việt theo hướng fashion editorial, accent xanh lime, có desktop/mobile.

## Chạy bằng Docker

Yêu cầu Docker Desktop/Engine có Compose v2; với WSL cần bật integration cho distro hiện tại.

**Windows PowerShell** — không cần cài Python trên Windows để chạy bằng Docker:

```powershell
docker desktop start --timeout 60
docker info --format '{{.OSType}}'
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup_env.ps1
docker compose config --quiet
docker compose up --build -d
docker compose exec api python -m app.seed demo
docker compose exec api python -m app.seed create-admin --email admin@example.com
```

Lệnh PowerShell trên chỉ áp dụng ExecutionPolicy cho tiến trình chạy script, không đổi chính sách hệ thống.

`docker info` cần trả về `linux` trước khi chạy Compose. Nếu báo không tìm thấy `dockerDesktopLinuxEngine`, mở Docker Desktop và đợi engine khởi động; với bản Docker Desktop chưa có lệnh `docker desktop`, mở từ Start menu. `docker compose config --quiet` chỉ kiểm tra cấu hình, không kiểm tra engine đang chạy. WSL Integration chỉ cần nếu gọi Docker từ terminal WSL, không bắt buộc khi dùng PowerShell.

**Linux/macOS/WSL:**

```bash
python3 scripts/setup_env.py
docker compose config --quiet
docker compose up --build -d
docker compose exec api python -m app.seed demo
docker compose exec api python -m app.seed create-admin --email admin@example.com
```

Mở URL `APP_ORIGIN` trong `.env` (mặc định **http://localhost:3000**), tạo tài khoản USER trên giao diện. Admin được tạo qua CLI với mật khẩu bạn nhập, không có mật khẩu mặc định. Script setup tạo `.env` với secret ngẫu nhiên và không ghi đè cấu hình có sẵn.

Nếu cổng 3000 đã được ứng dụng khác dùng, đặt `WEB_PORT` thành một cổng trống và đổi `APP_ORIGIN` tương ứng, ví dụ `WEB_PORT=3002` cùng `APP_ORIGIN=http://localhost:3002`, rồi chạy lại `docker compose up -d`. Hai giá trị phải khớp nhau để kiểm tra Origin/CSRF hoạt động đúng. Cổng proxy luôn chỉ bind loopback `127.0.0.1`.

Để bật **Sign in with Google**:

1. Mở [Google Cloud Console — Clients](https://console.cloud.google.com/auth/clients), chọn hoặc tạo project, rồi tạo OAuth Client ID loại **Web application**.
2. Thêm chính xác giá trị `APP_ORIGIN` trong `.env` vào **Authorized JavaScript origins** (mặc định khi dự án dùng cổng 3002 là `http://localhost:3002`).
3. Đặt Client ID vào `GOOGLE_CLIENT_ID` trong `.env`, rồi chạy `docker compose up --build -d`.

Chỉ Client ID được dùng ở trình duyệt; không cần lưu Client secret. Nếu Google OAuth app đang ở chế độ Testing, thêm tài khoản đăng nhập vào danh sách Test users. Google chỉ cấp email đã xác minh; tài khoản hiện có cùng email đã xác minh sẽ được liên kết.

Nếu PowerShell báo `Python was not found` khi chạy `python3`, dùng lệnh setup PowerShell ở trên. Các lệnh `python` sau `docker compose exec api` chạy trong container đã có Python.

## Đã triển khai

- Register/login/logout, Argon2id, JWT cookie HttpOnly, CSRF/Origin check, refresh rotation, revoke session, USER/ADMIN và owner checks.
- Profile/preferences: phong cách, màu, gender tùy chọn, khoảng ngân sách.
- Catalog/detail, filter kết hợp, sort/pagination, product/variant admin, upload ảnh an toàn, CLI cleaning có report, import CSV/JSON validate → transactional upsert.
- Stylist deterministic tiếng Việt/Anh, parse tiền, xác nhận input mơ hồ, 16 rules có version; form hoạt động độc lập với LLM.
- Ranking có score/components/reasons, ghép tối đa ba Look khác nhau trong tổng ngân sách, diagnostics khi thiếu dữ liệu hoặc budget thấp.
- Interactive Look với collage/hotspot, drawer, chọn variant, alternatives và preview giá/score; replacement tạo revision mới và kiểm tra lại giá/stock.
- Save/reopen/history/favorite/duplicate/delete Look, Like/Dislike có context; idempotency cho generate/save/replace và optimistic version cho sửa saved Look.
- Admin summary từ database, taxonomy CRUD/deactivate, draft/publish rule, audit logs.
- Migration, health/readiness, OpenAPI/TypeScript generation, CI workflow và bộ kiểm thử PostgreSQL/Playwright.

Catalog seed gồm **1.320 sản phẩm synthetic** và giá **DEMO**. Có **7 ảnh chụp tham khảo** cho **45 mẫu DEMO** khớp nhóm trang phục/màu sắc; các mẫu còn lại sử dụng SVG minh họa tự tạo. Seed tái chạy không thêm trùng, giữ nguyên ID, giá, biến thể và ảnh đã được quản trị viên thay thế. Đây là dữ liệu để chạy thử toàn luồng, chưa phải catalog hàng hóa đang bán hoặc dataset đánh giá chất lượng thời trang thực tế.

Trang chủ và trang đăng nhập dùng ảnh chụp thời trang từ [Unsplash](https://unsplash.com/license), đóng gói WebP trong dự án để không phụ thuộc mạng bên ngoài khi chạy. Nguồn ảnh được lưu tại `apps/web/public/images/editorial/credits.json` và `apps/api/assets/demo-photos/manifest.json`. Trang chủ có chọn bộ ảnh, chuyển cảnh, hiệu ứng xuất hiện khi cuộn và chữ chạy có nút tạm dừng; hỗ trợ bàn phím, màn hình di động và `prefers-reduced-motion`.

Sau khi cập nhật mã nguồn, chạy `docker compose up --build -d` rồi `docker compose exec api python -m app.seed demo` để cập nhật ảnh DEMO hiện có. Các Look đã lưu giữ nguyên ảnh snapshot lịch sử; Look tạo mới lấy ảnh catalog hiện tại.

## Cấu trúc mã nguồn

```text
apps/api/app/core/          config, errors, input/output schemas, idempotency
apps/api/app/db/            SQLAlchemy models, engine/session
apps/api/app/modules/       auth, profiles, catalog, stylist, recommendations,
                           looks, outfits, feedback, admin
apps/api/migrations/        Alembic schema
apps/api/tests/             unit + PostgreSQL API/integration/policy tests
apps/web/src/app/           public, shop, stylist, recommendation, my-looks, admin routes
apps/web/src/components/    UI, feature screens, providers, accessible dialogs
apps/web/src/lib/           API transport, generated types, view models, formatters
apps/web/tests/             Playwright desktop/mobile
packages/api-client/       generated shared OpenAPI types
contracts/                 exported OpenAPI và response mẫu thiết kế
infra/                     nginx proxy
scripts/                   env setup, contract generation, smoke benchmark
data/reports/              số liệu kiểm chứng local
docs/design/               design baseline từ DOCX
docs/runbooks/             cách chạy, import, release/backup/restore
```

## Hướng dẫn và kiểm chứng

- [Chạy local, build và test](docs/runbooks/local-development.md)
- [Import catalog thực tế](docs/runbooks/catalog-import.md)
- [Deployment, backup và restore](docs/runbooks/deployment-and-restore.md)
- [Báo cáo kiểm thử và giới hạn](docs/runbooks/verification.md)
- [OpenAPI thực tế](contracts/openapi.json) · [Shared generated types](packages/api-client/schema.d.ts)

Để cập nhật contract sau khi sửa API, dùng Python virtualenv đã cài requirements rồi chạy từ root:

```bash
python scripts/export_openapi.py
node scripts/generate-client.mjs
```

Frontend dùng generated types cho User/Product/Variant/LookItem và view models cho bố cục màn hình. CI kiểm tra drift của OpenAPI và cả hai bản generated schema, backend lint/format/tests, frontend type/format/build và Playwright.

## Phạm vi bàn giao

Đã triển khai luồng Phase 1 có persistence; chưa deploy cloud hoặc cấu hình TLS công khai. Đã build và khởi động Compose trên Docker Desktop Linux engine của Windows: migration thành công, PostgreSQL/API/web healthy, proxy phục vụ trang chủ/API/ảnh với HTTP 200. Cổng ngoài lấy từ `WEB_PORT`; mở đúng `APP_ORIGIN` trong `.env`. Xem report để biết phạm vi kiểm tra thực tế.

Phase 2: FashionCLIP, learned personalization, vector search, Virtual Try-On. Payment/order/checkout thương mại không nằm trong MVP. S3 adapter, email/account recovery, retention cleanup tự động và vận hành nhiều API instances cần được bổ sung khi mở rộng; local storage và interface AI hiện tại hỗ trợ mở rộng tiếp.

## Design baseline và nguồn

| Tài liệu | Nội dung |
|---|---|
| [01 — Kiến trúc](docs/design/01-architecture.md) | Boundary, module, cây thư mục đề xuất |
| [02 — Dữ liệu](docs/design/02-data-model.md) | ERD, constraints, snapshot, migration strategy |
| [03 — API](docs/design/03-api-contract.md) | Contract thiết kế v1; OpenAPI xuất từ code là contract thực thi |
| [04 — Recommendation](docs/design/04-recommendation.md) | Parse/rules/rank/composer/budget |
| [05 — UI/UX](docs/design/05-frontend.md) | Route, component, responsive, accessibility |
| [06 — Delivery](docs/design/06-delivery.md) | FR/NFR, backlog, release criteria |
| [07 — Quyết định](docs/design/07-decisions.md) | Nguồn, giả định và trade-offs |

Nguồn: `Phase1_Fashion_Project_Software_Project_Blueprint.docx` và `Fashion_AI_Phase1_UI_UX_Specification.docx`. Các tài liệu design là baseline của bước thiết kế; trạng thái “chưa triển khai” trong đó mô tả thời điểm lập baseline. README, OpenAPI và verification report này ghi nhận trạng thái implementation hiện tại.
