from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import result
from app.core.idempotency import execute_once
from app.core.outputs import RecommendationOutput
from app.core.schemas import Envelope, RecommendationInput
from app.db.models import Recommendation, User
from app.db.session import get_db
from app.modules.auth.security import current_user
from app.modules.recommendations.service import generate, owned

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


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
    count = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(
        query.order_by(Recommendation.created_at.desc(), Recommendation.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
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
    return result(request, owned(db, Recommendation, recommendation_id, user.id).result_snapshot)
