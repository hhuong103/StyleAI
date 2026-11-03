import csv
import hashlib
import io
import json
import warnings

from fastapi import APIRouter, Depends, File, Request, Response, UploadFile
from PIL import Image, UnidentifiedImageError
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError, result
from app.core.schemas import Envelope, ProductCreate, RuleInput, TaxonomyInput
from app.db.models import (
    CatalogImport,
    Category,
    Color,
    Feedback,
    Occasion,
    Outfit,
    OutfitRule,
    Product,
    Recommendation,
    Style,
    User,
    Variant,
    uid,
)
from app.db.session import get_db
from app.modules.auth.security import admin_user
from app.modules.catalog.repository import ProductRepository
from app.modules.catalog.router import audit
from app.modules.catalog.service import safe_media_path, validate_product, write_product
from app.modules.profiles.router import validate_codes

router = APIRouter(prefix="/admin", tags=["Administration"])
TAXONOMIES = {"categories": Category, "colors": Color, "styles": Style, "occasions": Occasion}


@router.get("/summary", response_model=Envelope[dict])
def summary(
    request: Request,
    user: User = Depends(admin_user),
    db: Session = Depends(get_db, scope="function"),
):
    def count(cls, *conditions):
        return db.scalar(select(func.count()).select_from(cls).where(*conditions))

    return result(
        request,
        {
            "users": count(User, User.status == "ACTIVE"),
            "products": count(Product, Product.active.is_(True)),
            "outfits": count(Outfit, Outfit.deleted_at.is_(None)),
            "recommendations": count(Recommendation),
            "likes": count(Feedback, Feedback.value == "LIKE"),
            "dislikes": count(Feedback, Feedback.value == "DISLIKE"),
        },
    )


@router.post("/uploads/images", status_code=201, response_model=Envelope[dict])
def upload_image(
    request: Request,
    file: UploadFile = File(...),
    user: User = Depends(admin_user),
    db: Session = Depends(get_db, scope="function"),
):
    raw = file.file.read(5 * 1024 * 1024 + 1)
    if len(raw) > 5 * 1024 * 1024:
        raise AppError(413, "IMAGE_TOO_LARGE", "Ảnh tối đa 5 MB.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            image = Image.open(io.BytesIO(raw))
            if image.format not in {"JPEG", "PNG", "WEBP"}:
                raise ValueError("Unsupported image")
            if max(image.size) > 4096 or min(image.size) < 1:
                raise ValueError("Image dimensions exceeded")
            image.load()
            key = f"uploads/{uid()}.webp"
            path = settings.media_root / key
            path.parent.mkdir(parents=True, exist_ok=True)
            image.convert("RGB").save(path, "WEBP", quality=85)
    except (
        UnidentifiedImageError,
        ValueError,
        OSError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ):
        raise AppError(
            415, "INVALID_IMAGE", "Chỉ nhận JPEG/PNG/WebP hợp lệ, tối đa 4096×4096."
        ) from None
    audit(db, request, user, "UPLOAD_IMAGE", "IMAGE", key)
    return result(
        request,
        {"storage_key": key, "url": f"/media/{key}", "width": image.width, "height": image.height},
    )


def parse_catalog(raw, filename):
    if filename.lower().endswith(".json"):
        values = json.loads(raw)
        if not isinstance(values, list):
            raise ValueError("JSON must be an array")
        return values
    if not filename.lower().endswith(".csv"):
        raise AppError(415, "INVALID_FILE_TYPE", "Chỉ nhận CSV hoặc JSON.")
    records = list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))))
    products = {}
    for row in records:
        code = row["product_code"]
        data = {
            key: row[key]
            for key in ["product_code", "name", "category_code", "color_code", "image_key"]
        }
        data.update(
            brand=row.get("brand") or None,
            gender=row.get("gender") or "UNISEX",
            base_price_vnd=int(row["base_price_vnd"]),
            description=row.get("description", ""),
            price_source=row.get("price_source") or "DEMO",
            styles=[c for c in row.get("styles", "").split(";") if c],
            occasions=[c for c in row.get("occasions", "").split(";") if c],
        )
        if code not in products:
            products[code] = {**data, "variants": []}
        elif {k: v for k, v in products[code].items() if k != "variants"} != data:
            raise ValueError(f"Conflicting product metadata: {code}")
        products[code]["variants"].append(
            {
                "sku": row["sku"],
                "size_code": row.get("size_code") or "ONE_SIZE",
                "available": row.get("available", "true").lower() in ["true", "1", "yes"],
                "price_override_vnd": int(row["price_override_vnd"])
                if row.get("price_override_vnd")
                else None,
            }
        )
    return list(products.values())


