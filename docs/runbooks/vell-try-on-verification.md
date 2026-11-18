# Kiểm chứng module VELL Try-On Jobs ngày 18 tháng 11 năm 2026

## Phạm vi

Đã khảo sát repository trước khi thay đổi: FastAPI trong `apps/api`, PostgreSQL 16 khi chạy Compose, SQLite cho local, SQLAlchemy/Alembic, Pydantic, JWT cookie, CSRF/Origin, catalog/recommendation/saved outfits hiện có. Frontend Next.js dùng `/vell`; `/shop` chuyển tới `/vell`; catalog ở `/catalog`, chi tiết ở `/shop/{productId}`. Queue Redis và S3 chưa có trong hạ tầng hiện tại.

Chỉ triển khai module Virtual Try-On và quản lý job. Tái sử dụng validation catalog, ảnh tham chiếu người mẫu, mã gọi Gemini, bộ ghi ảnh/metadata và cơ chế auth/error hiện có. Repository có thay đổi từ các lượt làm VELL trước; danh sách dưới đây là phần thuộc lượt triển khai backend job này.

## Source mới

- `apps/api/app/modules/vell/__init__.py`
- `apps/api/app/modules/vell/schemas.py`: DTO input/output và validation preset/consent/product IDs.
- `apps/api/app/modules/vell/router.py`: tạo, liệt kê, xem và hủy job.
- `apps/api/app/modules/vell/service.py`: admission, quota, idempotency và snapshot đầu vào.
- `apps/api/app/modules/vell/repository.py`: truy cập job theo owner, claim, lease và cập nhật trạng thái có điều kiện.
- `apps/api/app/modules/vell/providers.py`: protocol và Gemini provider adapter.
- `apps/api/app/modules/vell/worker.py`: process nền độc lập, timeout, kiểm tra output và lỗi inference.
- `apps/api/migrations/versions/0006_vell_try_on_jobs.py`.
- `apps/api/tests/test_vell_jobs.py` và `apps/api/tests/test_vell_jobs_postgres.py`.
- `docs/runbooks/vell-try-on-jobs.md` và báo cáo này.

## Source cập nhật

- `apps/api/app/db/models.py`: model `TryOnJob`.
- `apps/api/app/main.py`: đăng ký router VELL.
- `apps/api/app/modules/stylist/virtual_tryon.py`: tách preparation/persistence để tái sử dụng; endpoint đồng bộ hiện có dùng chung adapter; kiểm tra URL và đủ ba ảnh hợp lệ.
- `compose.yaml`: thêm service `vell-worker`, dùng chung database và media volume.
- `contracts/openapi.json`, `packages/api-client/schema.d.ts`, `apps/web/src/lib/schema.d.ts`: xuất lại contract từ code.
- `README.md`: liên kết tài liệu backend job.

## Kết quả kiểm tra

| Lệnh hoặc kiểm tra | Kết quả |
| --- | --- |
| `ruff check apps/api scripts` | Qua |
| Ruff format cho 13 file thuộc module job và điểm tích hợp | Qua |
| `pytest tests/test_vell_jobs.py tests/test_virtual_tryon.py -q` | 15 qua |
| Toàn bộ `pytest -q` trong Docker, PostgreSQL `fashion_test`, `GEMINI_API_KEY` rỗng | 106 qua, 2 lỗi ngoài module job |
| PostgreSQL test hai worker claim đồng thời | Qua trong bộ test đầy đủ |
| `alembic check` trên `fashion_test` | Không có schema drift |
| Export OpenAPI và generate TypeScript | Qua |
| `npm run typecheck` | Qua |
| `npm run build` | Qua |
| `E2E_BASE_URL=http://localhost:3002 npx playwright test --config=playwright.vell.config.ts` | 6 qua |
| `git diff --check` | Qua |
| Migration local `0005 → 0006` | Thành công |
| API local `GET /api/v1/vell/try-on` chưa đăng nhập | 401 `AUTH_REQUIRED` |
| Docker local sau cập nhật | API healthy, worker đang chạy |

Hai lỗi trong `tests/test_policies.py` nằm ở `test_explicit_form_takes_precedence_over_text` (test chỉ kỳ vọng cảnh báo occasion/style, response có thêm budget) và `test_taxonomy_cycle_rule_publish_and_image_validation` (publish trả 409, test kỳ vọng 200). Các module nghiệp vụ tương ứng không được sửa trong lượt này để giữ phạm vi VELL.

`ruff format --check apps/api` còn báo định dạng tại `apps/api/app/modules/auth/security.py`, file không sửa trong lượt này. `npm run format:check` báo 25 file frontend chưa khớp Prettier, cũng nằm ngoài phạm vi thay đổi backend job. Không tuyên bố toàn repo đã qua mọi gate.

## Giới hạn

Chưa gọi Gemini thật trong lượt kiểm thử này; inference thành công/thất bại và output validation được kiểm thử bằng provider chỉ dành cho test. Adapter production vẫn gọi Gemini thật và không có provider giả đăng ký trong ứng dụng. Không có sản phẩm hoặc link mua giả được thêm vào catalog.

Frontend hiện tại vẫn dùng endpoint đồng bộ; API job đã có để tích hợp polling ở một nhiệm vụ riêng. Phân đoạn, retailer URL verification, signed media URLs, Redis/S3, tác vụ dọn dữ liệu và kiểm chứng tự động độ chính xác trang phục/danh tính chưa thuộc module đã bàn giao. Chi tiết vận hành, trạng thái lỗi và request/response ở `vell-try-on-jobs.md`.
