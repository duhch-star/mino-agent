"""应用配置：通过环境变量覆盖（生产使用 .env / K8s ConfigMap）"""
from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, model_validator
from sqlalchemy.engine import make_url
from app.core.paths import APP_DIR, DATA_DIR

BASE_DIR = APP_DIR


class Settings(BaseSettings):
    # Never load the source checkout's .env, even when CWD is backend/.
    model_config = SettingsConfigDict(env_file=str(DATA_DIR / ".env"), env_file_encoding="utf-8", extra="ignore", hide_input_in_errors=True)

    app_name: str = "小民求职智能体"
    debug: bool = False
    seed_demo_data: bool = False
    api_prefix: str = "/v1"

    # 数据库：开发用 SQLite；生产用 PostgreSQL(+pgvector) 连接串覆盖
    database_url: str = f"sqlite:///{(DATA_DIR / 'xiaomin.db').as_posix()}"

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
    # Optional same-provider interview override; no additional key or endpoint.
    interview_llm_model: str = Field(default="", max_length=200)
    interview_max_tokens: int = Field(default=1000, ge=512, le=2400)
    interview_temperature: float = Field(default=0.2, ge=0, le=1)
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
    upload_dir: str = str(DATA_DIR / "uploads")
    mambo_tts_key: str = ""
    mambo_tts_api: str = "https://api.milorapart.top/apis/mbAIscvip"
    resume_xelatex: str = ""

    @model_validator(mode="after")
    def normalize_storage(self):
        url = make_url(self.database_url)
        if url.get_backend_name() == "sqlite" and url.database not in (None, "", ":memory:"):
            if url.query.get("uri") == "true" or url.database.startswith("file:"):
                raise ValueError("SQLite URI paths are unsupported; use an ordinary absolute SQLite path")
            path = Path(url.database).expanduser()
            if not path.is_absolute():
                path = DATA_DIR / path
            self.database_url = url.set(database=path.resolve().as_posix()).render_as_string(hide_password=False)
        uploads = Path(self.upload_dir).expanduser()
        self.upload_dir = str((uploads if uploads.is_absolute() else DATA_DIR / uploads).resolve())
        return self


@lru_cache
def get_settings() -> Settings:
    value = Settings()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if value.secret_key == "dev-secret-change-me":
        # Persist a per-installation signing key, never a shared shipped secret.
        import secrets
        import os
        path = DATA_DIR / ".jwt-secret"
        try:
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            pass
        else:
            with os.fdopen(fd, "w", encoding="utf-8") as target:
                target.write(secrets.token_urlsafe(48))
        value.secret_key = path.read_text(encoding="utf-8").strip()
        if len(value.secret_key) < 32:
            raise ValueError("Invalid local JWT signing key; restore .jwt-secret or configure SECRET_KEY")
    return value


settings = get_settings()
