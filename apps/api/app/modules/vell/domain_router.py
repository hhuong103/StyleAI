from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request, Response
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError, result
from app.core.idempotency import execute_once
from app.core.schemas import Envelope
from app.db.models import Product, TryOnJob, User
from app.db.session import get_db
from app.modules.auth.security import admin_user, current_user
from app.modules.catalog.repository import ProductRepository
from app.modules.vell import domain_service as service
from app.modules.vell.bound_runtime import submit_bound_job
from app.modules.vell.domain_models import (
    Composition,
    CompositionItem,
    GarmentRegion,
    ModelPreset,
    SavedStudioLook,
    ShoppingItem,
    StudioSession,
)
from app.modules.vell.domain_schemas import (
    BoundTryOnInput,
    ComposeInput,
    CompositionOutput,
    GarmentInput,
    ModelInput,
    ModelOutput,
    OutboundInput,
    PreferencesPatch,
    RecommendationInput,
    ReviewInput,
    SavedLookInput,
    SessionInput,
    SessionOutput,
    SessionPatch,
    ShoppingItemInput,
    VerifiedProductOutput,
    VerifyProductInput,
)
from app.modules.vell.repository import TryOnJobRepository
from app.modules.vell.segmentation import queue_segmentation, shopping_regions
from app.modules.vell.service import job_data

router = APIRouter(tags=["VELL Domain"])
DB = Depends(get_db, scope="function")
AUTH = Depends(current_user)
ADMIN = Depends(admin_user)


@router.get("/me", response_model=Envelope[dict])
def me(request: Request, user: User = AUTH):
    return result(request, {"id": user.id, "role": user.role})


@router.get("/preferences", response_model=Envelope[dict])
def preferences(request: Request, user: User = AUTH, db: Session = DB):
    from app.modules.profiles.router import profile_data

    return result(request, profile_data(db, user.id))


@router.patch("/preferences", response_model=Envelope[dict])
def update_preferences(
    body: PreferencesPatch, request: Request, user: User = AUTH, db: Session = DB
):
    from pydantic import ValidationError

    from app.core.schemas import ProfileUpdate
    from app.modules.profiles.router import profile_data, update

    changes = body.model_dump(exclude_unset=True)
    try:
        merged = ProfileUpdate.model_validate({**profile_data(db, user.id), **changes})
    except ValidationError as exc:
        raise AppError(422, "VALIDATION_ERROR", "Cấu hình preferences không hợp lệ.") from exc
    return update(merged, request, user, db)


@router.get("/styles", response_model=Envelope[list[dict]])
@router.get("/occasions", response_model=Envelope[list[dict]])
@router.get("/outfit-categories", response_model=Envelope[list[dict]])
def taxonomy(request: Request, db: Session = DB):
    from app.db.models import Occasion, Style

    cls = Style if request.url.path.endswith("/styles") else Occasion
    return result(
        request,
        [
            {"code": row.code, "label": row.label}
            for row in db.scalars(select(cls).where(cls.active.is_(True)).order_by(cls.code))
        ],
    )


@router.get("/retailers", response_model=Envelope[list[dict]])
def retailers(request: Request):
    return result(
        request,
        [
            {
                "code": "shopee-vn",
                "name": "Shopee Vietnam",
                "allowed_domains": ["shopee.vn", "www.shopee.vn"],
                "verification_method": "ADMIN_ATTESTATION",
                "official_api_integration": False,
            }
        ],
    )


@router.get("/filters", response_model=Envelope[list[dict]])
def filters(request: Request):
    return result(
        request,
        [
            {"id": key, "scope": "BACKGROUND_ONLY", "realism_supported": False}
            for key in ("COOL_STUDIO", "NEUTRAL_STUDIO", "WARM_STUDIO")
        ],
    )


