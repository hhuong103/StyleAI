import hashlib
import json
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select, text

from app.core.errors import AppError
from app.db.models import IdempotencyRequest
from app.modules.auth.security import utc


def execute_once(db, request, user_id, payload, work):
    key = request.headers.get("Idempotency-Key")
    if not key:
        return work()
    try:
        key = str(UUID(key))
    except ValueError:
        raise AppError(422, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key phải là UUID.") from None
    scope = request.method + " " + request.url.path
    fingerprint = hashlib.sha256(
        json.dumps(payload, sort_keys=True, default=str).encode()
    ).hexdigest()
    if db.bind.dialect.name == "postgresql":
        lock = int.from_bytes(
            hashlib.sha256(f"{user_id}:{scope}:{key}".encode()).digest()[:8], "big", signed=True
        )
        db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock})
    existing = db.scalar(
        select(IdempotencyRequest)
        .where(
            IdempotencyRequest.user_id == user_id,
            IdempotencyRequest.scope == scope,
            IdempotencyRequest.key == key,
        )
        .with_for_update()
    )
    if existing and utc(existing.expires_at) > datetime.now(UTC):
        if existing.request_hash != fingerprint:
            raise AppError(409, "IDEMPOTENCY_CONFLICT", "Key đã được dùng với dữ liệu khác.")
        return existing.response
    if existing:
        db.delete(existing)
        db.flush()
    response = work()
    db.add(
        IdempotencyRequest(
            user_id=user_id,
            scope=scope,
            key=key,
            request_hash=fingerprint,
            response=response,
            expires_at=datetime.now(UTC) + timedelta(hours=24),
        )
    )
    db.flush()
    return response
