from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.db.models import TryOnJob, User
from app.db.session import engine
from app.modules.vell.repository import TryOnJobRepository


def test_postgres_workers_claim_distinct_jobs(database):
    user_id = str(uuid4())
    with Session(engine) as db:
        db.add(User(id=user_id, email=f"{user_id}@example.com", password_hash="test-only"))
        db.flush()
        for _ in range(2):
            db.add(
                TryOnJob(
                    user_id=user_id,
                    idempotency_key=str(uuid4()),
                    request_hash="0" * 64,
                    provider="gemini",
                    status="QUEUED",
                    payload={},
                )
            )
        db.commit()
    barrier = Barrier(2)

    def claim():
        with Session(engine) as db:
            row = TryOnJobRepository(db).claim()
            claimed_id = row.id if row else None
            barrier.wait(timeout=10)
            db.commit()
            return claimed_id

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            claims = list(pool.map(lambda _: claim(), range(2)))
        assert None not in claims
        assert len(set(claims)) == 2
    finally:
        with Session(engine) as db:
            db.execute(delete(TryOnJob).where(TryOnJob.user_id == user_id))
            db.execute(delete(User).where(User.id == user_id))
            db.commit()