@router.post("/recommendations", response_model=Envelope[dict])
def recommend(body: RecommendationInput, request: Request, user: User = AUTH, db: Session = DB):
    from app.core.schemas import PlanInput
    from app.core.schemas import RecommendationInput as RankInput
    from app.modules.recommendations.service import generate
    from app.modules.stylist.service import make_plan

    session = service.owned(db, StudioSession, body.session_id, user.id)
    preset = service.model(db, session.model_id)
    context = body.model_dump(exclude={"session_id"})
    context["gender"] = {"FEMALE": "FEMALE", "MALE": "MALE", "ANDROGYNOUS": "UNISEX"}[
        preset.presentation
    ]
    plan = make_plan(db, user, PlanInput(context=context))
    ranked = generate(db, user, RankInput(plan_id=plan["plan_id"], top_k=8))
    compositions = []
    for look in ranked["looks"]:
        items = [
            {
                "product_id": item["product_id"],
                "variant_id": item["variant_id"],
                "slot": {
                    "TOP": "INNER_TOP",
                    "BOTTOM": "BOTTOM",
                    "OUTERWEAR": "OUTERWEAR",
                    "SHOES": "SHOES",
                }[item["role"]],
            }
            for item in look["items"]
        ]
        try:
            composed = service.compose(db, user.id, ComposeInput(name=look["name"], garments=items))
            compositions.append(service.outfit_data(db, composed))
        except AppError as exc:
            if exc.code not in {"PRODUCT_URL_UNVERIFIED", "PRODUCT_UNAVAILABLE", "INVALID_IMAGE"}:
                raise
    return result(
        request,
        {
            "outfits": compositions,
            "context": context,
            "diagnostics": ranked["diagnostics"],
            "verification_required": not bool(compositions),
        },
    )


@router.get("/models", response_model=Envelope[list[ModelOutput]])
def models(
    request: Request,
    presentation: str | None = Query(None, pattern="^(FEMALE|MALE|ANDROGYNOUS)$"),
    db: Session = DB,
):
    query = select(ModelPreset).order_by(ModelPreset.name)
    if presentation:
        query = query.where(ModelPreset.presentation == presentation)
    return result(request, [service.model_data(row) for row in db.scalars(query)])


@router.get("/models/{model_id}", response_model=Envelope[ModelOutput])
def model_detail(model_id: UUID, request: Request, db: Session = DB):
    return result(request, service.model_data(service.model(db, model_id)))


@router.post("/admin/models", status_code=201, response_model=Envelope[ModelOutput])
def add_model(body: ModelInput, request: Request, user: User = ADMIN, db: Session = DB):
    row = service.create_model(db, body)
    service.audit(db, user.id, "MODEL_REGISTERED", row.id, {"asset_hash": row.asset_hash})
    return result(request, service.model_data(row))


@router.post("/sessions", status_code=201, response_model=Envelope[SessionOutput])
def create_session(body: SessionInput, request: Request, user: User = AUTH, db: Session = DB):
    preset = service.model(db, body.model_id)
    row = StudioSession(user_id=user.id, model_id=preset.id)
    db.add(row)
    db.flush()
    return result(request, service.session_data(row))


@router.get("/sessions/{session_id}", response_model=Envelope[SessionOutput])
def session_detail(session_id: UUID, request: Request, user: User = AUTH, db: Session = DB):
    return result(
        request, service.session_data(service.owned(db, StudioSession, session_id, user.id))
    )


@router.patch("/sessions/{session_id}", response_model=Envelope[SessionOutput])
def update_session(
    session_id: UUID, body: SessionPatch, request: Request, user: User = AUTH, db: Session = DB
):
    row = service.owned(db, StudioSession, session_id, user.id, lock=True)
    return result(request, service.session_data(service.patch_session(db, row, body)))


@router.post("/outfits/compose", status_code=201, response_model=Envelope[CompositionOutput])
def compose(body: ComposeInput, request: Request, user: User = AUTH, db: Session = DB):
    return result(request, service.outfit_data(db, service.compose(db, user.id, body)))


