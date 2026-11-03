# 04 — Stylist, Ranking và Look Composer

## 1. Ba bước khác nhau

**Stylist** chọn cấu trúc slot/category, không tạo sản phẩm. **Ranker** lọc và chấm điểm sản phẩm catalog theo từng slot. **Look Composer** ghép các món thành bộ hoàn chỉnh trong tổng ngân sách. Tách ba bước này để tránh lỗi chọn mỗi món dưới 1,5 triệu nhưng tổng cả bộ vượt 1,5 triệu.

Đây là baseline rule-based/content-based, không phải model đã học. Phase 2 phải so sánh với baseline trên cùng bộ dữ liệu đánh giá.

## 2. Taxonomy ban đầu

| Nhóm | Codes khởi tạo |
|---|---|
| item_role | TOP, BOTTOM, OUTERWEAR, SHOES |
| TOP categories | T_SHIRT, OVERSIZED_TEE, SHIRT, BLOUSE, POLO, SWEATSHIRT |
| BOTTOM categories | JEANS, TROUSERS, WIDE_LEG_PANTS, SKIRT, CARGO, SHORTS, JOGGERS |
| OUTERWEAR categories | BLAZER, CARDIGAN, DENIM_JACKET, LIGHT_JACKET |
| SHOES categories | LOAFERS, SNEAKERS, FLATS, SANDALS, DRESS_SHOES |
| style | MINIMAL, FORMAL, SMART_CASUAL, CASUAL, STREETWEAR, KOREAN, SPORTY, VINTAGE |
| occasion | INTERVIEW, OFFICE, CAFE, DATE, PARTY, TRAVEL, DAILY |
| color | BLACK, WHITE, BEIGE, GREY, NAVY, BLUE, BROWN, GREEN, RED, PINK, YELLOW, PURPLE |
| gender | MALE, FEMALE, UNISEX; request có thể null = không giới hạn |
| color family | NEUTRAL: BLACK/WHITE/BEIGE/GREY/NAVY/BROWN; WARM/COOL cho các màu còn lại theo mapping versioned |

Đây là taxonomy đề xuất, không phải tuyên bố dataset đã có đủ mọi category. Dress/one-piece không nằm trong template bốn role ban đầu; phải thêm slot model/policy trước khi đưa vào, không nhét DRESS vào TOP và vẫn bắt buộc BOTTOM.

## 3. Parse và normalize intent

Đầu vào hỗ trợ guided form ngay cả khi không bật LLM. Parser deterministic nhận synonym tiếng Việt/Anh: “phỏng vấn/interview”, “tối giản/minimal”, “1,5 triệu/1.5m/1 500 000”. Chuyển số tiền theo locale, kiểm tra VND và integer. Text mơ hồ như “1.500” không đoán đơn vị nếu không xác định được; đánh dấu needs_confirmation.

Precedence: structured explicit > text parsed explicit > profile > configured default. Response mang `field_sources` và warnings khi text xung đột form; UI hiển thị giá trị cuối để user sửa. Default đề xuất DAILY, CASUAL, budget 1.500.000 VND, không giới hạn gender, không ưu tiên màu. Default budget phải hiển thị trước generate và được gửi lại bằng context khi user xác nhận; không dùng ngân sách ngầm. Không bắt người dùng khai giới tính nếu không muốn.

LLM parser là adapter tùy chọn, mặc định tắt. Timeout đề xuất 3 giây; lỗi/malformed output về parser deterministic hoặc guided form. Output phải qua Pydantic/taxonomy; không nhận SQL, product_id, price hoặc instruction trong text làm lệnh hệ thống. Không cho LLM truy cập catalog/tools. Không gọi LLM ở đường demo bắt buộc.

## 4. Rule engine

