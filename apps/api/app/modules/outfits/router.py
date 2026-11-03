import copy
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError, result
from app.core.idempotency import execute_once
from app.core.schemas import Envelope, OutfitUpdate, SaveOutfit
from app.db.models import Outfit, OutfitItem, Product, User, Variant
from app.db.session import get_db
from app.modules.auth.security import current_user
from app.modules.catalog.repository import price_of
from app.modules.looks.service import owned_look, revalidate

router = APIRouter(prefix="/outfits", tags=["Saved Looks"])


def owned_outfit(db, outfit_id, user_id, allow_deleted=False, lock=False):
    query = select(Outfit).where(Outfit.id == outfit_id, Outfit.user_id == user_id)
    if lock:
        query = query.with_for_update()
    row = db.scalar(query)
    if not row or (row.deleted_at and not allow_deleted):
        raise AppError(404, "NOT_FOUND", "Không tìm thấy Look đã lưu.")
    return row


def outfit_data(db, row, hints=False):
    items = [i.product_snapshot for i in row.items]
    output = {
        "id": row.id,
        "look_id": row.id,
        "name": row.name,
        "occasion": row.occasion_code,
        "style": row.style_code,
        "context": row.context_snapshot,
        "score": float(row.score),
        "total_price_vnd": row.total_price_vnd,
        "budget_max_vnd": row.context_snapshot["budget_max_vnd"],
        "is_favorite": row.is_favorite,
        "version": row.version,
        "created_at": row.created_at.isoformat(),
        "visual": row.visual,
        "reasons": row.reasons,
        "items": items,
    }
    if hints:
        statuses = []
        for item in items:
            product, variant = (
                db.get(Product, item["product_id"]),
                db.get(Variant, item["variant_id"]),
            )
            available = bool(
                product and product.active and variant and variant.active and variant.available
            )
            current = price_of(product, variant) if product and variant else None
            statuses.append(
                {
                    "slot_key": item["slot_key"],
                    "available": available,
                    "current_price_vnd": current,
                    "price_changed": current != item["price_vnd"],
                }
            )
        output["current_status"] = statuses
    return output


@router.post("", status_code=201, response_model=Envelope[dict])
def save(
    body: SaveOutfit,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    def work():
        look, rec = owned_look(db, str(body.look_id), user.id)
        snapshots = [i.snapshot for i in look.items]
        revalidate(db, snapshots)
        if sum(i["price_vnd"] for i in snapshots) > rec.context_snapshot["budget_max_vnd"]:
            raise AppError(409, "BUDGET_EXCEEDED", "Look vượt ngân sách.")
        row = Outfit(
            user_id=user.id,
            source_look_id=look.id,
            name=body.name or look.name,
            occasion_code=rec.context_snapshot["occasion"],
            style_code=rec.context_snapshot["style"],
            context_snapshot=rec.context_snapshot,
            total_price_vnd=look.total_price_vnd,
            score=look.score,
            visual=look.visual,
            reasons=look.reasons,
        )
        db.add(row)
        db.flush()
        row.items = [
            OutfitItem(
                slot_key=i["slot_key"],
                item_role=i["role"],
                product_id=i["product_id"],
                variant_id=i["variant_id"],
                price_snapshot_vnd=i["price_vnd"],
                product_snapshot=i,
            )
            for i in snapshots
        ]
        db.flush()
        return outfit_data(db, row)

    return result(request, execute_once(db, request, user.id, body.model_dump(mode="json"), work))


@router.get("", response_model=Envelope[list[dict]])
def listing(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    occasion: str | None = None,
    style: str | None = None,
    favorite: bool | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    query = select(Outfit).where(Outfit.user_id == user.id, Outfit.deleted_at.is_(None))
    for column, value in [
        (Outfit.occasion_code, occasion),
        (Outfit.style_code, style),
        (Outfit.is_favorite, favorite),
    ]:
        if value is not None:
            query = query.where(column == value)
    count = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(
        query.order_by(Outfit.created_at.desc(), Outfit.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return result(
        request, [outfit_data(db, r) for r in rows], page=page, page_size=page_size, total=count
    )


@router.get("/{outfit_id}", response_model=Envelope[dict])
def detail(
    outfit_id: str,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    return result(request, outfit_data(db, owned_outfit(db, outfit_id, user.id), hints=True))


@router.patch("/{outfit_id}", response_model=Envelope[dict])
def update(
    outfit_id: str,
    body: OutfitUpdate,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    row = owned_outfit(db, outfit_id, user.id, lock=True)
    if row.version != body.version:
        raise AppError(409, "STALE_VERSION", "Look đã thay đổi. Hãy tải lại trước khi sửa.")
    if body.name is not None:
        row.name = body.name
    if body.is_favorite is not None:
        row.is_favorite = body.is_favorite
    row.version += 1
    return result(request, outfit_data(db, row))


@router.delete("/{outfit_id}", status_code=204)
def delete(
    outfit_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    row = owned_outfit(db, outfit_id, user.id, allow_deleted=True, lock=True)
    row.deleted_at = row.deleted_at or datetime.now(UTC)
    return Response(status_code=204)


@router.post("/{outfit_id}/duplicate", status_code=201, response_model=Envelope[dict])
def duplicate(
    outfit_id: str,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    original = owned_outfit(db, outfit_id, user.id)
    row = Outfit(
        user_id=user.id,
        name=(original.name[:110] + " — bản sao"),
        occasion_code=original.occasion_code,
        style_code=original.style_code,
        context_snapshot=copy.deepcopy(original.context_snapshot),
        total_price_vnd=original.total_price_vnd,
        score=original.score,
        visual=original.visual,
        reasons=original.reasons,
    )
    db.add(row)
    db.flush()
    row.items = [
        OutfitItem(
            slot_key=i.slot_key,
            item_role=i.item_role,
            product_id=i.product_id,
            variant_id=i.variant_id,
            price_snapshot_vnd=i.price_snapshot_vnd,
            product_snapshot=copy.deepcopy(i.product_snapshot),
        )
        for i in original.items
    ]
    db.flush()
    return result(request, outfit_data(db, row, hints=True))
