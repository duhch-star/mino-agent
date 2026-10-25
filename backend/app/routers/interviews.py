"""面试会话接口（REST 部分）"""
import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.responses import ApiException, ok
from app.db.session import get_db
from app.models.user import User
from app.schemas import (AnswerSubmitRequest, FinishRequest,
                         InterviewCreateRequest)
from app.services import interview_service

router = APIRouter(prefix="/interviews", tags=["面试会话"])


@router.post("/sessions")
def create_session(req: InterviewCreateRequest, user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    s = interview_service.create_session(db, user.id, req.job_role, req.level,
                                         req.difficulty, req.duration_min,
                                         req.mode, req.question_tags)
    return ok(interview_service.session_out(s))


@router.get("/sessions/{session_id}")
def session_detail(session_id: str, user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    s = interview_service.own_or_404(db, session_id, user.id)
    return ok(interview_service.session_out(s))


@router.post("/sessions/{session_id}/start")
def start(session_id: str, user: User = Depends(get_current_user),
          db: Session = Depends(get_db)):
    s = interview_service.own_or_404(db, session_id, user.id)
    interview_service.start(db, s)
    data = {"session_id": s.id}
    # 方案 §3.6：start 统一签发 ws_token（文字模式同样可用 /ws 订阅状态）
    data.update(interview_service.issue_ws_token(user.id))
    return ok(data)


@router.post("/sessions/{session_id}/answer")
def submit_answer(session_id: str, req: AnswerSubmitRequest,
                  user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = interview_service.own_or_404(db, session_id, user.id)
    if s.status != "active":
        raise ApiException(40900, "会话未在进行中")
    questions = json.loads(s.questions_json or "[]")
    if not any(q["id"] == req.question_id for q in questions):
        raise ApiException(40400, "题目不存在")
    interview_service.submit_answer(db, s, req.question_id, req.text)
    return ok({"ack": True, "next_index": s.current_index})


@router.post("/sessions/{session_id}/next")
def next_question(session_id: str, user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    s = interview_service.own_or_404(db, session_id, user.id)
    questions = json.loads(s.questions_json or "[]")
    if s.current_index >= len(questions):
        raise ApiException(40900, "没有更多题目，请结束面试")
    return ok({"question": questions[s.current_index]})


@router.post("/sessions/{session_id}/finish")
def finish(session_id: str, req: FinishRequest, user: User = Depends(get_current_user),
           db: Session = Depends(get_db)):
    s = interview_service.own_or_404(db, session_id, user.id)
    report = interview_service.finish(db, s)
    report["recordings_keep"] = req.recordings_keep
    return ok(report)


@router.post("/sessions/{session_id}/abort")
def abort(session_id: str, user: User = Depends(get_current_user),
          db: Session = Depends(get_db)):
    s = interview_service.own_or_404(db, session_id, user.id)
    interview_service.abort(db, s)
    return ok({"session_id": s.id, "status": s.status})


@router.get("/sessions/{session_id}/questions")
def questions(session_id: str, user: User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    s = interview_service.own_or_404(db, session_id, user.id)
    return ok({"items": json.loads(s.questions_json or "[]")})


@router.get("/reports/{session_id}")
def report(session_id: str, user: User = Depends(get_current_user),
           db: Session = Depends(get_db)):
    s = interview_service.own_or_404(db, session_id, user.id)
    if s.status != "finished":
        raise ApiException(40900, "面试未结束")
    from app.services import ai_service
    return ok(ai_service.build_report(s))


@router.get("/history")
def history(user: User = Depends(get_current_user), page: int = Query(1, ge=1),
            page_size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    return ok(interview_service.history(db, user.id, page, page_size))


@router.delete("/sessions/{session_id}")
def delete_session(session_id: str, user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    s = interview_service.own_or_404(db, session_id, user.id)
    db.delete(s)
    db.commit()
    return ok({})