"""统一响应与错误码"""
from datetime import datetime

from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class ApiException(Exception):
    def __init__(self, code: int, message: str, details: dict | None = None,
                 status_code: int = 200):
        self.code = code
        self.message = message
        self.details = details or {}
        self.status_code = status_code


def _infer_http_status(code: int) -> int:
    """按业务错误码推断 HTTP 状态（未显式指定 status_code 时）"""
    if 40100 <= code < 40200:
        return 401
    if 40300 <= code < 40400:
        return 403
    if 40400 <= code < 40500:
        return 404
    if 40900 <= code < 41000:
        return 409
    if 42900 <= code < 43000:
        return 429
    if 50300 <= code < 50400:
        return 503
    if 50000 <= code < 50100:
        return 500
    if 40000 <= code < 40100:
        return 400
    return 400


def _now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


async def api_exception_handler(request: Request, exc: ApiException):
    request_id = getattr(request.state, "request_id", "")
    # 前端适配层（/api/*）使用 {error:{...}, requestId} 契约格式，
    # 且未显式指定 status_code 时按业务码推断 HTTP 状态
    if request.url.path.startswith("/api"):
        status = exc.status_code if exc.status_code != 200 else _infer_http_status(exc.code)
        return JSONResponse(status_code=status, content={
            "error": {"code": exc.code, "message": exc.message,
                      "details": exc.details},
            "requestId": request_id,
        })
    return JSONResponse(status_code=exc.status_code, content={
        "code": exc.code,
        "message": exc.message,
        "details": exc.details,
        "meta": {"request_id": request_id, "ts": _now_iso()},
    })


def ok(data=None, **meta) -> dict:
    return {"code": 0, "data": data if data is not None else {},
            "meta": {"ts": _now_iso(), **meta}}


class Page(BaseModel):
    page: int = 1
    page_size: int = 20


def paginate(items: list, total: int, page: int, page_size: int) -> dict:
    return {"items": items, "total": total, "page": page, "page_size": page_size}
