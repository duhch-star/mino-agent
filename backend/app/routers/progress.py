"""进度 / 收藏 / 笔记 / 推荐 接口"""
from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.responses import ApiException, ok
from app.db.session import get_db
from app.models.user import User
from app.schemas import NoteCreate, ProgressUpdate
from app.services import chapter_service, study_service

router = APIRouter(tags=["学习进度/收藏/笔记/推荐"])


# ---------- 进度 ----------
@router.get("/progress")
def progress_overview(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(study_service.learning_path(db, user))


@router.get("/progress/{chapter_id}")
def get_progress(chapter_id: str, user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    row = study_service.get_progress(db, user.id, chapter_id)
    return ok(study_service.progress_view(row) if row else {
        "chapter_id": chapter_id, "position_percent": 0, "completed": False,
        "quiz_score": None, "last_read_at": None})


@router.put("/progress/{chapter_id}")
def update_progress(chapter_id: str, req: ProgressUpdate,
                    user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not chapter_service.get(db, chapter_id):
        raise ApiException(40400, "章节不存在")
    row = study_service.upsert_progress(
        db, user.id, chapter_id,
        position_percent=req.position_percent,
        completed=req.completed, quiz_score=req.quiz_score)
    return ok(study_service.progress_view(row))


# ---------- 推荐 ----------
@router.get("/recommendations")
def recommendations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok({"items": study_service.recommendations(db, user)})


# ---------- 收藏 ----------
@router.post("/favorites/{chapter_id}")
def add_favorite(chapter_id: str, user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    chapter_service.public_or_404(db, chapter_id)
    fav = study_service.add_favorite(db, user.id, chapter_id)
    return ok({"chapter_id": fav.chapter_id, "favorited_at": str(fav.created_at)})


@router.delete("/favorites/{chapter_id}")
def remove_favorite(chapter_id: str, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    study_service.remove_favorite(db, user.id, chapter_id)
    return ok({})


@router.get("/favorites")
def list_favorites(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok({"items": study_service.list_favorites(db, user.id)})


# ---------- 笔记 ----------
@router.get("/notes")
def list_notes(chapter_id: str = "", user: User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    return ok({"items": study_service.list_notes(db, user.id, chapter_id)})


@router.post("/notes")
def create_note(req: NoteCreate, user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    note = study_service.create_note(db, user.id, req.chapter_id, req.anchor, req.text)
    return ok({"id": note.id, "chapter_id": note.chapter_id, "anchor": note.anchor,
               "text": note.text, "created_at": str(note.created_at)})


@router.delete("/notes/{note_id}")
def delete_note(note_id: str, user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    study_service.delete_note(db, user.id, note_id)
    return ok({})