@router.post("/catalog-imports/validate", response_model=Envelope[dict])
def validate_import(
    request: Request,
    file: UploadFile = File(...),
    user: User = Depends(admin_user),
    db: Session = Depends(get_db, scope="function"),
):
    raw = file.file.read(10 * 1024 * 1024 + 1)
    if len(raw) > 10 * 1024 * 1024:
        raise AppError(413, "IMPORT_TOO_LARGE", "File tối đa 10 MB.")
    try:
        records = parse_catalog(raw, file.filename or "")
        if not 0 < len(records) <= 5000:
            raise ValueError("Import requires 1–5000 products")
    except (ValueError, KeyError, UnicodeDecodeError):
        raise AppError(
            422, "INVALID_IMPORT", "File không đúng schema hoặc vượt giới hạn 5.000 sản phẩm."
        ) from None
    clean, errors, codes, skus = [], [], set(), set()
    for idx, row in enumerate(records, 1):
        try:
            body = ProductCreate.model_validate(row)
            validate_product(db, body)
            if body.product_code in codes or len({v.size_code for v in body.variants}) != len(
                body.variants
            ):
                raise ValueError("Duplicate product code or size")
            for v in body.variants:
                if v.sku in skus:
                    raise ValueError("Duplicate SKU")
                skus.add(v.sku)
            codes.add(body.product_code)
            clean.append(body.model_dump())
        except (ValidationError, AppError, ValueError) as exc:
            errors.append(
                {
                    "row": idx,
                    "message": exc.message if isinstance(exc, AppError) else str(exc)[:300],
                }
            )
    key = f"imports/{uid()}.json"
    path = settings.media_root / key
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(clean).encode()
    path.write_bytes(content)
    job = CatalogImport(
        user_id=user.id,
        file_key=key,
        checksum=hashlib.sha256(content).hexdigest(),
        status="FAILED" if errors else "VALIDATED",
        counts={"records": len(records), "valid": len(clean), "errors": len(errors)},
        report={"errors": errors},
    )
    db.add(job)
    db.flush()
    return result(
        request, {"import_id": job.id, "status": job.status, **job.counts, "errors": errors}
    )


def import_job(db, import_id):
    job = db.scalar(select(CatalogImport).where(CatalogImport.id == import_id).with_for_update())
    if not job:
        raise AppError(404, "NOT_FOUND", "Không tìm thấy lần import.")
    return job


@router.get("/catalog-imports/{import_id}", response_model=Envelope[dict])
def import_status(
    import_id: str,
    request: Request,
    user: User = Depends(admin_user),
    db: Session = Depends(get_db, scope="function"),
):
    job = import_job(db, import_id)
    return result(request, {"import_id": job.id, "status": job.status, **job.counts, **job.report})


