"""知识章节 / 图谱 / 测验 ORM"""
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Chapter(Base):
    __tablename__ = "chapters"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200), index=True)
    tags: Mapped[str] = mapped_column(String(500), default="[]")      # JSON 数组
    prereq: Mapped[str] = mapped_column(String(500), default="[]")    # 前置章节 id JSON
    related: Mapped[str] = mapped_column(String(500), default="[]")   # 相关章节 id JSON
    difficulty: Mapped[str] = mapped_column(String(40), default="入门")
    read_time_min: Mapped[int] = mapped_column(Integer, default=5)
    version: Mapped[int] = mapped_column(Integer, default=1)
    source: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft/review/published
    summary: Mapped[str] = mapped_column(String(1000), default="")
    front_matter: Mapped[str] = mapped_column(Text, default="{}")
    body_md: Mapped[str] = mapped_column(Text, default="")
    reviewer: Mapped[str] = mapped_column(String(40), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class ChapterGraphEdge(Base):
    """章节图谱边：kind = prereq|related|reference"""
    __tablename__ = "chapter_graph_edges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    from_id: Mapped[str] = mapped_column(String(40), index=True)
    to_id: Mapped[str] = mapped_column(String(40), index=True)
    kind: Mapped[str] = mapped_column(String(20), default="related")


class Quiz(Base):
    __tablename__ = "quizzes"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    chapter_id: Mapped[str] = mapped_column(String(40), index=True)
    type: Mapped[str] = mapped_column(String(10), default="single")   # single/multi/blank
    stem: Mapped[str] = mapped_column(Text)
    options: Mapped[str] = mapped_column(Text, default="[]")          # JSON
    answer: Mapped[str] = mapped_column(String(500))                  # 正确答案（明文，测试用）
    answer_explain: Mapped[str] = mapped_column(Text, default="")