# VELL Virtual Try-On jobs

Module này dùng FastAPI, PostgreSQL, SQLAlchemy/Alembic và JWT cookie/CSRF hiện có. Router, DTO, service, repository và AI provider adapter nằm trong `apps/api/app/modules/vell/`. API `/api/v1/stylist/virtual-try-on` cũ dùng chung adapter Gemini và vẫn trả kết quả đồng bộ để frontend hiện tại tiếp tục hoạt động. Chuyển frontend sang polling job là công việc tích hợp riêng.

## Chạy

```powershell
docker compose up --build -d
docker compose logs --tail 50 vell-worker
```

Compose chạy migration `0006` tạo bảng `vell_try_on_jobs` và worker riêng. Khi chạy ngoài Docker, dùng cùng `DATABASE_URL`, `MEDIA_ROOT`, `GEMINI_API_KEY`, `GEMINI_IMAGE_MODEL` cho API và worker:

```text
alembic upgrade head
python -m app.modules.vell.worker
python -m app.modules.vell.worker --once
```

Queue dùng PostgreSQL làm nguồn dữ liệu duy nhất. Worker claim bằng `FOR UPDATE SKIP LOCKED` và cập nhật trạng thái có điều kiện; có thể chạy nhiều worker trên PostgreSQL. SQLite phục vụ local/unit tests, không dành cho nhiều worker production. Chưa thêm Redis hoặc S3 vì dự án đã có PostgreSQL và media volume dùng chung.

## API

Tất cả endpoint yêu cầu đăng nhập. POST còn yêu cầu `Origin` khớp cấu hình, cookie CSRF và header `X-CSRF-Token` lấy từ `GET /api/v1/auth/csrf`. JSON trả theo envelope `{data, meta: {request_id}}`. OpenAPI đầy đủ ở `/openapi.json` của API và `contracts/openapi.json`.

| Method | Path | Thành công |
| --- | --- | --- |
| POST | `/api/v1/vell/try-on` | 202, tạo hoặc trả lại job cùng idempotency key |
| GET | `/api/v1/vell/try-on?page=1&page_size=24` | 200, danh sách job của người dùng hiện tại |
| GET | `/api/v1/vell/try-on/{job_id}` | 200, trạng thái và kết quả nếu có |
| POST | `/api/v1/vell/try-on/{job_id}/cancel` | 200, hủy job đang chờ/chạy; job đã kết thúc được giữ nguyên |

POST tạo job bắt buộc header `Idempotency-Key` là UUID. Cùng người dùng, cùng key, cùng body trả lại job cũ; body khác trả 409. Không tự retry inference khi không biết provider đã tính phí hay chưa. Để thử lại một job thất bại, người dùng chủ động gửi yêu cầu mới với key mới; hạn mức vẫn áp dụng.

Request mẫu, thay UUID bằng ID thật trong catalog:

```json
{
  "selected_products": ["<existing-catalog-product-uuid>"],
  "gender": "FEMALE",
  "age": 23,
  "height_cm": 165,
  "weight_kg": 52,
  "background": "STUDIO",
  "model_preset": "VELL_SEO_YEON",
  "consent_external_processing": true
}
```

Cho phép 1–4 product IDs khác nhau. Sản phẩm phải là catalog công khai `REAL`, active, còn hàng, có ảnh upload đọc được và URL Shopee listing hợp lệ. Giá trị URL hợp lệ về cấu trúc không thay thế việc xác minh listing từ nguồn dữ liệu được phép. Các số đo tùy chọn và giới hạn số học tái sử dụng `VirtualTryOnInput`. Preset hiện tại chỉ hỗ trợ người mẫu nữ VELL và từ chối gender khác. Không nhận URL ảnh tùy ý từ client.

Response tạo job có dạng:

```json
{
  "data": {
    "id": "<job-uuid>",
    "status": "QUEUED",
    "provider": "gemini",
    "created_at": "<ISO-8601>",
    "started_at": null,
    "finished_at": null,
    "result": null,
    "error": null
  },
  "meta": {"request_id": "<request-uuid>"}
}
```

Poll GET khoảng mỗi 2–3 giây đến trạng thái cuối. `SUCCEEDED` có `result.request_id` bằng job UUID, `views` gồm LEFT/FRONT/RIGHT với URL media, `product_ids`, `background`, `regions: []`, `segmentation_status: UNAVAILABLE` và ghi chú ảnh AI. Có thể dùng `result.request_id` với trường `try_on_request_id` của API lưu outfit hiện tại; backend kiểm tra owner và danh sách sản phẩm trước khi gắn ảnh.

