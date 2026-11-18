from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, func, select, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.models import Category, Color, OutfitRule, Product, ProductImage, Variant
from app.db.session import Base, get_db
from app.main import app
from app.modules.vell import integration_service
from app.modules.vell.integration_repository import schema_head


@pytest.fixture
def integrated():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        conn.execute(text("INSERT INTO alembic_version VALUES (:head)"), {"head": schema_head()})
    with factory() as db:
        db.add(Category(code="T_SHIRT", label="Test top", item_role="TOP"))
        db.add(Color(code="BLACK", label="Black", hex="#000000", family="NEUTRAL"))
        db.flush()
        db.add(
            Product(
                product_code="TEST_DEMO_ONLY",
                name="Test fixture only",
                category_code="T_SHIRT",
                color_code="BLACK",
                base_price_vnd=1,
                price_source="DEMO",
                source="synthetic-v1",
            )
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
    with TestClient(app) as client:
        yield client, factory, engine
    app.dependency_overrides.clear()
    engine.dispose()


def test_public_health_config_and_capabilities_do_not_expose_secrets(integrated, monkeypatch):
    client, _, _ = integrated
    monkeypatch.setattr(
        integration_service,
        "settings",
        replace(integration_service.settings, gemini_api_key="secret-test-only-key"),
    )
    monkeypatch.setattr(integration_service, "model_ready", lambda: True)
    response = client.get("/api/v1/vell/health")
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "ready"
    assert "request_id" in response.json()["meta"]
    config = client.get("/api/v1/vell/config")
    assert config.status_code == 200 and "secret-test-only-key" not in config.text
    assert config.json()["data"]["legacy_redirects"] == {"/shop": "/vell"}
    assert config.json()["data"]["frontend_route"] == "/vell"
    caps = client.get("/api/v1/vell/capabilities").json()["data"]
    assert caps["virtual_try_on"]["configured"] is True
    assert caps["virtual_try_on"]["available"] is False
    assert "PROVIDER_NOT_VERIFIED" in caps["virtual_try_on"]["reasons"]
    assert caps["recommendation"]["available"] is False
    assert caps["garment_segmentation"]["implemented"] is True
    assert caps["garment_segmentation"]["available"] is False
    assert caps["shopping_links"]["available"] is False
    assert caps["model_selection"]["available"] is False
    assert client.get("/api/v1/vell/config").headers["cache-control"] == "no-store"


def test_missing_ai_config_and_reference_are_not_advertised(integrated, monkeypatch):
    client, _, _ = integrated
    monkeypatch.setattr(
        integration_service,
        "settings",
        replace(integration_service.settings, gemini_api_key="", gemini_image_model=""),
    )
    monkeypatch.setattr(integration_service, "model_ready", lambda: False)
    assert client.get("/api/v1/vell/config").json()["data"]["model_presets"] == []
    ai = client.get("/api/v1/vell/capabilities").json()["data"]["virtual_try_on"]
    assert ai["configured"] is False and ai["available"] is False
    assert {"PROVIDER_KEY_MISSING", "PROVIDER_MODEL_MISSING", "MODEL_REFERENCE_MISSING"} <= set(
        ai["reasons"]
    )


def test_legacy_apis_and_catalog_data_remain_unchanged(integrated):
    client, factory, engine = integrated
    with factory() as db:
        product_id = db.scalar(select(Product.id))
    paths = [
        "/api/v1/products",
        f"/api/v1/products/{product_id}",
        "/api/v1/taxonomy",
        "/health/live",
    ]
    before = {path: client.get(path).json() for path in paths}
    statements = []

    def capture(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement.lstrip().split()[0].upper())

    event.listen(engine, "before_cursor_execute", capture)
    for path in ("health", "config", "capabilities"):
        assert client.get(f"/api/v1/vell/{path}").status_code == 200
    event.remove(engine, "before_cursor_execute", capture)
    assert not ({"INSERT", "UPDATE", "DELETE", "DROP", "ALTER"} & set(statements))
    for path in paths:
        response = client.get(path)
        assert response.status_code == 200
        assert response.json().get("data", response.json()) == before[path].get(
            "data", before[path]
        )
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(Product)) == 1
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.get("/api/v1/recommendations").status_code == 401
    assert client.get("/api/v1/outfits").status_code == 401
    assert client.get("/api/v1/vell/try-on").status_code == 401
    assert client.get("/api/v1/products?page=0").status_code == 422


def test_health_fails_safely_for_missing_or_outdated_schema(integrated):
    client, _, engine = integrated
    with engine.begin() as conn:
        conn.execute(text("UPDATE alembic_version SET version_num='0005'"))
    assert client.get("/api/v1/vell/health").status_code == 503
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE alembic_version"))
    response = client.get("/api/v1/vell/capabilities")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "VELL_NOT_READY"
    assert "SELECT" not in response.text
    assert client.get("/api/v1/vell/config").status_code == 200
    assert client.get("/health/live").status_code == 200


def test_manual_links_and_rule_engine_require_eligible_catalog(integrated):
    client, factory, _ = integrated
    with factory() as db:
        # Isolated test fixture only; no merchant inventory is imported by this test.
        product = db.scalar(select(Product))
        product.price_source = "REAL"
        product.source = "unit-test-fixture"
        product.product_url = "https://shopee.vn/test-fixture-i.123.456"
        product.images = [ProductImage(storage_key="uploads/test-fixture.webp", alt_text="Test")]
        product.variants = [Variant(sku="TEST_ONLY", size_code="M", available=True)]
        db.add(OutfitRule(rule_key="test_rule", occasion_code="DAILY", slots=[], active=True))
        db.commit()
    caps = client.get("/api/v1/vell/capabilities").json()["data"]
    assert caps["shopping_links"]["available"] is False
    assert "VERIFIED_CATALOG_REQUIRED" in caps["shopping_links"]["reasons"]
    assert caps["recommendation"]["available"] is False
    with factory() as db:
        product = db.scalar(select(Product))
        product.product_url = "https://shopee.vn/search?keyword=unverified"
        db.commit()
    assert (
        client.get("/api/v1/vell/capabilities").json()["data"]["shopping_links"]["available"]
        is False
    )


def test_namespace_has_unique_routes_and_keeps_job_contract(integrated):
    client, _, _ = integrated
    paths = client.get("/openapi.json").json()["paths"]
    for path in ("health", "config", "capabilities"):
        assert "get" in paths[f"/api/v1/vell/{path}"]
    assert "post" in paths["/api/v1/vell/try-on"]
    assert "get" in paths["/api/v1/vell/try-on/{job_id}"]
    assert "post" in paths["/api/v1/vell/try-on/{job_id}/cancel"]
    assert not any("/vell/vell/" in path or "/api/v1/api/v1/" in path for path in paths)
