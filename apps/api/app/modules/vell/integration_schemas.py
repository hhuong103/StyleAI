from typing import Literal

from pydantic import BaseModel


class VellHealth(BaseModel):
    module: Literal["vell"] = "vell"
    status: Literal["ready"] = "ready"
    database: Literal["ready"] = "ready"
    schema_status: Literal["current"] = "current"


class VellConfig(BaseModel):
    api_base: Literal["/api/v1/vell"] = "/api/v1/vell"
    frontend_route: Literal["/vell"] = "/vell"
    catalog_route: Literal["/catalog"] = "/catalog"
    legacy_redirects: dict[str, str]
    model_presets: list[str]
    default_model_preset: str | None
    provider: Literal["gemini"] = "gemini"
    provider_model: str
    authentication: Literal["cookie_jwt"] = "cookie_jwt"
    mutations_require_csrf: Literal[True] = True
    max_products_per_try_on: Literal[4] = 4
    max_new_jobs_per_user_per_hour: Literal[5] = 5


class Capability(BaseModel):
    implemented: bool
    configured: bool
    available: bool
    reasons: list[str]
    modes: list[str]
    authentication_required: bool


class VellCapabilities(BaseModel):
    model_selection: Capability
    recommendation: Capability
    virtual_try_on: Capability
    garment_segmentation: Capability
    shopping_links: Capability
