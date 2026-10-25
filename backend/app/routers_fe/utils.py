"""前端适配层共用工具"""
from fastapi import Depends
from sqlalchemy.orm import Session

from app.api.deps import get_optional_user, get_current_user
from app.db.session import get_db
from app.models.user import User


def user_view(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.nickname or user.account,
        "account": user.account,
        "role": user.role,
        "avatar": user.avatar,
    }


def get_optional_fe_user(authorization: str = Depends(get_optional_user)) -> User | None:
    return authorization


def get_fe_user(authorization: User = Depends(get_current_user)) -> User:
    return authorization