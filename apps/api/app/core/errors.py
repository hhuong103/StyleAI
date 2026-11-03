from fastapi import Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, status: int, code: str, message: str, details=None):
        self.status, self.code, self.message = status, code, message
        self.details = details or {}


def result(request: Request, data, **meta):
    return {"data": data, "meta": {"request_id": request.state.request_id, **meta}}


def error_response(request: Request, status: int, code: str, message: str, details=None):
    return JSONResponse(
        status_code=status,
        content={
            "error": {"code": code, "message": message, "details": details or {}},
            "meta": {"request_id": getattr(request.state, "request_id", "unknown")},
        },
    )
