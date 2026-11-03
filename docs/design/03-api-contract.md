# 03 — API Contract v1

## 1. Quy ước chung

Base path `/api/v1`. JSON dùng snake_case; ID UUID string; thời gian ISO-8601 UTC; price số nguyên VND; score [0,1]. Ví dụ bên dưới là contract thiết kế, chưa phải endpoint đang hoạt động. FastAPI/Pydantic sẽ phát OpenAPI thực tế khi triển khai; CI kiểm tra drift rồi sinh TypeScript client.

```json
{
  "data": {"id": "10000000-0000-4000-8000-000000000001"},
  "meta": {"request_id": "req_01"}
}
```

```json
{
  "error": {
    "code": "BUDGET_EXCEEDED",
    "message": "Tổng Look vượt ngân sách hiện tại.",
    "details": {"budget_vnd": 1500000, "current_total_vnd": 1540000}
  },
  "meta": {"request_id": "req_02"}
}
```

List dùng `data: []`, `meta: {request_id,page,page_size,total}`. Page ≥1; page_size mặc định 24, tối đa 100. Client không dịch theo message; dùng stable error/reason code và locale dictionary. Body error không có stack trace. HTTP 204 không có body/envelope.

| HTTP | Quy ước |
|---|---|
| 200 / 201 / 204 | đọc/sửa; tạo; xóa thành công |
| 400 | rule/context không được hỗ trợ, không thể parse input bắt buộc |
| 401 / 403 | chưa đăng nhập/phiên hết hạn; không đủ role/CSRF không hợp lệ |
| 404 | không tồn tại hoặc không thuộc user, tránh lộ tài nguyên cá nhân |
| 409 | stock/price thay đổi, stale outfit version, incompatible replacement |
| 413 / 415 / 422 | file quá lớn, media type sai, validation sai |
| 429 / 500 / 503 | giới hạn tốc độ, lỗi không mong đợi, dependency unavailable |

No recommendation là `200` với status/diagnostics, không phải 500. Invalid budget hoặc enum là 422. Template hợp lệ nhưng catalog thiếu là NO_RESULTS/PARTIAL.

## 2. Auth và quyền

Blueprint nói login nhận JWT. Đề xuất web lưu access JWT trong cookie HttpOnly, Secure, SameSite=Lax, Path=/api/v1; không trả token cho JS/localStorage. Refresh token opaque cookie riêng, Path=/api/v1/auth; DB lưu hash. Access TTL 15 phút, refresh absolute TTL 7 ngày; đều cấu hình được. Access claims tối thiểu sub, sid, role, iss, aud, iat, exp; backend kiểm tra user/session còn active để logout/disable có hiệu lực ngay.

Mọi mutation gồm register/login/logout/refresh kiểm tra Origin allowlist và CSRF token. `GET /auth/csrf` cấp signed token đồng thời cookie CSRF HttpOnly, SameSite=Lax, Path=/api/v1; client giữ token trả về trong memory và gửi `X-CSRF-Token`; backend đối chiếu cookie/header/chữ ký. CORS không wildcard credentials. Dev và production dùng cùng origin qua proxy. Không bật Secure cookie trên HTTP local, chỉ cấu hình dev; production bắt buộc HTTPS.

| Method | Path | Quyền | Body / kết quả chính |
|---|---|---|---|
| GET | /auth/csrf | Guest | csrf_token; Set-Cookie, Cache-Control no-store |
| POST | /auth/register | Guest + CSRF | email,password,display_name → user, chưa login tự động |
| POST | /auth/login | Guest + CSRF | email,password → user,expires_at + Set-Cookie |
| POST | /auth/refresh | refresh cookie + CSRF | rotate session/token, Set-Cookie; phát hiện reuse thì revoke family |
| POST | /auth/logout | cookie nếu có + CSRF | revoke session, clear cookies, 204; idempotent |
| GET | /auth/me | User/Admin | id,email,role,profile_completed; no-store |
| GET | /users/me/profile | User/Admin | profile + preferences |
| PUT | /users/me/profile | User/Admin | full profile/preference replacement, atomic; không sửa role/email |

Register không nhận role; password đề xuất 12–128 ký tự, không trim password; email trim và case normalization. Login sai trả chung INVALID_CREDENTIALS. Demo admin tạo bằng CLI với secret nhập từ môi trường/terminal, không có password cố định trong repo.