@router.post("/catalog-imports/{import_id}/commit", response_model=Envelope[dict])
def commit_import(
    import_id: str,
    request: Request,
    user: User = Depends(admin_user),
    db: Session = Depends(get_db, scope="function"),
):
    job = import_job(db, import_id)
    if job.status == "IMPORTED":
        return result(request, {"import_id": job.id, "status": job.status, **job.counts})
    if job.status != "VALIDATED":
        raise AppError(409, "IMPORT_NOT_VALID", "Cần sửa lỗi validation trước khi import.")
    raw = safe_media_path(job.file_key).read_bytes()
    if hashlib.sha256(raw).hexdigest() != job.checksum:
        raise AppError(409, "IMPORT_CHANGED", "Nội dung file đã thay đổi.")
    for record in json.loads(raw):
        body = ProductCreate.model_validate(record)
        product = db.scalar(
            select(Product).where(Product.product_code == body.product_code).with_for_update()
        )
        if product:
            from app.core.schemas import ProductInput

            write_product(db, ProductInput(**body.model_dump(exclude={"variants"})), product)
            for variant in body.variants:
                old = db.scalar(select(Variant).where(Variant.sku == variant.sku).with_for_update())
                if old and (old.product_id != product.id or old.size_code != variant.size_code):
                    raise AppError(409, "SKU_CONFLICT", "SKU đã thuộc sản phẩm/size khác.")
                if not old:
                    if any(v.size_code == variant.size_code for v in product.variants):
                        raise AppError(409, "SIZE_CONFLICT", "Size đã tồn tại với SKU khác.")
                    old = Variant(product_id=product.id, **variant.model_dump())
                    db.add(old)
                else:
                    for key, value in variant.model_dump().items():
                        setattr(old, key, value)
        else:
            write_product(db, body)
        db.flush()
    job.status, job.catalog_version = "IMPORTED", f"import-{job.id}"
    audit(db, request, user, "IMPORT", "CATALOG_IMPORT", job.id, job.counts)
    return result(request, {"import_id": job.id, "status": job.status, **job.counts})


@router.get("/taxonomy", response_model=Envelope[dict])
def all_taxonomy(
    request: Request,
    user: User = Depends(admin_user),
    db: Session = Depends(get_db, scope="function"),
):
    return result(
        request,
        {
            name: [
                {c.name: getattr(row, c.name) for c in cls.__table__.columns}
                for row in db.scalars(select(cls).order_by(cls.code))
            ]
            for name, cls in TAXONOMIES.items()
        },
    )


def write_taxonomy(db, kind, body, code=None):
    cls = TAXONOMIES.get(kind)
    if not cls:
        raise AppError(404, "NOT_FOUND", "Loại taxonomy không hợp lệ.")
    if code and body.code != code:
        raise AppError(422, "IMMUTABLE_CODE", "Không thể đổi code đã tạo.")
    row = db.get(cls, code or body.code)
    if code and not row:
        raise AppError(404, "NOT_FOUND", "Không tìm thấy taxonomy.")
    if not code and row:
        raise AppError(409, "CODE_EXISTS", "Code đã tồn tại.")
    values = body.model_dump()
    if kind == "categories":
        if not body.item_role:
            raise AppError(422, "ROLE_REQUIRED", "Category cần item_role.")
        ancestor = body.parent_code
        seen = {body.code}
        while ancestor:
            if ancestor in seen:
                raise AppError(422, "CATEGORY_CYCLE", "Cây category có vòng lặp.")
            seen.add(ancestor)
            parent = db.get(Category, ancestor)
            if not parent or parent.item_role != body.item_role:
                raise AppError(422, "INVALID_PARENT", "Parent category không hợp lệ.")
            ancestor = parent.parent_code
        if body.parent_code and db.scalar(
            select(Product.id).where(Product.category_code == body.parent_code).limit(1)
        ):
            raise AppError(
                409,
                "PARENT_HAS_PRODUCTS",
                "Không thêm category con vào category đang chứa sản phẩm.",
            )
        if (
            row
            and row.item_role != body.item_role
            and db.scalar(select(Product.id).where(Product.category_code == row.code).limit(1))
        ):
            raise AppError(409, "CATEGORY_IN_USE", "Không đổi role của category đang có sản phẩm.")
    if kind == "colors" and (not body.hex or not body.family):
        raise AppError(422, "COLOR_FIELDS_REQUIRED", "Color cần hex và family.")
    if not row:
        row = cls()
        db.add(row)
    for column in cls.__table__.columns:
        if column.name in values:
            setattr(row, column.name, values[column.name])
    db.flush()
    return {c.name: getattr(row, c.name) for c in cls.__table__.columns}