Rule gồm key, version, occasion, style, gender constraint tùy chọn, priority, slots, màu gợi ý, required flag. Mỗi slot có stable slot_key, role và một hoặc nhiều allowed categories. Chọn rule theo độ khớp occasion/style, specificity và priority; tie-break rule_key/version ổn định. Nếu không có exact rule, chỉ dùng fallback được công bố cho cùng occasion; không tự biến INTERVIEW thành DAILY.

Bộ **16 rule đề xuất để triển khai và test**, không phải rule đã chạy:

| Occasion + Style | TOP | OUTERWEAR | BOTTOM | SHOES |
|---|---|---|---|---|
| INTERVIEW + MINIMAL | SHIRT | BLAZER | TROUSERS | LOAFERS |
| INTERVIEW + FORMAL | SHIRT | BLAZER | TROUSERS | DRESS_SHOES |
| OFFICE + MINIMAL | SHIRT/BLOUSE | — | TROUSERS | LOAFERS |
| OFFICE + FORMAL | SHIRT | BLAZER | TROUSERS | DRESS_SHOES |
| OFFICE + SMART_CASUAL | SHIRT/POLO | — | TROUSERS | LOAFERS |
| CAFE + CASUAL | T_SHIRT | — | JEANS | SNEAKERS |
| CAFE + MINIMAL | SHIRT | — | WIDE_LEG_PANTS | LOAFERS |
| CAFE + KOREAN | SHIRT | CARDIGAN | JEANS | SNEAKERS |
| DATE + MINIMAL | SHIRT/BLOUSE | — | WIDE_LEG_PANTS/SKIRT | LOAFERS/FLATS |
| DATE + SMART_CASUAL | SHIRT | — | TROUSERS | LOAFERS |
| PARTY + MINIMAL | BLOUSE/SHIRT | BLAZER | TROUSERS/SKIRT | LOAFERS/FLATS |
| TRAVEL + CASUAL | T_SHIRT | LIGHT_JACKET | JEANS | SNEAKERS |
| TRAVEL + SPORTY | T_SHIRT | LIGHT_JACKET | JOGGERS | SNEAKERS |
| DAILY + STREETWEAR | OVERSIZED_TEE | — | CARGO/JEANS | SNEAKERS |
| DAILY + CASUAL | T_SHIRT | — | JEANS/SHORTS | SNEAKERS |
| DAILY + VINTAGE | SHIRT | DENIM_JACKET | JEANS | LOAFERS |

“—” nghĩa không có slot trong template đó; không phải slot missing. Mọi slot được tạo trong bảng trên đều required. Trong INTERVIEW, không bỏ BLAZER âm thầm để đủ ngân sách. Chưa tìm được rule của lựa chọn user thì trả UNSUPPORTED_CONTEXT với gợi ý style khả dụng cho occasion. Publish rule phải có acceptance cases, category-role validity và catalog coverage check; rule admin có cảnh báo thiếu coverage trước khi publish.

## 5. Candidate filtering

Hard constraints:

1. product active; ít nhất một variant active/available và ảnh primary hợp lệ.
2. Category nằm trong allowed categories của slot, có role tương thích.
3. gender MALE/FEMALE nhận cùng gender hoặc UNISEX; request UNISEX chỉ nhận UNISEX; null không lọc gender.
4. Effective variant price ≤ tổng budget; sau khi ghép phải tiếp tục kiểm tra residual budget.
5. Nếu user chọn size cho slot, variant phải khớp size; thiếu size không tự gán là phù hợp. Không bắt size nếu dữ liệu chưa hỗ trợ.

Style, màu, occasion là soft preferences trong baseline. Nếu tất cả tag thiếu, vẫn có candidate category/gender/price đúng; reasons không được tuyên bố khớp tag không có. Có thể thêm strict color policy sau nhưng không tự biến màu thành hard constraint ở v1.

Mỗi product chỉ có một representative variant trong xếp hạng: rẻ nhất khả dụng phù hợp size, tie-break SKU rồi variant_id. User được chọn variant khác qua revalidation. Không trả 5 size của cùng áo thành Top-5 khác nhau.

