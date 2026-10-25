"""对话助手 ORM：会话（含分支）/ 消息 / 附件"""
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)   # conv_xxx
    user_id: Mapped[str] = mapped_column(String(40), index=True)
    title: Mapped[str] = mapped_column(String(200), default="新对话")
    parent_session_id: Mapped[str] = mapped_column(String(40), default="")
    branch_message_id: Mapped[str] = mapped_column(String(40), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)   # msg_xxx
    session_id: Mapped[str] = mapped_column(String(40), index=True)
    role: Mapped[str] = mapped_column(String(20), default="user")   # user / assistant
    content: Mapped[str] = mapped_column(Text, default="")
    # 附加元数据：references / attachments / options / task / usage / performance / citations
    meta_json: Mapped[str] = mapped_column(Text, default="{}")
    feedback: Mapped[str] = mapped_column(String(20), default="")   # helpful / unhelpful
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Attachment(Base):
    __tablename__ = "chat_attachments"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)   # file_xxx
    user_id: Mapped[str] = mapped_column(String(40), index=True)
    name: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(120), default="")
    size: Mapped[int] = mapped_column(Integer, default=0)
    object_key: Mapped[str] = mapped_column(String(512), default="")
    # 解析状态与内容缓存（extract_document 结果），避免每次对话重复解析
    parse_status: Mapped[str] = mapped_column(String(20), default="pending")  # pending/ok/empty/failed
    parsed_text: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())