@router.get("/outfits", response_model=Envelope[list[CompositionOutput]])
def outfits(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    user: User = AUTH,
    db: Session = DB,
):
    rows = db.scalars(
        select(Composition)
        .where(Composition.user_id == user.id)
        .order_by(Composition.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return result(
        request, [service.outfit_data(db, row) for row in rows], page=page, page_size=page_size
    )


@router.get("/outfits/{outfit_id}", response_model=Envelope[CompositionOutput])
@router.get("/outfits/{outfit_id}/garments", response_model=Envelope[CompositionOutput])
def outfit_detail(outfit_id: UUID, request: Request, user: User = AUTH, db: Session = DB):
    return result(
        request, service.outfit_data(db, service.owned(db, Composition, outfit_id, user.id))
    )


@router.patch(
    "/outfits/{outfit_id}/garments/{slot}", status_code=201, response_model=Envelope[dict]
)
def replace_garment(
    outfit_id: UUID,
    slot: str,
    body: GarmentInput,
    request: Request,
    user: User = AUTH,
    db: Session = DB,
):
    original = service.owned(db, Composition, outfit_id, user.id)
    items = list(
        db.scalars(select(CompositionItem).where(CompositionItem.outfit_id == original.id))
    )
    if slot != body.slot or slot not in {item.slot for item in items}:
        raise AppError(422, "OUTFIT_COMPOSITION_INVALID", "Garment slot không hợp lệ.")
    garments = [
        body
        if item.slot == slot
        else GarmentInput(slot=item.slot, product_id=item.product_id, variant_id=item.variant_id)
        for item in items
    ]
    revision = service.compose(
        db, user.id, ComposeInput(name=original.name, source_id=original.id, garments=garments)
    )
    return result(request, service.outfit_data(db, revision))


@router.get("/products", response_model=Envelope[list[VerifiedProductOutput]])
def products(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    db: Session = DB,
):
    query = select(Product).where(
        Product.active.is_(True), *ProductRepository._real_product_conditions()
    )
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(Product.id).offset((page - 1) * page_size).limit(page_size))
    return result(
        request,
        [service.product_view(db, row) for row in rows],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/products/{product_id}", response_model=Envelope[VerifiedProductOutput])
def product_detail(product_id: UUID, request: Request, db: Session = DB):
    return result(request, service.product_view(db, ProductRepository(db).get(str(product_id))))


@router.post("/admin/products/{product_id}/verify", response_model=Envelope[dict])
def verify_product(
    product_id: UUID,
    body: VerifyProductInput,
    request: Request,
    user: User = ADMIN,
    db: Session = DB,
):
    row = service.verify_product(db, product_id, body, user.id)
    return result(
        request,
        {"verification_id": row.id, "method": "ADMIN_ATTESTATION", "expires_at": row.expires_at},
    )


@router.post("/try-ons", status_code=202, response_model=Envelope[dict])
def submit(
    body: BoundTryOnInput,
    request: Request,
    idempotency_key: UUID = Header(alias="Idempotency-Key"),
    user: User = AUTH,
    db: Session = DB,
):
    return result(
        request,
        execute_once(
            db,
            request,
            user.id,
            body.model_dump(mode="json"),
            lambda: job_data(submit_bound_job(db, user.id, body, idempotency_key)),
        ),
    )


@router.get("/try-ons/{job_id}", response_model=Envelope[dict])
def job_detail(job_id: UUID, request: Request, user: User = AUTH, db: Session = DB):
    return result(request, job_data(TryOnJobRepository(db).owned(job_id, user.id)))


@router.post("/try-ons/{job_id}/cancel", response_model=Envelope[dict])
def cancel_job(job_id: UUID, request: Request, user: User = AUTH, db: Session = DB):
    return result(request, job_data(TryOnJobRepository(db).cancel(job_id, user.id)))


@router.get("/try-on-results/{result_id}", response_model=Envelope[dict])
def result_detail(result_id: UUID, request: Request, user: User = AUTH, db: Session = DB):
    job, binding = service.bound_job(db, result_id, user.id)
    return result(
        request,
        {
            **job.result,
            "segmentation_status": binding.segmentation_status,
            "quality_status": binding.quality_status,
        },
    )


@router.post(
    "/try-on-results/{result_id}/segmentation", status_code=202, response_model=Envelope[dict]
)
def segment(result_id: UUID, request: Request, user: User = AUTH, db: Session = DB):
    binding = queue_segmentation(db, result_id, user.id)
    return result(request, {"result_id": str(result_id), "status": binding.segmentation_status})


@router.get("/try-on-results/{result_id}/regions", response_model=Envelope[dict])
def regions(result_id: UUID, request: Request, user: User = AUTH, db: Session = DB):
    _, binding = service.bound_job(db, result_id, user.id)
    rows = db.scalars(select(GarmentRegion).where(GarmentRegion.job_id == str(result_id)))
    return result(
        request,
        {
            "result_id": str(result_id),
            "status": binding.segmentation_status,
            "error": binding.segmentation_error,
            "coordinate_system": "normalized_0_1",
            "regions": [
                {
                    "id": row.id,
                    "garment_id": row.garment_id,
                    "product_id": row.product_id,
                    "polygon": row.polygon,
                    "verification_status": row.status,
                }
                for row in rows
            ],
        },
    )


@router.get("/try-on-results/{result_id}/shopping-regions", response_model=Envelope[dict])
def shopping(result_id: UUID, request: Request, user: User = AUTH, db: Session = DB):
    return result(request, shopping_regions(db, result_id, user.id))


@router.post("/admin/try-on-results/{result_id}/review", response_model=Envelope[dict])
def review(
    result_id: UUID, body: ReviewInput, request: Request, user: User = ADMIN, db: Session = DB
):
    import hashlib

    from app.modules.catalog.service import safe_media_path

    job = db.get(TryOnJob, str(result_id))
    if job is None:
        raise AppError(404, "TRY_ON_RESULT_NOT_FOUND", "Không tìm thấy kết quả.")
    _, binding = service.bound_job(db, result_id, job.user_id)
    if body.result_image_hash != binding.output_hash:
        raise AppError(409, "RESULT_CHANGED", "Không khớp ảnh cần kiểm chứng.")
    front = next(v["url"] for v in job.result["views"] if v["view"] == "FRONT")
    if (
        hashlib.sha256(safe_media_path(front.removeprefix("/media/")).read_bytes()).hexdigest()
        != binding.output_hash
    ):
        raise AppError(409, "RESULT_CHANGED", "Ảnh đã thay đổi.")
    region_rows = list(db.scalars(select(GarmentRegion).where(GarmentRegion.job_id == job.id)))
    garment_ids = set(
        db.scalars(select(CompositionItem.id).where(CompositionItem.outfit_id == binding.outfit_id))
    )
    if body.approve and (
        binding.segmentation_status != "PENDING_REVIEW"
        or {r.garment_id for r in region_rows} != garment_ids
    ):
        raise AppError(
            409, "SEGMENTATION_NOT_READY", "Chưa có vùng được xác định cho đầy đủ garments."
        )
    binding.quality_status = "APPROVED" if body.approve else "REJECTED"
    binding.segmentation_status = "VERIFIED" if body.approve else "REJECTED"
    for row in region_rows:
        row.status = "VERIFIED" if body.approve else "REJECTED"
    service.audit(db, user.id, "RESULT_REVIEWED", job.id, body.model_dump())
    return result(request, {"result_id": job.id, "quality_status": binding.quality_status})


@router.post("/saved-looks", status_code=201, response_model=Envelope[dict])
def save_look(body: SavedLookInput, request: Request, user: User = AUTH, db: Session = DB):
    service.bound_job(db, body.result_id, user.id)
    row = SavedStudioLook(user_id=user.id, job_id=str(body.result_id), name=body.name)
    db.add(row)
    db.flush()
    return result(request, {"saved_look_id": row.id, "result_id": row.job_id, "name": row.name})


@router.get("/saved-looks", response_model=Envelope[list[dict]])
def saved_looks(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    user: User = AUTH,
    db: Session = DB,
):
    rows = db.scalars(
        select(SavedStudioLook)
        .where(SavedStudioLook.user_id == user.id)
        .order_by(SavedStudioLook.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return result(
        request,
        [{"saved_look_id": row.id, "result_id": row.job_id, "name": row.name} for row in rows],
    )


@router.get("/saved-looks/{look_id}", response_model=Envelope[dict])
def saved_look(look_id: UUID, request: Request, user: User = AUTH, db: Session = DB):
    row = service.owned(db, SavedStudioLook, look_id, user.id)
    job, binding = service.bound_job(db, row.job_id, user.id)
    return result(
        request,
        {
            "saved_look_id": row.id,
            "name": row.name,
            "result": job.result,
            "outfit": service.outfit_data(db, db.get(Composition, binding.outfit_id)),
            "model": service.model_data(db.get(ModelPreset, binding.model_id)),
        },
    )


@router.delete("/saved-looks/{look_id}", status_code=204)
def delete_saved(look_id: UUID, user: User = AUTH, db: Session = DB):
    db.delete(service.owned(db, SavedStudioLook, look_id, user.id))
    return Response(status_code=204)


@router.get("/wishlist", response_model=Envelope[list[dict]])
@router.get("/shopping-bag", response_model=Envelope[list[dict]])
def shopping_items(
    request: Request, page: int = Query(1, ge=1), user: User = AUTH, db: Session = DB
):
    kind = "WISHLIST" if request.url.path.endswith("/wishlist") else "BAG"
    rows = db.scalars(
        select(ShoppingItem)
        .where(ShoppingItem.user_id == user.id, ShoppingItem.kind == kind)
        .order_by(ShoppingItem.created_at.desc())
        .offset((page - 1) * 24)
        .limit(24)
    )
    return result(
        request,
        [
            {"id": row.id, "product": service.product_view(db, db.get(Product, row.product_id))}
            for row in rows
        ],
    )


@router.post("/wishlist/items", status_code=201, response_model=Envelope[dict])
@router.post("/shopping-bag/items", status_code=201, response_model=Envelope[dict])
def add_shopping_item(
    body: ShoppingItemInput, request: Request, user: User = AUTH, db: Session = DB
):
    kind = "WISHLIST" if "/wishlist/" in request.url.path else "BAG"
    ProductRepository(db).get(str(body.product_id))
    row = db.scalar(
        select(ShoppingItem).where(
            ShoppingItem.user_id == user.id,
            ShoppingItem.kind == kind,
            ShoppingItem.product_id == str(body.product_id),
        )
    )
    if row is None:
        row = ShoppingItem(user_id=user.id, product_id=str(body.product_id), kind=kind)
        db.add(row)
        db.flush()
    return result(request, {"id": row.id, "product_id": row.product_id})


@router.delete("/wishlist/items/{product_id}", status_code=204)
@router.delete("/shopping-bag/items/{product_id}", status_code=204)
def remove_shopping_item(product_id: UUID, request: Request, user: User = AUTH, db: Session = DB):
    kind = "WISHLIST" if "/wishlist/" in request.url.path else "BAG"
    db.execute(
        delete(ShoppingItem).where(
            ShoppingItem.user_id == user.id,
            ShoppingItem.kind == kind,
            ShoppingItem.product_id == str(product_id),
        )
    )
    return Response(status_code=204)


@router.post("/events/outbound-navigation", status_code=202, response_model=Envelope[dict])
def outbound(body: OutboundInput, request: Request, user: User = AUTH, db: Session = DB):
    data = shopping_regions(db, body.result_id, user.id)
    if str(body.region_id) not in {region["region_id"] for region in data["regions"]}:
        raise AppError(422, "REGION_MAPPING_INVALID", "Vùng chưa được phép mua sắm.")
    service.audit(
        db, user.id, "OUTBOUND_NAVIGATION", str(body.result_id), body.model_dump(mode="json")
    )
    return result(request, {"accepted": True})
