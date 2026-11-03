from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError, result
from app.core.outputs import ProductOutput
from app.core.schemas import Envelope, ProductCreate, ProductInput, VariantCreate, VariantUpdate
from app.db.models import AdminAudit, Category, Color, Occasion, Style, User, Variant
from app.db.session import get_db
from app.modules.auth.security import admin_user, optional_user
from app.modules.catalog.repository import ProductRepository, product_data
from app.modules.catalog.service import write_product

router = APIRouter(tags=["Catalog"])


def audit(db, request, user, action, entity_type, entity_id, changes=None):
    db.add(
        AdminAudit(
            actor_id=user.id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            request_id=request.state.request_id,
            changes=changes or {},
        )
    )


@router.get("/taxonomy", response_model=Envelope[dict])
def taxonomy(
    request: Request,
    db: Session = Depends(get_db, scope="function"),
):
    output = {}
    for name, cls in [
        ("categories", Category),
        ("styles", Style),
        ("occasions", Occasion),
        ("colors", Color),
    ]:
        output[name] = [
            {c.name: getattr(row, c.name) for c in cls.__table__.columns}
            for row in db.scalars(select(cls).where(cls.active.is_(True)).order_by(cls.code))
        ]
    return result(request, output)


@router.get("/products", response_model=Envelope[list[ProductOutput]])
def listing(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    q: str | None = Query(None, max_length=100),
    category: str | None = None,
    gender: Literal["MALE", "FEMALE", "UNISEX"] | None = None,
    color: str | None = None,
    styles: str | None = None,
    occasions: str | None = None,
    min_price_vnd: int | None = Query(None, ge=0),
    max_price_vnd: int | None = Query(None, ge=0),
    available: bool | None = None,
    sort: str = "newest",
    include_inactive: bool = False,
    user: User | None = Depends(optional_user),
    db: Session = Depends(get_db, scope="function"),
):
    if include_inactive and (user is None or user.role != "ADMIN"):
        raise AppError(403, "FORBIDDEN", "Chỉ quản trị viên được xem sản phẩm ngừng bán.")
    if min_price_vnd is not None and max_price_vnd is not None and min_price_vnd > max_price_vnd:
        raise AppError(422, "INVALID_PRICE_RANGE", "Khoảng giá không hợp lệ.")
    data, total = ProductRepository(db).listing(
        page=page,
        page_size=page_size,
        q=q,
        category=category,
        gender=gender,
        color=color,
        styles=styles,
        occasions=occasions,
        min_price_vnd=min_price_vnd,
        max_price_vnd=max_price_vnd,
        available=available,
        sort=sort,
        include_inactive=include_inactive,
    )
    return result(request, data, page=page, page_size=page_size, total=total)


@router.get("/products/{product_id}", response_model=Envelope[ProductOutput])
def detail(
    product_id: str,
    request: Request,
    user: User | None = Depends(optional_user),
    db: Session = Depends(get_db, scope="function"),
):
    return result(
        request,
        product_data(
            ProductRepository(db).get(product_id, user is not None and user.role == "ADMIN")
        ),
    )


@router.post("/products", status_code=201, response_model=Envelope[ProductOutput])
def create(
    body: ProductCreate,
    request: Request,
    user: User = Depends(admin_user),
    db: Session = Depends(get_db, scope="function"),
):
    product = write_product(db, body)
    audit(db, request, user, "CREATE", "PRODUCT", product.id)
    return result(request, product_data(product))


@router.put("/products/{product_id}", response_model=Envelope[ProductOutput])
def update(
    product_id: str,
    body: ProductInput,
    request: Request,
    user: User = Depends(admin_user),
    db: Session = Depends(get_db, scope="function"),
):
    product = ProductRepository(db).get(product_id, True, True)
    write_product(db, body, product)
    audit(
        db,
        request,
        user,
        "UPDATE",
        "PRODUCT",
        product.id,
        {"base_price_vnd": product.base_price_vnd, "active": product.active},
    )
    return result(request, product_data(product))


@router.delete("/products/{product_id}", status_code=204)
def delete(
    product_id: str,
    request: Request,
    user: User = Depends(admin_user),
    db: Session = Depends(get_db, scope="function"),
):
    product = ProductRepository(db).get(product_id, True, True)
    product.active = False
    audit(db, request, user, "DEACTIVATE", "PRODUCT", product.id)
    return Response(status_code=204)


@router.post("/products/{product_id}/variants", status_code=201, response_model=Envelope[dict])
def create_variant(
    product_id: str,
    body: VariantCreate,
    request: Request,
    user: User = Depends(admin_user),
    db: Session = Depends(get_db, scope="function"),
):
    product = ProductRepository(db).get(product_id, True, True)
    if any(v.size_code == body.size_code for v in product.variants) or db.scalar(
        select(Variant).where(Variant.sku == body.sku)
    ):
        raise AppError(409, "DUPLICATE_VARIANT", "Size hoặc SKU bị trùng.")
    product.variants.append(Variant(**body.model_dump()))
    db.flush()
    audit(db, request, user, "CREATE_VARIANT", "PRODUCT", product.id)
    return result(request, product_data(product))


@router.patch("/products/{product_id}/variants/{variant_id}", response_model=Envelope[dict])
def update_variant(
    product_id: str,
    variant_id: str,
    body: VariantUpdate,
    request: Request,
    user: User = Depends(admin_user),
    db: Session = Depends(get_db, scope="function"),
):
    product = ProductRepository(db).get(product_id, True, True)
    variant = db.scalar(
        select(Variant)
        .where(Variant.id == variant_id, Variant.product_id == product_id)
        .with_for_update()
    )
    if not variant:
        raise AppError(404, "NOT_FOUND", "Không tìm thấy biến thể.")
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is None and k != "price_override_vnd":
            raise AppError(422, "INVALID_VARIANT", "Availability không được null.")
        setattr(variant, k, v)
    audit(
        db,
        request,
        user,
        "UPDATE_VARIANT",
        "VARIANT",
        variant.id,
        body.model_dump(exclude_unset=True),
    )
    return result(request, product_data(product))
