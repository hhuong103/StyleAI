from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update

from app.core.config import settings
from app.core.errors import AppError
from app.db.models import TryOnJob, uid


class TryOnJobRepository:
    def __init__(self, db):
        self.db = db

    def owned(self, job_id, user_id):
        row = self.db.scalar(
            select(TryOnJob).where(TryOnJob.id == str(job_id), TryOnJob.user_id == user_id)
        )
        if row is None:
            raise AppError(404, "TRY_ON_JOB_NOT_FOUND", "Không tìm thấy job mặc thử.")
        return row

    def claim(self):
        now = datetime.now(UTC)
        # A worker crash must not cause a second potentially billable inference.
        self.db.execute(
            update(TryOnJob)
            .execution_options(synchronize_session="fetch")
            .where(
                TryOnJob.status == "RUNNING",
                TryOnJob.lease_expires_at <= now,
            )
            .values(
                status="FAILED",
                finished_at=now,
                payload={},
                error={
                    "code": "WORKER_INTERRUPTED",
                    "message": "Worker bị gián đoạn; hãy gửi job mới để thử lại.",
                },
            )
        )
        row = self.db.scalar(
            select(TryOnJob)
            .where(TryOnJob.status == "QUEUED")
            .order_by(TryOnJob.created_at, TryOnJob.id)
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if row is None:
            return None
        token = uid()
        changed = self.db.execute(
            update(TryOnJob)
            .where(TryOnJob.id == row.id, TryOnJob.status == "QUEUED")
            .values(
                status="RUNNING",
                worker_token=token,
                started_at=now,
                lease_expires_at=now + timedelta(seconds=settings.vell_job_timeout_seconds + 120),
            )
        )
        if changed.rowcount != 1:
            return None
        self.db.flush()
        self.db.refresh(row)
        return row

    def finish(self, job_id, token, status, result=None, error=None):
        return (
            self.db.execute(
                update(TryOnJob)
                .where(
                    TryOnJob.id == job_id,
                    TryOnJob.status == "RUNNING",
                    TryOnJob.worker_token == token,
                )
                .values(
                    status=status,
                    result=result,
                    error=error,
                    payload={},
                    finished_at=datetime.now(UTC),
                    lease_expires_at=None,
                )
            ).rowcount
            == 1
        )

    def cancel(self, job_id, user_id):
        row = self.owned(job_id, user_id)
        self.db.execute(
            update(TryOnJob)
            .where(TryOnJob.id == row.id, TryOnJob.status.in_(["QUEUED", "RUNNING"]))
            .values(status="CANCELLED", payload={}, finished_at=datetime.now(UTC))
        )
        self.db.refresh(row)
        return row
