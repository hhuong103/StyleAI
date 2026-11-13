from uuid import uuid4

from conftest import authenticate
from sqlalchemy import func, select

from app.core.config import settings
from app.db.models import AuthSession, Feedback, Outfit, Product, User, Variant


def mark_test_product_real(product, materialize_image=False):
    product.price_source = "REAL"
    product.source = "test-fixture"
    product.product_url = "https://shopee.vn/test-listing-i.123456789.12345678901"
    for image in product.images:
        image.storage_key = f"uploads/test/{product.id}.webp"
    if materialize_image:
        path = settings.media_root / f"uploads/test/{product.id}.webp"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"test product image")


def mark_test_catalog_real(db):
    for product in db.scalars(select(Product)):
        mark_test_product_real(product)


def plan_and_generate(client, db, **context):
    mark_test_catalog_real(db)
    response = client.post(
        "/api/v1/stylist/plan",
        json={
            "text": "phỏng vấn tối giản",
            "context": {
                "occasion": "INTERVIEW",
                "style": "MINIMAL",
                "gender": "FEMALE",
                "preferred_colors": ["WHITE", "BLACK", "BEIGE"],
                "budget_max_vnd": 1500000,
                **context,
            },
        },
    )
    assert response.status_code == 200, response.text
    plan = response.json()["data"]
    response = client.post("/api/v1/recommendations", json={"plan_id": plan["plan_id"], "top_k": 5})
    assert response.status_code == 201, response.text
    return response.json()["data"]


def test_auth_csrf_role_and_password_not_echoed(client):
    response = client.post("/api/v1/auth/register", json={"email": "x", "password": "super-secret"})
    assert response.status_code == 403
    user = authenticate(client)
    assert client.get("/api/v1/auth/me").status_code == 200
    assert client.get("/api/v1/admin/summary").status_code == 403
    assert "access_token" in client.cookies
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "bad", "password": "super-secret", "display_name": "x", "role": "ADMIN"},
    )
    assert response.status_code == 422 and "super-secret" not in response.text
    assert user["role"] == "USER"


def test_whole_journey_persistence_replacement_feedback(client, signed_in, db):
    rec = plan_and_generate(client, db)
    assert rec["status"] == "COMPLETE" and len(rec["looks"]) == 3
    assert (
        len({tuple(sorted(i["product_id"] for i in look["items"])) for look in rec["looks"]}) == 3
    )
    look = rec["looks"][0]
    assert len(look["items"]) == 4
    assert sum(i["price_vnd"] for i in look["items"]) == look["total_price_vnd"] <= 1500000
    path = f"/api/v1/recommendations/{rec['recommendation_id']}/looks/{look['look_id']}"
    alternatives = client.get(path + "/slots/top/alternatives").json()["data"]
    assert alternatives
    replacement = client.post(
        path + "/replacements",
        json={"slot_key": "top", "variant_id": alternatives[0]["variant_id"]},
    )
    assert replacement.status_code == 201, replacement.text
    new_look = replacement.json()["data"]
    assert new_look["revision"] == 2 and new_look["source_look_id"] == look["look_id"]
    assert new_look["total_price_vnd"] == alternatives[0]["new_total_price_vnd"]
    key = str(uuid4())
    saved = client.post(
        "/api/v1/outfits", json={"look_id": new_look["look_id"]}, headers={"Idempotency-Key": key}
    )
    assert saved.status_code == 201, saved.text
    outfit = saved.json()["data"]
    retry = client.post(
        "/api/v1/outfits", json={"look_id": new_look["look_id"]}, headers={"Idempotency-Key": key}
    )
    assert retry.json()["data"]["id"] == outfit["id"]
    assert (
        db.scalar(select(func.count()).select_from(Outfit).where(Outfit.user_id == signed_in["id"]))
        == 1
    )
    for vote in ["LIKE", "DISLIKE"]:
        response = client.post(
            "/api/v1/feedback",
            json={"target_type": "OUTFIT", "target_id": outfit["id"], "value": vote},
        )
        assert response.status_code == 200, response.text
    assert (
        db.scalar(
            select(func.count()).select_from(Feedback).where(Feedback.user_id == signed_in["id"])
        )
        == 1
    )
    assert client.get("/api/v1/feedback").json()["data"][0]["value"] == "DISLIKE"
    patch = client.patch(
        f"/api/v1/outfits/{outfit['id']}", json={"version": 1, "is_favorite": True}
    )
    assert patch.json()["data"]["is_favorite"] is True
    assert (
        client.patch(
            f"/api/v1/outfits/{outfit['id']}", json={"version": 1, "is_favorite": False}
        ).status_code
        == 409
    )
    assert client.post(f"/api/v1/outfits/{outfit['id']}/duplicate").status_code == 201
    assert client.delete(f"/api/v1/outfits/{outfit['id']}").status_code == 204
    assert client.delete(f"/api/v1/outfits/{outfit['id']}").status_code == 204


