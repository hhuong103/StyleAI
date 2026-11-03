import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, Request, Response
from jwt.exceptions import PyJWKClientConnectionError, PyJWKClientError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError
from app.db.models import AuthSession, User, uid
from app.db.session import get_db

hasher = PasswordHasher()
DUMMY_HASH = hasher.hash("not-a-real-user-password")
google_jwks = jwt.PyJWKClient("https://www.googleapis.com/oauth2/v3/certs", timeout=5)
logger = logging.getLogger("styleai.auth")


def utc(value):
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def verify_password(encoded, password):
    try:
        return hasher.verify(encoded, password)
    except (VerificationError, InvalidHashError):
        return False


def verify_google_credential(credential):
    if not settings.google_client_id:
        raise AppError(503, "GOOGLE_NOT_CONFIGURED", "Đăng nhập Google chưa được cấu hình.")
    try:
        signing_key = google_jwks.get_signing_key_from_jwt(credential)
    except PyJWKClientConnectionError:
        raise AppError(502, "GOOGLE_UNAVAILABLE", "Không thể xác minh tài khoản Google.") from None
    except PyJWKClientError:
        raise AppError(
            401,
            "GOOGLE_SIGNING_KEY_NOT_FOUND",
            "Google không nhận diện được mã đăng nhập này. Tải lại trang và thử lại; nếu vẫn xảy ra, hãy xác nhận nút Google dùng đúng Web Client ID mới.",
        ) from None
    except jwt.PyJWTError as error:
        logger.warning(
            "Google ID token rejected during signing-key lookup: error_type=%s",
            type(error).__name__,
        )
        raise AppError(
            401,
            "GOOGLE_CREDENTIAL_INVALID",
            "Google không thể xác minh mã đăng nhập. Hãy đảm bảo Client ID trên giao diện và GOOGLE_CLIENT_ID trong .env thuộc cùng một OAuth Web client.",
        ) from None
    try:
        claims = jwt.decode(
            credential,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.google_client_id,
            issuer=["accounts.google.com", "https://accounts.google.com"],
            options={"require": ["exp", "iat", "aud", "iss", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise AppError(
            401, "GOOGLE_CREDENTIAL_EXPIRED", "Mã đăng nhập Google đã hết hạn. Vui lòng thử lại."
        ) from None
    except jwt.InvalidAudienceError:
        raise AppError(
            401,
            "GOOGLE_CLIENT_ID_MISMATCH",
            "Client ID Google không khớp. Hãy dùng cùng một OAuth Client ID loại Web ở Google Cloud và trong GOOGLE_CLIENT_ID.",
        ) from None
    except jwt.InvalidIssuerError:
        raise AppError(
            401,
            "GOOGLE_ISSUER_INVALID",
            "Google trả về mã đăng nhập không hợp lệ. Hãy kiểm tra OAuth Client ID và thử lại.",
        ) from None
    except jwt.InvalidSignatureError:
        raise AppError(
            401,
            "GOOGLE_SIGNATURE_INVALID",
            "Chữ ký mã đăng nhập Google không hợp lệ. Hãy thử đăng nhập lại.",
        ) from None
    except jwt.PyJWTError as error:
        logger.warning(
            "Google ID token rejected during claim verification: error_type=%s",
            type(error).__name__,
        )
        raise AppError(
            401,
            "GOOGLE_CREDENTIAL_INVALID",
            "Google không thể xác minh mã đăng nhập. Hãy đảm bảo Client ID trên giao diện và GOOGLE_CLIENT_ID trong .env thuộc cùng một OAuth Web client.",
        ) from None

    email = claims.get("email")
    subject = claims.get("sub")
    verified = claims.get("email_verified")
    if (
        not isinstance(email, str)
        or len(email) > 254
        or not isinstance(subject, str)
        or not subject
        or len(subject) > 255
    ):
        raise AppError(401, "GOOGLE_CREDENTIAL_INVALID", "Không thể xác minh tài khoản Google.")
    if not (verified is True or verified == "true"):
        raise AppError(
            401, "GOOGLE_EMAIL_UNVERIFIED", "Email trong tài khoản Google chưa được xác minh."
        )
    return {
        "email": email.strip().lower(),
        "sub": subject,
        "name": claims.get("name", ""),
    }


def token(payload, ttl):
    current = datetime.now(UTC)
    return jwt.encode(
        {
            **payload,
            "iat": current,
            "exp": current + timedelta(seconds=ttl),
            "iss": "styleai",
            "aud": "styleai-web",
        },
        settings.secret,
        algorithm="HS256",
    )


def decode(value, kind):
    try:
        payload = jwt.decode(
            value,
            settings.secret,
            algorithms=["HS256"],
            audience="styleai-web",
            issuer="styleai",
            leeway=5,
            options={"require": ["exp", "iat", "iss", "aud", "kind"]},
        )
        if payload.get("kind") != kind:
            raise ValueError("Wrong token kind")
        return payload
    except (jwt.PyJWTError, ValueError, TypeError):
        raise AppError(401, "SESSION_EXPIRED", "Phiên đăng nhập đã hết hạn.") from None


def issue_session(db, response: Response, user, family=None, expires=None):
    raw = secrets.token_urlsafe(40)
    session = AuthSession(
        id=uid(),
        user_id=user.id,
        family_id=family or uid(),
        refresh_token_hash=digest(raw),
        expires_at=expires or datetime.now(UTC) + timedelta(seconds=settings.refresh_ttl),
    )
    db.add(session)
    db.flush()
    access = token(
        {"sub": user.id, "sid": session.id, "role": user.role, "kind": "access"},
        settings.access_ttl,
    )
    secure = settings.app_env == "production"
    response.set_cookie(
        "access_token",
        access,
        max_age=settings.access_ttl,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/api/v1",
    )
    response.set_cookie(
        "refresh_token",
        raw,
        max_age=max(1, int((utc(session.expires_at) - datetime.now(UTC)).total_seconds())),
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/api/v1/auth",
    )
    return session


def user_from_request(request: Request, db: Session) -> User | None:
    value = request.cookies.get("access_token")
    if not value:
        return None
    payload = decode(value, "access")
    user = db.get(User, payload.get("sub", ""))
    session = db.get(AuthSession, payload.get("sid", ""))
    if (
        not user
        or user.status != "ACTIVE"
        or not session
        or session.user_id != user.id
        or session.revoked_at
        or utc(session.expires_at) <= datetime.now(UTC)
    ):
        raise AppError(401, "SESSION_EXPIRED", "Phiên đăng nhập không còn hợp lệ.")
    return user


def optional_user(
    request: Request, db: Session = Depends(get_db, scope="function")
) -> User | None:
    return user_from_request(request, db)


def current_user(request: Request, db: Session = Depends(get_db, scope="function")) -> User:
    user = user_from_request(request, db)
    if not user:
        raise AppError(401, "AUTH_REQUIRED", "Vui lòng đăng nhập để tiếp tục.")
    return user


def admin_user(user: User = Depends(current_user)):
    if user.role != "ADMIN":
        raise AppError(403, "FORBIDDEN", "Bạn không có quyền quản trị.")
    return user
