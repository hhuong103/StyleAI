from sqlalchemy import select

from app.core.config import settings
from app.core.errors import AppError
from app.db.models import (
    Category,
    Color,
    Occasion,
    Product,
    ProductImage,
    ProductOccasion,
    ProductStyle,
    Style,
    Variant,
)
from app.modules.profiles.router import validate_codes


def safe_media_path(key):
    root = settings.media_root.resolve()
    path = (root / key).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise AppError(422, "INVALID_IMAGE", "Ảnh local không tồn tại hoặc đường dẫn không hợp lệ.")
    return path


def validate_product(db, body):
    if not body.image_key.startswith(("demo/", "uploads/")):
        raise AppError(422, "INVALID_IMAGE", "Image key phải thuộc thư mục ảnh public đã kiểm tra.")
    category = db.get(Category, body.category_code)
    if (
        not category
        or not category.active
        or db.scalar(select(Category).where(Category.parent_code == category.code))
    ):
        raise AppError(422, "INVALID_CATEGORY", "Chọn category leaf đang hoạt động.")
    validate_codes(db, Color, [body.color_code])
    validate_codes(db, Style, body.styles)
    validate_codes(db, Occasion, body.occasions)
    safe_media_path(body.image_key)


def write_product(db, body, product=None):
    validate_product(db, body)
    existing = db.scalar(select(Product).where(Product.product_code == body.product_code))
    if existing and (not product or existing.id != product.id):
        raise AppError(409, "PRODUCT_CODE_EXISTS", "Mã sản phẩm đã tồn tại.")
    if not product:
        product = Product()
        db.add(product)
    for key in [
        "product_code",
        "name",
        "brand",
        "category_code",
        "gender",
        "color_code",
        "base_price_vnd",
        "description",
        "active",
        "price_source",
    ]:
        setattr(product, key, getattr(body, key))
    db.flush()
    product.styles = [ProductStyle(style_code=s) for s in set(body.styles)]
    product.occasions = [ProductOccasion(occasion_code=o) for o in set(body.occasions)]
    if product.images:
        product.images[0].storage_key = body.image_key
        product.images[0].alt_text = body.name
    else:
        product.images = [ProductImage(storage_key=body.image_key, alt_text=body.name)]
    if hasattr(body, "variants"):
        sizes, skus = set(), set()
        for item in body.variants:
            if (
                item.size_code in sizes
                or item.sku in skus
                or db.scalar(select(Variant).where(Variant.sku == item.sku))
            ):
                raise AppError(409, "DUPLICATE_VARIANT", "Size hoặc SKU bị trùng.")
            sizes.add(item.size_code)
            skus.add(item.sku)
        product.variants = [Variant(**v.model_dump()) for v in body.variants]
    db.flush()
    return product
