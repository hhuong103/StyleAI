from sqlalchemy import func, or_, select

from app.core.errors import AppError
from app.db.models import Category, Product, ProductOccasion, ProductStyle, Variant


def price_of(product, variant):
    return (
        variant.price_override_vnd
        if variant.price_override_vnd is not None
        else product.base_price_vnd
    )


def product_data(product):
    active = [v for v in product.variants if v.active]
    available = [v for v in active if v.available]
    price = min((price_of(product, v) for v in available or active), default=product.base_price_vnd)
    images = [{"url": f"/media/{i.storage_key}", "alt_text": i.alt_text} for i in product.images]
    return {
        "id": product.id,
        "product_code": product.product_code,
        "name": product.name,
        "brand": product.brand,
        "category": product.category_code,
        "gender": product.gender,
        "color": product.color_code,
        "price_vnd": price,
        "base_price_vnd": product.base_price_vnd,
        "description": product.description,
        "active": product.active,
        "available": bool(product.active and available),
        "price_source": product.price_source,
        "image": images[0] if images else None,
        "images": images,
        "styles": [s.style_code for s in product.styles],
        "occasions": [o.occasion_code for o in product.occasions],
        "variants": [
            {
                "id": v.id,
                "sku": v.sku,
                "size_code": v.size_code,
                "price_vnd": price_of(product, v),
                "available": v.available and v.active and product.active,
                "active": v.active,
                "price_override_vnd": v.price_override_vnd,
            }
            for v in product.variants
        ],
    }


class ProductRepository:
    def __init__(self, db):
        self.db = db

    def get(self, product_id, include_inactive=False, lock=False):
        query = select(Product).where(Product.id == product_id)
        if not include_inactive:
            query = query.where(Product.active.is_(True))
        if lock:
            query = query.with_for_update()
        product = self.db.scalar(query.execution_options(populate_existing=True))
        if not product:
            raise AppError(404, "NOT_FOUND", "Không tìm thấy sản phẩm.")
        return product

    def candidates(self, slot, context):
        query = (
            select(Product)
            .join(Category, Product.category_code == Category.code)
            .where(
                Product.active.is_(True),
                Category.active.is_(True),
                Product.category_code.in_(slot["categories"]),
                Product.images.any(),
                Product.variants.any(Variant.active.is_(True) & Variant.available.is_(True)),
            )
        )
        gender = context.get("gender")
        if gender:
            query = query.where(Product.gender.in_([gender, "UNISEX"]))
        return list(self.db.scalars(query.order_by(Product.product_code)))

    def listing(
        self,
        *,
        page,
        page_size,
        q=None,
        category=None,
        gender=None,
        color=None,
        styles=None,
        occasions=None,
        min_price_vnd=None,
        max_price_vnd=None,
        available=None,
        sort="newest",
        include_inactive=False,
    ):
        effective = func.coalesce(Variant.price_override_vnd, Product.base_price_vnd)
        active_price = (
            select(func.min(effective))
            .where(Variant.product_id == Product.id, Variant.active.is_(True))
            .correlate(Product)
            .scalar_subquery()
        )
        stock_price = (
            select(func.min(effective))
            .where(
                Variant.product_id == Product.id,
                Variant.active.is_(True),
                Variant.available.is_(True),
            )
            .correlate(Product)
            .scalar_subquery()
        )
        price = func.coalesce(stock_price, active_price, Product.base_price_vnd)
        query = select(Product)
        if not include_inactive:
            query = query.where(Product.active.is_(True))
        if q:
            pattern = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
            query = query.where(
                or_(
                    *(
                        c.ilike(pattern, escape="\\")
                        for c in [Product.name, Product.product_code, Product.brand]
                    )
                )
            )
        if category:
            categories = list(self.db.scalars(select(Category)))
            if not any(c.code == category for c in categories):
                raise AppError(422, "INVALID_TAXONOMY", "Category không hợp lệ.")
            selected = {category}
            for _ in categories:
                selected |= {c.code for c in categories if c.parent_code in selected}
            query = query.where(Product.category_code.in_(selected))
        if gender:
            query = query.where(Product.gender == gender)
        if color:
            query = query.where(Product.color_code == color)
        if styles:
            query = query.where(Product.styles.any(ProductStyle.style_code.in_(styles.split(","))))
        if occasions:
            query = query.where(
                Product.occasions.any(ProductOccasion.occasion_code.in_(occasions.split(",")))
            )
        if min_price_vnd is not None:
            query = query.where(price >= min_price_vnd)
        if max_price_vnd is not None:
            query = query.where(price <= max_price_vnd)
        if available is not None:
            stock = Product.variants.any(Variant.active.is_(True) & Variant.available.is_(True))
            query = query.where(stock if available else ~stock)
        order = {
            "newest": Product.created_at.desc(),
            "price_asc": price.asc(),
            "price_desc": price.desc(),
            "name_asc": Product.name.asc(),
        }
        if sort not in order:
            raise AppError(422, "INVALID_SORT", "Thứ tự sắp xếp không hợp lệ.")
        total = self.db.scalar(select(func.count()).select_from(query.subquery()))
        rows = self.db.scalars(
            query.order_by(order[sort], Product.id).offset((page - 1) * page_size).limit(page_size)
        )
        return [product_data(p) for p in rows], total
