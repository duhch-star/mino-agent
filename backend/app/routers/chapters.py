"""章节相关接口：列表/详情/图谱/检索/测验"""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.responses import ApiException, ok
from app.db.session import get_db
from app.models.chapter import Chapter
from app.models.user import User
from app.schemas import QuizSubmitRequest
from app.services import chapter_service, study_service

router = APIRouter(prefix="/chapters", tags=["MD知识网络"])


@router.get("")
def list_chapters(tag: str = "", difficulty: str = "", search: str = "",
                  page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                  db: Session = Depends(get_db)):
    return ok(chapter_service.list_chapters(db, tag, difficulty, search, page, page_size))


@router.get("/search")
def search_chapters(q: str, tag: str = "", page: int = Query(1, ge=1),
                    page_size: int = Query(10, ge=1, le=50),
                    db: Session = Depends(get_db)):
    return ok(chapter_service.search_chapters(db, q, tag, page, page_size))


@router.get("/graph")
def graph(db: Session = Depends(get_db)):
    return ok(chapter_service.graph(db))


@router.get("/{chapter_id}")
def chapter_detail(chapter_id: str, db: Session = Depends(get_db)):
    chapter = chapter_service.public_or_404(db, chapter_id)
    return ok({"chapter": chapter_service.chapter_detail(db, chapter)})


@router.get("/{chapter_id}/outline")
def outline(chapter_id: str, db: Session = Depends(get_db)):
    chapter = chapter_service.public_or_404(db, chapter_id)
    return ok({"outline": chapter_service.build_outline(chapter.body_md)})


@router.get("/{chapter_id}/related")
def related(chapter_id: str, db: Session = Depends(get_db)):
    chapter = chapter_service.public_or_404(db, chapter_id)
    return ok({"items": chapter_service.related_chapters(db, chapter)})


@router.get("/{chapter_id}/prereq")
def prereq(chapter_id: str, db: Session = Depends(get_db)):
    chapter = chapter_service.public_or_404(db, chapter_id)
    return ok({"chain": chapter_service.prereq_chain(db, chapter)})


class ReadProgressRequest(BaseModel):
    position_percent: float = Field(ge=0, le=100, default=0)
    duration_sec: int = Field(ge=0, default=0)


@router.post("/{chapter_id}/read")
def report_read(chapter_id: str, req: ReadProgressRequest,
                user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    chapter_service.public_or_404(db, chapter_id)
    row = study_service.upsert_progress(db, user.id, chapter_id,
                                        position_percent=req.position_percent)
    return ok(study_service.progress_view(row))


@router.get("/{chapter_id}/quizzes")
def quizzes(chapter_id: str, db: Session = Depends(get_db)):
    chapter_service.public_or_404(db, chapter_id)
    return ok({"questions": chapter_service.quizzes(db, chapter_id)})


@router.post("/{chapter_id}/quizzes/submit")
def submit_quiz(chapter_id: str, req: QuizSubmitRequest, db: Session = Depends(get_db)):
    chapter_service.public_or_404(db, chapter_id)
    quiz_rows = db.query(__import__("app.models.chapter", fromlist=["Quiz"]).Quiz)\
        .filter(__import__("app.models.chapter", fromlist=["Quiz"]).Quiz.chapter_id == chapter_id).all()
    if not quiz_rows:
        raise ApiException(40400, "本章暂无测验")
    answer_map = {a.get("question_id"): a.get("choice") for a in req.answers}
    results, correct = [], 0
    for q in quiz_rows:
        user_ans = answer_map.get(q.id)
        is_correct = user_ans == q.answer
        correct += 1 if is_correct else 0
        results.append({"question_id": q.id, "correct": is_correct,
                        "explain": q.answer_explain})
    score = round(correct / len(quiz_rows) * 100, 1) if quiz_rows else 0
    feedback = "本章掌握良好，可以继续下一篇！" if score >= 80 else "建议回看本章重点后再测验一次。"
    return ok({"score": score, "per_question": results, "feedback": feedback})