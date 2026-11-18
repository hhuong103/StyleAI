import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.errors import AppError
from app.db.models import Base, Category, Color, Product, ProductImage, Variant
from app.modules.catalog.repository import (
    ProductRepository,
    canonical_shopee_product_url,
    is_public_product_snapshot,
    is_shopee_product_url,
)


@pytest.fixture
def catalog_db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add(Category(code="SHIRT", label="Shirt", item_role="TOP", active=True))
        db.add(Color(code="WHITE", label="White", hex="#ffffff", family="NEUTRAL"))
        for product_code, source, price_source, url, image_key in [
            ("DEMO_SHIRT", "synthetic-v1", "DEMO", None, "demo/shirt.svg"),
            (
                "REAL_SHIRT",
                "merchant-feed",
                "REAL",
                "https://shopee.vn/real-shirt-i.123456789.12345678901",
                "uploads/real-shirt.webp",
            ),
            (
                "REAL_WITH_DEMO_IMAGE",
                "merchant-feed",
                "REAL",
                "https://shopee.vn/other-shirt-i.123456789.12345678902",
                "demo/shirt.svg",
            ),
        ]:
            db.add(
                Product(
                    product_code=product_code,
                    name=product_code,
                    category_code="SHIRT",
                    color_code="WHITE",
                    base_price_vnd=250000,
                    source=source,
                    price_source=price_source,
                    product_url=url,
                    images=[ProductImage(storage_key=image_key, alt_text=product_code)],
                    variants=[Variant(sku=f"{product_code}_M", size_code="M", available=True)],
                )
            )
        db.flush()
        yield db
    Base.metadata.drop_all(engine)
    engine.dispose()


def test_catalog_lists_all_products_but_recommendations_only_use_verified_products(catalog_db):
    repository = ProductRepository(catalog_db)

    products, total = repository.listing(page=1, page_size=20)
    candidates = repository.candidates({"categories": ["SHIRT"]}, {})

    assert total == 3
    assert {product["product_code"] for product in products} == {
        "DEMO_SHIRT",
        "REAL_SHIRT",
        "REAL_WITH_DEMO_IMAGE",
    }
    assert [product.product_code for product in candidates] == ["REAL_SHIRT"]
    demo = catalog_db.scalar(select(Product).where(Product.product_code == "DEMO_SHIRT"))
    with pytest.raises(AppError) as error:
        repository.get(demo.id)
    assert error.value.code == "NOT_FOUND"


def test_catalog_detail_is_available_for_demo_products(catalog_db):
    from types import SimpleNamespace

    from app.modules.catalog.router import detail

    demo = catalog_db.scalar(select(Product).where(Product.product_code == "DEMO_SHIRT"))
    request = SimpleNamespace(state=SimpleNamespace(request_id="test"))

    response = detail(demo.id, request, None, catalog_db)

    assert response["data"]["product_code"] == "DEMO_SHIRT"


@pytest.mark.parametrize(
    "url,valid",
    [
        ("https://shopee.vn/shirt-i.123456789.12345678901", True),
        ("https://www.shopee.vn/shirt-i.123456789.12345678901", True),
        ("https://shopee.vn/shirt-i.123456789.12345678901?sp_atk=abc&utm_source=share", True),
        ("https://www.shopee.vn/shirt-i.123456789.12345678901#share", True),
        ("HTTPS://SHOPEE.VN/shirt-i.123456789.12345678901?utm_source=share", True),
        ("https://shopee.vn/search?keyword=shirt", False),
        ("https://example.com/shirt-i.123456789.12345678901", False),
        ("http://shopee.vn/shirt-i.123456789.12345678901", False),
        ("https://user@shopee.vn/shirt-i.123456789.12345678901", False),
        ("https://shopee.vn:444/shirt-i.123456789.12345678901", False),
        ("https://[invalid/shirt-i.123456789.12345678901", False),
    ],
)
def test_shopee_product_urls_require_https_direct_item_path(url, valid):
    assert is_shopee_product_url(url) is valid


def test_share_url_is_stored_as_canonical_product_url():
    url = "https://www.shopee.vn/shirt-i.123456789.12345678901?sp_atk=abc#share"

    assert canonical_shopee_product_url(url) == "https://shopee.vn/shirt-i.123456789.12345678901"


def test_old_demo_snapshots_are_not_public():
    base = {
        "price_source": "REAL",
        "product_url": "https://shopee.vn/shirt-i.123456789.12345678901",
        "image": {"url": "/media/uploads/shirt.webp"},
    }

    assert is_public_product_snapshot(base)
    assert not is_public_product_snapshot({**base, "price_source": "DEMO"})
    assert not is_public_product_snapshot({**base, "image": {"url": "/media/demo/shirt.svg"}})
