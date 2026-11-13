from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError, result
from app.core.idempotency import execute_once
from app.core.outputs import RecommendationOutput
from app.core.schemas import Envelope, RecommendationInput
from app.db.models import Recommendation, User
from app.db.session import get_db
from app.modules.auth.security import current_user
from app.modules.catalog.repository import is_public_product_snapshot
from app.modules.recommendations.service import generate, owned

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


def is_public_recommendation(snapshot):
    items = [item for slot in snapshot.get("slot_results", []) for item in slot.get("items", [])]
    items.extend(item for look in snapshot.get("looks", []) for item in look.get("items", []))
    return all(is_public_product_snapshot(item) for item in items)


@router.post("", status_code=201, response_model=Envelope[RecommendationOutput])
def create(
    body: RecommendationInput,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    return result(
        request,
        execute_once(
            db, request, user.id, body.model_dump(mode="json"), lambda: generate(db, user, body)
        ),
    )


@router.get("", response_model=Envelope[list[dict]])
def history(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    query = select(Recommendation).where(Recommendation.user_id == user.id)
    rows = db.scalars(query.order_by(Recommendation.created_at.desc(), Recommendation.id))
    visible = [row for row in rows if is_public_recommendation(row.result_snapshot)]
    count = len(visible)
    rows = visible[(page - 1) * page_size : page * page_size]
    data = [
        {
            "id": r.id,
            "context": r.context_snapshot,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
            "looks": r.result_snapshot.get("looks", []),
        }
        for r in rows
    ]
    return result(request, data, page=page, page_size=page_size, total=count)


@router.get("/{recommendation_id}", response_model=Envelope[RecommendationOutput])
def detail(
    recommendation_id: str,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    snapshot = owned(db, Recommendation, recommendation_id, user.id).result_snapshot
    if not is_public_recommendation(snapshot):
        raise AppError(404, "NOT_FOUND", "Không tìm thấy gợi ý.")
    return result(request, snapshot)
