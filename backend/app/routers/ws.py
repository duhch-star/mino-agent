"""WebSocket 实时链路：语音面试房间 / 流式问答 / 心跳

协议见《小民求职智能体_API接口设计方案》3.7 节。
信封：{type, seq, ts, payload}
"""
import asyncio
import json
import time

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core.responses import ApiException
from app.core.security import decode_token
from app.db.session import get_db
from app.services import ai_service, interview_service, qa_service

router = APIRouter(prefix="/ws", tags=["WebSocket实时链路"])

# 简单会话级管理（单进程演示；生产换 Redis pub/sub 做多实例）
rooms: dict[str, dict] = {}


def _envelope(type_: str, payload: dict, seq: int = 0) -> str:
    return json.dumps({"type": type_, "seq": seq,
                       "ts": time.strftime("%Y-%m-%dT%H:%M:%S+08:00"),
                       "payload": payload}, ensure_ascii=False)


def _auth_user_id(token: str) -> str:
    try:
        payload = decode_token(token)
    except Exception:
        raise ApiException(40100, "ws token 无效")
    return payload.get("sub", "")


@router.websocket("/interview/{session_id}")
async def interview_room(ws: WebSocket, session_id: str,
                         db: Session = Depends(get_db)):
    token = ws.query_params.get("token", "")
    user_id = _auth_user_id(token)
    s = interview_service.get(db, session_id)
    if not s or s.user_id != user_id:
        await ws.close(code=4403)
        return
    await ws.accept()
    room = rooms.setdefault(session_id, {"ws": ws, "user_id": user_id, "seq": 0})
    room["ws"] = ws

    questions = json.loads(s.questions_json or "[]")
    idx = s.current_index

    async def send(type_, payload):
        room["seq"] += 1
        await ws.send_text(_envelope(type_, payload, room["seq"]))

    try:
        await send("interview.start", {"session_id": session_id,
                                       "question": questions[idx] if idx < len(questions) else None})
        tts = ai_service.get_tts()
        audio = await tts.synthesize(questions[idx]["text"] if idx < len(questions) else "你好，我是小民")
        await ws.send_bytes(audio)
        await send("tts.done", {"bytes": len(audio)})

        while True:
            raw = await ws.receive()
            if raw.get("type") == "websocket.disconnect":
                break
            text = raw.get("text")
            if not text:
                continue
            msg = json.loads(text)
            mtype = msg.get("type")

            if mtype == "ping":
                await send("pong", {"t": msg.get("t")})
            elif mtype in ("stt.audio", "answer.audio"):
                # 真实场景：音频分片→STT 服务；演示直接回显
                await send("stt.partial", {"text": "（正在识别…）"})
                stt = ai_service.get_stt()
                transcript = await stt.transcribe(b"-")
                await send("stt.final", {"text": transcript})
            elif mtype == "answer.start":
                await send("interview.answer_received", {})
            elif mtype == "answer.submit":
                payload = msg.get("payload", {})
                qid = payload.get("question_id", "")
                text = payload.get("text", "")
                interview_service.submit_answer(db, s, qid, text)
                idx = s.current_index
                if idx < len(questions):
                    grade = ai_service.grade_answer(
                        questions[idx - 1].get("text", ""), text)
                    await send("interview.hint", {"score_hint": grade["score"],
                                                  "tip": grade["comment"]})
                    await send("interview.question", {"question": questions[idx]})
                    audio = await tts.synthesize(questions[idx]["text"])
                    await ws.send_bytes(audio)
                    await send("tts.done", {"bytes": len(audio)})
                else:
                    await send("interview.finish", {"report_id": f"rp_{session_id}"})
            elif mtype == "session.finish":
                report = interview_service.finish(db, s)
                await send("interview.finish",
                           {"report_id": report["report_id"]})
                await ws.close()
                break
            elif mtype == "session.abort":
                interview_service.abort(db, s)
                await send("interview.abort", {"reason": "user"})
                await ws.close()
                break
            else:
                await send("error", {"code": 40000, "message": f"未知消息类型 {mtype}"})
    except WebSocketDisconnect:
        pass
    finally:
        await ws.close()


@router.websocket("/qa")
async def qa_stream(ws: WebSocket, db: Session = Depends(get_db)):
    await ws.accept()
    try:
        while True:
            raw = await ws.receive()
            if raw.get("type") == "websocket.disconnect":
                break
            text = raw.get("text")
            if not text:
                continue
            msg = json.loads(text)
            if msg.get("type") == "ping":
                await ws.send_text(_envelope("pong", {"t": msg.get("t")}))
                continue
            if msg.get("type") != "qa.ask":
                await ws.send_text(_envelope("error", {"message": "unknown"}))
                continue
            q = msg.get("payload", {}).get("question", "")
            hits = qa_service._retrieve(db, q, None)
            if hits:
                await ws.send_text(_envelope("qa.source",
                                             {"chapter_id": hits[0]["chapter_id"],
                                              "title": hits[0]["title"]}))
            # 模拟流式输出
            llm = ai_service.get_llm()
            answer = await llm.chat([{"role": "user", "content": q}], max_tokens=300)
            for chunk in [answer[i:i + 20] for i in range(0, len(answer), 20)]:
                await ws.send_text(_envelope("qa.delta", {"text": chunk}))
                await asyncio.sleep(0.02)
            await ws.send_text(_envelope("qa.done", {"sources": [
                {"chapter_id": h["chapter_id"], "title": h["title"]} for h in hits]}))
    except WebSocketDisconnect:
        pass
    finally:
        await ws.close()


@router.websocket("/events")
async def events(ws: WebSocket):
    """通知通道（章节更新/额度变更/审核完成）——演示版仅回显心跳"""
    await ws.accept()
    try:
        while True:
            raw = await ws.receive()
            if raw.get("type") == "websocket.disconnect":
                break
            text = raw.get("text")
            if text and json.loads(text).get("type") == "ping":
                await ws.send_text(_envelope("pong", {}))
    except WebSocketDisconnect:
        pass
    finally:
        await ws.close()