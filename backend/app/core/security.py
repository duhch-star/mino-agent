"""JWT 工具"""
import secrets
import time
import jwt

from app.core.config import settings


def create_token(user_id: str, token_type: str = "access",
                 minutes: int | None = None) -> str:
    now = int(time.time())
    if token_type == "refresh":
        ttl = settings.refresh_token_days * 86400
    else:
        ttl = (minutes or settings.access_token_minutes) * 60
    payload = {
        "sub": user_id,
        "type": token_type,
        "iat": now,
        "exp": now + ttl,
        # jti 保证同一秒内签发的令牌也不重复（刷新轮换不会产生哈希冲突）
        "jti": secrets.token_hex(8),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
