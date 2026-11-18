import io
import json
from uuid import uuid4

import pytest
from PIL import Image
from sqlalchemy import select
from test_api import mark_test_catalog_real, mark_test_product_real, plan_and_generate

from app.db.models import Category, Color, Product, ProductOccasion, ProductStyle, User, Variant
from app.modules.recommendations.engine import rank_products
from app.modules.stylist.taxonomy import OCCASIONS, RULES, STYLES


@pytest.mark.parametrize("occasion,style,categories", RULES)
def test_all_seed_rules_return_budget_safe_looks(
    client, signed_in, db, occasion, style, categories
):
    mark_test_catalog_real(db)
    rec = plan_and_generate(client, db, occasion=occasion, style=style, gender=None)
    assert rec["status"] == "COMPLETE"
    for look in rec["looks"]:
        assert len(look["items"]) == len(categories)
        assert look["total_price_vnd"] <= 1500000
        assert len({i["product_id"] for i in look["items"]}) == len(look["items"])


@pytest.mark.parametrize(
    ("occasion", "style"),
    [("DAILY", "FORMAL"), ("PARTY", "CASUAL"), ("TRAVEL", "MINIMAL")],
)
def test_unlisted_style_uses_occasion_fallback(client, signed_in, occasion, style):
    response = client.post(
        "/api/v1/stylist/plan",
        json={
            "text": "",
            "context": {
                "occasion": occasion,
                "style": style,
                "preferred_colors": [],
                "budget_max_vnd": 1_500_000,
            },
        },
    )

    assert response.status_code == 200, response.text
    plan = response.json()["data"]
    assert plan["normalized_context"]["style"] == style
    assert plan["rule_version"] == f"fallback_{occasion.lower()}@1"


def test_every_style_and_occasion_has_a_plan(client, signed_in):
    for occasion in OCCASIONS:
        for style in STYLES:
            response = client.post(
                "/api/v1/stylist/plan",
                json={
                    "text": "",
                    "context": {
                        "occasion": occasion,
                        "style": style,
                        "preferred_colors": [],
                        "budget_max_vnd": 1_500_000,
                    },
                },
            )
            assert response.status_code == 200, f"{occasion}/{style}: {response.text}"


def test_missing_tags_score_without_false_explanation(db):
    product = db.scalar(select(Product).where(Product.category_code == "SHIRT"))
    product.styles, product.occasions = [], []
    families = {c.code: c.family for c in db.scalars(select(Color))}
    ranked = rank_products(
        [product],
        {"slot_key": "top", "role": "TOP"},
        {
            "style": "MINIMAL",
            "occasion": "INTERVIEW",
            "preferred_colors": [],
            "budget_max_vnd": 1500000,
        },
        families,
    )
    assert ranked
    codes = {r["code"] for r in ranked[0]["reasons"]}
    assert not codes & {"STYLE_MATCH", "OCCASION_MATCH", "COLOR_MATCH"}
    assert 0 <= ranked[0]["score"] <= 1
    assert ranked[0]["score_components"]["preference_fit"] == 0


@pytest.mark.parametrize("preference", ["style", "occasion", "color"])
def test_selected_preferences_outrank_cheaper_unmatched_products(db, preference):
    products = list(
        db.scalars(
            select(Product)
            .where(Product.category_code == "SHIRT")
            .order_by(Product.product_code)
            .limit(2)
        )
    )
    assert len(products) == 2
    preferred, cheaper = products
    for product in products:
        product.styles = []
        product.occasions = []
        for variant in product.variants:
            variant.price_override_vnd = None
    preferred.base_price_vnd = 1_500_000
    cheaper.base_price_vnd = 0
    context = {
        "style": "MINIMAL",
        "occasion": "INTERVIEW",
        "preferred_colors": ["RED"] if preference == "color" else [],
        "budget_max_vnd": 1_500_000,
    }

    if preference == "style":
        preferred.styles = [ProductStyle(style_code="MINIMAL")]
    elif preference == "occasion":
        preferred.occasions = [ProductOccasion(occasion_code="INTERVIEW")]
    else:
        preferred.color_code = "RED"
        cheaper.color_code = "WHITE"

    families = {color.code: color.family for color in db.scalars(select(Color))}
    ranked = rank_products(products, {"slot_key": "top", "role": "TOP"}, context, families)

    assert ranked[0]["product_id"] == preferred.id
    assert (
        ranked[0]["score_components"]["preference_fit"]
        > ranked[1]["score_components"]["preference_fit"]
    )


