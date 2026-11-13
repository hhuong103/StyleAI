import asyncio
import base64
import binascii
import io
import logging
import mimetypes
from urllib.parse import quote

import httpx
from PIL import Image, UnidentifiedImageError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError
from app.core.schemas import VirtualTryOnInput
from app.db.models import User, uid
from app.modules.catalog.repository import ProductRepository

BACKGROUND_PROMPTS = {
    "SCHOOL": "a bright contemporary school courtyard with natural daylight",
    "CAFE": "a refined modern cafe with warm daylight and subtle depth",
    "PARTY": "an elegant evening party venue with cinematic practical lighting",
    "TRAVEL": "a modern travel setting with architectural depth and soft daylight",
    "OFFICE": "a polished contemporary office lobby with clean natural light",
    "STUDIO": "a professional neutral fashion studio with dimensional lighting",
}
VIEW_PROMPTS = {
    "LEFT": "left three-quarter view, with the model turned about 35 degrees",
    "FRONT": "straight-on front view",
    "RIGHT": "right three-quarter view, with the model turned about 35 degrees",
}
VIEW_LABELS = ("LEFT", "FRONT", "RIGHT")
SUPPORTED_REFERENCES = {"image/jpeg", "image/png", "image/webp"}
GEMINI_GENERATE_CONTENT_URL = "https://generativelanguage.googleapis.com/v1beta/models"
logger = logging.getLogger("styleai")


def _reference_files(products):
    references = []
    media_root = settings.media_root.resolve()
    for product in products:
        if not product.images:
            continue
        image = product.images[0]
        path = (settings.media_root / image.storage_key).resolve()
        try:
            path.relative_to(media_root)
        except ValueError:
            continue
        mime = mimetypes.guess_type(path.name)[0]
        if path.is_file() and mime in SUPPORTED_REFERENCES:
            references.append(path)
    return references


def _inline_reference(path) -> dict | None:
    try:
        with Image.open(path) as source:
            image = source.convert("RGB")
            image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
            output = io.BytesIO()
            image.save(output, format="JPEG", quality=88, optimize=True)
    except (OSError, UnidentifiedImageError):
        return None
    return {
        "type": "image",
        "data": base64.b64encode(output.getvalue()).decode("ascii"),
        "mime_type": "image/jpeg",
    }


def _prompt(body: VirtualTryOnInput, products, view: str) -> str:
    gender = {"FEMALE": "woman", "MALE": "man", "UNISEX": "adult person"}[body.gender]
    measurements = [
        f"height {body.height_cm} cm",
        f"weight {body.weight_kg} kg",
    ]
    for label, value in (
        ("bust", body.bust_cm),
        ("waist", body.waist_cm),
        ("hips", body.hips_cm),
    ):
        if value is not None:
            measurements.append(f"{label} {value} cm")
    garment_names = ", ".join(product.name for product in products)
    return (
        "Create one photorealistic, full-body fashion virtual try-on image of the same "
        f"adult {gender}, age {body.age}, with {', '.join(measurements)}. "
        f"Dress the model in these exact referenced products: {garment_names}. "
        "Preserve every product's silhouette, colour, material, seams, trims, footwear, "
        "and small construction details from the reference images. Do not add, remove, "
        "replace, recolour, or redesign a selected product. "
        f"Place the model in {BACKGROUND_PROMPTS[body.background]}. "
        "Use a vertical portrait 2:3 composition. "
        f"Camera angle: {VIEW_PROMPTS[view]}. "
        "Use premium ecommerce fashion photography, realistic anatomy, a natural pose, "
        "and consistent identity, outfit, lighting, lens, and environment. Keep the "
        "person visible from head to toe. No text, no added logos, no collage, and one "
        "person only. If a generated front-view reference is supplied, use it strictly "
        "to preserve the same person, garments, and scene while changing only the angle."
    )


