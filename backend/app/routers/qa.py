"""AI 问答接口：一次性问答 + 历史"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.responses import ok
from app.db.session import get_db
from app.models.user import User
from app.schemas import QaAskRequest
from app.services import qa_service, user_service

router = APIRouter(prefix="/qa", tags=["AI问答"])


@router.post("/ask")
async def ask(req: QaAskRequest, user: User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    user_service.consume_quota(db, user, llm_tokens=300)
    result = await qa_service.ask(db, user.id, req.question,
                                  req.chapter_id, req.selection)
    return ok(result)


@router.get("/history")
def history(user: User = Depends(get_current_user), page: int = Query(1, ge=1),
            page_size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    return ok(qa_service.history(db, user.id, page, page_size))


@router.delete("/history/{history_id}")
def delete_history(history_id: str, user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    qa_service.delete_history(db, user.id, history_id)
    return ok({})