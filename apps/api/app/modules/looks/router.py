from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.errors import result
from app.core.idempotency import execute_once
from app.core.outputs import LookOutput
from app.core.schemas import Envelope, ReplacementInput
from app.db.models import User
from app.db.session import get_db
from app.modules.auth.security import current_user
from app.modules.looks.service import alternatives, owned_look, replace
from app.modules.recommendations.service import look_data

router = APIRouter(prefix="/recommendations/{recommendation_id}/looks", tags=["Interactive Looks"])


@router.get("/{look_id}", response_model=Envelope[LookOutput])
def detail(
    recommendation_id: str,
    look_id: str,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    look, _ = owned_look(db, look_id, user.id, recommendation_id)
    return result(request, look_data(look))


@router.get("/{look_id}/slots/{slot_key}/alternatives", response_model=Envelope[list[dict]])
def choices(
    recommendation_id: str,
    look_id: str,
    slot_key: str,
    request: Request,
    limit: int = Query(5, ge=3, le=5),
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    look, rec = owned_look(db, look_id, user.id, recommendation_id)
    return result(request, alternatives(db, look, rec, slot_key, limit))


@router.post("/{look_id}/replacements", status_code=201, response_model=Envelope[LookOutput])
def replacement(
    recommendation_id: str,
    look_id: str,
    body: ReplacementInput,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    look, rec = owned_look(db, look_id, user.id, recommendation_id)
    return result(
        request,
        execute_once(
            db, request, user.id, body.model_dump(mode="json"), lambda: replace(db, look, rec, body)
        ),
    )
