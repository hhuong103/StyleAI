import re
import unicodedata
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import or_, select

from app.core.errors import AppError
from app.db.models import Color, Occasion, OutfitRule, Style, StylistPlan
from app.modules.profiles.router import profile_data, validate_codes

OCCASION_WORDS = {
    "INTERVIEW": ["phong van", "interview"],
    "OFFICE": ["cong so", "van phong", "office"],
    "CAFE": ["ca phe", "cafe", "coffee"],
    "DATE": ["hen ho", "date"],
    "PARTY": ["du tiec", "party"],
    "TRAVEL": ["du lich", "travel"],
    "DAILY": ["hang ngay", "daily"],
}
STYLE_WORDS = {
    "MINIMAL": ["toi gian", "minimal"],
    "SMART_CASUAL": ["thanh lich", "smart casual"],
    "FORMAL": ["trang trong", "formal"],
    "STREETWEAR": ["duong pho", "streetwear"],
    "CASUAL": ["thoai mai", "casual"],
    "KOREAN": ["han quoc", "korean"],
    "SPORTY": ["the thao", "sporty"],
    "VINTAGE": ["co dien", "vintage"],
}


def normalize(text):
    return "".join(
        c
        for c in unicodedata.normalize("NFD", text.lower().replace("đ", "d"))
        if unicodedata.category(c) != "Mn"
    )


def parse_text(text):
    value = normalize(text)
    parsed = {}
    for field, mapping in [("occasion", OCCASION_WORDS), ("style", STYLE_WORDS)]:
        for code, words in mapping.items():
            if any(re.search(r"(?<!\w)" + re.escape(word) + r"(?!\w)", value) for word in words):
                parsed[field] = code
                break
    money = re.search(r"(\d+(?:[.,]\d+)?)\s*(trieu|million|tr|m|k|nghin|ngan)(?!\w)", value)
    if money:
        multiple = 1000 if money[2] in ["k", "nghin", "ngan"] else 1000000
        parsed["budget_max_vnd"] = int(Decimal(money[1].replace(",", ".")) * multiple)
    else:
        explicit = re.search(r"(\d[\d .,_]*\d)\s*(vnd|dong|₫)", value)
        if explicit:
            parsed["budget_max_vnd"] = int(re.sub(r"\D", "", explicit[1]))
        else:
            amount = re.search(r"\b\d{5,9}\b", value)
            if amount:
                parsed["budget_max_vnd"] = int(amount[0])
            elif re.search(r"\d[.,]\d", value):
                parsed["ambiguous_budget"] = True
    return parsed


def make_plan(db, user, body):
    profile = profile_data(db, user.id)
    parsed = parse_text(body.text)
    explicit = body.context.model_dump(exclude_unset=True)
    defaults = {
        "gender": profile["gender"],
        "occasion": "DAILY",
        "style": (profile["preferred_styles"] or ["CASUAL"])[0],
        "preferred_colors": profile["favorite_colors"],
        "budget_max_vnd": profile["budget_max_vnd"] or 1500000,
        "sizes": {},
    }
    context = defaults.copy()
    sources = {
        k: (
            "profile"
            if (
                (k == "gender" and profile["gender"])
                or (k == "style" and profile["preferred_styles"])
                or (k == "preferred_colors" and profile["favorite_colors"])
                or (k == "budget_max_vnd" and profile["budget_max_vnd"])
            )
            else "default"
        )
        for k in context
    }
    warnings = []
    for layer, values in [("text", parsed), ("form", explicit)]:
        for key, val in values.items():
            if key not in context or (val is None and key != "gender"):
                continue
            if layer == "form" and key in parsed and parsed[key] != val:
                warnings.append({"code": "FORM_OVERRIDES_TEXT", "field": key})
            context[key], sources[key] = val, layer
    if not 0 < context["budget_max_vnd"] <= 100000000:
        raise AppError(422, "INVALID_BUDGET", "Ngân sách phải từ 1 đến 100.000.000 VND.")
    validate_codes(db, Style, [context["style"]])
    validate_codes(db, Occasion, [context["occasion"]])
    validate_codes(db, Color, context["preferred_colors"])
    rules = list(
        db.scalars(
            select(OutfitRule).where(
                OutfitRule.active.is_(True),
                OutfitRule.occasion_code == context["occasion"],
                or_(OutfitRule.style_code == context["style"], OutfitRule.style_code.is_(None)),
                or_(OutfitRule.gender == context["gender"], OutfitRule.gender.is_(None)),
            )
        )
    )
    if not rules:
        allowed = list(
            db.scalars(
                select(OutfitRule.style_code)
                .where(OutfitRule.active.is_(True), OutfitRule.occasion_code == context["occasion"])
                .distinct()
            )
        )
        raise AppError(
            400,
            "UNSUPPORTED_CONTEXT",
            "Chưa có công thức cho kết hợp này. Hãy chọn phong cách khác.",
            {"available_styles": allowed},
        )
    rule = sorted(
        rules,
        key=lambda r: (
            r.style_code is not None,
            r.gender is not None,
            r.priority,
            r.rule_key,
            r.version,
        ),
        reverse=True,
    )[0]
    needs = []
    if (parsed.get("ambiguous_budget") and "budget_max_vnd" not in explicit) or sources[
        "budget_max_vnd"
    ] == "default":
        needs.append("budget_max_vnd")
    template = {
        "slots": rule.slots,
        "rule_version": f"{rule.rule_key}@{rule.version}",
        "field_sources": sources,
        "warnings": warnings,
        "needs_confirmation": needs,
    }
    plan = StylistPlan(
        user_id=user.id,
        raw_text=body.text,
        normalized_context=context,
        template=template,
        rule_id=rule.id,
        expires_at=datetime.now(UTC) + timedelta(hours=24),
    )
    db.add(plan)
    db.flush()
    return {
        "plan_id": plan.id,
        "normalized_context": context,
        "schema_version": "1.0",
        "expires_at": plan.expires_at.isoformat(),
        **template,
    }
