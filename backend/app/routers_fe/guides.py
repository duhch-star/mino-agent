"""前端适配层：/api/guides 求职指南（章节）与测验

数据与前端 src/data/chapters.js 完全同构（由 dump 脚本导出），
保证页面渲染 / 内链 / 测验逻辑无需改动即可切换为后端数据源。

正式章节（GUIDES JSON）+ 审核通过章节（DB Chapter.status == "reviewed"）
共同构成指南列表，实现「审核通过即发布」。
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.responses import ApiException
from app.data import GUIDES
from app.db.session import get_db
from app.models.chapter import Chapter
from app.models.user import User
from app.routers_fe.utils import get_optional_fe_user

router = APIRouter(prefix="/guides", tags=["FE-求职指南"])

CHAPTERS = GUIDES["chapters"]
QUIZ_BANK = GUIDES["quizBank"]


def _chapter_view(c: dict) -> dict:
    return c


def _db_chapter_view(c: Chapter) -> dict:
    """DB 审核通过的章节 → 前端章节结构（字段与 src/data/chapters.js 同构）"""
    return {
        "id": c.id,
        "title": c.title,
        "tags": ["审核通过"],
        "prereq": [],
        "related": [],
        "difficulty": "入门",
        "readTime": "5 分钟",
        "updated": str(c.updated_at)[:10] if c.updated_at else "",
        "summary": c.summary or "",
        "content": c.body_md or "",
    }


def _find_db_chapter(db: Session, guide_id: str) -> Chapter | None:
    # 详情兼容两类状态：审核通过（reviewed）与正式发布（published）
    return (db.query(Chapter)
            .filter(Chapter.id == guide_id,
                    Chapter.status.in_(["reviewed", "published"]))
            .first())


@router.get("")
def fe_guides(user: User | None = Depends(get_optional_fe_user),
              db: Session = Depends(get_db)):
    items = list(CHAPTERS)
    known = {c["id"] for c in items}
    reviewed = (db.query(Chapter)
                .filter(Chapter.status == "reviewed")
                .order_by(Chapter.updated_at.desc())
                .all())
    for c in reviewed:
        if c.id not in known:
            items.append(_db_chapter_view(c))
    return items


@router.get("/{guide_id}")
def fe_guide(guide_id: str, user: User | None = Depends(get_optional_fe_user),
             db: Session = Depends(get_db)):
    # GUIDES JSON 章节 id（star/resume/...）与 DB 章节 id（ch_star/ch_resume/...）
    # 两套命名并存：GenUI「去补课」可能携带 ch_ 前缀，做兼容容错
    chapter = next((c for c in CHAPTERS if c["id"] == guide_id), None)
    if not chapter and guide_id.startswith("ch_"):
        chapter = next((c for c in CHAPTERS if c["id"] == guide_id[3:]), None)
        if chapter:
            chapter = {**chapter, "id": guide_id}
    if not chapter:
        db_chapter = _find_db_chapter(db, guide_id)
        if not db_chapter:
            raise ApiException(40400, "指南章节不存在", status_code=404)
        return _db_chapter_view(db_chapter)
    return _chapter_view(chapter)


@router.get("/{guide_id}/quiz")
def fe_quiz(guide_id: str, user: User | None = Depends(get_optional_fe_user)):
    quiz = QUIZ_BANK.get(guide_id, [])
    if not quiz and guide_id.startswith("ch_"):
        quiz = QUIZ_BANK.get(guide_id[3:], [])
    return quiz
