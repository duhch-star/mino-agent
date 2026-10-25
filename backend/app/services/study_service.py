"""进度/收藏/笔记/推荐 服务"""
import json
import secrets

from sqlalchemy.orm import Session

from app.core.responses import ApiException
from app.models.chapter import Chapter, ChapterGraphEdge
from app.models.study import Favorite, Note, Progress
from app.models.user import User


def get_progress(db: Session, user_id: str, chapter_id: str) -> Progress | None:
    return (db.query(Progress)
            .filter(Progress.user_id == user_id, Progress.chapter_id == chapter_id)
            .first())


def upsert_progress(db: Session, user_id: str, chapter_id: str, *,
                    position_percent: float | None = None, completed: bool | None = None,
                    quiz_score: float | None = None, quiz_total: int | None = None) -> Progress:
    row = get_progress(db, user_id, chapter_id)
    if not row:
        row = Progress(user_id=user_id, chapter_id=chapter_id)
        db.add(row)
    if position_percent is not None:
        row.position_percent = position_percent
    if completed is not None:
        row.completed = 1 if completed else 0
    if quiz_score is not None:
        row.quiz_score = quiz_score
    if quiz_total is not None:
        row.quiz_total = quiz_total
    db.commit()
    db.refresh(row)
    return row


def progress_view(row: Progress) -> dict:
    return {
        "chapter_id": row.chapter_id,
        "position_percent": row.position_percent,
        "completed": bool(row.completed),
        "quiz_score": row.quiz_score,
        "last_read_at": str(row.last_read_at),
    }


def learning_path(db: Session, user: User) -> dict:
    """学习路径：读出用户已学章节，按 prereq 拓扑补齐未学章节"""
    rows = db.query(Progress).filter(Progress.user_id == user.id).all()
    learned = {r.chapter_id for r in rows if r.completed}
    in_progress = {r.chapter_id for r in rows if not r.completed and r.position_percent > 0}
    all_chapters = {c.id: c for c in db.query(Chapter).filter(Chapter.status == "published").all()}

    # 拓扑排序（Kahn）：边 prereq -> chapter
    indegree = {cid: 0 for cid in all_chapters}
    adj = {cid: [] for cid in all_chapters}
    for cid, c in all_chapters.items():
        for p in json.loads(c.prereq or "[]"):
            if p in all_chapters:
                adj.setdefault(p, []).append(cid)
                indegree[cid] += 1
    queue = [cid for cid, d in indegree.items() if d == 0]
    order = []
    while queue:
        cid = queue.pop(0)
        order.append(cid)
        for nxt in adj.get(cid, []):
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                queue.append(nxt)

    path_items = []
    for cid in order:
        if cid not in all_chapters:
            continue
        c = all_chapters[cid]
        if cid in learned:
            status = "learned"
        elif cid in in_progress:
            status = "in_progress"
        else:
            status = "pending"
        path_items.append({"chapter_id": cid, "title": c.title, "status": status,
                           "difficulty": c.difficulty})
    return {"path": path_items, "learned": len(learned),
            "in_progress": len(in_progress)}


def recommendations(db: Session, user: User, limit: int = 10) -> list:
    rows = db.query(Progress).filter(Progress.user_id == user.id).all()
    learned = {r.chapter_id for r in rows if r.completed}
    done_any = len(learned) > 0
    in_progress = {r.chapter_id for r in rows
                   if not r.completed and r.position_percent > 0}

    result = []
    for r in rows:
        if r.position_percent > 0 and not r.completed:
            result.append({
                "chapter_id": r.chapter_id,
                "reason": "你上次读到这里，继续上次进度",
                "rank": 1, "position_percent": r.position_percent,
            })

    path = learning_path(db, user)["path"]
    next_pending = [p for p in path if p["status"] == "pending"][:limit]
    for i, p in enumerate(next_pending):
        result.append({
            "chapter_id": p["chapter_id"],
            "reason": "学习路径推荐：先掌握前置知识" if i == 0 else "学习路径推荐：接续学习",
            "rank": 2 + i, "position_percent": 0,
        })

    if not done_any:
        # 冷启动：按方向匹配标签
        tag = "简历" if not user.target_role else "面试"
        fallback = (db.query(Chapter)
                    .filter(Chapter.status == "published",
                            Chapter.tags.like(f'%"{tag}"%'))
                    .order_by(Chapter.id).limit(3).all())
        for i, c in enumerate(fallback):
            result.append({
                "chapter_id": c.id,
                "reason": f"冷启动推荐：适合{user.target_role or '求职者'}的入门章节",
                "rank": 100 + i, "position_percent": 0,
            })
    return result[:limit]


def add_favorite(db: Session, user_id: str, chapter_id: str) -> Favorite:
    if db.query(Favorite).filter(Favorite.user_id == user_id,
                                 Favorite.chapter_id == chapter_id).first():
        raise ApiException(40004, "已收藏")
    fav = Favorite(user_id=user_id, chapter_id=chapter_id)
    db.add(fav)
    db.commit()
    db.refresh(fav)
    return fav


def remove_favorite(db: Session, user_id: str, chapter_id: str):
    fav = (db.query(Favorite)
           .filter(Favorite.user_id == user_id, Favorite.chapter_id == chapter_id)
           .first())
    if fav:
        db.delete(fav)
        db.commit()


def list_favorites(db: Session, user_id: str) -> list:
    favs = (db.query(Favorite, Chapter)
            .join(Chapter, Chapter.id == Favorite.chapter_id)
            .filter(Favorite.user_id == user_id)
            .order_by(Favorite.created_at.desc()).all())
    return [{"chapter_id": c.id, "title": c.title, "summary": c.summary,
             "favorited_at": str(f.created_at)} for f, c in favs]


def create_note(db: Session, user_id: str, chapter_id: str, anchor: str, text: str) -> Note:
    note = Note(id=f"nt_{secrets.token_hex(6)}", user_id=user_id,
                chapter_id=chapter_id, anchor=anchor, text=text)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def list_notes(db: Session, user_id: str, chapter_id: str = "") -> list:
    q = db.query(Note).filter(Note.user_id == user_id).order_by(Note.created_at.desc())
    if chapter_id:
        q = q.filter(Note.chapter_id == chapter_id)
    return [{"id": n.id, "chapter_id": n.chapter_id, "anchor": n.anchor,
             "text": n.text, "created_at": str(n.created_at)} for n in q.all()]


def delete_note(db: Session, user_id: str, note_id: str):
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == user_id).first()
    if not note:
        raise ApiException(40400, "笔记不存在")
    db.delete(note)
    db.commit()