def test_same_color_family_counts_as_partial_preference_match(db):
    product = db.scalar(select(Product).where(Product.category_code == "SHIRT"))
    product.styles, product.occasions = [], []
    product.color_code = "PINK"
    families = {color.code: color.family for color in db.scalars(select(Color))}

    ranked = rank_products(
        [product],
        {"slot_key": "top", "role": "TOP"},
        {
            "style": "MINIMAL",
            "occasion": "INTERVIEW",
            "preferred_colors": ["RED"],
            "budget_max_vnd": 1_500_000,
        },
        families,
    )

    assert ranked[0]["score_components"]["color_match"] == 0.7
    assert ranked[0]["score_components"]["preference_fit"] == pytest.approx(0.7 / 3)
    assert any(reason["code"] == "COLOR_FAMILY_MATCH" for reason in ranked[0]["reasons"])


def test_replacement_cannot_exceed_total_budget(client, signed_in, db):
    rec = plan_and_generate(client, db)
    look = rec["looks"][0]
    product = db.scalar(select(Product).where(Product.category_code == "SHIRT"))
    variant = Variant(
        product_id=product.id,
        sku="OVER_BUDGET_SIZE",
        size_code="BUDGET_TEST",
        price_override_vnd=1500000,
    )
    db.add(variant)
    db.flush()
    path = (
        f"/api/v1/recommendations/{rec['recommendation_id']}/looks/{look['look_id']}/replacements"
    )
    response = client.post(path, json={"slot_key": "top", "variant_id": variant.id})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "BUDGET_EXCEEDED"


def test_idempotency_key_rejects_different_payload(client, signed_in, db):
    rec = plan_and_generate(client, db)
    headers = {"Idempotency-Key": str(uuid4())}
    look_id = rec["looks"][0]["look_id"]
    assert (
        client.post(
            "/api/v1/outfits", json={"look_id": look_id, "name": "First"}, headers=headers
        ).status_code
        == 201
    )
    response = client.post(
        "/api/v1/outfits", json={"look_id": look_id, "name": "Second"}, headers=headers
    )
    assert (
        response.status_code == 409 and response.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"
    )


