"""应用配置：通过环境变量覆盖（生产使用 .env / K8s ConfigMap）"""
from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "小民求职智能体"
    debug: bool = True
    api_prefix: str = "/v1"

    # 数据库：开发用 SQLite；生产用 PostgreSQL(+pgvector) 连接串覆盖
    database_url: str = f"sqlite:///{BASE_DIR / 'xiaomin.db'}"

    # JWT
    secret_key: str = "dev-secret-change-me"
    algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 30

    # CORS
    cors_origins: list[str] = ["*"]

    # 供应商密钥（仅后端持有，客户端永不下发）
    llm_api_key: str = ""
    llm_base_url: str = ""
    llm_model: str = "glm-4-flash"
    stt_provider: str = "mock"
    tts_provider: str = "mock"

    # MinerU 文档解析（可选）：配置后 PDF/图片优先走 MinerU 在线 API；
    # 留空则使用本地 pdfplumber / python-docx 轻量解析
    mineru_api_key: str = ""
    mineru_base_url: str = "https://api.mineru.net/v4"

    # 配额默认值（每天）
    quota_llm_tokens: int = 200_000
    quota_stt_minutes: int = 30
    quota_tts_chars: int = 20_000

    # 上传文件本地存储目录（生产换 OSS/COS）
    upload_dir: str = str(BASE_DIR / "uploads")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
