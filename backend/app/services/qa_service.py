"""RAG 问答服务：检索章节 → 组装上下文 → LLM 生成 → 记录来源"""
import json
import secrets

from sqlalchemy.orm import Session

from app.models.chapter import Chapter
from app.models.interview import QaHistory
from app.services import ai_service, chapter_service


def _retrieve(db: Session, question: str, chapter_id: str | None) -> list:
    """混合检索：先精确标题/标签，再正文包含，返回 top3 章节片段"""
    hits = []
    chapters = db.query(Chapter).filter(Chapter.status == "published").all()
    for c in chapters:
        if chapter_id and c.id != chapter_id:
            continue
        words = [w for w in question if w.strip()]
        title_hit = any(w in c.title for w in words)
        body_hit = any(w in c.body_md for w in words[:6])
        tag_hit = any(w in c.tags for w in words)
        if title_hit or body_hit or tag_hit:
            snippet = c.body_md[:600]
            hits.append({"chapter_id": c.id, "title": c.title,
                         "anchor": chapter_service.build_outline(c.body_md)[0]["anchor"]
                         if chapter_service.build_outline(c.body_md) else "",
                         "snippet": snippet, "score": (3 if title_hit else 0) + 1})
    hits.sort(key=lambda h: -h["score"])
    return hits[:3]


async def ask(db: Session, user_id: str, question: str,
              chapter_id: str | None = None, selection: str | None = None) -> dict:
    hits = _retrieve(db, question, chapter_id)
    context = "\n\n".join(f"【{h['title']}】\n{h['snippet']}" for h in hits)
    system = (
        "你是「小民」，一名专业求职辅导助手。回答必须基于提供的知识章节内容；"
        "若资料不足，明确说明“知识库暂无相关资料”，不要编造事实。回答控制在 400 字内。"
    )
    user_prompt = f"知识库内容：\n{context if context else '（无检索命中）'}\n\n"
    if selection:
        user_prompt += f"用户选中的段落：{selection}\n\n"
    user_prompt += f"用户问题：{question}"
    llm = ai_service.get_llm()
    answer = await llm.chat([
        {"role": "system", "content": system},
        {"role": "user", "content": user_prompt},
    ], temperature=0.4, max_tokens=800)

    record = QaHistory(
        id=f"qa_{secrets.token_hex(6)}", user_id=user_id,
        question=question, answer=answer,
        sources_json=json.dumps([{"chapter_id": h["chapter_id"],
                                  "title": h["title"], "anchor": h["anchor"]}
                                 for h in hits], ensure_ascii=False),
    )
    db.add(record)
    db.commit()

    related = hits[0]["chapter_id"] if hits else None
    return {"answer": answer,
            "sources": [{"chapter_id": h["chapter_id"], "title": h["title"],
                         "anchor": h["anchor"]} for h in hits],
            "related_chapter": related}


def history(db: Session, user_id: str, page: int = 1, page_size: int = 20) -> dict:
    q = db.query(QaHistory).filter(QaHistory.user_id == user_id)\
        .order_by(QaHistory.created_at.desc())
    total = q.count()
    rows = q.offset((page - 1) * page_size).limit(page_size).all()
    items = [{"id": r.id, "question": r.question, "answer": r.answer,
              "sources": json.loads(r.sources_json or "[]"),
              "created_at": str(r.created_at)} for r in rows]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def delete_history(db: Session, user_id: str, history_id: str):
    row = db.query(QaHistory).filter(QaHistory.id == history_id,
                                     QaHistory.user_id == user_id).first()
    if row:
        db.delete(row)
        db.commit()