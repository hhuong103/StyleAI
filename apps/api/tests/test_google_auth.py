from contextlib import contextmanager
from types import SimpleNamespace

from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.config import settings as app_settings
from app.core.errors import AppError
from app.db.models import Profile, User
from app.db.session import Base, get_db
from app.main import app
from app.modules.auth import router as auth_router
from app.modules.auth import security


def test_google_credential_requires_verified_email(monkeypatch):
    test_settings = SimpleNamespace(google_client_id="test-google-client")
    monkeypatch.setattr(security, "settings", test_settings)
    monkeypatch.setattr(
        security.google_jwks,
        "get_signing_key_from_jwt",
        lambda _: SimpleNamespace(key="verified-public-key"),
    )
    claims = {
        "aud": "test-google-client",
        "iss": "https://accounts.google.com",
        "exp": 4_000_000_000,
        "iat": 1_700_000_000,
        "sub": "google-user",
        "email": "user@example.com",
        "email_verified": True,
        "name": "Test User",
    }
    monkeypatch.setattr(security.jwt, "decode", lambda *_args, **_kwargs: claims)

    assert security.verify_google_credential("synthetic-google-id-token")["email"] == (
        "user@example.com"
    )
    claims["email_verified"] = False
    try:
        security.verify_google_credential("synthetic-google-id-token")
    except AppError as error:
        assert error.code == "GOOGLE_EMAIL_UNVERIFIED"
    else:
        raise AssertionError("Unverified Google email was accepted")


def test_google_credential_verifies_rs256_signature(monkeypatch):
    client_id = "test-google-client"
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    claims = {
        "aud": client_id,
        "iss": "https://accounts.google.com",
        "exp": 4_000_000_000,
        "iat": 1_700_000_000,
        "sub": "google-user",
        "email": "user@example.com",
        "email_verified": True,
        "name": "Test User",
    }
    credential = security.jwt.encode(claims, private_key, algorithm="RS256")

    monkeypatch.setattr(security, "settings", SimpleNamespace(google_client_id=client_id))
    monkeypatch.setattr(
        security.google_jwks,
        "get_signing_key_from_jwt",
        lambda _: SimpleNamespace(key=private_key.public_key()),
    )

    assert security.verify_google_credential(credential) == {
        "email": "user@example.com",
        "sub": "google-user",
        "name": "Test User",
    }


def test_google_credential_reports_client_id_mismatch(monkeypatch):
    monkeypatch.setattr(
        security,
        "settings",
        SimpleNamespace(google_client_id="configured-web-client"),
    )
    monkeypatch.setattr(
        security.google_jwks,
        "get_signing_key_from_jwt",
        lambda _: SimpleNamespace(key="verified-public-key"),
    )

    def reject_audience(*_args, **_kwargs):
        raise security.jwt.InvalidAudienceError("audience mismatch")

    monkeypatch.setattr(security.jwt, "decode", reject_audience)
    try:
        security.verify_google_credential("synthetic-google-id-token")
    except AppError as error:
        assert error.code == "GOOGLE_CLIENT_ID_MISMATCH"
        assert "Client ID" in error.message
    else:
        raise AssertionError("A credential for a different client ID was accepted")


def test_google_credential_reports_expired_token(monkeypatch):
    monkeypatch.setattr(
        security,
        "settings",
        SimpleNamespace(google_client_id="test-google-client"),
    )
    monkeypatch.setattr(
        security.google_jwks,
        "get_signing_key_from_jwt",
        lambda _: SimpleNamespace(key="verified-public-key"),
    )

    def reject_expiration(*_args, **_kwargs):
        raise security.jwt.ExpiredSignatureError()

    monkeypatch.setattr(security.jwt, "decode", reject_expiration)
    try:
        security.verify_google_credential("synthetic-google-id-token")
    except AppError as error:
        assert error.code == "GOOGLE_CREDENTIAL_EXPIRED"
    else:
        raise AssertionError("An expired credential was accepted")