def _extract_image(payload: dict) -> bytes | None:
    if not isinstance(payload, dict):
        return None
    candidates = payload.get("candidates")
    if not isinstance(candidates, list):
        return None
    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        content = candidate.get("content")
        if not isinstance(content, dict):
            continue
        parts = content.get("parts")
        if not isinstance(parts, list):
            continue
        for part in parts:
            if not isinstance(part, dict):
                continue
            inline_data = part.get("inlineData", part.get("inline_data"))
            if not isinstance(inline_data, dict):
                continue
            encoded = inline_data.get("data")
            if not isinstance(encoded, str):
                continue
            try:
                return base64.b64decode(encoded, validate=True)
            except (ValueError, binascii.Error):
                return None
    return None


def _provider_error(payload) -> tuple[str, str]:
    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict):
            message = error.get("message")
            code = error.get("status") or error.get("code")
        elif isinstance(error, str):
            message = error
            code = ""
        else:
            message = payload.get("message")
            code = payload.get("status", "")
    elif isinstance(payload, list):
        item = next((item for item in payload if isinstance(item, dict)), {})
        message = item.get("message", "")
        code = item.get("status", item.get("code", ""))
    else:
        message, code = "", ""
    return (
        message if isinstance(message, str) else "",
        str(code) if isinstance(code, (str, int)) else "",
    )


def _as_jpeg(image: bytes) -> bytes | None:
    try:
        with Image.open(io.BytesIO(image)) as source:
            output = io.BytesIO()
            source.convert("RGB").save(output, format="JPEG", quality=92)
            return output.getvalue()
    except (OSError, UnidentifiedImageError):
        return None


async def _generate_view(
    client: httpx.AsyncClient,
    body: VirtualTryOnInput,
    products,
    view: str,
    references: list[dict],
) -> bytes:
    model = quote(settings.gemini_image_model, safe="")
    response = await client.post(
        f"{GEMINI_GENERATE_CONTENT_URL}/{model}:generateContent",
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": settings.gemini_api_key,
        },
        json={
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": _prompt(body, products, view)},
                        *[
                            {
                                "inlineData": {
                                    "mimeType": reference["mime_type"],
                                    "data": reference["data"],
                                }
                            }
                            for reference in references
                        ],
                    ],
                }
            ],
            "generationConfig": {
                "responseModalities": ["IMAGE"],
                "imageConfig": {"aspectRatio": "2:3", "imageSize": "1K"},
            },
        },
    )
    if response.status_code >= 400:
        try:
            provider_message, provider_code = _provider_error(response.json())
        except ValueError:
            provider_message, provider_code = "", ""
        provider_message = provider_message[:300]
        logger.warning(
            "Gemini image request failed: status=%s code=%s message=%s",
            response.status_code,
            provider_code[:80],
            provider_message,
        )
        details = {
            "provider_status": response.status_code,
            "provider_code": provider_code[:80],
            "provider_message": provider_message,
        }
        invalid_api_key = (
            "api key not valid" in provider_message.lower()
            or "api key is invalid" in provider_message.lower()
            or provider_code.upper() in {"API_KEY_INVALID", "INVALID_API_KEY"}
        )
        if invalid_api_key:
            raise AppError(
                503,
                "AI_IMAGE_CONFIGURATION",
                "API key Gemini hiện không hợp lệ. Hãy tạo key mới trong Google AI Studio, cập nhật GEMINI_API_KEY rồi khởi động lại API.",
                details,
            )
        if response.status_code in {401, 403}:
            raise AppError(
                503,
                "AI_IMAGE_CONFIGURATION",
                "Gemini từ chối quyền truy cập. Hãy bật Generative Language API và kiểm tra giới hạn quyền của API key.",
                details,
            )
        if response.status_code == 404:
            raise AppError(
                503,
                "AI_IMAGE_MODEL_UNAVAILABLE",
                "Model tạo ảnh Gemini hiện không khả dụng cho API key này.",
                details,
            )
        if response.status_code == 429:
            raise AppError(
                503,
                "AI_IMAGE_QUOTA_EXCEEDED",
                "Đã hết hạn mức tạo ảnh Gemini. Hãy kiểm tra hạn mức và thanh toán của dự án.",
                details,
            )
        raise AppError(
            502,
            "AI_IMAGE_FAILED",
            "Gemini từ chối yêu cầu tạo ảnh.",
            details,
        )
    try:
        payload = response.json()
    except ValueError as exc:
        raise AppError(502, "AI_IMAGE_INVALID", "Phản hồi tạo ảnh từ Gemini không hợp lệ.") from exc
    image = _extract_image(payload)
    if not image:
        raise AppError(502, "AI_IMAGE_INCOMPLETE", "Gemini chưa trả về ảnh hoàn chỉnh.")
    jpeg = _as_jpeg(image)
    if not jpeg:
        raise AppError(502, "AI_IMAGE_INVALID", "Ảnh trả về từ Gemini không hợp lệ.")
    return jpeg


