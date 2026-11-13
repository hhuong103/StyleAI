from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.errors import result
from app.core.schemas import Envelope, PlanInput, VirtualTryOnInput
from app.db.models import User
from app.db.session import get_db
from app.modules.auth.security import current_user
from app.modules.stylist.service import make_plan
from app.modules.stylist.virtual_tryon import generate_virtual_try_on

router = APIRouter(prefix="/stylist", tags=["Stylist"])


@router.post("/plan", response_model=Envelope[dict])
def plan(
    body: PlanInput,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    return result(request, make_plan(db, user, body))


@router.post("/virtual-try-on", response_model=Envelope[dict])
async def virtual_try_on(
    body: VirtualTryOnInput,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    return result(request, await generate_virtual_try_on(db, user, body))
