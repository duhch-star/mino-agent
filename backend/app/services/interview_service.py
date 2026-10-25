"""面试会话服务：创建、答题、结束、复盘"""
import json
import secrets
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.responses import ApiException
from app.core.security import create_token
from app.models.interview import InterviewSession
from app.services import ai_service


def create_session(db: Session, user_id: str, job_role: str, level: str,
                   difficulty: str, duration_min: int, mode: str,
                   question_tags: list | None) -> InterviewSession:
    questions = ai_service.generate_questions(
        job_role, difficulty, level, count=4, tags=question_tags)
    session = InterviewSession(
        id=f"iv_{secrets.token_hex(8)}",
        user_id=user_id,
        job_role=job_role,
        level=level,
        difficulty=difficulty,
        mode=mode,
        duration_min=duration_min,
        questions_json=json.dumps(questions, ensure_ascii=False),
        answers_json="[]",
        current_index=0,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get(db: Session, session_id: str) -> InterviewSession | None:
    return db.get(InterviewSession, session_id)


def own_or_404(db: Session, session_id: str, user_id: str) -> InterviewSession:
    s = db.get(InterviewSession, session_id)
    if not s:
        raise ApiException(40400, "面试会话不存在")
    if s.user_id != user_id:
        raise ApiException(40300, "无权访问该会话")
    return s


def session_out(s: InterviewSession) -> dict:
    return {
        "session_id": s.id,
        "status": s.status,
        "job_role": s.job_role,
        "level": s.level,
        "difficulty": s.difficulty,
        "mode": s.mode,
        "duration_min": s.duration_min,
        "questions": json.loads(s.questions_json or "[]"),
        "current_index": s.current_index,
        "started_at": str(s.started_at) if s.started_at else None,
        "ended_at": str(s.ended_at) if s.ended_at else None,
    }


def issue_ws_token(user_id: str) -> dict:
    # sub 必须是 user_id：ws.py 用 sub 与会话 owner(user_id) 比对
    token = create_token(user_id, "ws", minutes=120)
    return {"ws_token": token, "expires_in": 120 * 60}


def start(db: Session, s: InterviewSession):
    if s.status != "active":
        raise ApiException(40900, "会话已结束")
    if not s.started_at:
        s.started_at = datetime.utcnow()
        db.commit()


def submit_answer(db: Session, s: InterviewSession, question_id: str, text: str):
    answers = json.loads(s.answers_json or "[]")
    answers.append({"question_id": question_id, "text": text,
                    "duration_sec": 0, "ts": datetime.utcnow().isoformat()})
    s.answers_json = json.dumps(answers, ensure_ascii=False)
    s.current_index = min(s.current_index + 1,
                          len(json.loads(s.questions_json or "[]")))
    db.commit()


def finish(db: Session, s: InterviewSession) -> dict:
    if s.status != "active":
        raise ApiException(40900, "会话已结束")
    s.status = "finished"
    s.ended_at = datetime.utcnow()
    s.report_id = f"rp_{secrets.token_hex(6)}"
    db.commit()
    report = ai_service.build_report(s)
    return report


def abort(db: Session, s: InterviewSession):
    s.status = "aborted"
    s.ended_at = datetime.utcnow()
    db.commit()


def history(db: Session, user_id: str, page: int, page_size: int) -> dict:
    q = db.query(InterviewSession).filter(InterviewSession.user_id == user_id)\
        .order_by(InterviewSession.created_at.desc())
    total = q.count()
    rows = q.offset((page - 1) * page_size).limit(page_size).all()
    items = [{
        "session_id": s.id, "status": s.status, "job_role": s.job_role,
        "level": s.level, "difficulty": s.difficulty, "mode": s.mode,
        "duration_min": s.duration_min, "report_id": s.report_id,
        "created_at": str(s.created_at),
    } for s in rows]
    return {"items": items, "total": total, "page": page, "page_size": page_size}