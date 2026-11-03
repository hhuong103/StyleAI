"""Idempotent synthetic fixtures. Never represented as real retailer data."""

import argparse
import getpass
import json
import os
import shutil
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

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
from app.db.session import SessionLocal
from app.modules.auth.security import hasher
from app.modules.stylist.taxonomy import CATEGORIES, COLORS, OCCASIONS, RULES, STYLES, rule_slots

ILLUSTRATION_DESCRIPTION = (
    "Sản phẩm và giá mô phỏng để thử nghiệm hệ thống. "
    "Ảnh minh họa tự tạo, không phải hàng hóa đang bán."
)
PHOTO_DESCRIPTION = (
    "Sản phẩm và giá mô phỏng để thử nghiệm hệ thống. "
    "Ảnh chụp tham khảo từ Unsplash, phù hợp nhóm trang phục và màu sắc; "
    "không phải ảnh của hàng hóa đang bán."
)


def install_demo_photos():
    """Bundle selected reference photographs; seeding never needs network access."""
    source = Path(__file__).resolve().parents[1] / "assets" / "demo-photos"
    manifest = json.loads((source / "manifest.json").read_text(encoding="utf-8"))
    target = settings.media_root / "demo" / "photos"
    target.mkdir(parents=True, exist_ok=True)
    photos = {}
    for entry in manifest:
        shutil.copyfile(source / entry["file"], target / entry["file"])
        entry = {**entry, "key": f"demo/photos/{entry['file']}"}
        for color in entry["colors"]:
            photos[entry["category"], color] = entry
    return photos


def apply_demo_photo(product, photo):
    """Upgrade original fixtures only. Preserve manually replaced/uploaded images."""
    original = f"demo/{product.category_code.lower()}-{product.color_code.lower()}.svg"
    if (
        product.source != "synthetic-v1"
        or product.price_source != "DEMO"
        or len(product.images) != 1
        or product.images[0].storage_key != original
        or product.images[0].attribution != "Original code-generated illustration; demo only"
    ):
        return False
    image = product.images[0]
    image.storage_key = photo["key"]
    image.alt_text = photo["alt"]
    image.source_url = photo["source_url"]
    image.attribution = photo["attribution"]
    if product.description == ILLUSTRATION_DESCRIPTION:
        product.description = PHOTO_DESCRIPTION
    return True


def illustration(category, color):
    role = CATEGORIES[category][1]
    if role == "TOP":
        shape = '<path d="M155 116 112 133 66 209 113 240 145 199 145 383 295 383 295 199 327 240 374 209 328 133 285 116 254 151 186 151Z"/>'
        detail = '<path d="M186 151q34 34 68 0M159 365h122"/>'
        if category in ["SHIRT", "BLOUSE", "POLO"]:
            detail += '<path d="m186 122 34 45 34-45M220 167v213M186 122l-8 53 42-8 42 8-8-53"/><path d="M229 200v2m0 30v2m0 30v2m0 30v2m0 30v2"/>'
    elif role == "BOTTOM":
        shape = (
            '<path d="M144 94h152l14 99-18 232h-66l-6-196-9 196h-66l-16-232Z"/>'
            if category != "SKIRT"
            else '<path d="M153 118h134l44 267H109Z"/>'
        )
        detail = '<path d="M148 116h144M220 118v94m-67-64 31 19m102-19-31 19M145 403h66m15 0h66"/>'
    elif role == "OUTERWEAR":
        shape = '<path d="m162 97-48 28-50 230 57 19 30-153-8 201h154l-8-201 30 153 57-19-50-230-48-28-58 42Z"/>'
        detail = '<path d="m184 105 36 34-50 94 50 33m36-161-36 34 50 94-50 33v156M163 310h35m44 0h35M228 286v4m0 31v4m0 31v4"/>'
    else:
        shape = '<path d="m94 245 22-100 93 24 32 75 114 57q33 25 9 59H83q-22-24-10-48Z"/><path d="m116 145 20-15 86 24-13 15Z"/>'
        detail = '<path d="M83 342h280M211 224l-32 11m47 11-30 13m50 8-29 13M98 251l45 15 28 62"/>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="440" height="520" viewBox="0 0 440 520"><defs><filter id="s"><feDropShadow dx="0" dy="12" stdDeviation="10" flood-opacity=".10"/></filter></defs><rect width="440" height="520" fill="#edeae4"/><ellipse cx="220" cy="455" rx="136" ry="15" fill="#d7d1c6" opacity=".4"/><g fill="{color}" stroke="#191919" stroke-opacity=".25" stroke-width="2" stroke-linejoin="round" filter="url(#s)">{shape}</g><g fill="none" stroke="#111" stroke-opacity=".28" stroke-width="2">{detail}</g></svg>'


