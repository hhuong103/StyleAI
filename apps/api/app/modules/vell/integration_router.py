from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.errors import result
from app.core.schemas import Envelope
from app.db.session import get_db
from app.modules.vell.integration_schemas import VellCapabilities, VellConfig, VellHealth
from app.modules.vell.integration_service import capabilities, health, public_config

router = APIRouter(tags=["VELL Integration"])


@router.get(
    "/health",
    response_model=Envelope[VellHealth],
    responses={503: {"description": "Database or VELL schema not ready"}},
)
def vell_health(request: Request, db: Session = Depends(get_db, scope="function")):
    return result(request, health(db))


@router.get("/config", response_model=Envelope[VellConfig])
def vell_config(request: Request):
    return result(request, public_config())


@router.get(
    "/capabilities",
    response_model=Envelope[VellCapabilities],
    responses={503: {"description": "Database or catalog not ready"}},
)
def vell_capabilities(request: Request, db: Session = Depends(get_db, scope="function")):
    return result(request, capabilities(db))
