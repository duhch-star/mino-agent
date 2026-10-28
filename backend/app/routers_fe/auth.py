"""前端适配层：/api/auth/* 认证接口（驼峰契约）"""
import ipaddress
import os
import threading

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.responses import ApiException
from app.db.session import get_db
from app.routers_fe.utils import user_view
from app.services import user_service
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["FE-认证"])


class FeLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=64)


class FeRefreshRequest(BaseModel):
    refresh_token: str


class DesktopSetupRequest(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=64)


_setup_lock = threading.Lock()


def _desktop_only(request: Request):
    host = request.client.host if request.client else ""
    try:
        local = ipaddress.ip_address(host).is_loopback
    except ValueError:
        local = False
    if os.environ.get("MINOS_DESKTOP") != "1" or not local:
        raise ApiException(40300, "仅限本机桌面首次设置", status_code=403)
    # This unauthenticated local endpoint must not be callable by hostile websites.
    if request.headers.get("origin"):
        raise ApiException(40300, "首次设置请通过桌面启动器", status_code=403)


@router.get("/desktop-status")
def desktop_status(request: Request, db: Session = Depends(get_db)):
    _desktop_only(request)
    return {"setupRequired": db.query(User.id).first() is None}


@router.post("/desktop-setup")
def desktop_setup(req: DesktopSetupRequest, request: Request, db: Session = Depends(get_db)):
    _desktop_only(request)
    account = req.username.strip()
    if not account:
        raise ApiException(40000, "请输入账号", status_code=400)
    with _setup_lock:
        # BEGIN IMMEDIATE serializes first-user checks across SQLite connections.
        # Desktop runs exactly one worker; lock also protects other DB dialects.
        try:
            if db.get_bind().dialect.name == "sqlite":
                db.execute(text("BEGIN IMMEDIATE"))
            if db.query(User.id).first() is not None:
                raise ApiException(40900, "首次设置已完成", status_code=409)
            user = user_service.create_user(db, account, req.password)
            return {"ok": True, "username": user.account}
        except Exception:
            db.rollback()
            raise


@router.post("/login")
def fe_login(req: FeLoginRequest, db: Session = Depends(get_db)):
    user = user_service.get_by_account(db, req.username)
    if not user or not user_service.verify_password(req.password, user.password_hash):
        raise ApiException(40003, "账号或密码错误", status_code=401)
    if not user.is_active:
        raise ApiException(40300, "账号已禁用", status_code=403)
    if not user.password_hash.startswith('pbkdf2_sha256$'):
        user.password_hash = user_service.hash_password(req.password)
        db.commit()
    tokens = user_service.issue_token_pair(db, user)
    return {
        "accessToken": tokens["access_token"],
        "refreshToken": tokens["refresh_token"],
        "expiresIn": tokens["expires_in"],
        "user": user_view(user),
    }


@router.post("/refresh")
def fe_refresh(req: FeRefreshRequest, db: Session = Depends(get_db)):
    tokens = user_service.rotate_refresh(db, req.refresh_token)
    return {
        "accessToken": tokens["access_token"],
        "refreshToken": tokens["refresh_token"],
        "expiresIn": tokens["expires_in"],
    }


@router.post("/logout")
def fe_logout(req: FeRefreshRequest, db: Session = Depends(get_db)):
    user_service.rotate_refresh(db, req.refresh_token)
    return {"ok": True}