def seed(db, editions=5):
    for code, (label, role, _) in CATEGORIES.items():
        if not db.get(Category, code):
            db.add(Category(code=code, label=label, item_role=role))
    for cls, mapping in [(Style, STYLES), (Occasion, OCCASIONS)]:
        for code, label in mapping.items():
            if not db.get(cls, code):
                db.add(cls(code=code, label=label))
    for code, (label, hex_value, family) in COLORS.items():
        if not db.get(Color, code):
            db.add(Color(code=code, label=label, hex=hex_value, family=family))
    db.flush()
    for occasion, style, categories in RULES:
        key = f"{occasion}_{style}".lower()
        if not db.scalar(select(OutfitRule).where(OutfitRule.rule_key == key)):
            db.add(
                OutfitRule(
                    rule_key=key,
                    occasion_code=occasion,
                    style_code=style,
                    slots=rule_slots(categories),
                    active=True,
                )
            )
    db.flush()
    keys = set(db.scalars(select(Product.product_code)))
    photos = install_demo_photos()
    updated_images = 0
    existing_demo = db.scalars(
        select(Product)
        .where(Product.source == "synthetic-v1", Product.price_source == "DEMO")
        .options(selectinload(Product.images))
    )
    for product in existing_demo:
        photo = photos.get((product.category_code, product.color_code))
        if photo and apply_demo_photo(product, photo):
            updated_images += 1
    root = settings.media_root / "demo"
    root.mkdir(parents=True, exist_ok=True)
    created = 0
    for category, (label, _, base) in CATEGORIES.items():
        matching = [
            (o, s)
            for o, s, categories in RULES
            if any(category in c.split("/") for c in categories)
        ]
        for color, (color_label, hex_value, _) in COLORS.items():
            key = f"demo/{category.lower()}-{color.lower()}.svg"
            (settings.media_root / key).write_text(illustration(category, hex_value))
            for edition in range(editions):
                code = f"DEMO_{category}_{color}_{edition + 1:02}"
                if code in keys:
                    continue
                product = Product(
                    product_code=code,
                    name=f"{label} {color_label.lower()} — Edit {edition + 1:02}",
                    brand="STYLEAI Studio",
                    category_code=category,
                    color_code=color,
                    gender="FEMALE" if category in ["SKIRT", "BLOUSE", "FLATS"] else "UNISEX",
                    base_price_vnd=base + edition * 45000,
                    source="synthetic-v1",
                    price_source="DEMO",
                    description=ILLUSTRATION_DESCRIPTION,
                    variants=[
                        Variant(sku=code + "_ONE", size_code="ONE_SIZE", available=edition != 4)
                    ],
                    images=[
                        ProductImage(
                            storage_key=key,
                            alt_text=f"Minh họa {label.lower()} {color_label.lower()}",
                            attribution="Original code-generated illustration; demo only",
                        )
                    ],
                    styles=[
                        ProductStyle(style_code=s)
                        for s in sorted({s for _, s in matching} or {"CASUAL"})
                    ],
                    occasions=[
                        ProductOccasion(occasion_code=o)
                        for o in sorted({o for o, _ in matching} or {"DAILY"})
                    ],
                )
                photo = photos.get((category, color))
                if photo:
                    apply_demo_photo(product, photo)
                db.add(product)
                created += 1
    db.flush()
    total = db.scalar(select(func.count()).select_from(Product))
    return {
        "source": "synthetic-v1",
        "created": created,
        "products": total,
        "image_files": len(CATEGORIES) * len(COLORS) + len({p['key'] for p in photos.values()}),
        "photo_files": len({p['key'] for p in photos.values()}),
        "updated_images": updated_images,
        "license": "Synthetic metadata/original illustrations; selected reference photos under Unsplash License. Not a real product dataset.",
        "rules": len(RULES),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["demo", "create-admin"])
    parser.add_argument("--email")
    args = parser.parse_args()
    with SessionLocal.begin() as db:
        if args.command == "demo":
            report = seed(db)
            settings.media_root.mkdir(parents=True, exist_ok=True)
            (settings.media_root / "seed-report.json").write_text(json.dumps(report, indent=2))
            print(json.dumps(report, ensure_ascii=False))
        else:
            email = (args.email or input("Admin email: ")).strip().lower()
            password = os.getenv("ADMIN_PASSWORD") or getpass.getpass(
                "Admin password (12+ characters): "
            )
            from app.core.schemas import Register

            credentials = Register(email=email, password=password, display_name="Administrator")
            if db.scalar(select(User).where(User.email == str(credentials.email).lower())):
                raise SystemExit("Email already exists; no account changed")
            user = User(
                email=str(credentials.email).lower(),
                password_hash=hasher.hash(password),
                role="ADMIN",
            )
            db.add(user)
            db.flush()
            db.add_all(
                [
                    Profile(user_id=user.id, display_name="Administrator"),
                    Preference(user_id=user.id),
                ]
            )
            print("Admin created")


if __name__ == "__main__":
    main()