Profile PUT gồm display_name, gender nullable, age_range nullable, locale, preferred_styles[], favorite_colors[], budget_min_vnd nullable, budget_max_vnd nullable. Danh mục enum lấy từ taxonomy; không có preference vẫn generate bằng context/default hợp lệ.

## 3. Catalog, taxonomy và quản trị

| Method | Path | Quyền | Hành vi |
|---|---|---|---|
| GET | /products | User/Admin | q,category,gender,color,styles,occasions,min_price_vnd,max_price_vnd,available,page,page_size,sort |
| GET | /products/{product_id} | User/Admin | metadata, images, variants, price_source, availability |
| POST | /products | Admin | metadata + ít nhất một variant + primary image reference; 201 |
| PUT | /products/{product_id} | Admin | sửa product metadata/base price; không thay SKU variant qua body này |
| DELETE | /products/{product_id} | Admin | deactivate; 204 |
| POST | /products/{product_id}/variants | Admin | sku,size_code,price_override_vnd?,available; 201 |
| PATCH | /products/{product_id}/variants/{variant_id} | Admin | availability/active/price; kiểm tra variant thuộc product |
| GET | /taxonomy | User/Admin | categories/styles/occasions/colors, version; public enums cho form được bundle nếu cần |
| POST/PUT/DELETE | /admin/taxonomy/{type}[/{code}] | Admin | create/update/deactivate; type allowlist, không nhận table name tùy ý |
| GET/POST | /admin/outfit-rules | Admin | list hoặc create draft/versioned rule |
| POST | /admin/outfit-rules/{rule_id}/publish | Admin | validate schema/coverage; publish active version |
| POST | /admin/uploads/images | Admin | multipart file; MIME/decode/size validation → storage_key,dimensions |
| POST | /admin/catalog-imports/validate | Admin | multipart CSV/JSON tối đa 10 MB → import_id,count,report; dry-run |
| POST | /admin/catalog-imports/{import_id}/commit | Admin | checksum/mapping recheck, atomic idempotent upsert → report |
| GET | /admin/catalog-imports/{import_id} | Admin | status,counts,row errors hoặc report download reference |
| GET | /admin/summary | Admin | active users/products, saved outfits, recommendations, LIKE/DISLIKE; DB thật |

Import đồng bộ cho catalog demo, proxy timeout riêng 120s và giao diện hiển thị đang xử lý thực. CLI cho raw cleaning hoặc import lớn; không cam kết CRUD <2s cho upload/import. Bước validate không thay catalog; commit không tự xóa sản phẩm không có trong file.

styles/occasions là comma-separated codes, OR trong cùng nhóm, AND giữa nhóm. Color/gender/category là single code trong MVP; category parent mở rộng descendants. Sort allowlist `newest|price_asc|price_desc|name_asc`, tie-break ID. Giá listing là min effective price của các variant khả dụng, hoặc min active variant nếu tất cả hết hàng và response ghi rõ unavailable. Filter `available=true` dùng variant còn hàng; filter giá phải dùng cùng variant availability policy, tránh một product lọt vì variant rẻ đã hết.

Public Home/Looks teaser dùng curated assets được duyệt, không gọi catalog riêng tư. Mở public catalog sau này là một quyết định quyền truy cập mới, chưa mặc định từ menu Shop.

## 4. Stylist và recommendations

| Method | Path | Quyền | Hành vi |
|---|---|---|---|
| POST | /stylist/plan | User/Admin | text + structured context → normalized context + template + plan_id |
| POST | /recommendations | User/Admin | plan_id,top_k (1–20, mặc định 5) → per-slot candidates + tối đa 3 Looks |
| GET | /recommendations | User/Admin | lịch sử của mình, paging; không chứa prompt thô trong list |
| GET | /recommendations/{recommendation_id} | Owner | kết quả gốc, diagnostics, generated Looks |
| GET | /recommendations/{recommendation_id}/looks/{look_id} | Owner | một Look/revision, revalidation hints |
| GET | /recommendations/{recommendation_id}/looks/{look_id}/slots/{slot_key}/alternatives | Owner | 3–5 alternatives; delta total/score; respect budget |
| POST | /recommendations/{recommendation_id}/looks/{look_id}/replacements | Owner | slot_key,variant_id → Look mới bất biến, 201 |

