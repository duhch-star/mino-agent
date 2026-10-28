"""前端适配层：/api/chat/* 对话助手（SSE 流式）+ 附件

SSE 事件契约（见 mino-agent BACKEND_API.md）：
event: activity | delta | done | error
"""
import asyncio
import json

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.responses import ApiException
from app.db.session import get_db
from app.models.user import User
from app.routers_fe.utils import get_optional_fe_user
from app.services import chat_service
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/chat", tags=["FE-对话助手"])


def _guest_user_id(user: User | None) -> str:
    return user.id if user else ""


# ---------------- 会话 CRUD ----------------

class FeSessionCreate(BaseModel):
    title: str = ""
    parentSessionId: str = ""
    branchMessageId: str = ""


class FeSessionRename(BaseModel):
    title: str = Field(min_length=1, max_length=60)


@router.post("/sessions")
def fe_create_session(req: FeSessionCreate, user: User | None = Depends(get_optional_fe_user),
                      db: Session = Depends(get_db)):
    return chat_service.create_session(db, _guest_user_id(user), req.model_dump())


@router.get("/sessions")
def fe_list_sessions(user: User | None = Depends(get_optional_fe_user),
                     db: Session = Depends(get_db)):
    return chat_service.list_sessions(db, _guest_user_id(user))


@router.get("/sessions/{session_id}/messages")
def fe_session_messages(session_id: str, user: User | None = Depends(get_optional_fe_user),
                        db: Session = Depends(get_db)):
    result = chat_service.list_messages(db, _guest_user_id(user), session_id)
    if result is None:
        raise ApiException(40400, "会话不存在", status_code=404)
    return result


@router.patch("/sessions/{session_id}")
def fe_rename_session(session_id: str, req: FeSessionRename,
                      user: User | None = Depends(get_optional_fe_user),
                      db: Session = Depends(get_db)):
    result = chat_service.rename_session(db, _guest_user_id(user), session_id, req.title)
    if result is None:
        raise ApiException(40400, "会话不存在", status_code=404)
    return result


@router.delete("/sessions/{session_id}")
def fe_delete_session(session_id: str, user: User | None = Depends(get_optional_fe_user),
                      db: Session = Depends(get_db)):
    deleted = chat_service.delete_session(db, _guest_user_id(user), session_id)
    if not deleted:
        raise ApiException(40400, "会话不存在", status_code=404)
    return {"deleted": True}


# ---------------- 工具 / Skill 目录（可扩展：前端动态加载工具菜单） ----------------

@router.get("/tools")
def fe_list_tools(user: User | None = Depends(get_optional_fe_user)):
    """返回工具目录 + 已加载 skills（新增工具/skill 后前端无需发版即出现）。"""
    from app.services import tool_registry
    return {
        "tools": tool_registry.list_tools(),
        "skills": tool_registry.list_skills(),
        "harness": {"enabled": bool(user), "requiresLogin": True,
                    "scope": "当前用户独立文件工作区", "maxRounds": 6, "maxCalls": 12,
                    "tools": ["list_files", "read_file", "write_file", "edit_file", "search_files"]},
    }


@router.get("/skills")
def fe_list_skills(user: User | None = Depends(get_optional_fe_user)):
    from app.services import tool_registry
    tool_registry.load_skills()  # 热加载：每次拉取重扫 skills 目录
    return {"skills": tool_registry.list_skills()}


# ---------------- 附件上传 ----------------

@router.post("/attachments")
def fe_upload_attachments(files: list[UploadFile] = File(...),
                          user: User | None = Depends(get_optional_fe_user),
                          db: Session = Depends(get_db)):
    return chat_service.create_attachments(db, _guest_user_id(user), files)


# ---------------- 消息反馈 ----------------

class FeFeedback(BaseModel):
    conversationId: str
    messageId: str
    rating: str = Field(pattern="^(helpful|unhelpful)$")
    reason: str | None = None


@router.post("/feedback")
def fe_chat_feedback(req: FeFeedback, user: User | None = Depends(get_optional_fe_user),
                     db: Session = Depends(get_db)):
    result = chat_service.set_message_feedback(
        db, _guest_user_id(user), req.conversationId, req.messageId,
        req.rating, req.reason)
    if result is None:
        raise ApiException(40400, "消息或会话不存在", status_code=404)
    return result


# ---------------- 流式对话（SSE） ----------------