def test_demo_products_are_not_publicly_browsable_or_recommendable(client, signed_in, db):
    product = db.scalar(select(Product).where(Product.price_source == "DEMO"))

    assert client.get("/api/v1/products").json()["meta"]["total"] == 0
    assert client.get(f"/api/v1/products/{product.id}").status_code == 404

    response = client.post(
        "/api/v1/stylist/plan",
        json={
            "text": "",
            "context": {
                "occasion": "DAILY",
                "style": "CASUAL",
                "budget_max_vnd": 1_500_000,
            },
        },
    )
    plan = response.json()["data"]
    response = client.post(
        "/api/v1/recommendations",
        json={
            "plan_id": plan["plan_id"],
            "selected_products": [{"product_id": product.id, "variant_id": product.variants[0].id}],
        },
    )
    assert response.status_code == 404


def test_recommendation_includes_selected_waitlist_products(client, signed_in, db):
    plan_response = client.post(
        "/api/v1/stylist/plan",
        json={
            "text": "",
            "context": {
                "occasion": "INTERVIEW",
                "style": "MINIMAL",
                "gender": "FEMALE",
                "preferred_colors": [],
                "budget_max_vnd": 1500000,
            },
        },
    )
    assert plan_response.status_code == 200, plan_response.text
    plan = plan_response.json()["data"]
    mark_test_catalog_real(db)
    product = db.scalar(select(Product).where(Product.product_code == "DEMO_T_SHIRT_WHITE_01"))
    variant = product.variants[0]

    response = client.post(
        "/api/v1/recommendations",
        json={
            "plan_id": plan["plan_id"],
            "selected_products": [{"product_id": product.id, "variant_id": variant.id}],
        },
    )

    assert response.status_code == 201, response.text
    recommendation = response.json()["data"]
    assert recommendation["status"] == "COMPLETE"
    assert all(
        any(
            item["product_id"] == product.id and item["variant_id"] == variant.id
            for item in look["items"]
        )
        for look in recommendation["looks"]
    )


def test_virtual_try_on_validates_profile_before_provider_call(client, signed_in):
    response = client.post(
        "/api/v1/stylist/virtual-try-on",
        json={
            "selected_products": [str(uuid4())],
            "gender": "FEMALE",
            "age": 17,
            "height_cm": 165,
            "weight_kg": 52,
            "bust_cm": None,
            "waist_cm": None,
            "hips_cm": None,
            "background": "CAFE",
            "consent_external_processing": True,
        },
    )
    assert response.status_code == 422


