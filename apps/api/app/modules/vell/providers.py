import asyncio
import base64
from typing import Protocol

import httpx

from app.core.errors import AppError
from app.core.schemas import VirtualTryOnInput
from app.modules.stylist.virtual_tryon import _generate_view


class TryOnProvider(Protocol):
    async def generate(
        self, body: VirtualTryOnInput, products, references: list[dict]
    ) -> dict[str, bytes]: ...


class GeminiTryOnProvider:
    """Adapter for the existing Gemini generateContent integration."""

    async def generate(self, body, products, references):
        try:
            async with httpx.AsyncClient(timeout=270) as client:
                front = await _generate_view(client, body, products, "FRONT", references)
                front_reference = {
                    "data": base64.b64encode(front).decode("ascii"),
                    "mime_type": "image/jpeg",
                }
                left, right = await asyncio.gather(
                    _generate_view(client, body, products, "LEFT", [*references, front_reference]),
                    _generate_view(client, body, products, "RIGHT", [*references, front_reference]),
                )
                return {"FRONT": front, "LEFT": left, "RIGHT": right}
        except httpx.TimeoutException as exc:
            raise AppError(504, "AI_IMAGE_TIMEOUT", "Tạo ảnh quá thời gian. Hãy thử lại.") from exc
        except httpx.HTTPError as exc:
            raise AppError(502, "AI_IMAGE_UNAVAILABLE", "Không thể kết nối dịch vụ AI.") from exc


def get_provider(name: str) -> TryOnProvider:
    if name != "gemini":
        raise AppError(503, "AI_PROVIDER_UNAVAILABLE", "Nhà cung cấp AI chưa được cấu hình.")
    return GeminiTryOnProvider()
