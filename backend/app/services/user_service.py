"""业务服务层：用户与会话、验证码、配额"""
import hashlib
import secrets
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.responses import ApiException
from app.core.security import create_token
from app.models.user import User, RefreshToken, VerifyCode, DailyQuota


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(8)}"


def hash_password(password: str) -> str:
    return hashlib.sha256((password + settings.secret_key).encode()).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash


def get(db: Session, user_id: str) -> User | None:
    return db.get(User, user_id)


def get_by_account(db: Session, account: str) -> User | None:
    return db.query(User).filter(User.account == account).first()


def create_user(db: Session, account: str, password: str, nickname: str = "") -> User:
    user = User(
        id=new_id("u"),
        account=account,
        password_hash=hash_password(password),
        nickname=nickname or account,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def issue_token_pair(db: Session, user: User) -> dict:
    access_token = create_token(user.id, "access")
    refresh_token = create_token(user.id, "refresh")
    db.add(RefreshToken(
        user_id=user.id,
        token_hash=hashlib.sha256(refresh_token.encode()).hexdigest(),
        expires_at=datetime.utcnow() + timedelta(days=settings.refresh_token_days),
    ))
    db.commit()
    return {"access_token": access_token, "refresh_token": refresh_token,
            "expires_in": settings.access_token_minutes * 60}


def rotate_refresh(db: Session, refresh_token: str) -> dict:
    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    record = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash,
                                           RefreshToken.revoked == 0).first()
    if not record or record.expires_at < datetime.utcnow():
        raise ApiException(40103, "登录状态已过期")
    user = db.get(User, record.user_id)
    if not user or not user.is_active:
        raise ApiException(40100, "用户不存在或已禁用")
    record.revoked = 1
    return issue_token_pair(db, user)


def create_verify_code(db: Session, account: str, scene: str) -> str:
    code = f"{secrets.randbelow(1000000):06d}"
    db.add(VerifyCode(
        account=account, scene=scene, code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=10),
    ))
    db.commit()
    return code


def check_verify_code(db: Session, account: str, scene: str, code: str) -> None:
    record = (db.query(VerifyCode)
              .filter(VerifyCode.account == account, VerifyCode.scene == scene,
                      VerifyCode.code == code, VerifyCode.used == 0)
              .order_by(VerifyCode.id.desc()).first())
    if not record or record.expires_at < datetime.utcnow():
        raise ApiException(40001, "验证码无效或已过期")
    record.used = 1
    db.commit()


# ---------- 配额 ----------

def get_quota(db: Session, user: User) -> dict:
    day = datetime.utcnow().strftime("%Y-%m-%d")
    row = db.query(DailyQuota).filter(DailyQuota.user_id == user.id,
                                      DailyQuota.day == day).first()
    used = {"llm_tokens": 0, "stt_minutes": 0, "tts_chars": 0}
    if row:
        used = {"llm_tokens": row.llm_tokens, "stt_minutes": row.stt_minutes,
                "tts_chars": row.tts_chars}
    limits = {"llm_tokens": settings.quota_llm_tokens,
              "stt_minutes": settings.quota_stt_minutes,
              "tts_chars": settings.quota_tts_chars}
    return {"used": used, "limits": limits, "reset_at": f"{day}T00:00:00+08:00"}


def consume_quota(db: Session, user: User, *, llm_tokens: int = 0,
                  stt_minutes: int = 0, tts_chars: int = 0) -> dict:
    day = datetime.utcnow().strftime("%Y-%m-%d")
    row = db.query(DailyQuota).filter(DailyQuota.user_id == user.id,
                                      DailyQuota.day == day).first()
    if not row:
        row = DailyQuota(user_id=user.id, day=day)
        db.add(row)
    # 列可空（旧数据/种子缺省），统一按 0 兜底再累加
    new_llm = (row.llm_tokens or 0) + llm_tokens
    new_stt = (row.stt_minutes or 0) + stt_minutes
    new_tts = (row.tts_chars or 0) + tts_chars
    limits = {"llm_tokens": settings.quota_llm_tokens,
              "stt_minutes": settings.quota_stt_minutes,
              "tts_chars": settings.quota_tts_chars}
    # 先校验配额，超额时拒绝并回滚，避免扣成负数/超额入账
    if new_llm > limits["llm_tokens"] or new_stt > limits["stt_minutes"] \
            or new_tts > limits["tts_chars"]:
        db.rollback()
        raise ApiException(42900, "今日额度已用完，请明日再试或升级套餐")
    row.llm_tokens = new_llm
    row.stt_minutes = new_stt
    row.tts_chars = new_tts
    db.commit()
    return get_quota(db, user)