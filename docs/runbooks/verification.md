# Báo cáo kiểm chứng implementation

Ngày thực hiện: **03/11/2026**. Môi trường: WSL/Linux, Node.js 22.22.2, Python 3.12.3, PostgreSQL 16.15; dependency versions được khóa trong package-lock.json và requirements.txt. Database và các tài khoản QA dùng môi trường local tách biệt; không có thao tác deploy cloud hoặc sửa hệ thống ngoài.

## Cập nhật ảnh thật và chuyển động — 03/11/2026

- Production Docker build/TypeScript: thành công. API và web được cập nhật trên `http://localhost:3002`.
- Kiểm thử seed/MIME trong PostgreSQL `fashion_test` riêng: **3 passed**. Bao gồm nâng cấp ảnh nhưng giữ ID/variant/giá, chạy lại không thay đổi, bảo vệ ảnh upload/dữ liệu import và phục vụ WebP với `Content-Type: image/webp`.
- Playwright trên ứng dụng Docker đang chạy: **4 passed**, desktop/mobile; đăng ký → phối đồ → thay món → lưu → phản hồi → catalog/detail, bàn phím và reduced motion.
- QA ảnh và tương tác trên desktop 1440px/mobile 390px: cả ba bộ ảnh tải thành công; nút chuyển ảnh đổi đúng nội dung và liên kết; chữ chạy tạm dừng được; reduced motion tắt chuyển động; không lỗi JavaScript hay tràn ngang.
- Seed thực tế: **0 sản phẩm mới**, **45 ảnh sản phẩm được cập nhật**, **7 file ảnh chụp**, tổng **271 file ảnh**. Metadata và giá vẫn là DEMO; ảnh chụp dùng để tham khảo, không phải inventory của nhà bán hàng.
- Đã xử lý thiếu MIME database WebP trong Python slim và reload nginx sau khi container web đổi địa chỉ.

Ảnh giao diện mới: [desktop](../screenshots/photos-desktop.png), [mobile](../screenshots/photos-mobile.png). Nguồn và giấy phép từng ảnh được lưu trong các manifest của frontend/API. Các kết quả baseline bên dưới thuộc lượt triển khai ban đầu, không phải toàn bộ bộ test đã được chạy lại trong lần thay đổi giao diện này.

## Kết quả baseline đã chạy

| Kiểm tra | Kết quả | Phạm vi |
|---|---|---|
| Backend unit/API/integration/policy | **42 passed** | PostgreSQL thật; 16 rule contexts, parse tiền, budget/composer, owner/RBAC/CSRF, refresh/reuse, CRUD/import, upload, feedback, stale price/stock, idempotency |
| Alembic bootstrap | **Passed** | Schema mới từ revision 0001 trên PostgreSQL rỗng |
| Alembic/model drift | **Passed** | `alembic check`: No new upgrade operations detected |
| Backend Ruff lint/format | **Passed** | app, tests, migration, scripts |
| Frontend TypeScript | **Passed** | strict checking; generated contract types cho entity chính |
| Frontend production build | **Passed** | 19 routes gồm public, protected, dynamic Look/product và admin |
| Frontend formatting | **Passed** | Prettier; schema files generated được loại khỏi formatting |
| Playwright desktop/mobile | **4 passed** | Register → profile → stylist → 3 Looks → hotspot → replace → save → Like → reload → favorite → catalog/detail; keyboard/reduced motion |
| Browser QA quản trị | **Passed** | Sửa product, đổi stock variant, tạo taxonomy, create/publish rule, 6 counters DB thật |
| Responsive QA | **Passed** | 1440, 834, 390px; kiểm tra không overflow ngang ở Interactive Look |
| Seed tái chạy | **Passed** | 0 record mới, 1.320 products, 264 image files, 16 rules; không reset giá/stock |
| Cleaning smoke | **Passed** | Normalize TSHIRT/GRAY, loại duplicate và missing image, inferred tags có report |
| PostgreSQL/media restore drill | **Passed** | Restore sang DB tạm riêng, revision 0001, 1.320 products và 1.320 image references hợp lệ |
| Compose | **Passed** | Build và up trên Windows Docker Desktop Linux engine; migration exit 0, PostgreSQL/API/web healthy, proxy bind loopback với WEB_PORT cấu hình được |
| Docker HTTP smoke | **Passed** | `http://localhost:3002`: home, API CSRF và ảnh DEMO trả 200; login cố ý sai trả 401 sau khi Origin/CSRF hợp lệ |
| GitHub CI | **Workflow provided** | Chưa chạy trên GitHub; chưa tạo remote hoặc PR |