Natural text tối đa 2.000 ký tự. Precedence: structured explicit > parsed explicit > profile > default. Trường bắt buộc còn thiếu được trả trong `needs_confirmation`, không tự bịa. Mỗi plan có `schema_version`, `expires_at`; plan hết hạn tạo lại, trả 409 PLAN_EXPIRED khi dùng để recommend.

Ví dụ POST /stylist/plan:

```json
{
  "text": "Tôi cần outfit đi phỏng vấn, tối giản, dưới 1,5 triệu",
  "locale": "vi-VN",
  "context": {
    "gender": "FEMALE",
    "occasion": "INTERVIEW",
    "style": "MINIMAL",
    "preferred_colors": ["WHITE", "BEIGE", "BLACK"],
    "budget_max_vnd": 1500000
  }
}
```

Response data có dạng:

```json
{
  "plan_id": "10000000-0000-4000-8000-000000000001",
  "schema_version": "1.0",
  "rule_version": "interview_minimal@1",
  "normalized_context": {
    "gender": "FEMALE",
    "occasion": "INTERVIEW",
    "style": "MINIMAL",
    "preferred_colors": ["WHITE", "BEIGE", "BLACK"],
    "budget_max_vnd": 1500000
  },
  "slots": [
    {"slot_key": "top", "role": "TOP", "categories": ["SHIRT"], "required": true},
    {"slot_key": "outerwear", "role": "OUTERWEAR", "categories": ["BLAZER"], "required": true},
    {"slot_key": "bottom", "role": "BOTTOM", "categories": ["TROUSERS"], "required": true},
    {"slot_key": "shoes", "role": "SHOES", "categories": ["LOAFERS"], "required": true}
  ],
  "needs_confirmation": [],
  "warnings": []
}
```

POST /recommendations chỉ nhận plan_id và top_k; client không được đổi ngân sách/template bên trong request này. Muốn đổi context tạo plan mới. Khi needs_confirmation khác rỗng, chưa cho generate.

LookSet response data gồm:

```json
{
  "recommendation_id": "20000000-0000-4000-8000-000000000001",
  "status": "COMPLETE",
  "algorithm_version": "weighted-v1+composer-v1",
  "currency": "VND",
  "budget_max_vnd": 1500000,
  "slot_results": [],
  "looks": [],
  "diagnostics": {"missing_slots": [], "constraints": [], "relaxation_options": []}
}
```

Hai mảng để rỗng ở ví dụ envelope trên nhằm thể hiện hình dạng, không phải fixture COMPLETE hợp lệ. [Mẫu JSON hoàn chỉnh](../../contracts/examples/recommendation.complete.json) có bốn slot, một Look khả thi, giá và score tính theo policy. Khi COMPLETE, `looks` phải có ít nhất một complete Look. Mỗi `slot_results` có slot_key, role, requested_categories và items: recommendation_item_id, product_id, variant_id, rank, score, score_components, reasons, product snapshot. Mỗi `looks` có look_id,label,name,revision,score,total_price_vnd,budget_status,reasons,visual,items. Item có slot_key,role,product_id,variant_id,size_code,price_vnd,score,reasons,image. Reason gồm code và facts; UI render lời giải thích từ code.

`visual={kind:"COLLAGE",layout:"four-piece-v1",aspect_ratio:0.8,hotspots:[{slot_key:"top",x:0.25,y:0.25}]}`; phần mapping đầy đủ phải phủ đúng các slot có item. Không hứa image_url cho collage client render.

`status=COMPLETE` khi có ≥1 complete Look, không có nghĩa đủ ba. `status=PARTIAL` khi có ứng viên ở ít nhất một slot nhưng thiếu ứng viên ở required slot khác; `looks=[]`, hiển thị partial slot results, không bật Save Full Look. `status=NO_RESULTS` khi tất cả slot rỗng, hoặc mọi slot có candidate nhưng minimum complete total vượt budget; vẫn có thể trả slot_results để giải thích. Diagnostics phân biệt EMPTY_SLOT/BUDGET_TOO_LOW. Luôn trả fewer_looks_reason nếu complete Looks <3. GET recommendation trả original result_snapshot và original Look IDs; revisions do replacement chỉ lấy qua endpoint Look cụ thể, không tự biến thành lựa chọn gốc thứ tư.

## 5. Replacement, variant và giá thay đổi

