import hashlib
import json
import time
from datetime import UTC, datetime

from sqlalchemy import select

from app.core.errors import AppError
from app.db.models import (
    Category,
    Color,
    LookItem,
    Recommendation,
    RecommendationItem,
    RecommendationLook,
    StylistPlan,
)
from app.modules.auth.security import utc
from app.modules.catalog.repository import ProductRepository, is_public_product_snapshot, price_of
from app.modules.recommendations.engine import (
    ALGORITHM_VERSION,
    compose,
    explain,
    look_score,
    rank_products,
    score_candidate,
    total,
)


def owned(db, cls, row_id, user_id):
    row = db.get(cls, row_id)
    if not row or row.user_id != user_id:
        raise AppError(404, "NOT_FOUND", "Không tìm thấy dữ liệu.")
    return row


def look_data(look):
    items = sorted(
        [item.snapshot for item in look.items],
        key=lambda i: (
            ["top", "outerwear", "bottom", "shoes"].index(i["slot_key"])
            if i["slot_key"] in ["top", "outerwear", "bottom", "shoes"]
            else 99
        ),
    )
    if any(not is_public_product_snapshot(item) for item in items):
        raise AppError(404, "NOT_FOUND", "Không tìm thấy Look.")
    return {
        "look_id": look.id,
        "recommendation_id": look.recommendation_id,
        "label": look.label,
        "name": look.name,
        "revision": look.revision,
        "source_look_id": look.source_look_id,
        "score": float(look.score),
        "total_price_vnd": look.total_price_vnd,
        "budget_max_vnd": look.budget_limit_vnd,
        "budget_status": "WITHIN_BUDGET",
        "reasons": look.reasons,
        "visual": look.visual,
        "items": items,
    }


def persist_look(db, recommendation, label, items, source=None):
    context = recommendation.context_snapshot
    names = {
        "BEST_MATCH": "The Clean Edit",
        "ALTERNATIVE": "A Different Perspective",
        "BUDGET_CHOICE": "The Thoughtful Edit",
    }
    visual = {
        "kind": "COLLAGE",
        "layout": "four-piece-v1",
        "aspect_ratio": 0.8,
        "hotspots": [
            {
                "slot_key": item["slot_key"],
                "x": 0.25 if idx % 2 == 0 else 0.75,
                "y": 0.25 if idx < 2 else 0.75,
            }
            for idx, item in enumerate(items)
        ],
    }
    look = RecommendationLook(
        recommendation_id=recommendation.id,
        label=label,
        name=names[label],
        total_price_vnd=total(items),
        score=look_score(items),
        budget_limit_vnd=context["budget_max_vnd"],
        visual=visual,
        reasons=explain(items, context),
        source_look_id=source.id if source else None,
        revision=source.revision + 1 if source else 1,
    )
    db.add(look)
    db.flush()
    look.items = [
        LookItem(
            slot_key=i["slot_key"],
            item_role=i["role"],
            product_id=i["product_id"],
            variant_id=i["variant_id"],
            recommendation_item_id=i.get("recommendation_item_id"),
            score=i["score"],
            reasons=i["reasons"],
            snapshot=i,
        )
        for i in items
    ]
    db.flush()
    return look


