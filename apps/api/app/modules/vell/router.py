from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy.orm import Session

from app.core.errors import result
from app.core.schemas import Envelope
from app.db.models import User
from app.db.session import get_db
from app.modules.auth.security import current_user
from app.modules.vell.domain_router import router as domain_router
from app.modules.vell.integration_router import router as integration_router
from app.modules.vell.repository import TryOnJobRepository
from app.modules.vell.schemas import TryOnJobInput, TryOnJobOutput
from app.modules.vell.service import create_job, get_job, job_data, list_jobs

router = APIRouter(prefix="/vell")
router.include_router(integration_router)
router.include_router(domain_router)
jobs_router = APIRouter(prefix="/try-on", tags=["VELL Try-On Jobs"])


@jobs_router.post("", status_code=202, response_model=Envelope[TryOnJobOutput])
def submit(
    body: TryOnJobInput,
    request: Request,
    idempotency_key: UUID = Header(alias="Idempotency-Key"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    return result(request, job_data(create_job(db, user.id, body, idempotency_key)))


@jobs_router.get("", response_model=Envelope[list[TryOnJobOutput]])
def listing(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    return result(
        request,
        [job_data(row) for row in list_jobs(db, user.id, page, page_size)],
        page=page,
        page_size=page_size,
    )


@jobs_router.get("/{job_id}", response_model=Envelope[TryOnJobOutput])
def detail(
    job_id: UUID,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    return result(request, job_data(get_job(db, job_id, user.id)))


@jobs_router.post("/{job_id}/cancel", response_model=Envelope[TryOnJobOutput])
def cancel(
    job_id: UUID,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    return result(request, job_data(TryOnJobRepository(db).cancel(job_id, user.id)))


router.include_router(jobs_router)
