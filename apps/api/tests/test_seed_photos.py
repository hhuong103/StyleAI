from sqlalchemy import select

from app.db.models import Product
from app.seed import ILLUSTRATION_DESCRIPTION, PHOTO_DESCRIPTION, seed


def test_bundled_photo_is_publicly_served_as_webp(client):
    response = client.get("/media/demo/photos/shirt-white.webp")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/webp"
    assert response.content[:4] == b"RIFF"


def test_demo_photo_upgrade_preserves_identity_and_is_idempotent(db):
    product = db.scalar(select(Product).where(Product.product_code == "DEMO_SHIRT_WHITE_01"))
    original_id, variant_id, price = product.id, product.variants[0].id, product.base_price_vnd
    product.images[0].storage_key = "demo/shirt-white.svg"
    product.images[0].attribution = "Original code-generated illustration; demo only"
    product.description = ILLUSTRATION_DESCRIPTION
    db.flush()

    first = seed(db)
    assert first["created"] == 0
    assert first["updated_images"] == 1
    assert product.images[0].storage_key == "demo/photos/shirt-white.webp"
    assert product.images[0].source_url.startswith("https://images.unsplash.com/")
    assert product.description == PHOTO_DESCRIPTION
    assert (product.id, product.variants[0].id, product.base_price_vnd) == (
        original_id, variant_id, price
    )
    assert seed(db)["updated_images"] == 0


def test_demo_seed_preserves_uploaded_images_and_non_demo_records(db):
    custom = db.scalar(select(Product).where(Product.product_code == "DEMO_SHIRT_WHITE_01"))
    custom.images[0].storage_key = "uploads/my-shirt.webp"
    custom.images[0].attribution = "My own photography"
    custom.description = "My description"
    imported = db.scalar(select(Product).where(Product.product_code == "DEMO_SHIRT_WHITE_02"))
    imported.source = "merchant-import"
    imported.images[0].storage_key = "demo/shirt-white.svg"
    imported.images[0].attribution = "Original code-generated illustration; demo only"
    db.flush()

    report = seed(db)
    assert report["updated_images"] == 0
    assert custom.images[0].storage_key == "uploads/my-shirt.webp"
    assert custom.description == "My description"
    assert imported.images[0].storage_key == "demo/shirt-white.svg"