Endpoint alternatives nhận `limit` 3–5, loại product hiện tại và product đã dùng trong Look, giữ slot/gender/availability. Trả candidate cùng `new_total_price_vnd`, `delta_price_vnd`, `new_look_score`, `within_budget`. Những variant khác cùng product được đổi qua POST replacements với variant_id tương ứng, không cần giả làm product alternative.

POST replacements nhận:

```json
{
  "slot_key": "outerwear",
  "variant_id": "30000000-0000-4000-8000-000000000002"
}
```

Server kiểm tra source Look thuộc recommendation/user; khóa và định giá lại toàn bộ các variant còn lại cùng variant mới. Nếu dữ liệu không còn khớp giá snapshot, trả 409 CATALOG_CHANGED kèm giá hiện tại để người dùng refresh/confirm; không âm thầm lưu giá mới. Nếu không khả dụng trả 409 ITEM_UNAVAILABLE. Không chấp nhận vượt budget; trả 409 BUDGET_EXCEEDED. Thành công tạo Look mới với source_look_id, revision tăng, tổng/score/reasons đã tính lại; Look cũ và kết quả ranking gốc không sửa.

Preview không phải reserve giá/tồn kho; POST là bước kiểm chứng cuối. Nếu user muốn tăng ngân sách, tạo plan/recommendation mới có chủ ý. Không tự relax category, gender hoặc stock.

## 6. Saved outfits và feedback

| Method | Path | Quyền | Body / hành vi |
|---|---|---|---|
| POST | /outfits | User/Admin | look_id,name? → revalidate, snapshot; 201 |
| GET | /outfits | User/Admin | own list: occasion,style,favorite,page,page_size |
| GET | /outfits/{outfit_id} | Owner | snapshot + current availability hints |
| PATCH | /outfits/{outfit_id} | Owner | name?,is_favorite?,version → version+1; 409 nếu cũ |
| DELETE | /outfits/{outfit_id} | Owner | soft-delete, 204; repeated delete cùng owner trả 204 |
| POST | /outfits/{outfit_id}/duplicate | Owner | tạo saved snapshot riêng + tên copy; không khẳng định giá hiện tại |
| POST | /feedback | User/Admin | target_type,target_id,value,reason_code? → upsert; 200 |
| GET | /feedback | User/Admin | own feedback, target filter và paging |
| DELETE | /feedback/{feedback_id} | Owner | bỏ reaction, 204 |

Save từ generated Look phải đủ required slots, variant đã chọn khả dụng, giá chưa đổi và tổng trong budget. Saved outfit không giữ stock hoặc cam kết giá mua; khi mở lại có nhãn dữ liệu lúc lưu và cảnh báo món đã thay đổi. Duplicate sao chép lịch sử, không gọi recommendation và không giả định stock hiện tại; UI vẫn hiển thị trạng thái.

Feedback target_type là RECOMMENDATION, RECOMMENDATION_ITEM, LOOK, OUTFIT hoặc PRODUCT. Target không thuộc user trả 404 trừ PRODUCT là tài nguyên catalog được phép truy cập. Backend tự gắn algorithm/rule version, request context và target snapshot; không cho client chèn context nội bộ. Like rồi Dislike cùng target cập nhật row hiện có, không tăng hai votes.

POST /recommendations, /outfits và /replacements hỗ trợ `Idempotency-Key` UUID, scope theo user + method + canonical path, TTL 24h. Thiết kế thêm bảng kỹ thuật `idempotency_requests` (user_id,scope,key,request_hash,status,response_resource_id,expires_at; unique user/scope/key). Cùng key khác payload trả 409; pending trả 409 REQUEST_IN_PROGRESS; key trùng đã complete trả cùng resource. Tạo resource và ghi trạng thái complete cùng transaction. Request failed rollback có thể retry; không ghi raw auth/body nhạy cảm. FE đồng thời khóa submit khi mutation pending.

## 7. Health và cache

`GET /health/live` không cần DB; `GET /health/ready` kiểm tra DB/migration compatibility, 503 nếu chưa sẵn sàng. Không công khai DSN, version secret hoặc trace. Profile/auth/recommendations/outfits/feedback dùng `Cache-Control: no-store`; SSR/query cache phải tách user, logout clear toàn bộ cache cá nhân. Ảnh versioned có thể cache dài; taxonomy có ETag theo version. API response luôn có X-Request-ID.