Ảnh QA: [Home desktop](../screenshots/home-desktop.png), [Interactive Look desktop](../screenshots/interactive-desktop.png), [Interactive Look mobile](../screenshots/interactive-mobile.png). Các ảnh là bản chụp UI với synthetic fixtures, không phải ảnh sản phẩm thực.

## Performance smoke

[Raw report](../../data/reports/benchmark.json), 10 tài khoản/người dùng đồng thời, 10 mẫu mỗi endpoint, catalog 1.320 sản phẩm DEMO, LLM tắt, gọi qua HTTP frontend proxy cùng origin:

| Endpoint | p50 | p95 |
|---|---:|---:|
| Catalog filter | 254,07 ms | 273,63 ms |
| Generate recommendation | 2.314,52 ms | 2.493,21 ms |

0 Look vi phạm tổng ngân sách trong phép đo. Đây là end-to-end HTTP smoke với mẫu nhỏ trên một máy local, không phải benchmark tải dài, SLA production hoặc bằng chứng chất lượng recommendation trên hàng hóa thật.

[Restore report](../../data/reports/restore-drill.json) xác minh bản dump và archive ảnh được đọc lại. Chưa xác minh quy trình Docker restore trên hosting, RPO/RTO thực tế hoặc disaster recovery nhiều máy.

## Lỗi quan trọng được khắc phục trong QA

- Commit sau response ở FastAPI có thể làm register → login ngay lập tức gặp race. Các session dependency hiện dùng `scope="function"` để commit/rollback trước khi gửi response.
- API filter giá dùng effective price của variant còn hàng, tránh lọt product vì một variant rẻ đã hết stock.
- Thay/lưu Look kiểm tra lại stock và giá trong transaction; source Look và giá lịch sử được giữ bất biến.
- JWT có clock-skew allowance 5 giây để tránh từ chối iat vì lệch đồng hồ rất nhỏ.
- No-result do budget phân biệt với thiếu slot và báo minimum feasible budget, không trả server error.
- Browser tests chờ response filter và dùng ID/tên từ response, không phụ thuộc tên seed khi có dữ liệu import mới.

## Khác biệt với design baseline và giới hạn

- Models vật lý được tập trung trong `app/db/models.py`; service/routing/algorithms vẫn tách theo module. UUID được lưu dạng string; public IDs là UUID.
- API success của POST recommendations dùng 201 vì tạo resource lịch sử; error/ownership và những contract thực thi khác xem OpenAPI.
- Catalog version là fingerprint của candidate/ranking input thực tế, không phải version sequence toàn database. Context, rule và algorithm version cùng snapshots được lưu.
- BUDGET_CHOICE ưu tiên giá thấp trong những tổ hợp còn lại; không bảo đảm rẻ hơn BEST_MATCH hoặc giảm 20%. UI dùng nhãn “Ưu tiên ngân sách”. Beam search có cheapest-path reserve, không cam kết global optimum.
- Dữ liệu seed là synthetic, kết hợp ảnh chụp tham khảo Unsplash cho các mẫu khớp loại/màu và SVG tự tạo cho các mẫu còn lại. Dataset sạch 1.000+ sản phẩm thực tế, license, giá và relevance evaluation với người dùng thật còn phụ thuộc dữ liệu được cung cấp.
- Đã bổ sung kiểm chứng Docker build/up qua CLI Windows. Docker Desktop ban đầu chưa chạy nên thiếu named pipe Linux engine; đã khởi động và xác nhận `docker info` trả `linux`. Cổng 3000/3001 được ứng dụng khác sử dụng nên cấu hình Fashion AI bằng `WEB_PORT=3002`, `APP_ORIGIN=http://localhost:3002`. WSL Integration không bắt buộc cho luồng PowerShell. Các test PostgreSQL/Playwright ở trên là lượt test chạy service riêng trước đó; kiểm chứng Docker bổ sung là build/up, health, seed và HTTP smoke.
- Có một deprecation warning từ Starlette TestClient/httpx trong backend test run; tests vẫn pass. Đây là dependency warning, không phải lỗi runtime được quan sát.
- Chưa deploy public/TLS, không có payment, LLM provider, FashionCLIP, learning hoặc Try-On. S3, email/recovery, retention cleanup định kỳ, shared rate limiting cho nhiều instance và SLA vận hành chưa triển khai.
- CI hiện chạy lint/format/type/build/PostgreSQL/E2E và contract drift; chưa có dịch vụ secret/dependency scanning riêng. Không coi việc không commit .env là thay thế một quy trình security review production.

Report này ghi nhận khả năng chạy MVP và các giới hạn thực tế; không thay cho UAT trên dataset/hạ tầng production.
