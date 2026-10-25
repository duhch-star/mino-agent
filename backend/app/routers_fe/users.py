"""前端适配层：/api/users/me、/api/usage/me、画像与学习状态"""
import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.study import Favorite, Note, Progress
from app.models.user import User
from app.routers_fe.utils import get_fe_user, user_view
from app.services import study_service, user_service

router = APIRouter(tags=["FE-用户与学习"])


# ---------------- 当前用户 ----------------

@router.get("/users/me")
def fe_me(user: User = Depends(get_fe_user)):
    return user_view(user)


class FeProfile(BaseModel):
    direction: str = ""
    level: str = ""
    targetRoles: list = []


@router.get("/users/me/profile")
def fe_get_profile(user: User = Depends(get_fe_user)):
    return {
        "direction": user.direction,
        "level": user.grade,
        "targetRoles": [user.target_role] if user.target_role else [],
    }


@router.put("/users/me/profile")
def fe_save_profile(req: FeProfile, user: User = Depends(get_fe_user),
                    db: Session = Depends(get_db)):
    user.direction = req.direction
    user.grade = req.level
    user.target_role = req.targetRoles[0] if req.targetRoles else ""
    db.commit()
    db.refresh(user)
    return {
        "direction": user.direction,
        "level": user.grade,
        "targetRoles": [user.target_role] if user.target_role else [],
    }


@router.delete("/users/me/data")
def fe_delete_data(user: User = Depends(get_fe_user), db: Session = Depends(get_db)):
    from app.models.chat import Attachment, ChatMessage, ChatSession
    from app.models.interview import InterviewSession, QaHistory
    for model in (Progress, Favorite, Note, QaHistory, InterviewSession,
                  ChatSession, ChatMessage, Attachment):
        if hasattr(model, "user_id"):
            db.query(model).filter(model.user_id == user.id).delete()
    db.commit()
    return {"deleted": True}


# ---------------- 配额 ----------------

@router.get("/usage/me")
def fe_usage(user: User = Depends(get_fe_user), db: Session = Depends(get_db)):
    quota = user_service.get_quota(db, user)
    used = quota["used"]
    limits = quota["limits"]
    pct = lambda used, limit: round(used / limit * 100) if limit else 0
    return {
        "today": {
            "llmTokens": used["llm_tokens"],
            "sttMinutes": used["stt_minutes"],
            "ttsChars": used["tts_chars"],
        },
        "limit": {
            "llmTokens": limits["llm_tokens"],
            "sttMinutes": limits["stt_minutes"],
            "ttsChars": limits["tts_chars"],
        },
        "percent": {
            "llmTokens": pct(used["llm_tokens"], limits["llm_tokens"]),
            "sttMinutes": pct(used["stt_minutes"], limits["stt_minutes"]),
            "ttsChars": pct(used["tts_chars"], limits["tts_chars"]),
        },
        "resetAt": quota["reset_at"],
    }


# ---------------- 学习状态（进度/收藏/笔记/测验） ----------------

@router.get("/users/me/learning")
def fe_get_learning(user: User = Depends(get_fe_user), db: Session = Depends(get_db)):
    progress_rows = db.query(Progress).filter(Progress.user_id == user.id).all()
    favorites = db.query(Favorite).filter(Favorite.user_id == user.id).all()
    note_rows = db.query(Note).filter(Note.user_id == user.id).all()

    progress = {r.chapter_id: round(r.position_percent / 100, 4) for r in progress_rows}
    bookmarks = [f.chapter_id for f in favorites]
    notes = {n.chapter_id: n.text for n in note_rows}
    quiz_results = {}
    for r in progress_rows:
        if r.quiz_score is not None:
            total = r.quiz_total if r.quiz_total is not None else 10
            score = int(round(r.quiz_score / 100 * total))
            quiz_results[r.chapter_id] = {
                "score": score,
                "total": total,
                "percent": r.quiz_score,
            }
    return {
        "progress": progress,
        "bookmarks": bookmarks,
        "notes": notes,
        "quizResults": quiz_results,
    }


class FeLearningState(BaseModel):
    profile: dict = {}
    progress: dict = {}
    bookmarks: list = []
    notes: dict = {}
    quizResults: dict = {}


@router.put("/users/me/learning")
def fe_save_learning(req: FeLearningState, user: User = Depends(get_fe_user),
                     db: Session = Depends(get_db)):
    # 进度
    for chapter_id, frac in (req.progress or {}).items():
        try:
            study_service.upsert_progress(
                db, user.id, chapter_id,
                position_percent=round(float(frac) * 100, 1))
        except Exception:
            continue
    # 收藏（差量：仅新增）
    for chapter_id in req.bookmarks or []:
        if not db.query(Favorite).filter(Favorite.user_id == user.id,
                                         Favorite.chapter_id == chapter_id).first():
            db.add(Favorite(user_id=user.id, chapter_id=chapter_id))
    # 笔记
    for chapter_id, text in (req.notes or {}).items():
        existing = db.query(Note).filter(Note.user_id == user.id,
                                         Note.chapter_id == chapter_id).first()
        if existing:
            existing.text = text
        elif text:
            db.add(Note(id=f"nt_{__import__('secrets').token_hex(6)}",
                        user_id=user.id, chapter_id=chapter_id, text=text))
    # 测验（percent 直接保存；score/total 一并记录以便回读）
    for chapter_id, result in (req.quizResults or {}).items():
        percent = result.get("percent")
        total = result.get("total")
        if percent is None and result.get("score") is not None and total:
            percent = round(float(result["score"]) / float(total) * 100, 1)
        if percent is not None:
            study_service.upsert_progress(db, user.id, chapter_id,
                                          quiz_score=percent,
                                          quiz_total=int(total) if total else None)
    db.commit()
    return {"saved": True}