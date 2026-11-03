# 07 — Nguồn yêu cầu và quyết định thiết kế

## 1. Cách đọc nguồn

Yêu cầu hiện tại là thiết kế toàn bộ cấu trúc hệ thống trước khi triển khai. Hai DOCX là nguồn yêu cầu sản phẩm và tham khảo kỹ thuật; không phải lệnh tự động tạo tài khoản, Jira ticket, gọi LLM, publish website hoặc triển khai hạ tầng. Không có thao tác nào trong các hệ thống ngoài được thực hiện bởi bộ thiết kế này.

Ký hiệu trong tài liệu: **nguồn** là nội dung đã có trong DOCX; **quyết định** là lựa chọn kỹ thuật đề xuất để biến nội dung đó thành thiết kế nhất quán; **giả định** là điều có thể thay khi có dữ liệu thực tế.

## 2. Đối chiếu và giải quyết khác biệt

| Chủ đề | Nguồn | Cách đưa vào thiết kế |
|---|---|---|
| Kiến trúc | Blueprint §3: modular monolith, FastAPI/PostgreSQL, AI sau API | Giữ nguyên; chọn Next.js từ hai lựa chọn frontend |
| Kết quả recommendation | Blueprint §10: Top-K per role; UI §9/§25: ba complete Looks | Giữ per-slot candidates và thêm Look Composer cùng generated Look tables/API |
| Ngân sách | Blueprint candidate dùng remaining budget; UI §12/§14 không vượt tổng | Hard invariant trên toàn Look ở compose/replace/save; không chỉ lọc từng món |
| Variants | Blueprint chỉ available flag; UI §10/§18 có size/color/SKU/stock | Thêm variants; một product/màu, size ở variant; availability boolean, chưa stock quantity |
| Outfit/Look | Blueprint dùng outfits; UI dùng Looks cả generated và saved | UI thống nhất Look; DB tách recommendation_looks và outfits để bảo toàn vòng đời |
| Replace/Why/Multiple Looks | UI §25 có acceptance nhưng §28 ghi P1 | Thiết kế đầy đủ; ưu tiên trong core showcase sau ranking, trước motion nâng cao |
| Shoes | Blueprint demo có “nếu scope có”; UI example có shoes | Templates core gồm shoes; chỉ template cụ thể quyết định required slots |
| Admin | Blueprint CRUD/counters; UI thêm rules/taxonomy/variants | Thiết kế đủ ba phần bổ sung; EP09 hoàn thiện UI quản trị |
| Public Shop | UI navigation public; Blueprint §2.1 guest chỉ landing/auth, API catalog User | Giữ public navigation/teasers; catalog cần login; ghi rõ thay vì tự mở quyền |
| LLM | Hai tài liệu không yêu cầu bắt buộc gọi LLM | Tắt mặc định, deterministic parser/form; optional adapter sau |
| Hình Look | UI cho static/model/collage và Phase 2 Try-On | Collage món thật là fallback chuẩn; không giả ảnh người mẫu là try-on |
| Plan 12 tuần | Blueprint có framing/design và sprint cuối 1 tuần | Đề xuất sáu sprint hai tuần, giữ critical path và deliverables |

## 3. Decision log

| ID | Quyết định | Lý do / trade-off |
|---|---|---|
| ADR01 | Modular monolith, một API deploy | Dễ chạy/debug/demo; boundary vẫn đủ để tách AI sau này |
| ADR02 | Next.js + TypeScript | Hợp editorial/public pages và app tương tác; team cần quản lý server/client boundary |
| ADR03 | PostgreSQL + normalized taxonomy/joins + JSONB snapshots | Integrity cho dữ liệu vận hành, giữ snapshot linh hoạt; JSONB không thay mọi FK |
| ADR04 | Rule → rank → compose | UI yêu cầu bộ hoàn chỉnh; ranking đơn lẻ không đủ ràng buộc ngân sách |
| ADR05 | JWT cookie + refresh rotation + CSRF | Tránh token JS persistence; cần CSRF/Origin và session lookup để revoke |
| ADR06 | Variant effective price authoritative | Giá/availability phải đúng theo size đã chọn; query phức tạp hơn base price |
| ADR07 | Generated Look immutable; saved snapshot riêng | Feedback/history đúng phiên bản; tốn thêm rows nhưng catalog demo nhỏ |
| ADR08 | Beam search + cheapest path reserve | Chạy gọn, có lời giải hợp budget khi v1 feasible; không bảo đảm tối ưu toàn cục hoặc đủ ba Looks |
| ADR09 | Không Redis/queue/GPU mặc định | Quy mô 2.000–5.000 phù hợp DB + bounded compute; thêm khi có số đo |
| ADR10 | Local images demo, storage port cho S3-compatible | Demo offline; production cần volume/backup hoặc object storage |
| ADR11 | Compose và schema migration tách lifecycle worker | Tránh worker tranh migration; dễ bootstrap/restore |
| ADR12 | Human-readable contract trước, OpenAPI từ code sau | Tránh viết hai schema khác nhau bằng tay; hiện chưa có runtime OpenAPI |

## 4. Giả định để tiến hành

- Một currency VND, một catalog dùng chung, chưa multi-tenant hoặc marketplace nhiều người bán.
- Ba role sản phẩm chính TOP/BOTTOM/SHOES, OUTERWEAR theo template; không one-piece/dress hoặc accessories trong core v1.
- Gender/profile là tùy chọn. Không khai gender thì không giới hạn; UNISEX là một filter cụ thể.
- Bộ màu và 16 rules là seed đề xuất; coverage phải kiểm tra bằng dataset trước publish.
- Có thể dùng giá DEMO khi dataset thiếu, nhưng hiển thị rõ và giữ provenance; không có thanh toán thật.
- Default budget 1.500.000 chỉ là gợi ý hiển thị để user xác nhận. Mục tiêu Budget Choice 80% là policy đề xuất có version.
- Chưa có dataset được giao trong workspace. Việc đọc hai DOCX không tạo ra catalog sạch hoặc quyền sử dụng ảnh.
- Hosting, domain, email transactional, OAuth/password reset và terms/privacy copy chưa nằm trong FR hiện có. Đăng ký/login cơ bản không phụ thuộc email provider; cần bổ sung account recovery trước vận hành thương mại rộng.
- NFR demo, TTL và retention là cấu hình/đề xuất ban đầu; chưa có benchmark hoặc SLA production được xác nhận.

## 5. Danh mục nguồn

| Nguồn | Phần đã dùng |
|---|---|
| Phase1_Fashion_Project_Software_Project_Blueprint.docx | §1–22, phụ lục; hai hình architecture/flow |
| Fashion_AI_Phase1_UI_UX_Specification.docx | §1–28; hai hình experience flow/Interactive Look |
| [FastAPI — Bigger Applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/) | Router/module organization; không phải nguồn cho domain policy |
| [SQLAlchemy — Transactions](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html) | Transaction boundary; không phải cam kết tự có integrity ở service chưa viết |
| [Next.js — Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) | Render/interactivity boundary |

Tài liệu upstream được kiểm tra ngày 03/11/2026; không khóa package version dựa chỉ vào trang latest. Không có nội dung thực thi từ nguồn ngoài được đưa vào dự án.