def test_virtual_try_on_reports_missing_provider_configuration(client, signed_in):
    response = client.post(
        "/api/v1/stylist/virtual-try-on",
        json={
            "selected_products": [str(uuid4())],
            "gender": "FEMALE",
            "age": 24,
            "height_cm": 165,
            "weight_kg": 52,
            "bust_cm": None,
            "waist_cm": None,
            "hips_cm": None,
            "background": "CAFE",
            "consent_external_processing": True,
        },
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "GEMINI_IMAGE_NOT_CONFIGURED"


def test_waitlist_product_adds_its_role_to_the_recommended_look(client, signed_in, db):
    plan_response = client.post(
        "/api/v1/stylist/plan",
        json={
            "text": "",
            "context": {
                "occasion": "DAILY",
                "style": "CASUAL",
                "gender": "UNISEX",
                "preferred_colors": [],
                "budget_max_vnd": 1500000,
            },
        },
    )
    assert plan_response.status_code == 200, plan_response.text
    plan = plan_response.json()["data"]
    mark_test_catalog_real(db)
    product = db.scalar(select(Product).where(Product.product_code == "DEMO_BLAZER_BEIGE_01"))
    variant = product.variants[0]

    response = client.post(
        "/api/v1/recommendations",
        json={
            "plan_id": plan["plan_id"],
            "selected_products": [{"product_id": product.id, "variant_id": variant.id}],
        },
    )

    assert response.status_code == 201, response.text
    recommendation = response.json()["data"]
    assert all(
        any(
            item["product_id"] == product.id and item["slot_key"] == "outerwear"
            for item in look["items"]
        )
        for look in recommendation["looks"]
    )


def test_cross_user_cannot_access_look_or_outfit(client, signed_in, db):
    rec = plan_and_generate(client, db)
    look = rec["looks"][0]
    outfit = client.post("/api/v1/outfits", json={"look_id": look["look_id"]}).json()["data"]
    authenticate(client, "other@example.com")
    assert client.get(f"/api/v1/recommendations/{rec['recommendation_id']}").status_code == 404
    assert client.get(f"/api/v1/outfits/{outfit['id']}").status_code == 404
    assert client.post("/api/v1/outfits", json={"look_id": look["look_id"]}).status_code == 404
    assert (
        client.post(
            "/api/v1/feedback",
            json={"target_type": "LOOK", "target_id": look["look_id"], "value": "LIKE"},
        ).status_code
        == 404
    )


def test_changed_price_stock_and_incompatible_slot(client, signed_in, db):
    rec = plan_and_generate(client, db)
    look = rec["looks"][0]
    selected = look["items"][0]
    product = db.get(Product, selected["product_id"])
    product.base_price_vnd += 10000
    db.flush()
    response = client.post("/api/v1/outfits", json={"look_id": look["look_id"]})
    assert response.status_code == 409 and response.json()["error"]["code"] == "CATALOG_CHANGED"
    # Failed request rolls back its savepoint; re-fetch before changing stock.
    variant = db.get(Variant, selected["variant_id"])
    variant.available = False
    db.flush()
    response = client.post("/api/v1/outfits", json={"look_id": look["look_id"]})
    assert response.status_code == 409 and response.json()["error"]["code"] == "ITEM_UNAVAILABLE"
    path = (
        f"/api/v1/recommendations/{rec['recommendation_id']}/looks/{look['look_id']}/replacements"
    )
    response = client.post(
        path, json={"slot_key": "top", "variant_id": look["items"][-1]["variant_id"]}
    )
    assert response.status_code == 409


def test_no_results_is_not_server_error(client, signed_in, db):
    rec = plan_and_generate(client, db, budget_max_vnd=100000)
    assert rec["status"] in ["NO_RESULTS", "PARTIAL"] and not rec["looks"]
    assert rec["diagnostics"]["minimum_feasible_budget_vnd"] > 100000
    assert rec["diagnostics"]["constraints"][0]["code"] == "BUDGET_TOO_LOW"


def test_default_and_ambiguous_budget_require_confirmation(client, signed_in):
    for text in ["", "phỏng vấn tối giản dưới 1.500"]:
        response = client.post("/api/v1/stylist/plan", json={"text": text})
        plan = response.json()["data"]
        assert "budget_max_vnd" in plan["needs_confirmation"]
        assert (
            client.post("/api/v1/recommendations", json={"plan_id": plan["plan_id"]}).status_code
            == 422
        )


def test_catalog_filters_use_available_variant_price(client, signed_in, db):
    product = db.scalar(select(Product).where(Product.category_code == "SHIRT"))
    mark_test_product_real(product)
    product.base_price_vnd = 999000
    first = product.variants[0]
    first.price_override_vnd, first.available = 100000, False
    product.variants.append(
        Variant(sku="CUSTOM-M", size_code="M", available=True, price_override_vnd=500000)
    )
    db.flush()
    response = client.get(
        f"/api/v1/products?q={product.product_code}&max_price_vnd=200000&available=true"
    )
    assert response.status_code == 200 and response.json()["meta"]["total"] == 0
    response = client.get(
        f"/api/v1/products?q={product.product_code}&min_price_vnd=450000&max_price_vnd=550000&available=true"
    )
    assert response.json()["data"][0]["price_vnd"] == 500000


def test_catalog_is_browseable_without_sign_in(client, db):
    product = db.scalar(select(Product).where(Product.category_code == "SHIRT"))
    mark_test_product_real(product)
    taxonomy = client.get("/api/v1/taxonomy")
    assert taxonomy.status_code == 200

    products = client.get("/api/v1/products")
    assert products.status_code == 200
    product = products.json()["data"][0]

    detail = client.get(f"/api/v1/products/{product['id']}")
    assert detail.status_code == 200

    assert client.get("/api/v1/products?include_inactive=true").status_code == 403


def test_retired_shopee_seed_products_are_hidden_from_collection(client, db):
    product = db.scalar(select(Product).where(Product.category_code == "SNEAKERS"))
    mark_test_product_real(product)
    product.source = "shopee-verified-2026-11-06"
    db.flush()

    response = client.get("/api/v1/products?page_size=100")

    assert response.status_code == 200
    assert product.id not in {item["id"] for item in response.json()["data"]}


def test_refresh_rotation_reuse_and_logout_revoke(client, signed_in, db):
    old_refresh = client.cookies.get("refresh_token")
    old_access = client.cookies.get("access_token")
    assert client.post("/api/v1/auth/refresh").status_code == 200
    assert client.cookies.get("refresh_token") != old_refresh
    client.cookies.set("refresh_token", old_refresh, domain="localhost.local", path="/api/v1/auth")
    assert client.post("/api/v1/auth/refresh").status_code == 401
    assert all(
        s.revoked_at
        for s in db.scalars(select(AuthSession).where(AuthSession.user_id == signed_in["id"]))
    )
    assert client.get("/api/v1/auth/me").status_code == 401
    assert old_access


def test_admin_summary_product_and_import(client, signed_in, db):
    mark_test_product_real(
        db.scalar(select(Product).order_by(Product.product_code)), materialize_image=True
    )
    user = db.get(User, signed_in["id"])
    user.role = "ADMIN"
    db.flush()
    summary = client.get("/api/v1/admin/summary")
    assert summary.status_code == 200 and summary.json()["data"]["products"] >= 1000
    product = client.get("/api/v1/products?page_size=1").json()["data"][0]
    stock = client.patch(
        f"/api/v1/products/{product['id']}/stock",
        json={"available": False},
    )
    assert stock.status_code == 200, stock.text
    assert stock.json()["data"]["available"] is False
    assert all(
        not variant["available"]
        for variant in stock.json()["data"]["variants"]
        if variant["active"]
    )
    stock = client.patch(
        f"/api/v1/products/{product['id']}/stock",
        json={"available": True},
    )
    assert stock.status_code == 200, stock.text
    assert stock.json()["data"]["available"] is True
    body = {
        "product_code": "IMPORT_TEST",
        "name": "Imported shirt",
        "category_code": "SHIRT",
        "color_code": "WHITE",
        "base_price_vnd": 249000,
        "image_key": product["image"]["url"].removeprefix("/media/"),
        "variants": [{"sku": "IMPORT_TEST_ONE"}],
        "styles": ["MINIMAL"],
        "occasions": ["INTERVIEW"],
    }
    import json

    validate = client.post(
        "/api/v1/admin/catalog-imports/validate",
        files={"file": ("catalog.json", json.dumps([body]), "application/json")},
    )
    assert validate.status_code == 200, validate.text
    job = validate.json()["data"]
    assert job["status"] == "VALIDATED"
    for _ in range(2):
        commit = client.post(f"/api/v1/admin/catalog-imports/{job['import_id']}/commit")
        assert commit.status_code == 200, commit.text
    assert (
        db.scalar(
            select(func.count()).select_from(Product).where(Product.product_code == "IMPORT_TEST")
        )
        == 1
    )


def test_invalid_upload_and_import_are_rejected(client, signed_in, db):
    db.get(User, signed_in["id"]).role = "ADMIN"
    db.commit()
    assert (
        client.post(
            "/api/v1/admin/uploads/images", files={"file": ("bad.png", b"not a png", "image/png")}
        ).status_code
        == 415
    )
    assert (
        client.post(
            "/api/v1/admin/catalog-imports/validate",
            files={"file": ("bad.json", "{}", "application/json")},
        ).status_code
        == 422
    )
    assert client.get("/media/imports/secret.json").status_code == 404
