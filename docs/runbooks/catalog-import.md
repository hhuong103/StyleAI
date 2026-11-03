# Catalog thật và import

Đăng nhập bằng ADMIN → Products → Import catalog. Dùng JSON array hoặc CSV UTF-8, tối đa 10 MB và 5.000 sản phẩm mỗi lần. Upload ảnh JPEG/PNG/WebP qua editor hoặc `/admin/uploads/images` trước; dùng `storage_key` nhận về trong `image_key`. API không tải arbitrary remote URL.

Ví dụ một record (thay `image_key` bằng ảnh đã upload):

```json
[
  {
    "product_code": "SHOP_SHIRT_001_WHITE",
    "name": "White cotton shirt",
    "brand": "Your brand",
    "category_code": "SHIRT",
    "gender": "UNISEX",
    "color_code": "WHITE",
    "base_price_vnd": 249000,
    "description": "Cotton shirt; source and license reviewed by importer.",
    "active": true,
    "price_source": "REAL",
    "styles": ["MINIMAL"],
    "occasions": ["INTERVIEW", "OFFICE"],
    "image_key": "uploads/replace-with-uploaded-key.webp",
    "variants": [
      {"sku": "SHOP_SHIRT_001_WHITE_M", "size_code": "M", "available": true},
      {"sku": "SHOP_SHIRT_001_WHITE_L", "size_code": "L", "available": false}
    ]
  }
]
```

CSV headers: `product_code,name,brand,category_code,gender,color_code,base_price_vnd,description,price_source,image_key,styles,occasions,sku,size_code,available,price_override_vnd`. Mỗi dòng một variant; product metadata phải giống nhau cho các dòng cùng code. Styles/occasions phân cách bằng dấu `;`; giá integer VND, available true/false; override để trống nếu dùng giá base. Thiếu size tạo ONE_SIZE và UI nói rõ chưa có thông tin size.

Validate đọc file, kiểm tra taxonomy/schema/ảnh/mã trùng và lưu report, không thay catalog. Nếu status VALIDATED, commit mới upsert trong một transaction. Product được nhận diện bởi product_code, variant bởi SKU; không chuyển SKU sang product khác, không tự xóa variant vắng mặt hoặc reset database. Commit cùng import_id lần nữa trả cùng kết quả. File khác cùng product_code/SKU cập nhật dữ liệu hiện có theo validation.

Có CLI cleaning cho input cùng schema canonical trên, không truy cập database hoặc tải ảnh remote:

```bash
python scripts/clean_catalog.py --input data/raw/catalog.json --output data/cleaned/catalog.json --media-root apps/api/media
```

CLI normalize codes, map aliases TSHIRT/TEE/PANTS/GRAY, loại record thiếu ảnh hoặc duplicate code/SKU/size, validate schema và xuất file `.report.json` với số liệu trước/sau cùng checksums. Nếu thiếu style/occasion, gán nhãn bằng mapping từ rules có version; đó là nhãn suy diễn cần review, không phải nhãn thật của nguồn. Giá thiếu không được tự bịa; chỉ tạo giá DEMO có chủ ý.

Các giới hạn: không có crawler/enrichment ML hoặc dataset thật kèm theo. Cần kiểm tra license, quyền ảnh và độ đúng của metadata trước khi import. Không dùng catalog synthetic để báo cáo độ chính xác recommendation trên hàng hóa thực tế.
