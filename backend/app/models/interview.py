"""面试 / 问答 / 录音 ORM"""
from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(40), index=True)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active/finished/aborted
    job_role: Mapped[str] = mapped_column(String(80), default="")
    level: Mapped[str] = mapped_column(String(40), default="")
    difficulty: Mapped[str] = mapped_column(String(40), default="中等")
    mode: Mapped[str] = mapped_column(String(10), default="voice")     # voice/text
    duration_min: Mapped[int] = mapped_column(Integer, default=20)
    questions_json: Mapped[str] = mapped_column(Text, default="[]")
    answers_json: Mapped[str] = mapped_column(Text, default="[]")
    current_index: Mapped[int] = mapped_column(Integer, default=0)
    report_id: Mapped[str] = mapped_column(String(40), default="")
    recording_object_key: Mapped[str] = mapped_column(String(512), default="")
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class QaHistory(Base):
    __tablename__ = "qa_history"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(40), index=True)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    sources_json: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class AudioRecord(Base):
    """录音文件元信息（用户授权后）"""
    __tablename__ = "audio_records"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(40), index=True)
    session_id: Mapped[str] = mapped_column(String(40), index=True)
    object_key: Mapped[str] = mapped_column(String(512))
    duration_sec: Mapped[float] = mapped_column(Float, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())