async def generate_virtual_try_on(db: Session, user: User, body: VirtualTryOnInput) -> dict:
    if not settings.gemini_api_key:
        raise AppError(
            503,
            "GEMINI_IMAGE_NOT_CONFIGURED",
            "Chưa cấu hình GEMINI_API_KEY cho chức năng thử đồ AI.",
        )

    repository = ProductRepository(db)
    products = [repository.get(str(product_id)) for product_id in body.selected_products]
    if len({product.id for product in products}) != len(products):
        raise AppError(422, "DUPLICATE_PRODUCT", "Mỗi sản phẩm chỉ được chọn một lần.")
    if any(
        not any(variant.active and variant.available for variant in product.variants)
        for product in products
    ):
        raise AppError(409, "PRODUCT_UNAVAILABLE", "Một sản phẩm đã hết hàng. Hãy chọn lại.")

    references = [
        reference
        for path in _reference_files(products)
        if (reference := _inline_reference(path)) is not None
    ]
    if not references:
        raise AppError(
            422,
            "NO_IMAGE_REFERENCE",
            "Các sản phẩm đã chọn chưa có ảnh JPEG, PNG hoặc WebP phù hợp để tạo ảnh.",
        )

    try:
        async with httpx.AsyncClient(timeout=270) as client:
            front = await _generate_view(client, body, products, "FRONT", references)
            front_reference = {
                "type": "image",
                "data": base64.b64encode(front).decode("ascii"),
                "mime_type": "image/jpeg",
            }
            left, right = await asyncio.gather(
                _generate_view(client, body, products, "LEFT", [*references, front_reference]),
                _generate_view(client, body, products, "RIGHT", [*references, front_reference]),
            )
    except httpx.TimeoutException as exc:
        raise AppError(504, "AI_IMAGE_TIMEOUT", "Tạo ảnh quá thời gian. Hãy thử lại.") from exc
    except httpx.HTTPError as exc:
        raise AppError(
            502, "AI_IMAGE_UNAVAILABLE", "Không thể kết nối dịch vụ tạo ảnh Gemini."
        ) from exc

    request_id = uid()
    output_dir = settings.media_root / "uploads" / "virtual-try-on" / user.id / request_id
    output_dir.mkdir(parents=True, exist_ok=True)
    views = []
    for index, (view, image) in enumerate(zip(VIEW_LABELS, (left, front, right))):
        filename = f"{index + 1}-{view.lower()}.jpg"
        (output_dir / filename).write_bytes(image)
        views.append(
            {
                "view": view,
                "url": (f"/media/uploads/virtual-try-on/{user.id}/{request_id}/{filename}"),
            }
        )

    return {
        "request_id": request_id,
        "views": views,
        "background": body.background,
        "product_ids": [product.id for product in products],
        "disclaimer": ("AI-generated preview. Verify garment fit and fine details before use."),
    }
