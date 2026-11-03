import json
import logging
import mimetypes
import secrets
import threading
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException

from app.core.config import settings
from app.core.errors import AppError, error_response
from app.db.models import uid
from app.db.session import engine
from app.modules.admin.router import router as admin
from app.modules.auth.router import router as auth
from app.modules.auth.security import decode
from app.modules.catalog.router import router as catalog
from app.modules.feedback.router import router as feedback
from app.modules.looks.router import router as looks
from app.modules.outfits.router import router as outfits
from app.modules.profiles.router import router as profiles
from app.modules.recommendations.router import router as recommendations
from app.modules.stylist.router import router as stylist

logger = logging.getLogger("styleai")
logging.basicConfig(level=logging.INFO, format="%(message)s")


@asynccontextmanager
async def lifespan(_):
    settings.validate()
    yield
    engine.dispose()


app = FastAPI(title="STYLEAI API", version="1.0.0", lifespan=lifespan)
hits = defaultdict(deque)
hit_lock = threading.Lock()


@app.middleware("http")
async def security_and_logging(request: Request, call_next):
    request.state.request_id = uid()
    started = time.monotonic()
    try:
        if request.url.path.startswith("/api/") and request.method not in {
            "GET",
            "HEAD",
            "OPTIONS",
        }:
            if request.headers.get("origin") != settings.app_origin:
                raise AppError(403, "INVALID_ORIGIN", "Origin không được phép.")
            header, cookie = (
                request.headers.get("x-csrf-token", ""),
                request.cookies.get("csrf_token", ""),
            )
            if not header or not secrets.compare_digest(header, cookie):
                raise AppError(403, "CSRF_INVALID", "Vui lòng tải lại trang và thử lại.")
            try:
                decode(header, "csrf")
            except AppError:
                raise AppError(403, "CSRF_INVALID", "CSRF đã hết hạn. Vui lòng thử lại.") from None
            if request.url.path in {
                "/api/v1/auth/login",
                "/api/v1/auth/register",
                "/api/v1/auth/google",
                "/api/v1/auth/refresh",
                "/api/v1/recommendations",
            }:
                key = ((request.client.host if request.client else "unknown"), request.url.path)
                with hit_lock:
                    bucket = hits[key]
                    while bucket and bucket[0] < started - 60:
                        bucket.popleft()
                    if len(bucket) >= 30:
                        raise AppError(
                            429, "RATE_LIMITED", "Quá nhiều yêu cầu. Hãy thử lại sau một phút."
                        )
                    bucket.append(started)
        response = await call_next(request)
    except AppError as exc:
        response = error_response(request, exc.status, exc.code, exc.message, exc.details)
    response.headers["X-Request-ID"] = request.state.request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    logger.info(
        json.dumps(
            {
                "request_id": request.state.request_id,
                "path": getattr(request.scope.get("route"), "path", "unmatched"),
                "method": request.method,
                "status": response.status_code,
                "duration_ms": round((time.monotonic() - started) * 1000),
            }
        )
    )
    return response


@app.exception_handler(AppError)
async def application_error(request, exc):
    return error_response(request, exc.status, exc.code, exc.message, exc.details)


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    # Never echo rejected input: auth payloads can contain passwords.
    issues = [{"field": ".".join(map(str, e["loc"])), "type": e["type"]} for e in exc.errors()]
    return error_response(
        request, 422, "VALIDATION_ERROR", "Dữ liệu chưa hợp lệ.", {"issues": issues}
    )


@app.exception_handler(IntegrityError)
async def integrity_error(request, _):
    return error_response(
        request, 409, "DATA_CONFLICT", "Dữ liệu bị trùng hoặc đã thay đổi. Vui lòng thử lại."
    )


@app.exception_handler(HTTPException)
async def http_error(request, exc):
    return error_response(
        request, exc.status_code, "HTTP_ERROR", "Không tìm thấy hoặc không thể xử lý yêu cầu."
    )


@app.exception_handler(Exception)
async def unexpected_error(request, _):
    logger.error(json.dumps({"request_id": request.state.request_id, "error": "INTERNAL_ERROR"}))
    return error_response(request, 500, "INTERNAL_ERROR", "Có lỗi hệ thống. Vui lòng thử lại.")


@app.get("/health/live", tags=["Health"])
def live():
    return {"status": "ok"}


@app.get("/health/ready", tags=["Health"])
def ready(request: Request):
    try:
        with engine.connect() as connection:
            version = connection.scalar(text("SELECT version_num FROM alembic_version"))
        if version != "0002":
            raise ValueError("Schema mismatch")
    except Exception:
        return error_response(request, 503, "NOT_READY", "Database/migration chưa sẵn sàng.")
    return {"status": "ready"}


for router in [auth, profiles, catalog, stylist, recommendations, looks, outfits, feedback, admin]:
    app.include_router(router, prefix="/api/v1")

settings.media_root.mkdir(parents=True, exist_ok=True)


class PublicMedia(StaticFiles):
    async def get_response(self, path, scope):
        if path.split("/", 1)[0] not in {"demo", "uploads"}:
            raise HTTPException(status_code=404)
        return await super().get_response(path, scope)


# Slim Python images may not include the OS MIME database for WebP.
mimetypes.add_type("image/webp", ".webp")
app.mount("/media", PublicMedia(directory=settings.media_root, follow_symlink=False), name="media")
