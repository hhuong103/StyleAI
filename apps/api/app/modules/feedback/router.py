from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError, result
from app.core.schemas import Envelope, FeedbackInput
from app.db.models import Feedback, Recommendation, RecommendationItem, User
from app.db.session import get_db
from app.modules.auth.security import current_user
from app.modules.catalog.repository import ProductRepository
from app.modules.looks.service import owned_look
from app.modules.outfits.router import owned_outfit
from app.modules.recommendations.service import owned

router = APIRouter(prefix="/feedback", tags=["Feedback"])
TARGETS = {
    "RECOMMENDATION": "recommendation_id",
    "RECOMMENDATION_ITEM": "recommendation_item_id",
    "LOOK": "look_id",
    "OUTFIT": "outfit_id",
    "PRODUCT": "product_id",
}


def feedback_data(row):
    column = next(c for c in TARGETS.values() if getattr(row, c))
    return {
        "id": row.id,
        "target_type": next(k for k, v in TARGETS.items() if v == column),
        "target_id": getattr(row, column),
        "value": row.value,
        "reason_code": row.reason_code,
    }


@router.post("", response_model=Envelope[dict])
def create(
    body: FeedbackInput,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    target_id, kind = str(body.target_id), body.target_type
    context = {}
    if kind == "LOOK":
        look, rec = owned_look(db, target_id, user.id)
        context = {
            "algorithm_version": rec.algorithm_version,
            "context": rec.context_snapshot,
            "revision": look.revision,
        }
    elif kind == "RECOMMENDATION":
        rec = owned(db, Recommendation, target_id, user.id)
        context = {"algorithm_version": rec.algorithm_version, "context": rec.context_snapshot}
    elif kind == "RECOMMENDATION_ITEM":
        item = db.get(RecommendationItem, target_id)
        if not item:
            raise AppError(404, "NOT_FOUND", "Không tìm thấy recommendation item.")
        rec = owned(db, Recommendation, item.recommendation_id, user.id)
        context = {
            "algorithm_version": rec.algorithm_version,
            "context": rec.context_snapshot,
            "item": item.product_snapshot,
        }
    elif kind == "OUTFIT":
        outfit = owned_outfit(db, target_id, user.id)
        context = {"context": outfit.context_snapshot, "score": float(outfit.score)}
    else:
        ProductRepository(db).get(target_id)
    column = TARGETS[kind]
    row = db.scalar(
        select(Feedback)
        .where(Feedback.user_id == user.id, getattr(Feedback, column) == target_id)
        .with_for_update()
    )
    if not row:
        row = Feedback(user_id=user.id, **{column: target_id})
        db.add(row)
    row.value, row.reason_code, row.context = body.value, body.reason_code, context
    db.flush()
    return result(request, feedback_data(row))


@router.get("", response_model=Envelope[list[dict]])
def history(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    target_type: str | None = None,
    target_id: str | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    query = select(Feedback).where(Feedback.user_id == user.id)
    if (target_type is None) != (target_id is None):
        raise AppError(422, "INVALID_TARGET_FILTER", "Cần cả target_type và target_id.")
    if target_type:
        if target_type not in TARGETS:
            raise AppError(422, "INVALID_TARGET_FILTER", "Loại feedback không hợp lệ.")
        query = query.where(getattr(Feedback, TARGETS[target_type]) == target_id)
    count = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(
        query.order_by(Feedback.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return result(
        request, [feedback_data(r) for r in rows], page=page, page_size=page_size, total=count
    )


@router.delete("/{feedback_id}", status_code=204)
def delete(
    feedback_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    row = owned(db, Feedback, feedback_id, user.id)
    db.delete(row)
    return Response(status_code=204)
