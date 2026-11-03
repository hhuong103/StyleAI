from decimal import Decimal

from app.modules.catalog.repository import price_of, product_data

ALGORITHM_VERSION = "weighted-v1+composer-v1"


def score_candidate(product, variant, slot, context, families):
    price = price_of(product, variant)
    preferred = context.get("preferred_colors", [])
    color = (
        1
        if not preferred or product.color_code in preferred
        else (
            0.7
            if any(families.get(c) == families.get(product.color_code) for c in preferred)
            else 0
        )
    )
    components = {
        "category_match": 1,
        "style_match": int(context["style"] in [s.style_code for s in product.styles]),
        "color_match": color,
        "occasion_match": int(context["occasion"] in [o.occasion_code for o in product.occasions]),
        "budget_fit": max(0, float(1 - Decimal(price) / Decimal(context["budget_max_vnd"]))),
    }
    weights = {
        "category_match": ".30",
        "style_match": ".25",
        "color_match": ".15",
        "occasion_match": ".15",
        "budget_fit": ".15",
    }
    score = sum(Decimal(weights[k]) * Decimal(str(v)) for k, v in components.items())
    reasons = [
        {"code": "CATEGORY_MATCH", "facts": {"category": product.category_code}},
        {
            "code": "WITHIN_BUDGET",
            "facts": {"price_vnd": price, "budget_max_vnd": context["budget_max_vnd"]},
        },
    ]
    for key, code, fact in [
        ("style_match", "STYLE_MATCH", {"style": context["style"]}),
        ("occasion_match", "OCCASION_MATCH", {"occasion": context["occasion"]}),
        (
            "color_match",
            "COLOR_MATCH" if color == 1 else "COLOR_FAMILY_MATCH",
            {"color": product.color_code},
        ),
    ]:
        if components[key] and (key != "color_match" or preferred):
            reasons.append({"code": code, "facts": fact})
    data = product_data(product)
    return {
        "slot_key": slot["slot_key"],
        "role": slot["role"],
        "product_id": product.id,
        "variant_id": variant.id,
        "product_code": product.product_code,
        "name": product.name,
        "brand": product.brand,
        "category": product.category_code,
        "color": product.color_code,
        "gender": product.gender,
        "price_vnd": price,
        "price_source": product.price_source,
        "size_code": variant.size_code,
        "image": data["image"],
        "score": float(score.quantize(Decimal(".000001"))),
        "score_components": components,
        "reasons": reasons,
    }


def rank_products(products, slot, context, families):
    ranked = []
    size = context.get("sizes", {}).get(slot["slot_key"])
    for product in products:
        variants = [
            v
            for v in product.variants
            if v.active
            and v.available
            and (not size or v.size_code == size)
            and price_of(product, v) <= context["budget_max_vnd"]
        ]
        if not variants:
            continue
        variant = min(variants, key=lambda v: (price_of(product, v), v.sku, v.id))
        ranked.append(score_candidate(product, variant, slot, context, families))
    ranked.sort(key=lambda i: (-i["score"], i["price_vnd"], i["product_code"], i["variant_id"]))
    for rank, item in enumerate(ranked, 1):
        item["rank"] = rank
    return ranked


def signature(items):
    return tuple(sorted((i["slot_key"], i["product_id"]) for i in items))


def total(items):
    return sum(i["price_vnd"] for i in items)


def look_score(items):
    return round(sum(i["score"] for i in items) / len(items), 6)


def compose(slots, ranked, budget):
    missing = [s["slot_key"] for s in slots if not ranked[s["slot_key"]]]
    diagnostics = {"missing_slots": missing, "constraints": [], "relaxation_options": []}
    if missing:
        diagnostics["constraints"] = [{"code": "EMPTY_SLOT", "slots": missing}]
        diagnostics["fewer_looks_reason"] = "MISSING_REQUIRED_SLOTS"
        return [], diagnostics, "PARTIAL" if any(ranked.values()) else "NO_RESULTS"
    cheapest = [
        min(ranked[s["slot_key"]], key=lambda i: (i["price_vnd"], i["product_code"])) for s in slots
    ]
    minimum = total(cheapest)
    diagnostics["minimum_feasible_budget_vnd"] = minimum
    if minimum > budget:
        diagnostics.update(
            constraints=[{"code": "BUDGET_TOO_LOW", "minimum_vnd": minimum}],
            relaxation_options=[{"field": "budget_max_vnd", "suggested_value": minimum}],
            fewer_looks_reason="BUDGET_TOO_LOW",
        )
        return [], diagnostics, "NO_RESULTS"
    beam = [[]]
    for idx, slot in enumerate(slots):
        candidates = ranked[slot["slot_key"]]
        pool = {
            i["product_id"]: i
            for i in candidates[:30]
            + sorted(candidates, key=lambda i: (i["price_vnd"], i["product_code"]))[:10]
        }
        residual = sum(i["price_vnd"] for i in cheapest[idx + 1 :])
        expanded = [
            state + [item]
            for state in beam
            for item in pool.values()
            if total(state) + item["price_vnd"] + residual <= budget
            and item["product_id"] not in {i["product_id"] for i in state}
        ]
        beam = sorted(
            expanded, key=lambda items: (-look_score(items), total(items), signature(items))
        )[:50]
    combinations = {signature(items): items for items in beam + [cheapest]}
    choices = sorted(
        combinations.values(),
        key=lambda items: (-look_score(items), total(items), signature(items)),
    )
    selected = [("BEST_MATCH", choices.pop(0))]
    if choices:
        base = {i["product_id"] for i in selected[0][1]}
        alternative = min(
            choices,
            key=lambda items: (
                -len({i["product_id"] for i in items} - base),
                -look_score(items),
                total(items),
                signature(items),
            ),
        )
        selected.append(("ALTERNATIVE", alternative))
        choices.remove(alternative)
    if choices:
        selected.append(
            (
                "BUDGET_CHOICE",
                min(
                    choices, key=lambda items: (total(items), -look_score(items), signature(items))
                ),
            )
        )
    if len(selected) < 3:
        diagnostics["fewer_looks_reason"] = "INSUFFICIENT_DISTINCT_COMBINATIONS"
    return selected, diagnostics, "COMPLETE"


def explain(items, context):
    return [
        {"code": "OCCASION_TEMPLATE_MATCH", "facts": {"occasion": context["occasion"]}},
        {
            "code": "STYLE_COVERAGE",
            "facts": {
                "style": context["style"],
                "matched_items": sum(bool(i["score_components"]["style_match"]) for i in items),
                "total_items": len(items),
            },
        },
        {
            "code": "LOOK_WITHIN_BUDGET",
            "facts": {
                "total_price_vnd": total(items),
                "budget_max_vnd": context["budget_max_vnd"],
                "remaining_vnd": context["budget_max_vnd"] - total(items),
            },
        },
        {"code": "PALETTE_COVERAGE", "facts": {"colors": sorted({i["color"] for i in items})}},
    ]
