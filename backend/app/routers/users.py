"""用户与配额接口"""
import json
import secrets
import urllib.parse

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.responses import ApiException, ok
from app.db.session import get_db
from app.models.user import User
from app.schemas import UpdateSettingsRequest
from app.services import user_service

router = APIRouter(prefix="/users", tags=["用户与配额"])


def _load_settings(user: User) -> dict:
    try:
        return json.loads(user.settings_json or "{}")
    except json.JSONDecodeError:
        return {}


@router.get("/quota")
def get_quota(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(user_service.get_quota(db, user))


@router.get("/settings")
def get_settings(user: User = Depends(get_current_user)):
    data = _load_settings(user)
    return ok({
        "privacy": data.get("privacy", {"keep_recordings": True, "allow_cloud_sync": False}),
        "ui": data.get("ui", {}),
    })


@router.put("/settings")
def update_settings(req: UpdateSettingsRequest, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    data = _load_settings(user)
    if req.privacy is not None:
        data["privacy"] = req.privacy.model_dump() if hasattr(req.privacy, "model_dump") else req.privacy
    if req.ui is not None:
        data["ui"] = req.ui.model_dump() if hasattr(req.ui, "model_dump") else req.ui
    user.settings_json = json.dumps(data, ensure_ascii=False)
    db.commit()
    return ok({"privacy": data.get("privacy", {}), "ui": data.get("ui", {})})


@router.post("/privacy/export")
def export_data(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """导出我的数据：返回一次性下载 URL + 真实数据（演示直接返回 JSON 内容）"""
    from app.models.chat import ChatMessage, ChatSession
    from app.models.interview import InterviewSession, QaHistory
    from app.models.study import Favorite, Note, Progress
    payload = {
        "user": {
            "id": user.id, "account": user.account, "nickname": user.nickname,
            "direction": user.direction, "target_role": user.target_role,
            "grade": user.grade, "role": user.role,
        },
        "progress": [{"chapter_id": r.chapter_id, "position_percent": r.position_percent,
                      "completed": bool(r.completed), "quiz_score": r.quiz_score}
                     for r in db.query(Progress).filter(Progress.user_id == user.id).all()],
        "favorites": [f.chapter_id for f in db.query(Favorite).filter(Favorite.user_id == user.id).all()],
        "notes": [{"chapter_id": n.chapter_id, "anchor": n.anchor, "text": n.text}
                  for n in db.query(Note).filter(Note.user_id == user.id).all()],
        "qa_history": [{"question": h.question, "answer": h.answer}
                       for h in db.query(QaHistory).filter(QaHistory.user_id == user.id).all()],
        "chat_sessions": [{"id": s.id, "title": s.title,
                           "messages": [m.content for m in db.query(ChatMessage)
                                        .filter(ChatMessage.session_id == s.id).all()]}
                          for s in db.query(ChatSession).filter(ChatSession.user_id == user.id).all()],
        "interviews": [{"id": s.id, "position": s.position, "status": s.status}
                       for s in db.query(InterviewSession).filter(InterviewSession.user_id == user.id).all()],
    }
    token = secrets.token_hex(8)
    # 简化：直接返回内容（真实环境生成文件并给一次性下载链接）
    return ok({"download_url": f"/v1/users/{user.id}/privacy/export?token={token}",
               "expires_in": 3600, "data": payload})


@router.get("/{user_id}/privacy/export")
def download_export(user_id: str, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    if user_id != user.id:
        raise ApiException(40300, "无权限访问他人信息")
    from app.models.chat import ChatMessage, ChatSession
    from app.models.interview import InterviewSession, QaHistory
    from app.models.study import Favorite, Note, Progress
    payload = {
        "user": {"id": user.id, "account": user.account, "nickname": user.nickname,
                 "direction": user.direction, "target_role": user.target_role,
                 "grade": user.grade, "role": user.role},
        "progress": [{"chapter_id": r.chapter_id, "position_percent": r.position_percent,
                      "completed": bool(r.completed), "quiz_score": r.quiz_score}
                     for r in db.query(Progress).filter(Progress.user_id == user.id).all()],
        "favorites": [f.chapter_id for f in db.query(Favorite).filter(Favorite.user_id == user.id).all()],
        "notes": [{"chapter_id": n.chapter_id, "anchor": n.anchor, "text": n.text}
                  for n in db.query(Note).filter(Note.user_id == user.id).all()],
        "qa_history": [{"question": h.question, "answer": h.answer}
                       for h in db.query(QaHistory).filter(QaHistory.user_id == user.id).all()],
        "chat_sessions": [{"id": s.id, "title": s.title,
                           "messages": [m.content for m in db.query(ChatMessage)
                                        .filter(ChatMessage.session_id == s.id).all()]}
                          for s in db.query(ChatSession).filter(ChatSession.user_id == user.id).all()],
        "interviews": [{"id": s.id, "position": s.position, "status": s.status}
                       for s in db.query(InterviewSession).filter(InterviewSession.user_id == user.id).all()],
    }
    return JSONResponse(
        content=payload,
        headers={"Content-Disposition":
                 f'attachment; filename="export-{secrets.token_hex(3)}.json"'})



@router.get("/{user_id}")
def get_user(user_id: str, user: User = Depends(get_current_user)):
    # 仅允许访问自己
    if user_id != user.id:
        raise ApiException(40300, "无权限访问他人信息")
    from app.schemas import UserOut
    return ok(UserOut.model_validate(user).model_dump(mode="json"))