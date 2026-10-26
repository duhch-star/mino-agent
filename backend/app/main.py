"""小民求职智能体 - FastAPI 后端

架构：
- FastAPI + SQLAlchemy 2.0 + SQLite（开发）/ PostgreSQL（生产，含 pgvector）
- 分层：routers(接口) / services(业务) / models(ORM) / schemas(Pydantic)
- 统一响应：{code, data, meta}；错误码见 docs/API.md
"""
import secrets
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.responses import ApiException, api_exception_handler
from app.db.session import engine, Base
from app.models.chat import ResumeDocument  # register the new table before create_all
from app.routers import (
    auth, users, chapters, progress, qa, interviews, coach, files, admin, ws,
)
from app.routers_fe import (
    auth as fe_auth, users as fe_users, knowledge as fe_knowledge,
    guides as fe_guides, interview as fe_interview, chat as fe_chat,
    career as fe_career, review as fe_review, speech as fe_speech, resume as fe_resume,
    resume_documents as fe_resume_documents,
    pi_web as fe_pi_web,
)

API_PREFIX = settings.api_prefix
FE_PREFIX = "/api"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 开发环境自动建表（生产使用 Alembic 迁移）
    Base.metadata.create_all(bind=engine)
    from app.db.seed import seed
    from app.db.session import SessionLocal
    with SessionLocal() as session:
        seed(session)
    yield
    from app.services.pi_web_service import manager as pi_web_manager
    pi_web_manager.shutdown()


app = FastAPI(
    title="小民求职智能体 API",
    description="求职知识学习 / 模拟面试 / 职业辅导桌面智能体后端",
    version="0.1.0",
    lifespan=lifespan,
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    """为每个请求生成 request_id（方案 §2.2 统一响应 meta.request_id）"""
    request.state.request_id = f"req_{secrets.token_hex(6)}"
    request.state.start_ts = time.time()
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(ApiException, api_exception_handler)

for router in (auth.router, users.router, chapters.router, progress.router,
               qa.router, interviews.router, coach.router, files.router,
               admin.router, ws.router):
    app.include_router(router, prefix=API_PREFIX)

# 前端适配层（/api/*）：与 mino-agent 前端契约对齐
for router in (fe_auth.router, fe_users.router, fe_knowledge.router,
               fe_guides.router, fe_interview.router, fe_chat.router,
               fe_career.router, fe_review.router, fe_speech.router, fe_resume.router,
               fe_resume_documents.router, fe_pi_web.router):
    app.include_router(router, prefix=FE_PREFIX)


@app.get("/health")
def health():
    return {"status": "ok", "service": "xiaomin-backend", "version": app.version}


@app.get("/")
def root():
    return {"name": app.title, "docs": "/docs", "openapi": "/openapi.json"}