def test_google_credential_reports_unrecognized_signing_key(monkeypatch):
    monkeypatch.setattr(
        security,
        "settings",
        SimpleNamespace(google_client_id="test-google-client"),
    )

    def reject_signing_key(_credential):
        raise security.jwt.PyJWKClientError("Unable to find a signing key")

    monkeypatch.setattr(
        security.google_jwks,
        "get_signing_key_from_jwt",
        reject_signing_key,
    )
    try:
        security.verify_google_credential("synthetic-google-id-token")
    except AppError as error:
        assert error.code == "GOOGLE_SIGNING_KEY_NOT_FOUND"
        assert "Web Client ID" in error.message
    else:
        raise AssertionError("A credential without a recognized signing key was accepted")


def test_google_credential_logs_safe_claim_error_type(monkeypatch, caplog):
    monkeypatch.setattr(
        security,
        "settings",
        SimpleNamespace(google_client_id="test-google-client"),
    )
    monkeypatch.setattr(
        security.google_jwks,
        "get_signing_key_from_jwt",
        lambda _: SimpleNamespace(key="verified-public-key"),
    )

    def reject_claims(*_args, **_kwargs):
        raise security.jwt.DecodeError("malformed synthetic token")

    monkeypatch.setattr(security.jwt, "decode", reject_claims)
    with caplog.at_level("WARNING", logger="styleai.auth"):
        try:
            security.verify_google_credential("synthetic-google-id-token")
        except AppError as error:
            assert error.code == "GOOGLE_CREDENTIAL_INVALID"
        else:
            raise AssertionError("A malformed credential was accepted")

    assert "error_type=DecodeError" in caplog.text
    assert "synthetic-google-id-token" not in caplog.text


@contextmanager
def google_client(monkeypatch, claims):
    test_settings = SimpleNamespace(
        app_env="development",
        google_client_id="test-google-client",
        secret=app_settings.secret,
        access_ttl=900,
        refresh_ttl=604800,
    )
    monkeypatch.setattr("app.core.config.settings", test_settings)
    monkeypatch.setattr(security, "settings", test_settings)
    monkeypatch.setattr(auth_router, "verify_google_credential", lambda _: claims)

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)

    def override_db():
        with Session(engine, expire_on_commit=False) as db:
            yield db
            db.commit()

    app.dependency_overrides[get_db] = override_db
    try:
        with TestClient(app, base_url=app_settings.app_origin) as client:
            csrf = client.get("/api/v1/auth/csrf").json()["data"]["csrf_token"]
            client.headers.update({"Origin": app_settings.app_origin, "X-CSRF-Token": csrf})
            yield client, engine
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_google_sign_in_creates_user_and_session(monkeypatch):
    claims = {
        "email": "new.google@example.com",
        "sub": "google-user-1",
        "name": "Google User",
    }
    with google_client(monkeypatch, claims) as (client, engine):
        config = client.get("/api/v1/auth/google/config")
        assert config.json()["data"]["client_id"] == "test-google-client"
        response = client.post(
            "/api/v1/auth/google",
            json={"credential": "synthetic-google-id-token"},
        )
        assert response.status_code == 200, response.text
        assert response.json()["data"]["email"] == claims["email"]
        assert client.get("/api/v1/auth/me").status_code == 200
        with Session(engine) as db:
            user = db.scalar(select(User).where(User.email == claims["email"]))
            assert user.google_sub == claims["sub"]
            assert db.get(Profile, user.id).display_name == claims["name"]
        claims["sub"] = "different-google-user"
        conflict = client.post(
            "/api/v1/auth/google",
            json={"credential": "synthetic-google-id-token"},
        )
        assert conflict.status_code == 409


def test_google_sign_in_links_existing_verified_email(monkeypatch):
    claims = {
        "email": "existing@example.com",
        "sub": "google-user-2",
        "name": "Existing User",
    }
    with google_client(monkeypatch, claims) as (client, engine):
        csrf = client.headers["X-CSRF-Token"]
        registration = client.post(
            "/api/v1/auth/register",
            headers={"X-CSRF-Token": csrf},
            json={
                "email": claims["email"],
                "password": "A-test-password-12345",
                "display_name": "Existing User",
            },
        )
        assert registration.status_code == 201, registration.text
        response = client.post(
            "/api/v1/auth/google",
            headers={"X-CSRF-Token": csrf},
            json={"credential": "synthetic-google-id-token"},
        )
        assert response.status_code == 200, response.text
        with Session(engine) as db:
            user = db.scalar(select(User).where(User.email == claims["email"]))
            assert user.google_sub == claims["sub"]
