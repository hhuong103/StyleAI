import os
import subprocess
import sys

import pytest

test_url = os.getenv("TEST_DATABASE_URL")
if test_url:
    os.environ["DATABASE_URL"] = test_url
os.environ.setdefault("MEDIA_ROOT", "/tmp/styleai-test-media")
os.environ.setdefault("APP_ORIGIN", "http://localhost:3000")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.db.session import engine, get_db  # noqa: E402
from app.main import app, hits  # noqa: E402
from app.seed import seed  # noqa: E402


@pytest.fixture(scope="session")
def database():
    if not test_url:
        pytest.skip("Set TEST_DATABASE_URL to a dedicated PostgreSQL fashion_test database")
    url = make_url(test_url)
    if url.get_backend_name() != "postgresql" or url.database not in {
        "fashion_test",
        "styleai_test",
    }:
        pytest.fail(
            "Tests require a dedicated PostgreSQL database named fashion_test or styleai_test"
        )
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True)
    with Session(engine) as session:
        seed(session)
        session.commit()
    yield


@pytest.fixture
def db(database):
    with engine.connect() as connection:
        transaction = connection.begin()
        with Session(
            bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
        ) as session:
            yield session
        transaction.rollback()


@pytest.fixture
def client(db):
    def override():
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise

    app.dependency_overrides[get_db] = override
    hits.clear()
    with TestClient(app, base_url="http://localhost:3000") as client:
        yield client
    app.dependency_overrides.clear()


def authenticate(client, email="user@example.com"):
    csrf = client.get("/api/v1/auth/csrf").json()["data"]["csrf_token"]
    client.headers.update({"Origin": "http://localhost:3000", "X-CSRF-Token": csrf})
    password = "A-test-password-12345"
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "display_name": "Test User"},
    )
    assert response.status_code == 201, response.text
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["data"]


@pytest.fixture
def signed_in(client):
    return authenticate(client)
