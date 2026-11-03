from sqlalchemy import select

from app.core.errors import AppError
from app.db.models import Color, Product, Recommendation, RecommendationLook, StylistPlan, Variant
from app.modules.catalog.repository import ProductRepository, price_of
from app.modules.recommendations.engine import look_score, rank_products, score_candidate, total
from app.modules.recommendations.service import look_data, owned, persist_look


def owned_look(db, look_id, user_id, recommendation_id=None):
    look = db.get(RecommendationLook, look_id)
    if not look or (recommendation_id and look.recommendation_id != recommendation_id):
        raise AppError(404, "NOT_FOUND", "Không tìm thấy Look.")
    rec = owned(db, Recommendation, look.recommendation_id, user_id)
    return look, rec


def revalidate(db, items):
    products = {
        p.id: p
        for p in db.scalars(
            select(Product)
            .where(Product.id.in_(sorted({i["product_id"] for i in items})))
            .order_by(Product.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    }
    variants = {
        v.id: v
        for v in db.scalars(
            select(Variant)
            .where(Variant.id.in_(sorted({i["variant_id"] for i in items})))
            .order_by(Variant.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    }
    for item in items:
        product, variant = products.get(item["product_id"]), variants.get(item["variant_id"])
        if (
            not product
            or not variant
            or variant.product_id != product.id
            or not product.active
            or not variant.active
            or not variant.available
        ):
            raise AppError(
                409,
                "ITEM_UNAVAILABLE",
                "Một món đã hết hàng hoặc ngừng hoạt động.",
                {"slot_key": item["slot_key"]},
            )
        current = price_of(product, variant)
        if current != item["price_vnd"]:
            raise AppError(
                409,
                "CATALOG_CHANGED",
                "Giá sản phẩm đã thay đổi. Hãy tạo lại Look để xác nhận giá mới.",
                {"slot_key": item["slot_key"], "current_price_vnd": current},
            )


def alternatives(db, look, rec, slot_key, limit):
    plan = db.get(StylistPlan, rec.plan_id)
    slot = next((s for s in plan.template["slots"] if s["slot_key"] == slot_key), None)
    if not slot:
        raise AppError(404, "NOT_FOUND", "Slot không tồn tại trong Look.")
    context = rec.context_snapshot
    families = {c.code: c.family for c in db.scalars(select(Color))}
    items = [i.snapshot for i in look.items]
    other = [i for i in items if i["slot_key"] != slot_key]
    revalidate(db, other)
    current_ids = {i["product_id"] for i in items}
    candidates = rank_products(
        ProductRepository(db).candidates(slot, context), slot, context, families
    )
    return [
        {
            **i,
            "new_total_price_vnd": total(other) + i["price_vnd"],
            "delta_price_vnd": total(other) + i["price_vnd"] - look.total_price_vnd,
            "new_look_score": look_score(other + [i]),
            "within_budget": True,
        }
        for i in candidates
        if i["product_id"] not in current_ids
        and total(other) + i["price_vnd"] <= context["budget_max_vnd"]
    ][:limit]


def replace(db, look, rec, body):
    plan = db.get(StylistPlan, rec.plan_id)
    slot = next((s for s in plan.template["slots"] if s["slot_key"] == body.slot_key), None)
    if not slot:
        raise AppError(422, "INVALID_SLOT", "Slot không hợp lệ.")
    variant = db.get(Variant, str(body.variant_id))
    if not variant:
        raise AppError(404, "NOT_FOUND", "Biến thể không tồn tại.")
    product = ProductRepository(db).get(variant.product_id, True)
    context = rec.context_snapshot
    if product.category_code not in slot["categories"] or (
        context.get("gender") and product.gender not in [context["gender"], "UNISEX"]
    ):
        raise AppError(409, "INCOMPATIBLE_REPLACEMENT", "Món này không phù hợp slot hoặc gender.")
    requested_size = context.get("sizes", {}).get(body.slot_key)
    if requested_size and variant.size_code != requested_size:
        raise AppError(409, "INCOMPATIBLE_SIZE", "Biến thể không đúng size đã yêu cầu.")
    families = {c.code: c.family for c in db.scalars(select(Color))}
    item = score_candidate(product, variant, slot, context, families)
    items = [i.snapshot for i in look.items if i.slot_key != body.slot_key] + [item]
    if len({i["product_id"] for i in items}) != len(items):
        raise AppError(
            409, "DUPLICATE_PRODUCT", "Một sản phẩm không thể xuất hiện hai lần trong Look."
        )
    revalidate(db, items)
    if total(items) > context["budget_max_vnd"]:
        raise AppError(409, "BUDGET_EXCEEDED", "Thay món này sẽ vượt ngân sách.")
    items.sort(key=lambda i: [s["slot_key"] for s in plan.template["slots"]].index(i["slot_key"]))
    return look_data(persist_look(db, rec, look.label, items, source=look))
