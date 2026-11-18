import asyncio
import io
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.errors import AppError
from app.db.models import TryOnJob, User
from app.db.session import Base, get_db
from app.main import app
from app.modules.auth.security import current_user
from app.modules.stylist import virtual_tryon
from app.modules.vell import service
from app.modules.vell.repository import TryOnJobRepository
from app.modules.vell.worker import run_once


def body():
    return {
        "selected_products": [str(uuid4())],
        "gender": "FEMALE",
        "age": 23,
        "height_cm": 165,
        "weight_kg": 52,
        "background": "STUDIO",
        "consent_external_processing": True,
    }


@pytest.fixture
def jobs(tmp_path, monkeypatch):
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    user_id = str(uuid4())
    with factory() as db:
        db.add(User(id=user_id, email="vell-job@example.com", password_hash="unused"))
        db.commit()

    def db_dependency():
        with factory() as db:
            try:
                yield db
                db.commit()
            except Exception:
                db.rollback()
                raise

    monkeypatch.setattr(virtual_tryon, "settings", SimpleNamespace(media_root=tmp_path))
    monkeypatch.setattr(
        service,
        "prepare_try_on",
        lambda db, request: (
            [
                SimpleNamespace(id=str(pid), name="Test garment")
                for pid in request.selected_products
            ],
            [],
        ),
    )
    app.dependency_overrides[get_db] = db_dependency
    app.dependency_overrides[current_user] = lambda: SimpleNamespace(id=user_id)
    with TestClient(app, base_url="http://localhost:3000") as client:
        token = client.get("/api/v1/auth/csrf").json()["data"]["csrf_token"]
        client.headers.update({"Origin": "http://localhost:3000", "X-CSRF-Token": token})
        yield client, factory, user_id
    app.dependency_overrides.clear()
    engine.dispose()


def submit(client, payload=None, key=None):
    return client.post(
        "/api/v1/vell/try-on",
        json=payload or body(),
        headers={"Idempotency-Key": key or str(uuid4())},
    )


def test_api_idempotency_validation_ownership_and_cancel(jobs):
    client, factory, user_id = jobs
    payload, key = body(), str(uuid4())
    response = submit(client, payload, key)
    assert response.status_code == 202, response.text
    job = response.json()["data"]
    assert job["status"] == "QUEUED" and job["result"] is None
    assert "payload" not in job and "references" not in job
    assert submit(client, payload, key).json()["data"]["id"] == job["id"]
    assert submit(client, body(), key).status_code == 409
    assert submit(client, {**payload, "consent_external_processing": False}).status_code == 422
    assert (
        submit(
            client, {**payload, "selected_products": payload["selected_products"] * 2}
        ).status_code
        == 422
    )
    assert submit(client, {**payload, "gender": "MALE"}).status_code == 422
    assert client.post("/api/v1/vell/try-on", json=payload).status_code == 422
    assert client.get("/api/v1/vell/try-on/not-a-uuid").status_code == 422
    assert len(client.get("/api/v1/vell/try-on").json()["data"]) == 1
    app.dependency_overrides[current_user] = lambda: SimpleNamespace(id=str(uuid4()))
    assert client.get(f"/api/v1/vell/try-on/{job['id']}").status_code == 404
    assert client.post(f"/api/v1/vell/try-on/{job['id']}/cancel").status_code == 404
    app.dependency_overrides[current_user] = lambda: SimpleNamespace(id=user_id)
    assert (
        client.post(f"/api/v1/vell/try-on/{job['id']}/cancel").json()["data"]["status"]
        == "CANCELLED"
    )
    assert asyncio.run(run_once(factory)) is False
    app.dependency_overrides.pop(current_user)
    assert client.get("/api/v1/vell/try-on").status_code == 401


def test_quota(jobs):
    client, _, _ = jobs
    for _ in range(5):
        assert submit(client).status_code == 202
    assert submit(client).status_code == 429


class ImageProvider:
    async def generate(self, *args):
        output = io.BytesIO()
        Image.new("RGB", (10, 15), "white").save(output, "PNG")
        return {view: output.getvalue() for view in ("LEFT", "FRONT", "RIGHT")}


def test_worker_runs_inference_validates_and_persists_result(jobs):
    client, factory, _ = jobs
    job_id = submit(client).json()["data"]["id"]
    assert asyncio.run(run_once(factory, lambda name: ImageProvider()))
    output = client.get(f"/api/v1/vell/try-on/{job_id}").json()["data"]
    assert output["status"] == "SUCCEEDED"
    assert len(output["result"]["views"]) == 3
    assert output["result"]["segmentation_status"] == "UNAVAILABLE"
    assert output["result"]["request_id"] == job_id
    for view in output["result"]["views"]:
        path = virtual_tryon.settings.media_root / view["url"].removeprefix("/media/")
        assert Image.open(path).format == "JPEG"
    with factory() as db:
        assert db.get(TryOnJob, job_id).payload == {}
    assert asyncio.run(run_once(factory)) is False


@pytest.mark.parametrize(
    "kind,code", [("invalid", "AI_IMAGE_INVALID"), ("error", "AI_IMAGE_QUOTA_EXCEEDED")]
)
def test_worker_never_succeeds_with_invalid_or_failed_inference(jobs, kind, code):
    client, factory, _ = jobs

    class Provider:
        async def generate(self, *args):
            if kind == "error":
                raise AppError(
                    503, "AI_IMAGE_QUOTA_EXCEEDED", "No quota", {"provider_message": "private"}
                )
            return {"FRONT": b"not an image"}

    job_id = submit(client).json()["data"]["id"]
    asyncio.run(run_once(factory, lambda name: Provider()))
    output = client.get(f"/api/v1/vell/try-on/{job_id}").json()["data"]
    assert output["status"] == "FAILED" and output["result"] is None
    assert output["error"]["code"] == code
    assert "private" not in str(output)


def test_cancel_running_wins_over_late_inference(jobs):
    client, factory, user_id = jobs
    job_id = submit(client).json()["data"]["id"]

    class CancelDuringInference(ImageProvider):
        async def generate(self, *args):
            with factory() as db:
                TryOnJobRepository(db).cancel(job_id, user_id)
                db.commit()
            return await super().generate(*args)

    asyncio.run(run_once(factory, lambda name: CancelDuringInference()))
    output = client.get(f"/api/v1/vell/try-on/{job_id}").json()["data"]
    assert output["status"] == "CANCELLED" and output["result"] is None


def test_crashed_worker_lease_expires_without_second_inference(jobs):
    client, factory, _ = jobs
    job_id = submit(client).json()["data"]["id"]
    with factory() as db:
        row = TryOnJobRepository(db).claim()
        assert row.status == "RUNNING"
        db.commit()
        assert TryOnJobRepository(db).claim() is None
        row.lease_expires_at = datetime.now(UTC) - timedelta(seconds=1)
        db.commit()
    assert asyncio.run(run_once(factory)) is False
    with factory() as db:
        row = db.scalar(select(TryOnJob).where(TryOnJob.id == job_id))
        assert row.status == "FAILED" and row.error["code"] == "WORKER_INTERRUPTED"


def test_real_preparation_rejects_missing_catalog(jobs, monkeypatch):
    client, _, _ = jobs
    monkeypatch.setattr(service, "prepare_try_on", virtual_tryon.prepare_try_on)
    monkeypatch.setattr(virtual_tryon, "settings", SimpleNamespace(gemini_api_key="test-only"))
    assert submit(client).status_code == 404
