"""知识章节服务：查询、图谱、检索、测验"""
import json
import re
import secrets

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.responses import ApiException
from app.models.chapter import Chapter, ChapterGraphEdge, Quiz
from app.schemas import ChapterListItem, ChapterOut, QuizOut


def get(db: Session, chapter_id: str) -> Chapter | None:
    return db.get(Chapter, chapter_id)


def public_or_404(db: Session, chapter_id: str) -> Chapter:
    chapter = db.get(Chapter, chapter_id)
    if not chapter or chapter.status != "published":
        raise ApiException(40400, "章节不存在或未发布")
    return chapter


def _load_list(chapter: Chapter) -> dict:
    return {
        "id": chapter.id, "slug": chapter.slug, "title": chapter.title,
        "tags": json.loads(chapter.tags or "[]"),
        "difficulty": chapter.difficulty, "read_time_min": chapter.read_time_min,
        "summary": chapter.summary, "updated_at": str(chapter.updated_at),
    }


def list_chapters(db: Session, tag: str = "", difficulty: str = "",
                  search: str = "", page: int = 1, page_size: int = 20) -> dict:
    q = db.query(Chapter).filter(Chapter.status == "published")
    if tag:
        q = q.filter(Chapter.tags.like(f'%"{tag}"%'))
    if difficulty:
        q = q.filter(Chapter.difficulty == difficulty)
    if search:
        q = q.filter(or_(Chapter.title.like(f"%{search}%"),
                         Chapter.body_md.like(f"%{search}%"),
                         Chapter.summary.like(f"%{search}%")))
    total = q.count()
    rows = q.order_by(Chapter.updated_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [_load_list(c) for c in rows], "total": total,
            "page": page, "page_size": page_size}


def build_outline(body_md: str) -> list:
    outline = []
    for line in body_md.splitlines():
        m = re.match(r"^(#{1,4})\s+(.+)$", line)
        if m:
            level = len(m.group(1))
            title = m.group(2).strip()
            anchor = re.sub(r"[^\w\u4e00-\u9fff-]", "", title.lower()).replace(" ", "-")
            outline.append({"level": level, "title": title, "anchor": anchor or "sec"})
    return outline


def chapter_detail(db: Session, chapter: Chapter) -> dict:
    data = _load_list(chapter)
    data.update({
        "version": chapter.version,
        "source": chapter.source,
        "prereq": json.loads(chapter.prereq or "[]"),
        "related": json.loads(chapter.related or "[]"),
        "outline": build_outline(chapter.body_md),
        "body_md": chapter.body_md,
        "quiz_count": db.query(Quiz).filter(Quiz.chapter_id == chapter.id).count(),
        "status": chapter.status,
    })
    return data


def related_chapters(db: Session, chapter: Chapter) -> list:
    ids = json.loads(chapter.related or "[]") + json.loads(chapter.prereq or "[]")
    out = []
    for cid in ids[:12]:
        c = db.get(Chapter, cid)
        if c and c.status == "published":
            out.append(_load_list(c))
    return out


def prereq_chain(db: Session, chapter: Chapter) -> list:
    chain, seen = [], set()

    def walk(cid: str):
        if cid in seen:
            return
        seen.add(cid)
        c = db.get(Chapter, cid)
        if not c:
            return
        chain.append(_load_list(c))
        for p in json.loads(c.prereq or "[]"):
            walk(p)

    walk(chapter.id)
    return chain[1:]  # 去掉自身


def graph(db: Session) -> dict:
    chapters = db.query(Chapter).filter(Chapter.status == "published").all()
    nodes = [{"id": c.id, "title": c.title, "tags": json.loads(c.tags or "[]"),
              "difficulty": c.difficulty} for c in chapters]
    node_ids = {c.id for c in chapters}
    edges = []
    for c in chapters:
        for p in json.loads(c.prereq or "[]"):
            if p in node_ids:
                edges.append({"from": p, "to": c.id, "kind": "prereq"})
        for r in json.loads(c.related or "[]"):
            if r in node_ids:
                edges.append({"from": c.id, "to": r, "kind": "related"})
    return {"nodes": nodes, "edges": edges}


def search_chapters(db: Session, q: str, tag: str = "", page: int = 1,
                    page_size: int = 10) -> dict:
    query = db.query(Chapter).filter(Chapter.status == "published")
    if tag:
        query = query.filter(Chapter.tags.like(f'%"{tag}"%'))
    rows = query.filter(or_(Chapter.title.like(f"%{q}%"),
                            Chapter.body_md.like(f"%{q}%"),
                            Chapter.summary.like(f"%{q}%"),
                            Chapter.tags.like(f"%{q}%"))).all()
    scored = []
    for c in rows:
        score = 90 if q in c.title else (60 if q in c.summary else 40)
        snippet = c.summary[:120]
        scored.append({"chapter_id": c.id, "title": c.title,
                       "snippet": snippet, "score": score})
    scored.sort(key=lambda x: -x["score"])
    total = len(scored)
    start = (page - 1) * page_size
    return {"items": scored[start:start + page_size], "total": total,
            "page": page, "page_size": page_size}


def quizzes(db: Session, chapter_id: str) -> list:
    rows = db.query(Quiz).filter(Quiz.chapter_id == chapter_id).all()
    return [QuizOut(id=q.id, chapter_id=q.chapter_id, type=q.type,
                    stem=q.stem, options=json.loads(q.options or "[]"))
            .model_dump() for q in rows]


def create_quiz(db: Session, chapter_id: str, stem: str, options: list,
                answer: str, explain: str = "", qtype: str = "single") -> Quiz:
    quiz = Quiz(id=f"qz_{secrets.token_hex(6)}", chapter_id=chapter_id, type=qtype,
                stem=stem, options=json.dumps(options, ensure_ascii=False),
                answer=answer, answer_explain=explain)
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz