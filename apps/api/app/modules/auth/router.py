import secrets
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.errors import AppError, result
from app.core.outputs import UserOutput
from app.core.schemas import Envelope, GoogleLogin, Login, Register
from app.db.models import AuthSession, Preference, Profile, User
from app.db.session import get_db
from app.modules.auth.security import (
    DUMMY_HASH,
    current_user,
    digest,
    hasher,
    issue_session,
    token,
    utc,
    verify_google_credential,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def user_data(db, user):
    profile = db.get(Profile, user.id)
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "display_name": profile.display_name,
        "profile_completed": bool(db.get(Preference, user.id).budget_max_vnd),
    }


@router.get("/csrf", response_model=Envelope[dict])
def csrf(request: Request, response: Response):
    from app.core.config import settings
    from app.db.models import uid

    value = token({"kind": "csrf", "nonce": uid()}, 3600)
    response.set_cookie(
        "csrf_token",
        value,
        httponly=True,
        secure=settings.app_env == "production",
        samesite="lax",
        path="/api/v1",
        max_age=3600,
    )
    return result(request, {"csrf_token": value})


@router.post("/register", status_code=201, response_model=Envelope[UserOutput])
def register(body: Register, request: Request, db: Session = Depends(get_db, scope="function")):
    email = str(body.email).strip().lower()
    if db.scalar(select(User).where(User.email == email)):
        raise AppError(409, "EMAIL_EXISTS", "Email đã được sử dụng.")
    user = User(email=email, password_hash=hasher.hash(body.password), role="USER")
    db.add(user)
    db.flush()
    db.add_all(
        [
            Profile(user_id=user.id, display_name=body.display_name.strip()),
            Preference(user_id=user.id),
        ]
    )
    db.flush()
    return result(request, user_data(db, user))


@router.post("/login", response_model=Envelope[UserOutput])
def login(
    body: Login,
    request: Request,
    response: Response,
    db: Session = Depends(get_db, scope="function"),
):
    user = db.scalar(select(User).where(User.email == str(body.email).lower()))
    valid = verify_password(user.password_hash if user else DUMMY_HASH, body.password)
    if not valid or not user or user.status != "ACTIVE":
        raise AppError(401, "INVALID_CREDENTIALS", "Email hoặc mật khẩu chưa đúng.")
    issue_session(db, response, user)
    return result(request, user_data(db, user))


@router.get("/google/config", response_model=Envelope[dict])
def google_config(request: Request):
    from app.core.config import settings

    return result(request, {"client_id": settings.google_client_id or None})


@router.post("/google", response_model=Envelope[UserOutput])
def google_login(
    body: GoogleLogin,
    request: Request,
    response: Response,
    db: Session = Depends(get_db, scope="function"),
):
    claims = verify_google_credential(body.credential)
    email = claims["email"]
    user = db.scalar(select(User).where(User.google_sub == claims["sub"]))
    if user is None:
        user = db.scalar(select(User).where(User.email == email))
        if user and user.google_sub not in {None, claims["sub"]}:
            raise AppError(
                409,
                "GOOGLE_ACCOUNT_LINKED",
                "Tài khoản này đã liên kết với Google khác.",
            )
        if user is None:
            display_name = claims["name"].strip() if isinstance(claims["name"], str) else ""
            user = User(
                email=email,
                password_hash=hasher.hash(secrets.token_urlsafe(64)),
                google_sub=claims["sub"],
                role="USER",
            )
            db.add(user)
            db.flush()
            db.add_all(
                [
                    Profile(
                        user_id=user.id,
                        display_name=(display_name or email.split("@")[0])[:80],
                    ),
                    Preference(user_id=user.id),
                ]
            )
        else:
            user.google_sub = claims["sub"]
    if user.status != "ACTIVE":
        raise AppError(401, "ACCOUNT_DISABLED", "Tài khoản đã bị vô hiệu hóa.")
    issue_session(db, response, user)
    return result(request, user_data(db, user))


@router.get("/me", response_model=Envelope[UserOutput])
def me(
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    return result(request, user_data(db, user))


@router.post("/refresh", response_model=Envelope[UserOutput])
def refresh(request: Request, response: Response, db: Session = Depends(get_db, scope="function")):
    raw = request.cookies.get("refresh_token", "")
    session = db.scalar(
        select(AuthSession).where(AuthSession.refresh_token_hash == digest(raw)).with_for_update()
    )
    if not session:
        raise AppError(401, "SESSION_EXPIRED", "Vui lòng đăng nhập lại.")
    if session.revoked_at:
        db.execute(
            update(AuthSession)
            .where(AuthSession.family_id == session.family_id)
            .values(revoked_at=datetime.now(UTC))
        )
        db.commit()  # Reuse revocation must survive the error response.
        raise AppError(401, "REFRESH_REUSED", "Phiên đăng nhập đã bị thu hồi.")
    user = db.get(User, session.user_id)
    if utc(session.expires_at) <= datetime.now(UTC) or user.status != "ACTIVE":
        raise AppError(401, "SESSION_EXPIRED", "Vui lòng đăng nhập lại.")
    session.revoked_at = datetime.now(UTC)
    replacement = issue_session(db, response, user, session.family_id, session.expires_at)
    session.replaced_by_id = replacement.id
    return result(request, user_data(db, user))


@router.post("/logout", status_code=204)
def logout(request: Request, db: Session = Depends(get_db, scope="function")):
    raw = request.cookies.get("refresh_token", "")
    session = db.scalar(
        select(AuthSession).where(AuthSession.refresh_token_hash == digest(raw)).with_for_update()
    )
    if session:
        db.execute(
            update(AuthSession)
            .where(AuthSession.family_id == session.family_id)
            .values(revoked_at=datetime.now(UTC))
        )
    response = Response(status_code=204)
    response.delete_cookie("access_token", path="/api/v1")
    response.delete_cookie("refresh_token", path="/api/v1/auth")
    return response
