"""Run with python -m app.modules.vell.worker. Durable SQL queue; no API background tasks."""

import argparse
import asyncio
import logging
from types import SimpleNamespace

from app.core.config import settings
from app.core.errors import AppError
from app.core.schemas import VirtualTryOnInput
from app.db.models import TryOnJob
from app.db.session import SessionLocal
from app.modules.stylist.virtual_tryon import persist_try_on
from app.modules.vell.providers import get_provider
from app.modules.vell.repository import TryOnJobRepository
from app.modules.vell.schemas import TryOnJobInput, TryOnResult

logger = logging.getLogger(__name__)


async def run_once(session_factory=SessionLocal, provider_factory=get_provider):
    with session_factory() as db:
        row = TryOnJobRepository(db).claim()
        if row is None:
            db.commit()
            return False
        job_id, user_id, token, provider_name, payload = (
            row.id,
            row.user_id,
            row.worker_token,
            row.provider,
            row.payload,
        )
        db.commit()
    # No database connection or transaction is held while calling the AI provider.
    try:
        body = (VirtualTryOnInput if payload.get("bound") else TryOnJobInput).model_validate(
            payload["body"]
        )
        from app.modules.vell.bound_runtime import complete_binding, read_inputs

        products = [SimpleNamespace(**product) for product in payload["products"]]
        images = await asyncio.wait_for(
            provider_factory(provider_name).generate(body, products, read_inputs(payload)),
            timeout=settings.vell_job_timeout_seconds,
        )
        # Cancellation / lease recovery wins over a late provider response.
        with session_factory() as db:
            row = db.get(TryOnJob, job_id, with_for_update=True)
            if row.status != "RUNNING" or row.worker_token != token:
                return True
            output = persist_try_on(user_id, body, products, images, job_id)
            output = TryOnResult.model_validate(output).model_dump(mode="json")
            output = complete_binding(db, job_id, output)
            TryOnJobRepository(db).finish(job_id, token, "SUCCEEDED", result=output)
            db.commit()
    except Exception as exc:
        if isinstance(exc, AppError):
            error = {"code": exc.code, "message": exc.message}
        elif isinstance(exc, TimeoutError):
            error = {"code": "AI_IMAGE_TIMEOUT", "message": "Tạo ảnh quá thời gian."}
        else:
            logger.error("VELL job %s failed (%s)", job_id, type(exc).__name__)
            error = {"code": "TRY_ON_FAILED", "message": "Không thể hoàn tất job mặc thử."}
        with session_factory() as db:
            TryOnJobRepository(db).finish(job_id, token, "FAILED", error=error)
            db.commit()
    finally:
        if payload.get("bound"):
            from app.modules.vell.bound_runtime import cleanup_inputs

            cleanup_inputs(payload)
    return True


async def serve(once=False):
    while True:
        from app.modules.vell.bound_runtime import write_heartbeat

        write_heartbeat()
        try:
            worked = await run_once()
        except Exception:
            logger.exception("VELL worker could not process the queue")
            if once:
                raise
            worked = False
        if once:
            return
        if not worked:
            await asyncio.sleep(2)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    asyncio.run(serve(parser.parse_args().once))