def test_explicit_form_takes_precedence_over_text(client, signed_in):
    response = client.post(
        "/api/v1/stylist/plan",
        json={
            "text": "phỏng vấn tối giản dưới 1 triệu",
            "context": {"occasion": "CAFE", "style": "CASUAL", "budget_max_vnd": 1500000},
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["normalized_context"]["occasion"] == "CAFE"
    assert data["normalized_context"]["style"] == "CASUAL"
    assert data["normalized_context"]["budget_max_vnd"] == 1500000
    assert data["field_sources"]["occasion"] == "form"
    assert {warning["field"] for warning in data["warnings"]} == {"occasion", "style"}


def test_catalog_product_crud_and_import_upsert(client, signed_in, db):
    db.get(User, signed_in["id"]).role = "ADMIN"
    db.commit()
    existing_product = db.scalar(select(Product).order_by(Product.product_code))
    mark_test_product_real(existing_product, materialize_image=True)
    existing = client.get("/api/v1/products?page_size=1").json()["data"][0]
    body = {
        "product_code": "ADMIN_CREATE",
        "name": "Admin created shirt",
        "category_code": "SHIRT",
        "color_code": "WHITE",
        "base_price_vnd": 200000,
        "image_key": existing["image"]["url"].removeprefix("/media/"),
        "styles": ["MINIMAL"],
        "occasions": ["INTERVIEW"],
        "variants": [{"sku": "ADMIN_CREATE_ONE"}],
    }
    response = client.post("/api/v1/products", json=body)
    assert response.status_code == 201, response.text
    product = response.json()["data"]
    update = {k: v for k, v in body.items() if k != "variants"}
    update["base_price_vnd"] = 250000
    response = client.put(f"/api/v1/products/{product['id']}", json=update)
    assert response.status_code == 200 and response.json()["data"]["price_vnd"] == 250000
    body["base_price_vnd"] = 280000
    job = client.post(
        "/api/v1/admin/catalog-imports/validate",
        files={"file": ("upsert.json", json.dumps([body]), "application/json")},
    ).json()["data"]
    response = client.post(f"/api/v1/admin/catalog-imports/{job['import_id']}/commit")
    assert response.status_code == 200, response.text
    assert client.get(f"/api/v1/products/{product['id']}").json()["data"]["price_vnd"] == 280000
    assert client.delete(f"/api/v1/products/{product['id']}").status_code == 204
    db.get(User, signed_in["id"]).role = "USER"
    db.commit()
    assert client.get(f"/api/v1/products/{product['id']}").status_code == 404


def test_real_product_requires_original_upload_and_exact_shopee_listing(client, signed_in, db):
    db.get(User, signed_in["id"]).role = "ADMIN"
    db.commit()
    demo = db.scalar(select(Product))
    body = {
        "product_code": "REAL_PRODUCT_TEST",
        "name": "Real product",
        "category_code": "SHIRT",
        "color_code": "WHITE",
        "base_price_vnd": 250000,
        "price_source": "REAL",
        "product_url": "https://shopee.vn/example-product-i.123456789.12345678901",
        "image_key": demo.images[0].storage_key,
        "variants": [{"sku": "REAL_PRODUCT_TEST_M", "size_code": "M", "available": True}],
    }

    response = client.post("/api/v1/products", json=body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "REAL_PRODUCT_IMAGE_REQUIRED"

    image = Image.new("RGB", (30, 40), "white")
    raw = io.BytesIO()
    image.save(raw, "PNG")
    uploaded = client.post(
        "/api/v1/admin/uploads/images",
        files={"file": ("real-product.png", raw.getvalue(), "image/png")},
    )
    body["image_key"] = uploaded.json()["data"]["storage_key"]
    body["product_url"] = "https://shopee.vn/search?keyword=shirt"

    response = client.post("/api/v1/products", json=body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_PRODUCT_URL"

    body["product_url"] = (
        "https://www.shopee.vn/example-product-i.123456789.12345678901?sp_atk=abc&utm_source=share"
    )
    response = client.post("/api/v1/products", json=body)
    assert response.status_code == 201, response.text
    assert (
        response.json()["data"]["product_url"]
        == "https://shopee.vn/example-product-i.123456789.12345678901"
    )


def test_taxonomy_cycle_rule_publish_and_image_validation(client, signed_in, db):
    db.get(User, signed_in["id"]).role = "ADMIN"
    db.commit()
    invalid = client.post(
        "/api/v1/admin/taxonomy/categories",
        json={
            "code": "TEST_CATEGORY",
            "label": "Test",
            "item_role": "TOP",
            "parent_code": "TEST_CATEGORY",
        },
    )
    assert invalid.status_code == 422
    image = Image.new("RGB", (30, 40), "white")
    raw = io.BytesIO()
    image.save(raw, "PNG")
    response = client.post(
        "/api/v1/admin/uploads/images", files={"file": ("valid.png", raw.getvalue(), "image/png")}
    )
    assert response.status_code == 201 and response.json()["data"]["storage_key"].endswith(".webp")
    rule = client.post(
        "/api/v1/admin/outfit-rules",
        json={
            "rule_key": "test_rule",
            "occasion_code": "DAILY",
            "style_code": "CASUAL",
            "slots": [{"slot_key": "top", "role": "TOP", "categories": ["SHIRT"]}],
        },
    ).json()["data"]
    published = client.post(f"/api/v1/admin/outfit-rules/{rule['id']}/publish")
    assert published.status_code == 200 and published.json()["data"]["active"]
    category = db.get(Category, "SHIRT")
    category.active = False
    db.commit()
    from app.modules.catalog.repository import ProductRepository

    assert ProductRepository(db).candidates({"categories": ["SHIRT"]}, {}) == []
