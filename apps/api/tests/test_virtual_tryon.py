import asyncio
import base64
import io
from types import SimpleNamespace
from uuid import uuid4

import pytest
from PIL import Image

from app.core.errors import AppError
from app.core.schemas import VirtualTryOnInput
from app.modules.stylist.virtual_tryon import _generate_view


class FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self.payload = payload

    def json(self):
        return self.payload


class FakeClient:
    def __init__(self, response):
        self.response = response
        self.request = None

    async def post(self, url, **kwargs):
        self.request = {"url": url, **kwargs}
        return self.response


def _request_body():
    return VirtualTryOnInput(
        selected_products=[uuid4()],
        gender="FEMALE",
        age=24,
        height_cm=165,
        weight_kg=52,
        background="CAFE",
        consent_external_processing=True,
    )


def test_generate_view_uses_generate_content_request_and_normalizes_output(monkeypatch):
    from app.modules.stylist import virtual_tryon

    monkeypatch.setattr(
        virtual_tryon,
        "settings",
        SimpleNamespace(
            gemini_api_key="test-key",
            gemini_image_model="gemini-3.1-flash-image",
        ),
    )
    image = io.BytesIO()
    Image.new("RGB", (2, 3), "white").save(image, format="PNG")
    client = FakeClient(
        FakeResponse(
            200,
            {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "inlineData": {
                                        "mimeType": "image/png",
                                        "data": base64.b64encode(image.getvalue()).decode("ascii"),
                                    }
                                }
                            ]
                        }
                    }
                ]
            },
        )
    )

    reference = {"mime_type": "image/jpeg", "data": "cHJvZHVjdA=="}
    result = asyncio.run(_generate_view(client, _request_body(), [], "FRONT", [reference]))

    assert Image.open(io.BytesIO(result)).format == "JPEG"
    assert client.request["url"].endswith("/models/gemini-3.1-flash-image:generateContent")
    assert client.request["headers"]["x-goog-api-key"] == "test-key"
    payload = client.request["json"]
    assert payload["contents"][0]["role"] == "user"
    assert payload["contents"][0]["parts"][1] == {
        "inlineData": {"mimeType": "image/jpeg", "data": "cHJvZHVjdA=="}
    }
    assert payload["generationConfig"] == {
        "responseModalities": ["IMAGE"],
        "imageConfig": {"aspectRatio": "2:3", "imageSize": "1K"},
    }


def test_generate_view_reports_provider_error_details(monkeypatch):
    from app.modules.stylist import virtual_tryon

    monkeypatch.setattr(
        virtual_tryon,
        "settings",
        SimpleNamespace(
            gemini_api_key="test-key",
            gemini_image_model="gemini-3.1-flash-image",
        ),
    )
    client = FakeClient(
        FakeResponse(
            400,
            {
                "error": {
                    "code": 400,
                    "status": "INVALID_ARGUMENT",
                    "message": "Invalid generation configuration",
                }
            },
        )
    )

    with pytest.raises(AppError) as error:
        asyncio.run(_generate_view(client, _request_body(), [], "FRONT", []))

    assert error.value.code == "AI_IMAGE_FAILED"
    assert error.value.details == {
        "provider_status": 400,
        "provider_code": "INVALID_ARGUMENT",
        "provider_message": "Invalid generation configuration",
    }


@pytest.mark.parametrize(
    ("status_code", "provider_code", "provider_message", "error_code"),
    [
        (
            400,
            "INVALID_ARGUMENT",
            "API key not valid. Please pass a valid API key.",
            "AI_IMAGE_CONFIGURATION",
        ),
        (403, "PERMISSION_DENIED", "Provider error", "AI_IMAGE_CONFIGURATION"),
        (404, "NOT_FOUND", "Provider error", "AI_IMAGE_MODEL_UNAVAILABLE"),
        (429, "RESOURCE_EXHAUSTED", "Provider error", "AI_IMAGE_QUOTA_EXCEEDED"),
    ],
)
def test_generate_view_classifies_provider_configuration_failures(
    monkeypatch, status_code, provider_code, provider_message, error_code
):
    from app.modules.stylist import virtual_tryon

    monkeypatch.setattr(
        virtual_tryon,
        "settings",
        SimpleNamespace(
            gemini_api_key="test-key",
            gemini_image_model="gemini-3.1-flash-image",
        ),
    )
    client = FakeClient(
        FakeResponse(
            status_code,
            {"error": {"status": provider_code, "message": provider_message}},
        )
    )

    with pytest.raises(AppError) as error:
        asyncio.run(_generate_view(client, _request_body(), [], "FRONT", []))

    assert error.value.code == error_code
    assert error.value.details["provider_code"] == provider_code