def generate(db, user, body):
    start = time.monotonic()
    plan = owned(db, StylistPlan, str(body.plan_id), user.id)
    if utc(plan.expires_at) <= datetime.now(UTC):
        raise AppError(409, "PLAN_EXPIRED", "Vui lòng tạo lại yêu cầu stylist.")
    if plan.template["needs_confirmation"]:
        raise AppError(422, "CONFIRM_CONTEXT", "Vui lòng xác nhận ngân sách trước khi tạo Look.")
    context = plan.normalized_context
    slots = [dict(slot, categories=list(slot["categories"])) for slot in plan.template["slots"]]
    pinned = {}
    selected_roles = set()
    repo = ProductRepository(db)
    for selection in body.selected_products:
        product = repo.get(str(selection.product_id))
        category = db.get(Category, product.category_code)
        if not category or not category.active or not category.item_role:
            raise AppError(
                422, "INVALID_WAITLIST_PRODUCT", "Danh sách chờ có sản phẩm không còn hợp lệ."
            )
        role = category.item_role
        if role in selected_roles:
            raise AppError(
                422,
                "DUPLICATE_WAITLIST_ROLE",
                "Chỉ chọn một sản phẩm cho mỗi loại trang phục để AI phối Look.",
            )
        selected_roles.add(role)
        variant = next(
            (v for v in product.variants if str(v.id) == str(selection.variant_id)), None
        )
        if not variant or not variant.active or not variant.available:
            raise AppError(
                422,
                "WAITLIST_VARIANT_UNAVAILABLE",
                "Một sản phẩm trong danh sách chờ không còn phiên bản khả dụng.",
            )
        slot = next((item for item in slots if item["role"] == role), None)
        if slot is None:
            slot = {
                "slot_key": role.lower(),
                "role": role,
                "categories": [product.category_code],
                "required": True,
            }
            slots.append(slot)
        elif product.category_code not in slot["categories"]:
            slot["categories"].append(product.category_code)
        pinned[slot["slot_key"]] = (product, variant)

    slots.sort(
        key=lambda slot: (
            ["top", "outerwear", "bottom", "shoes"].index(slot["slot_key"])
            if slot["slot_key"] in ["top", "outerwear", "bottom", "shoes"]
            else 99
        )
    )
    families = {c.code: c.family for c in db.scalars(select(Color))}
    products_by_slot = {s["slot_key"]: repo.candidates(s, context) for s in slots}
    for slot_key, (product, _) in pinned.items():
        if all(candidate.id != product.id for candidate in products_by_slot[slot_key]):
            raise AppError(
                422,
                "WAITLIST_PRODUCT_INELIGIBLE",
                "Một sản phẩm đã chọn không phù hợp giới tính hoặc không còn ảnh để phối.",
            )
    ranked = {
        s["slot_key"]: rank_products(products_by_slot[s["slot_key"]], s, context, families)
        for s in slots
    }
    for slot in slots:
        if slot["slot_key"] in pinned:
            product, variant = pinned[slot["slot_key"]]
            ranked[slot["slot_key"]] = [
                score_candidate(product, variant, slot, context, families) | {"rank": 1}
            ]
    choices, diagnostics, status = compose(slots, ranked, context["budget_max_vnd"])
    minima = []
    for slot in slots:
        size = context.get("sizes", {}).get(slot["slot_key"])
        prices = [
            price_of(p, v)
            for p in products_by_slot[slot["slot_key"]]
            for v in p.variants
            if v.active and v.available and (not size or v.size_code == size)
        ]
        minima.append(min(prices) if prices else None)
    if all(value is not None for value in minima) and sum(minima) > context["budget_max_vnd"]:
        minimum = sum(minima)
        diagnostics = {
            "missing_slots": [],
            "minimum_feasible_budget_vnd": minimum,
            "constraints": [{"code": "BUDGET_TOO_LOW", "minimum_vnd": minimum}],
            "relaxation_options": [{"field": "budget_max_vnd", "suggested_value": minimum}],
            "fewer_looks_reason": "BUDGET_TOO_LOW",
        }
        choices, status = [], "NO_RESULTS"
    # Fingerprint the actual eligible/ranked input, not merely the product count.
    catalog_version = (
        "candidates-" + hashlib.sha256(json.dumps(ranked, sort_keys=True).encode()).hexdigest()[:24]
    )
    rec = Recommendation(
        user_id=user.id,
        plan_id=plan.id,
        context_snapshot=context,
        algorithm_version=ALGORITHM_VERSION,
        catalog_version=catalog_version,
        rule_version=plan.template["rule_version"],
        status=status,
        diagnostics=diagnostics,
        result_snapshot={},
    )
    db.add(rec)
    db.flush()
    for slot in slots:
        for item in ranked[slot["slot_key"]]:
            row = RecommendationItem(
                recommendation_id=rec.id,
                slot_key=slot["slot_key"],
                product_id=item["product_id"],
                variant_id=item["variant_id"],
                rank=item["rank"],
                score=item["score"],
                score_components=item["score_components"],
                reasons=item["reasons"],
                product_snapshot=item.copy(),
            )
            db.add(row)
            db.flush()
            item["recommendation_item_id"] = row.id
    looks = [look_data(persist_look(db, rec, label, items)) for label, items in choices]
    output = {
        "recommendation_id": rec.id,
        "status": status,
        "algorithm_version": ALGORITHM_VERSION,
        "currency": "VND",
        "budget_max_vnd": context["budget_max_vnd"],
        "context": context,
        "slot_results": [
            {
                "slot_key": s["slot_key"],
                "role": s["role"],
                "requested_categories": s["categories"],
                "items": ranked[s["slot_key"]][: body.top_k],
            }
            for s in slots
        ],
        "looks": looks,
        "diagnostics": diagnostics,
    }
    rec.result_snapshot = output
    rec.duration_ms = int((time.monotonic() - start) * 1000)
    return output
