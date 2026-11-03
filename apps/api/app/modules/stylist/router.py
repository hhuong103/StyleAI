from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.errors import result
from app.core.schemas import Envelope, PlanInput
from app.db.models import User
from app.db.session import get_db
from app.modules.auth.security import current_user
from app.modules.stylist.service import make_plan

router = APIRouter(prefix="/stylist", tags=["Stylist"])


@router.post("/plan", response_model=Envelope[dict])
def plan(
    body: PlanInput,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    return result(request, make_plan(db, user, body))
