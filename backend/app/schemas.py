"""Pydantic 请求/响应模型"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


# ---------- 通用 ----------
class OkData(BaseModel):
    code: int = 0
    data: Any


class PageResult(BaseModel):
    items: list
    total: int
    page: int
    page_size: int


# ---------- 认证 ----------
class RegisterRequest(BaseModel):
    account: str = Field(min_length=5, max_length=120)
    code: str = Field(min_length=6, max_length=6)
    password: str = Field(min_length=8, max_length=64)


class LoginRequest(BaseModel):
    account: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class VerifyCodeRequest(BaseModel):
    account: str
    scene: str = Field(pattern="^(register|login|reset)$")


class UserOut(BaseModel):
    id: str
    account: str
    nickname: str
    avatar: str = ""
    direction: str = ""
    target_role: str = ""
    grade: str = ""
    experience_years: int = 0
    role: str = "user"
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    user: UserOut


class UpdateProfileRequest(BaseModel):
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    direction: Optional[str] = None
    target_role: Optional[str] = None
    grade: Optional[str] = None
    experience_years: Optional[int] = Field(default=None, ge=0, le=60)


# ---------- 配额 ----------
class UpdateSettingsRequest(BaseModel):
    privacy: Optional[dict] = None
    ui: Optional[dict] = None


# ---------- 章节 ----------
class ChapterOut(BaseModel):
    id: str
    slug: str
    title: str
    tags: list = []
    prereq: list = []
    related: list = []
    difficulty: str = "入门"
    read_time_min: int = 5
    version: int = 1
    source: str = ""
    status: str = "published"
    summary: str = ""
    outline: list = []
    body_md: str = ""
    quiz_count: int = 0
    updated_at: datetime


class ChapterListItem(BaseModel):
    id: str
    slug: str
    title: str
    tags: list = []
    difficulty: str
    read_time_min: int
    summary: str
    updated_at: datetime


class ChapterPublicOut(ChapterListItem):
    """发布后的公开章节"""
    version: int
    source: str
    outline: list
    body_md: str
    quiz_count: int
    prereq: list = []
    related: list = []


class GraphOut(BaseModel):
    nodes: list
    edges: list


class QuizOut(BaseModel):
    id: str
    chapter_id: str
    type: str
    stem: str
    options: list = []
    # answer 不返回（避免泄题）


class QuizSubmitRequest(BaseModel):
    answers: list[dict]


class QuizSubmitOut(BaseModel):
    score: float
    per_question: list[dict]
    feedback: str


# ---------- 进度/收藏/笔记/推荐 ----------
class ProgressUpdate(BaseModel):
    position_percent: Optional[float] = Field(default=None, ge=0, le=100)
    completed: Optional[bool] = None
    quiz_score: Optional[float] = Field(default=None, ge=0, le=100)


class ProgressOut(BaseModel):
    chapter_id: str
    position_percent: float
    completed: bool
    quiz_score: Optional[float]
    last_read_at: Optional[datetime]


class NoteCreate(BaseModel):
    chapter_id: str
    anchor: str = ""
    text: str = Field(min_length=1)


class NoteOut(BaseModel):
    id: str
    chapter_id: str
    anchor: str
    text: str
    created_at: datetime


class RecommendItem(BaseModel):
    chapter_id: str
    reason: str
    rank: int
    position_percent: float = 0


# ---------- 问答 ----------
class QaAskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    chapter_id: Optional[str] = None
    selection: Optional[str] = None


class QaSource(BaseModel):
    chapter_id: str
    title: str
    anchor: str = ""


class QaAnswer(BaseModel):
    answer: str
    sources: list = []
    related_chapter: Optional[str] = None


# ---------- 面试 ----------
class InterviewCreateRequest(BaseModel):
    job_role: str = Field(min_length=1, max_length=80)
    level: str = Field(default="", max_length=40)
    difficulty: str = Field(default="中等", max_length=40)
    duration_min: int = Field(default=20, ge=5, le=60)
    mode: str = Field(default="voice", pattern="^(voice|text)$")
    question_tags: list = []


class AnswerSubmitRequest(BaseModel):
    question_id: str
    text: str = Field(min_length=1, max_length=4000)


class FinishRequest(BaseModel):
    recordings_keep: bool = False


class InterviewQuestion(BaseModel):
    id: str
    text: str
    type: str = "behavioral"
    followups: list = []
    hints: list = []


class InterviewOut(BaseModel):
    session_id: str
    status: str
    job_role: str
    level: str
    difficulty: str
    mode: str
    duration_min: int
    questions: list = []
    current_index: int
    started_at: Optional[datetime]
    ended_at: Optional[datetime]


class InterviewStartOut(BaseModel):
    session_id: str
    ws_token: str
    expires_in: int


class ReportOut(BaseModel):
    report_id: str
    session_id: str
    per_question: list = []
    summary: dict = {}
    next_steps: list = []


# ---------- 职业辅导 ----------
class StarSuggestRequest(BaseModel):
    experience_text: str = Field(min_length=10, max_length=4000)
    question: Optional[str] = None


class StarOut(BaseModel):
    star: list[dict]
    tip: str


class PlanRequest(BaseModel):
    goal: str
    deadline: Optional[str] = None
    preferences: Optional[dict] = None


# ---------- 管理端 ----------
class GenerateRequest(BaseModel):
    topic: str
    source_ids: list = []
    outline: Optional[list] = None


class JobOut(BaseModel):
    job_id: str
    status: str
    stage: str = ""
    preview_md: str = ""
    chapter_id: Optional[str] = None


class ReviewRequest(BaseModel):
    action: str = Field(pattern="^(pass|reject|revise)$")
    comment: str = ""


class PublishRequest(BaseModel):
    action: str = Field(pattern="^(publish|unpublish)$")


class ChapterEdit(BaseModel):
    body_md: Optional[str] = None
    front_matter: Optional[dict] = None
    title: Optional[str] = None
    tags: Optional[list] = None
    prereq: Optional[list] = None
    related: Optional[list] = None
    summary: Optional[str] = None
    difficulty: Optional[str] = None
    source: Optional[str] = None


# ---------- 文件 ----------
class PresignRequest(BaseModel):
    filename: str
    content_type: str
    purpose: str = Field(pattern="^(resume|recording)$")


class PresignOut(BaseModel):
    upload_url: str
    object_key: str
    expires_in: int