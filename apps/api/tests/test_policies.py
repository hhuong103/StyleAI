import io
import json
from uuid import uuid4

import pytest
from PIL import Image
from sqlalchemy import select
from test_api import plan_and_generate

from app.db.models import Category, Color, Product, User, Variant
from app.modules.recommendations.engine import rank_products
from app.modules.stylist.taxonomy import RULES


@pytest.mark.parametrize("occasion,style,categories", RULES)
def test_all_seed_rules_return_budget_safe_looks(client, signed_in, occasion, style, categories):
    rec = plan_and_generate(client, occasion=occasion, style=style, gender=None)
    assert rec["status"] == "COMPLETE"
    for look in rec["looks"]:
        assert len(look["items"]) == len(categories)
        assert look["total_price_vnd"] <= 1500000
        assert len({i["product_id"] for i in look["items"]}) == len(look["items"])


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


def test_replacement_cannot_exceed_total_budget(client, signed_in, db):
    rec = plan_and_generate(client)
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


def test_idempotency_key_rejects_different_payload(client, signed_in):
    rec = plan_and_generate(client)
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
    assert data["normalized_context"]["budget_max_vnd"] == 1500000
    assert data["field_sources"]["occasion"] == "form"
    assert data["warnings"]


def test_catalog_product_crud_and_import_upsert(client, signed_in, db):
    db.get(User, signed_in["id"]).role = "ADMIN"
    db.commit()
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