## 6. Weighted ranking

Giữ trọng số blueprint để có baseline dễ đối chiếu:

```text
score = 0.30*category_match
      + 0.25*style_match
      + 0.15*color_match
      + 0.15*occasion_match
      + 0.15*budget_fit

category_match = 1 cho candidate hợp lệ
style_match = 1 nếu đúng tag requested style, ngược lại 0
color_match = 1 nếu đúng preferred color;
              0.7 nếu cùng family ưu tiên;
              0 nếu khác;
              1 nếu user không ưu tiên màu
occasion_match = 1 nếu có requested occasion tag, ngược lại 0
budget_fit = clamp(1 - effective_price / total_budget, 0, 1)
```

Budget >0 bắt buộc. Category là hard filter nên 0.30 là hằng số với mọi candidate; giữ để tương thích ví dụ tài liệu, không mô tả nó như tín hiệu phân biệt. Budget fit dùng tổng budget, không tạo giới hạn slot cố định có thể loại nhầm outfit khả thi. Preference budget_min là soft hint, không ép user tiêu ít nhất số đó.

Sort `score DESC, effective_price ASC, product_code ASC, variant_id ASC`; không random. Tính bằng Decimal, chỉ round ở serialize/display. Return score_components và các reason có evidence: CATEGORY_MATCH, STYLE_MATCH, COLOR_MATCH/COLOR_FAMILY_MATCH, OCCASION_MATCH, WITHIN_BUDGET. Không nhận text lý do do client gửi.

Score hiển thị `round(score*100)% mức phù hợp` là chỉ số heuristic, không phải xác suất hay chất lượng model đã được kiểm chứng. Version mọi thay đổi công thức/mapping; lưu component để giải thích và replay.

## 7. Ghép Look trong tổng ngân sách

**Không dùng phép lấy Top-1 từng slot rồi cộng giá.** K có thể bỏ mất món rẻ cần thiết. API chỉ hiển thị Top-K, nhưng composer sử dụng candidate pool rộng hơn từ catalog đã lọc.

Thuật toán thực dụng, deterministic cho 3–4 slot:

1. Tính giá rẻ nhất từng required slot từ toàn candidate set hợp lệ. Nếu một slot rỗng: trả diagnostics EMPTY_SLOT với partial slot_results.
2. Sum minimum prices là lower bound. Slot categories v1 thuộc role tách biệt nên sản phẩm không chồng slot. Nếu lower bound > budget: trả BUDGET_TOO_LOW và minimum_feasible_budget_vnd; không gọi empty là lỗi server.
3. Mỗi slot lấy 30 ứng viên score cao nhất cộng 10 rẻ nhất; luôn giữ cheapest candidate. Pool limit là cấu hình có version, không làm thay đổi eligibility.
4. Duyệt slot theo thứ tự template, beam width 50. Với mỗi state chỉ thêm item khi tổng hiện tại + món mới + minimum cost các slot chưa ghép ≤ budget. Không cho cùng product lặp trong Look.
5. Giữ đường cheapest complete outfit riêng khỏi beam pruning. Nhờ vậy, nếu baseline v1 có lời giải khả thi, vẫn có ít nhất một complete outfit; beam không bảo đảm global optimum hoặc tìm đủ mọi biến thể.
6. Thu complete combinations, unique bằng sorted `(slot_key,product_id)`; khác size cùng món không được tính là Look khác. Tính `look_score = mean(item_scores)` không bonus mơ hồ.
7. Chọn Look labels theo chính sách bên dưới; lưu original rank result và chosen combinations cùng context/version trong một transaction.

Độ rộng beam/pool giới hạn thời gian ghép; metric theo dõi số candidates trước/sau filter và compose duration. Không tính mọi tích Descartes của 5.000 sản phẩm.

### Ba lựa chọn

