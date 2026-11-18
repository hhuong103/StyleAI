import asyncio
import hashlib
import io
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.models import (
    Category,
    Color,
    Occasion,
    OutfitRule,
    Preference,
    Product,
    ProductImage,
    ProductOccasion,
    ProductStyle,
    Profile,
    Style,
    User,
    Variant,
)
from app.db.session import Base, get_db
from app.main import app
from app.modules.auth.security import current_user
from app.modules.catalog import service as catalog_service
from app.modules.stylist import virtual_tryon
from app.modules.vell import bound_runtime, domain_service
from app.modules.vell.domain_models import JobBinding, ProductVerification
from app.modules.vell.segmentation import SegmentationOutput, segment_once, validate_regions
from app.modules.vell.worker import run_once


@pytest.fixture
def studio(tmp_path, monkeypatch):
    test_settings = replace(settings, media_root=tmp_path, gemini_api_key="test-only-no-network")
    for module in (catalog_service, virtual_tryon, bound_runtime, domain_service):
        monkeypatch.setattr(module, "settings", test_settings, raising=False)
    monkeypatch.delenv("VELL_SEGMENTATION_URL", raising=False)
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )

    @event.listens_for(engine, "connect")
    def foreign_keys(conn, _):
        conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    user_id = str(uuid4())
    identity = SimpleNamespace(id=user_id, role="ADMIN")
    with factory() as db:
        db.add(
            User(id=user_id, email="studio-test@example.com", password_hash="unused", role="ADMIN")
        )
        db.add(Color(code="BLACK", label="Black", hex="#000000", family="NEUTRAL"))
        for code, role in (
            ("TEE", "TOP"),
            ("JACKET", "OUTERWEAR"),
            ("PANTS", "BOTTOM"),
            ("BOOTS", "SHOES"),
        ):
            db.add(Category(code=code, label=code, item_role=role))
        db.flush()
        db.add(Profile(user_id=user_id, display_name="Test studio"))
        db.add(Preference(user_id=user_id))
        db.add(Style(code="CASUAL", label="Casual"))
        db.add(Occasion(code="DAILY", label="Everyday"))
        db.flush()
        db.add(
            OutfitRule(
                rule_key="studio_test",
                occasion_code="DAILY",
                style_code="CASUAL",
                active=True,
                slots=[
                    {"slot_key": key, "role": role, "categories": [category], "required": True}
                    for key, role, category in (
                        ("top", "TOP", "TEE"),
                        ("outerwear", "OUTERWEAR", "JACKET"),
                        ("bottom", "BOTTOM", "PANTS"),
                        ("shoes", "SHOES", "BOOTS"),
                    )
                ],
            )
        )
        garments = []
        for index, (code, slot) in enumerate(
            (("TEE", "INNER_TOP"), ("JACKET", "OUTERWEAR"), ("PANTS", "BOTTOM"), ("BOOTS", "SHOES"))
        ):
            key = f"uploads/test-{index}.png"
            (tmp_path / "uploads").mkdir(exist_ok=True)
            Image.new("RGB", (24, 36), (index * 40, 80, 100)).save(tmp_path / key)
            product = Product(
                product_code=f"TEST_ONLY_{index}",
                name=f"Test fixture {code}",
                category_code=code,
                color_code="BLACK",
                base_price_vnd=100,
                price_source="REAL",
                source="test-fixture-only",
                product_url=f"https://shopee.vn/test-fixture-i.123.{index + 1}",
                images=[ProductImage(storage_key=key, alt_text="Test fixture")],
                variants=[Variant(sku=f"TEST_SKU_{index}", size_code="M")],
                styles=[ProductStyle(style_code="CASUAL")],
                occasions=[ProductOccasion(occasion_code="DAILY")],
            )
            db.add(product)
            db.flush()
            garments.append(
                {"slot": slot, "product_id": product.id, "variant_id": product.variants[0].id}
            )
        db.commit()

    def database():
        with factory() as db:
            try:
                yield db
                db.commit()
            except Exception:
                db.rollback()
                raise

    app.dependency_overrides[get_db] = database
    app.dependency_overrides[current_user] = lambda: identity
    with TestClient(app, base_url="http://localhost:3000") as client:
        csrf = client.get("/api/v1/auth/csrf").json()["data"]["csrf_token"]
        client.headers.update({"Origin": "http://localhost:3000", "X-CSRF-Token": csrf})
        models = []
        for index, presentation in enumerate(("FEMALE", "MALE")):
            response = client.post(
                "/api/v1/vell/admin/models",
                json={
                    "name": f"Test {presentation}",
                    "presentation": presentation,
                    "asset_key": f"uploads/test-{index}.png",
                    "license_note": "Test-only generated fixture; no real person.",
                },
            )
            assert response.status_code == 201, response.text
            models.append(response.json()["data"])
        yield client, factory, identity, garments, models, tmp_path
    app.dependency_overrides.clear()
    engine.dispose()


