"""学习进度 / 收藏 / 笔记 ORM"""
from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Progress(Base):
    __tablename__ = "progress"
    __table_args__ = (UniqueConstraint("user_id", "chapter_id", name="uq_progress_user_chapter"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(40), index=True)
    chapter_id: Mapped[str] = mapped_column(String(40), index=True)
    position_percent: Mapped[float] = mapped_column(Float, default=0)
    completed: Mapped[int] = mapped_column(Integer, default=0)
    quiz_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    quiz_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_read_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class Favorite(Base):
    __tablename__ = "favorites"
    __table_args__ = (UniqueConstraint("user_id", "chapter_id", name="uq_fav_user_chapter"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(40), index=True)
    chapter_id: Mapped[str] = mapped_column(String(40), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(40), index=True)
    chapter_id: Mapped[str] = mapped_column(String(40), index=True)
    anchor: Mapped[str] = mapped_column(String(200), default="")
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())