@router.post("/taxonomy/{kind}", status_code=201, response_model=Envelope[dict])
def add_taxonomy(
    kind: str,
    body: TaxonomyInput,
    request: Request,
    user: User = Depends(admin_user),
    db: Session = Depends(get_db, scope="function"),
):
    data = write_taxonomy(db, kind, body)
    audit(db, request, user, "CREATE_TAXONOMY", kind, body.code)
    return result(request, data)


@router.put("/taxonomy/{kind}/{code}", response_model=Envelope[dict])
def update_taxonomy(
    kind: str,
    code: str,
    body: TaxonomyInput,
    request: Request,
    user: User = Depends(admin_user),
    db: Session = Depends(get_db, scope="function"),
):
    data = write_taxonomy(db, kind, body, code)
    audit(db, request, user, "UPDATE_TAXONOMY", kind, code)
    return result(request, data)


@router.delete("/taxonomy/{kind}/{code}", status_code=204)
def delete_taxonomy(
    kind: str,
    code: str,
    request: Request,
    user: User = Depends(admin_user),
    db: Session = Depends(get_db, scope="function"),
):
    cls = TAXONOMIES.get(kind)
    row = db.get(cls, code) if cls else None
    if not row:
        raise AppError(404, "NOT_FOUND", "Không tìm thấy taxonomy.")
    row.active = False
    audit(db, request, user, "DEACTIVATE_TAXONOMY", kind, code)
    return Response(status_code=204)


def rule_data(row):
    return {
        "id": row.id,
        "rule_key": row.rule_key,
        "version": row.version,
        "occasion_code": row.occasion_code,
        "style_code": row.style_code,
        "gender": row.gender,
        "slots": row.slots,
        "active": row.active,
        "priority": row.priority,
    }


@router.get("/outfit-rules", response_model=Envelope[list[dict]])
def rules(
    request: Request,
    user: User = Depends(admin_user),
    db: Session = Depends(get_db, scope="function"),
):
    return result(
        request,
        [
            rule_data(r)
            for r in db.scalars(
                select(OutfitRule).order_by(OutfitRule.rule_key, OutfitRule.version.desc())
            )
        ],
    )


@router.post("/outfit-rules", status_code=201, response_model=Envelope[dict])
def create_rule(
    body: RuleInput,
    request: Request,
    user: User = Depends(admin_user),
    db: Session = Depends(get_db, scope="function"),
):
    validate_codes(db, Occasion, [body.occasion_code])
    if body.style_code:
        validate_codes(db, Style, [body.style_code])
    for slot in body.slots:
        validate_codes(db, Category, slot.categories)
        if any(db.get(Category, c).item_role != slot.role for c in slot.categories):
            raise AppError(422, "CATEGORY_ROLE_MISMATCH", "Category không đúng role.")
    version = (
        db.scalar(select(func.max(OutfitRule.version)).where(OutfitRule.rule_key == body.rule_key))
        or 0
    ) + 1
    row = OutfitRule(**body.model_dump(), version=version, active=False)
    db.add(row)
    db.flush()
    audit(db, request, user, "CREATE_RULE", "RULE", row.id)
    return result(request, rule_data(row))


@router.post("/outfit-rules/{rule_id}/publish", response_model=Envelope[dict])
def publish(
    rule_id: str,
    request: Request,
    user: User = Depends(admin_user),
    db: Session = Depends(get_db, scope="function"),
):
    row = db.scalar(select(OutfitRule).where(OutfitRule.id == rule_id).with_for_update())
    if not row:
        raise AppError(404, "NOT_FOUND", "Không tìm thấy rule.")
    missing = [
        s["slot_key"]
        for s in row.slots
        if not ProductRepository(db).candidates(s, {"gender": row.gender})
    ]
    if missing:
        raise AppError(
            409,
            "RULE_COVERAGE_MISSING",
            "Catalog chưa đủ cho rule này.",
            {"missing_slots": missing},
        )
    for previous in db.scalars(
        select(OutfitRule).where(OutfitRule.rule_key == row.rule_key).with_for_update()
    ):
        previous.active = previous.id == row.id
    audit(db, request, user, "PUBLISH_RULE", "RULE", row.id)
    return result(request, rule_data(row))