def verified_outfit(client, garments):
    for item in garments:
        response = client.post(
            f"/api/v1/vell/admin/products/{item['product_id']}/verify",
            json={
                "retailer_sku": f"TEST-{item['slot']}",
                "evidence": "Test-only admin attestation fixture, not merchant inventory.",
            },
        )
        assert response.status_code == 200, response.text
    response = client.post(
        "/api/v1/vell/outfits/compose", json={"name": "Test complete outfit", "garments": garments}
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def prepared_session(client, garments, model):
    outfit = verified_outfit(client, garments)
    session = client.post("/api/v1/vell/sessions", json={"model_id": model["model_id"]}).json()[
        "data"
    ]
    session = client.patch(
        f"/api/v1/vell/sessions/{session['session_id']}",
        json={"version": 1, "outfit_id": outfit["outfit_id"]},
    ).json()["data"]
    return session, outfit


class Provider:
    def __init__(self):
        self.calls = []

    async def generate(self, body, products, refs):
        self.calls.append((body.gender, [p.id for p in products], len(refs)))
        image = io.BytesIO()
        Image.new("RGB", (40, 60), "white").save(image, "PNG")
        return {key: image.getvalue() for key in ("FRONT", "LEFT", "RIGHT")}


def test_model_switch_never_reuses_job_or_active_result(studio):
    client, factory, _, garments, models, root = studio
    session, outfit = prepared_session(client, garments, models[0])

    def submit(session):
        response = client.post(
            "/api/v1/vell/try-ons",
            headers={"Idempotency-Key": str(uuid4())},
            json={
                "session_id": session["session_id"],
                "session_version": session["version"],
                "consent_external_processing": True,
            },
        )
        assert response.status_code == 202, response.text
        return response.json()["data"]

    female_job = submit(session)
    assert submit(session)["id"] == female_job["id"]
    session = client.patch(
        f"/api/v1/vell/sessions/{session['session_id']}",
        json={"version": session["version"], "model_id": models[1]["model_id"]},
    ).json()["data"]
    assert session["active_job_id"] is None
    male_job = submit(session)
    assert male_job["id"] != female_job["id"]
    provider = Provider()
    asyncio.run(run_once(factory, lambda _: provider))
    asyncio.run(run_once(factory, lambda _: provider))
    assert {call[0] for call in provider.calls} == {"FEMALE", "MALE"}
    assert all(
        set(call[1]) == {g["product_id"] for g in garments} and call[2] == 5
        for call in provider.calls
    )
    female = client.get(f"/api/v1/vell/try-on-results/{female_job['id']}").json()["data"]
    male = client.get(f"/api/v1/vell/try-on-results/{male_job['id']}").json()["data"]
    assert female["model_id"] == models[0]["model_id"]
    assert male["model_id"] == models[1]["model_id"] and male["outfit_id"] == outfit["outfit_id"]
    assert (
        client.get(f"/api/v1/vell/sessions/{session['session_id']}").json()["data"]["active_job_id"]
        == male_job["id"]
    )
    assert not list((root / "vell-inputs").rglob("*.json"))


def test_composition_and_verification_fail_closed(studio):
    client, factory, identity, garments, models, root = studio
    response = client.post(
        "/api/v1/vell/outfits/compose", json={"name": "Unverified", "garments": garments}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "PRODUCT_URL_UNVERIFIED"
    assert (
        client.post(
            "/api/v1/vell/outfits/compose", json={"name": "Missing pants", "garments": garments[:2]}
        ).status_code
        == 422
    )


def test_recommendation_preferences_and_revision(studio):
    client, factory, identity, garments, models, _ = studio
    session, outfit = prepared_session(client, garments, models[0])
    response = client.post(
        "/api/v1/vell/recommendations",
        json={
            "session_id": session["session_id"],
            "occasion": "DAILY",
            "style": "CASUAL",
            "budget_max_vnd": 1000,
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["context"]["occasion"] == "DAILY" and data["context"]["style"] == "CASUAL"
    assert data["outfits"]
    assert all(len(look["garments"]) == 4 for look in data["outfits"])
    assert (
        client.patch(
            "/api/v1/vell/preferences",
            json={"preferred_styles": ["CASUAL"], "budget_max_vnd": 5000},
        ).status_code
        == 200
    )
    assert client.get("/api/v1/vell/preferences").json()["data"]["budget_max_vnd"] == 5000
    response = client.patch(
        f"/api/v1/vell/outfits/{outfit['outfit_id']}/garments/INNER_TOP", json=garments[0]
    )
    assert response.status_code == 201, response.text
    revision = response.json()["data"]
    assert revision["revision"] == 2 and revision["outfit_id"] != outfit["outfit_id"]
    assert {g["product_id"] for g in revision["garments"]} == {
        g["product_id"] for g in outfit["garments"]
    }
    outfit = verified_outfit(client, garments)
    assert outfit["accordion"]["TOPS"]["count"] == 2
    assert outfit["accordion"]["BOTTOMS"]["count"] == 1
    product_id = garments[0]["product_id"]
    assert client.get(f"/api/v1/vell/products/{product_id}").json()["data"]["product_url"]
    with factory() as db:
        row = db.get(Product, product_id)
        row.product_url = "https://shopee.vn/different-product-i.123.999"
        db.commit()
    assert client.get(f"/api/v1/vell/products/{product_id}").json()["data"]["product_url"] is None
    identity.role = "USER"
    assert (
        client.post(
            f"/api/v1/vell/admin/products/{product_id}/verify",
            json={"retailer_sku": "forbidden", "evidence": "This is not an administrator."},
        ).status_code
        == 403
    )


def test_segmentation_review_shopping_and_saved_look(studio):
    client, factory, identity, garments, models, _ = studio
    session, outfit = prepared_session(client, garments, models[1])
    job = client.post(
        "/api/v1/vell/try-ons",
        headers={"Idempotency-Key": str(uuid4())},
        json={
            "session_id": session["session_id"],
            "session_version": session["version"],
            "consent_external_processing": True,
        },
    ).json()["data"]
    asyncio.run(run_once(factory, lambda _: Provider()))
    job_id = job["id"]
    assert client.post(f"/api/v1/vell/try-on-results/{job_id}/segmentation").status_code == 503
    assert client.get(f"/api/v1/vell/try-on-results/{job_id}/shopping-regions").status_code == 409
    with factory() as db:
        binding = db.get(JobBinding, job_id)
        binding.segmentation_status = "QUEUED"
        output_hash = binding.output_hash
        db.commit()

    class Segmenter:
        async def segment(self, result_id, image_hash, image, items):
            assert hashlib.sha256(image).hexdigest() == image_hash
            return SegmentationOutput(
                result_id=result_id,
                result_image_hash=image_hash,
                regions=[
                    {
                        "garment_id": item["garment_id"],
                        "product_id": item["product_id"],
                        "confidence": 0.9,
                        "polygon": [[0.1, 0.1], [0.3, 0.1], [0.35, 0.3], [0.2, 0.4], [0.1, 0.3]],
                    }
                    for item in items
                ],
            )

    asyncio.run(segment_once(factory, Segmenter))
    assert client.get(f"/api/v1/vell/try-on-results/{job_id}/shopping-regions").status_code == 409
    response = client.post(
        f"/api/v1/vell/admin/try-on-results/{job_id}/review",
        json={
            "approve": True,
            "evidence": "Test-only review of identity, full outfit and all region mappings.",
            "result_image_hash": output_hash,
        },
    )
    assert response.status_code == 200, response.text
    regions = client.get(f"/api/v1/vell/try-on-results/{job_id}/shopping-regions").json()["data"][
        "regions"
    ]
    assert {r["product_id"] for r in regions} == {g["product_id"] for g in garments}
    assert len({r["verified_product_url"] for r in regions}) == 4
    saved = client.post(
        "/api/v1/vell/saved-looks", json={"result_id": job_id, "name": "Test library"}
    ).json()["data"]
    detail = client.get(f"/api/v1/vell/saved-looks/{saved['saved_look_id']}").json()["data"]
    assert detail["result"]["model_id"] == models[1]["model_id"]
    with factory() as db:
        for record in db.scalars(select(ProductVerification)):
            record.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        db.commit()
    assert (
        client.get(f"/api/v1/vell/try-on-results/{job_id}/shopping-regions").json()["data"][
            "regions"
        ]
        == []
    )
    identity.id = str(uuid4())
    assert client.get(f"/api/v1/vell/saved-looks/{saved['saved_look_id']}").status_code == 404
    assert client.get(f"/api/v1/vell/try-on-results/{job_id}").status_code == 404


@pytest.mark.parametrize("change", ["foreign_result", "foreign_product", "outside", "rectangle"])
def test_segmentation_rejects_incorrect_mapping(change):
    region = {
        "garment_id": "g",
        "product_id": "p",
        "confidence": 0.9,
        "polygon": [[0.1, 0.1], [0.4, 0.1], [0.5, 0.3], [0.2, 0.5], [0.1, 0.3]],
    }
    result_id = "r"
    if change == "foreign_result":
        result_id = "other"
    if change == "foreign_product":
        region["product_id"] = "other"
    if change == "outside":
        region["polygon"][0] = [2, 2]
    if change == "rectangle":
        region["polygon"] = [[0, 0], [1, 0], [1, 1], [0, 1]]
    output = SegmentationOutput(result_id=result_id, result_image_hash="hash", regions=[region])
    from app.core.errors import AppError

    with pytest.raises(AppError):
        validate_regions(output, "r", "hash", [{"garment_id": "g", "product_id": "p"}])
