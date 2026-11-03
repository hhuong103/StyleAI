from fastapi import APIRouter, Depends, Request
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.errors import AppError, result
from app.core.schemas import Envelope, ProfileUpdate
from app.db.models import Color, Preference, PreferenceColor, PreferenceStyle, Profile, Style, User
from app.db.session import get_db
from app.modules.auth.security import current_user

router = APIRouter(prefix="/users/me/profile", tags=["Profile"])


def profile_data(db, user_id):
    p, pref = db.get(Profile, user_id), db.get(Preference, user_id)
    return {
        "display_name": p.display_name,
        "gender": p.gender,
        "age_range": p.age_range,
        "locale": p.locale,
        "preferred_styles": list(
            db.scalars(select(PreferenceStyle.style_code).where(PreferenceStyle.user_id == user_id))
        ),
        "favorite_colors": list(
            db.scalars(select(PreferenceColor.color_code).where(PreferenceColor.user_id == user_id))
        ),
        "budget_min_vnd": pref.budget_min_vnd,
        "budget_max_vnd": pref.budget_max_vnd,
    }


def validate_codes(db, cls, codes):
    for code in codes:
        row = db.get(cls, code)
        if not row or not row.active:
            raise AppError(422, "INVALID_TAXONOMY", f"Mã danh mục không hợp lệ: {code}")


@router.get("", response_model=Envelope[dict])
def read(
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    return result(request, profile_data(db, user.id))


@router.put("", response_model=Envelope[dict])
def update(
    body: ProfileUpdate,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    validate_codes(db, Style, body.preferred_styles)
    validate_codes(db, Color, body.favorite_colors)
    profile, pref = db.get(Profile, user.id), db.get(Preference, user.id)
    for key in ["display_name", "gender", "age_range", "locale"]:
        setattr(profile, key, getattr(body, key))
    pref.budget_min_vnd, pref.budget_max_vnd = body.budget_min_vnd, body.budget_max_vnd
    db.execute(delete(PreferenceStyle).where(PreferenceStyle.user_id == user.id))
    db.execute(delete(PreferenceColor).where(PreferenceColor.user_id == user.id))
    db.add_all([PreferenceStyle(user_id=user.id, style_code=c) for c in set(body.preferred_styles)])
    db.add_all([PreferenceColor(user_id=user.id, color_code=c) for c in set(body.favorite_colors)])
    db.flush()
    return result(request, profile_data(db, user.id))