class FeChatRequest(BaseModel):
    conversationId: str = ""
    text: str = Field(min_length=1)
    context: dict | None = None
    mode: str = "career"
    tool: str | None = None
    depth: str = "standard"
    attachments: list = []
    attachmentIds: list = []


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("")
async def fe_chat(req: FeChatRequest, user: User | None = Depends(get_optional_fe_user),
                  db: Session = Depends(get_db)):
    user_id = _guest_user_id(user)
    session = None
    if req.conversationId:
        session = chat_service.get_session(db, user_id, req.conversationId)
    if not session and req.conversationId:
        raise ApiException(40400, "会话不存在，请先创建会话", status_code=404)

    # 保存用户消息（登录用户）
    user_message_id = ''
    if session and user_id:
        meta = {
            "references": req.attachments and [
                {"kind": "file", "title": a.get("name", "")} for a in req.attachments
            ] or [],
            "attachments": req.attachments,
            "attachmentIds": req.attachmentIds,
            "context": req.context,
            "options": {"mode": req.mode, "depth": req.depth, "tool": req.tool},
        }
        user_message_id = chat_service.save_user_message(db, session, req.text, meta).id

    # 生成（真流式 LLM 调用）
    asked = {"conversationId": req.conversationId, "text": req.text,
             "context": req.context, "mode": req.mode, "tool": req.tool,
             "depth": req.depth, "attachmentIds": req.attachmentIds,
             "userId": user_id}

    async def stream():
        yield _sse("activity", {"status": "running", "label": "正在生成回答"})
        content_parts = []
        saved_id = ""
        tool_calls = {}
        try:
            # 逐 token 推送 delta（真实流式：首个 token 到达即开始返回）
            async for event in chat_service.stream_reply(db, asked):
                if event["type"] == "delta":
                    content_parts.append(event["delta"])
                    yield _sse("delta", {"delta": event["delta"]})
                elif event["type"] == "tool_call":
                    trace = {k: v for k, v in event.items() if k != "type"}
                    tool_calls[trace["id"]] = trace
                    yield _sse("tool_call", trace)
                elif event["type"] == "ui":
                    yield _sse("ui", event["ui"])
                elif event["type"] == "done":
                    content = "".join(content_parts)
                    # 保存助手消息（登录用户），得到真实 messageId
                    if session and user_id:
                        saved = chat_service.save_assistant_message(
                            db, session, content,
                            {"task": {"status": "completed", "mode": req.mode,
                                      "tool": req.tool, "depth": req.depth},
                             "usage": event["usage"],
                             "performance": event["performance"],
                             "ui": event.get("ui"),
                             "skills": event.get("skills"),
                             "toolCalls": list(tool_calls.values())})
                        saved_id = saved.id
                    yield _sse("done", {
                        "messageId": saved_id or event["messageId"],
                        "userMessageId": user_message_id,
                        "usage": event["usage"],
                        "performance": event["performance"],
                        "citations": event["citations"],
                        "ui": event.get("ui"),
                        "skills": event.get("skills") or [],
                        "toolCalls": list(tool_calls.values()),
                    })
        except Exception as exc:  # noqa: BLE001
            import httpx
            if isinstance(exc, httpx.TimeoutException):
                message = "模型响应超时，请重试；已完成的工具操作仍然保留。"
            elif isinstance(exc, httpx.RequestError):
                message = "无法连接模型服务，请检查网络及 API 地址后重试。"
            elif isinstance(exc, RuntimeError) and str(exc).startswith(('模型接口返回 HTTP ', '模型输出被截断或过滤', '模型连接意外中断', '已达到本轮工具调用上限', '已达到工具执行轮数上限')):
                message = str(exc)
            else:
                message = "生成失败，请重试；已完成的工具操作仍然保留。"
            yield _sse("error", {"code": "MODEL_UNAVAILABLE",
                                 "message": message,
                                 "retryable": True})

        finally:
            if not saved_id and session and user_id and (content_parts or tool_calls):
                for trace in tool_calls.values():
                    if trace["status"] == "running":
                        trace.update(status="failed", error="执行中断，请重新读取确认文件状态")
                chat_service.save_assistant_message(db, session, "".join(content_parts), {
                    "task": {"status": "failed", "mode": req.mode, "tool": req.tool, "depth": req.depth},
                    "toolCalls": list(tool_calls.values())})

    return StreamingResponse(stream(),
                             media_type="text/event-stream; charset=utf-8",
                             headers={"Cache-Control": "no-cache",
                                      "X-Accel-Buffering": "no"})