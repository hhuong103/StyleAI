# VELL Fashion Studio

VELL thay mục Collection trong điều hướng chính và mở tại `/vell`. Đường dẫn `/shop` cũ chuyển tới VELL. Catalog sản phẩm vẫn có tại `/catalog`; trang chi tiết sản phẩm tiếp tục dùng `/shop/{productId}` để giữ liên kết cũ.

## Sử dụng

1. Chạy Compose và migration theo README. Migration `0005` bổ sung School, Athletic, Street, Sleep và ba loại trang phục mặc nhà.
2. Import sản phẩm thật có ảnh chính chủ và URL listing cụ thể theo [hướng dẫn catalog](catalog-import.md). Catalog demo không được dùng làm sản phẩm mua sắm của VELL.
3. Đặt `GEMINI_API_KEY` trong `.env` để bật mặc thử AI. Không đưa khóa vào frontend.
4. Mở `/vell`, chọn **Sản phẩm thật**, tình huống, rồi chọn outfit. Khi chưa có catalog phù hợp, giao diện báo trạng thái trống.
5. Đánh dấu đồng ý gửi ảnh sản phẩm đến dịch vụ AI và chọn **Tạo ảnh mặc thử**. Kết quả được giữ trong phiên giao diện để chọn lại không tạo ảnh trùng.
6. Chọn **Save to Library** để lưu outfit cùng ảnh mặc thử nếu đã tạo. Ảnh được lưu trên media volume và liên kết trong `Outfit.visual.try_on`.

## Ranh giới dữ liệu

- Tám outfit ban đầu và outfit Sleep là hình minh họa; không có giá hay link mua. Các ảnh minh họa từ bộ runway trước đây có thể thể hiện người mẫu khác với Han Seo-yeon.
- Outfit thật chỉ dùng sản phẩm công khai có trạng thái `REAL`, ảnh upload, còn hàng và URL listing Shopee đúng cấu trúc. Kiểm tra cấu trúc URL không bảo đảm listing vẫn còn bán; quy trình nhập và kiểm tra catalog cần xác minh với nhà bán lẻ.
- API mặc thử dùng ảnh Han Seo-yeon làm tham chiếu và ảnh từng sản phẩm, nhưng ảnh sinh bởi AI vẫn cần người xem kiểm tra lại danh tính, màu, kiểu dáng và chi tiết sản phẩm.
- Chưa có dịch vụ phân đoạn trang phục được kiểm chứng. API chưa trả về garment regions; do đó ảnh AI **không bật Hover-to-Shop**. Người dùng có thể mở trang sản phẩm từ accordion bên phải. Khi có kết quả phân đoạn được xác thực theo từng ảnh và `product_id`, overlay đã chuẩn bị sẵn mới bật vùng tương tác.
- Thanh Realism hiển thị giá trị đã chọn; dịch vụ AI hiện chưa nhận tham số này nên không thay đổi ảnh. Filter chỉ đổi nền studio, không đổi màu ảnh sản phẩm.

## Kiểm tra

- `cd apps/web && npm run typecheck && npm run build`
- `cd apps/web && npx playwright test --config=playwright.vell.config.ts` với web đang chạy tại `http://127.0.0.1:3004` hoặc đặt `E2E_BASE_URL`.
- `apps/api/.venv/Scripts/python.exe -m pytest apps/api/tests/test_virtual_tryon.py apps/api/tests/test_vell_occasions_migration.py -q` từ thư mục gốc trên Windows.

Kiểm tra kết nối Gemini thực tế và link mua hàng cần `GEMINI_API_KEY`, catalog `REAL`, tài khoản đăng nhập và backend đang chạy. Bộ kiểm thử cục bộ không gửi ảnh đến Gemini.