Lỗi API trả `{error: {code, message, details}, meta: {request_id}}`. Ví dụ:

```json
{
  "error": {
    "code": "IDEMPOTENCY_CONFLICT",
    "message": "Key đã được dùng với dữ liệu khác.",
    "details": {}
  },
  "meta": {"request_id": "<request-uuid>"}
}
```

| HTTP | Trường hợp |
| --- | --- |
| 401 | Chưa đăng nhập |
| 403 | Origin/CSRF không hợp lệ |
| 404 | Job không tồn tại/không thuộc người dùng, hoặc sản phẩm không công khai |
| 409 | Idempotency conflict hoặc sản phẩm hết hàng |
| 422 | UUID, body, preset, consent, ảnh hoặc URL sản phẩm không hợp lệ |
| 429 | Vượt 5 job mới/người dùng/giờ, tính cả job đã hủy/thất bại |
| 503 | Chưa cấu hình provider hoặc thiếu ảnh tham chiếu người mẫu |

Lỗi inference xảy ra sau khi API đã nhận job được trả trong GET với `status: FAILED`, `result: null` và `error: {code, message}`. Các mã gồm `AI_IMAGE_CONFIGURATION`, `AI_IMAGE_QUOTA_EXCEEDED`, `AI_IMAGE_MODEL_UNAVAILABLE`, `AI_IMAGE_TIMEOUT`, `AI_IMAGE_INVALID`, `AI_IMAGE_UNAVAILABLE`, `TRY_ON_FAILED`, `WORKER_INTERRUPTED`. Không trả raw provider response trong job.

## Vòng đời và dữ liệu

- `QUEUED → RUNNING → SUCCEEDED | FAILED`; hủy có thể chuyển QUEUED/RUNNING sang CANCELLED.
- Snapshot ảnh đầu vào và thông tin sản phẩm được lưu trong payload nội bộ, không đưa vào response; payload được xóa khi job kết thúc. Job đang chờ vẫn giữ payload để worker khởi động lại có thể xử lý.
- Worker không giữ kết nối database trong thời gian chờ inference. Timeout tổng là 540 giây; lease là 660 giây. Worker đang hoạt động đánh dấu lease hết hạn thành FAILED thay vì gọi inference lần hai. Nếu toàn bộ worker dừng, việc phục hồi xảy ra khi worker chạy lại.
- Hủy đang chạy chặn công bố kết quả muộn; không bảo đảm dừng được inference hoặc chi phí đã gửi tới nhà cung cấp.
- Chỉ công bố SUCCEEDED sau khi provider trả đủ ba ảnh giải mã được, ảnh được ghi lên media và result vượt qua schema validation. Nếu ghi file thành công nhưng commit database thất bại, có thể còn file chưa được job tham chiếu; chưa có tác vụ dọn file tự động.
- Ảnh output dùng cơ chế media công khai theo UUID hiện có của dự án, không phải signed URL riêng tư. Media volume phải được dùng chung giữa API và worker.
- Provider thực tế là Gemini qua adapter `TryOnProvider`. Chưa xác minh tự động độ giống danh tính, độ đúng garment hoặc phân đoạn; không bật Hover-to-Shop từ kết quả này.
- Module này chưa thay đổi UI sang API job, chưa thêm segmentation, recommendation mới hoặc retailer verification service.

## Kiểm thử

Từ `apps/api`: `python -m pytest tests/test_vell_jobs.py tests/test_vell_jobs_postgres.py tests/test_virtual_tryon.py -q`. PostgreSQL test yêu cầu `TEST_DATABASE_URL` tới database riêng `fashion_test` hoặc `styleai_test`. Provider giả và ảnh tạo trong test chỉ dùng kiểm thử, không được đăng ký trong ứng dụng. Không gọi inference Gemini tính phí trong bộ test.

Chạy kiểm tra toàn repo theo CI: `ruff check apps/api scripts`, `ruff format --check apps/api`, `pytest -q` trong `apps/api`; export OpenAPI và generate TypeScript; `npm run format:check`, `npm run typecheck`, `npm run build` trong `apps/web`. Đặt `GEMINI_API_KEY` rỗng khi chạy pytest vì test cấu hình mặc định cần kiểm tra trường hợp thiếu key.
