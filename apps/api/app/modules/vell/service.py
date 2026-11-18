import hashlib
import json
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select

from app.core.errors import AppError
from app.db.models import TryOnJob, User
from app.modules.stylist.virtual_tryon import prepare_try_on
from app.modules.vell.repository import TryOnJobRepository
from app.modules.vell.schemas import TryOnJobOutput


def job_data(row):
    return TryOnJobOutput.model_validate(
        {key: getattr(row, key) for key in TryOnJobOutput.model_fields}
    ).model_dump(mode="json")


def create_job(db, user_id, body, key):
    payload = body.model_dump(mode="json")
    fingerprint = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    # Serialize per-user admission, including idempotency and quota, on PostgreSQL.
    db.execute(select(User.id).where(User.id == user_id).with_for_update())
    prior = db.scalar(
        select(TryOnJob).where(TryOnJob.user_id == user_id, TryOnJob.idempotency_key == str(key))
    )
    if prior:
        if prior.request_hash != fingerprint:
            raise AppError(409, "IDEMPOTENCY_CONFLICT", "Key đã được dùng với dữ liệu khác.")
        return prior
    count = db.scalar(
        select(func.count())
        .select_from(TryOnJob)
        .where(
            TryOnJob.user_id == user_id,
            TryOnJob.created_at >= datetime.now(UTC) - timedelta(hours=1),
        )
    )
    if count >= 5:
        raise AppError(429, "TRY_ON_QUOTA_EXCEEDED", "Chỉ được tạo tối đa 5 job mỗi giờ.")
    products, references = prepare_try_on(db, body)
    row = TryOnJob(
        user_id=user_id,
        idempotency_key=str(key),
        request_hash=fingerprint,
        provider="gemini",
        status="QUEUED",
        payload={
            "body": payload,
            "products": [{"id": product.id, "name": product.name} for product in products],
            "references": references,
        },
    )
    db.add(row)
    db.flush()
    return row


def list_jobs(db, user_id, page, page_size):
    return list(
        db.scalars(
            select(TryOnJob)
            .where(TryOnJob.user_id == user_id)
            .order_by(TryOnJob.created_at.desc(), TryOnJob.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )


def get_job(db, job_id, user_id):
    return TryOnJobRepository(db).owned(job_id, user_id)
