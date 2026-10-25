"""依赖注入：当前用户 / 可选用户 / 数据库"""
from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.core.responses import ApiException
from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User
from app.services import user_service


def get_current_user(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> User:
    if not authorization.startswith("Bearer "):
        raise ApiException(40100, "未登录", status_code=401)
    token = authorization[7:]
    try:
        payload = decode_token(token)
    except Exception:
        raise ApiException(40103, "登录状态已过期", status_code=401)
    if payload.get("type") != "access":
        raise ApiException(40100, "无效令牌", status_code=401)
    user = user_service.get(db, payload["sub"])
    if not user:
        raise ApiException(40100, "用户不存在", status_code=401)
    return user


def get_optional_user(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> User | None:
    if authorization.startswith("Bearer "):
        try:
            payload = decode_token(authorization[7:])
            if payload.get("type") == "access":
                return user_service.get(db, payload["sub"])
        except Exception:
            return None
    return None
