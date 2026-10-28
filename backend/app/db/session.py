"""SQLAlchemy 2.0 数据库会话"""
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

url = make_url(settings.database_url)
if url.get_backend_name() == "sqlite" and url.database not in (None, "", ":memory:"):
    Path(url.database).parent.mkdir(parents=True, exist_ok=True)
connect_args = {"check_same_thread": False} if url.get_backend_name() == "sqlite" else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
