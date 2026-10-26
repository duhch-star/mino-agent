"""前端适配层：/api/auth/* 认证接口（驼峰契约）"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.responses import ApiException
from app.db.session import get_db
from app.routers_fe.utils import user_view
from app.services import user_service

router = APIRouter(prefix="/auth", tags=["FE-认证"])


class FeLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=64)


class FeRefreshRequest(BaseModel):
    refresh_token: str


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