- BEST_MATCH: Look score cao nhất trong complete combinations, tie-break total thấp hơn rồi product signature.
- ALTERNATIVE: trong các Look chưa dùng có ít nhất một product khác, ưu tiên khác ≥2 slot khi có; chọn số slot khác lớn hơn rồi score. Vẫn phải tuân template/context và ngân sách.
- BUDGET_CHOICE: trong complete combinations chưa dùng, ưu tiên total ≤80% budget; chọn total thấp nhất, tie-break score cao hơn. Nếu không có dưới mốc 80%, dùng lựa chọn rẻ nhất còn lại trong budget và nói rõ không đạt mốc tiết kiệm 20%.

80% là mục tiêu tiết kiệm đề xuất, không được vượt ngân sách gốc để đủ ba. Đối với template 3 slot, khác ≥2 vẫn là ưu tiên, không bắt buộc. Nếu chỉ đủ 1–2 Look khác nhau, trả số thực có cùng fewer_looks_reason; không nhân bản Look để đủ ba. Thuật toán không cam kết ba phong cách khác nhau nếu request chỉ cho MINIMAL.

### Giải thích ở cấp Look

Trả ít nhất ba facts khi đủ evidence: template phù hợp occasion; style coverage (ví dụ 3/4 món có tag MINIMAL); total/budget và khoản còn lại; palette/family coverage. Không gọi “color harmony” đã được model xác nhận; Phase 1 chỉ giải thích palette được rule định nghĩa. Nếu thiếu tag, nói coverage thực thay vì bịa 100% match.

Ví dụ outfit demo: Shirt 249.000 + Blazer 699.000 + Trousers 349.000 + Shoes 199.000 = **1.496.000 VND**, còn 4.000 trên budget 1.500.000. Từng món rẻ hơn budget chưa đủ; toàn bộ tổng mới là invariant cuối.

## 8. Replacement

`remaining_budget = total_budget - sum(current prices of other selected slots)`.

Alternatives giữ category/role/gender/size/available policy, lọc effective price ≤ remaining_budget và loại product đã dùng. Rank lại bằng cùng version context, preview delta total/score. Khi confirm, backend định giá lại toàn Look dưới lock; chỉ khi snapshot vẫn đúng và toàn bộ hợp lệ mới tạo revision mới. Thay variant cùng product cũng đi qua bước này.

Giá/tồn kho đổi trả conflict cho user chọn lại. Không giảm số món hoặc nới budget ngầm. Feedback vào Look cũ giữ đúng snapshot cũ; Like bản mới là target mới, không tự copy reaction.

## 9. Bộ đánh giá cần triển khai

| Nhóm | Acceptance |
|---|---|
| Parse | “1,5 triệu” → 1500000; structured thắng text; số mơ hồ cần confirm |
| Rule | 16 contexts trả schema hợp lệ; không tồn tại context → controlled unsupported |
| Eligibility | sai category/gender, inactive, hết stock bị loại; null tags không crash |
| Ranking | số học đúng, score ∈[0,1], rank liên tục, tie deterministic |
| Whole budget | từng món hợp budget nhưng tổng vượt vẫn bị loại |
| Composer | cheapest path được giữ khi Top-K đắt; 1–2 feasible Looks không bị clone thành 3 |
| Diagnostics | missing slot và budget lower bound phân biệt; không relax tự động |
| Replace | giữ các slot khác, preview đúng, overbudget/changed stock bị chặn |
| Replay | cùng snapshot/version tạo cùng thứ tự; profile đổi không sửa lịch sử |

Offline baseline: bộ 30–50 request được người review gán đánh giá phù hợp, báo coverage complete Look, số Look trung bình, vi phạm budget/stock/category (mục tiêu 0), relevance do người chấm và latency. Không gọi đây là model accuracy. NFR recommendation <5s được đo khi LLM tắt, catalog 2.000–5.000; LLM bật báo riêng.
