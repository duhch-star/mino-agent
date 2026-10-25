"""前端适配层：/api/review/* 内容审核（管理员）"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.responses import ApiException
from app.db.session import get_db
from app.models.chapter import Chapter
from app.models.user import User
from app.routers_fe.utils import get_fe_user

router = APIRouter(prefix="/review", tags=["FE-内容审核"])

DRAFT_STATUS = ("draft", "review", "reviewed")


def _require_admin(user: User):
    if user.role != "admin":
        raise ApiException(40300, "需要管理员权限", status_code=403)


@router.get("/drafts")
def fe_drafts(user: User = Depends(get_fe_user), db: Session = Depends(get_db)):
    _require_admin(user)
    rows = (db.query(Chapter)
            .filter(Chapter.status.in_(DRAFT_STATUS))
            .order_by(Chapter.updated_at.desc())
            .all())
    return {"items": [{
        "id": c.id, "title": c.title, "status": c.status,
        "summary": c.summary, "updated_at": str(c.updated_at),
        "preview": (c.body_md or "")[:200],
    } for c in rows]}


class FeReviewDecision(BaseModel):
    decision: str = Field(pattern="^(approved|rejected|revise)$")
    reason: str = ""


@router.post("/drafts/{draft_id}/decision")
def fe_decision(draft_id: str, req: FeReviewDecision,
                user: User = Depends(get_fe_user), db: Session = Depends(get_db)):
    _require_admin(user)
    chapter = db.get(Chapter, draft_id)
    if not chapter:
        raise ApiException(40400, "草稿不存在", status_code=404)
    if req.decision == "approved":
        chapter.status = "reviewed"
    elif req.decision == "rejected":
        chapter.status = "rejected"
    else:
        chapter.status = "draft"
    chapter.reviewer = user.id
    db.commit()
    return {"id": chapter.id, "status": chapter.status, "decision": req.decision}