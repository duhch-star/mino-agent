"""用户与认证相关 ORM"""
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    account: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), default="")
    nickname: Mapped[str] = mapped_column(String(80), default="")
    avatar: Mapped[str] = mapped_column(String(512), default="")
    direction: Mapped[str] = mapped_column(String(80), default="")     # 求职方向，如 互联网
    target_role: Mapped[str] = mapped_column(String(80), default="")   # 目标岗位
    grade: Mapped[str] = mapped_column(String(40), default="")         # 年级/身份
    experience_years: Mapped[int] = mapped_column(Integer, default=0)
    role: Mapped[str] = mapped_column(String(20), default="user")      # user / admin
    is_active: Mapped[int] = mapped_column(Integer, default=1)
    settings_json: Mapped[str] = mapped_column(Text, default="{}")     # 用户设置（隐私/UI），JSON 序列化
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(40), index=True)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    revoked: Mapped[int] = mapped_column(Integer, default=0)


class VerifyCode(Base):
    __tablename__ = "verify_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account: Mapped[str] = mapped_column(String(120), index=True)
    scene: Mapped[str] = mapped_column(String(20))   # register/login/reset
    code: Mapped[str] = mapped_column(String(10))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class DailyQuota(Base):
    """每日配额消耗记录"""
    __tablename__ = "daily_quotas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(40), index=True)
    day: Mapped[str] = mapped_column(String(10), index=True)     # YYYY-MM-DD
    llm_tokens: Mapped[int] = mapped_column(Integer, default=0)
    stt_minutes: Mapped[int] = mapped_column(Integer, default=0)
    tts_chars: Mapped[int] = mapped_column(Integer, default=0)