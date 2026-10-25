"""管理端：AI 章节生成流水线（大纲→撰写→审核→发布）"""
import json
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.responses import ApiException, ok
from app.db.session import get_db
from app.models.chapter import Chapter
from app.models.user import User
from app.schemas import ChapterEdit, GenerateRequest, PublishRequest, ReviewRequest
from app.services import ai_service

router = APIRouter(prefix="/admin/chapters", tags=["管理端-章节生成"])

# 内存任务表（演示；生产换 Celery/任务队列）
JOB_STORE: dict[str, dict] = {}


def _require_admin(user: User):
    if user.role != "admin":
        raise ApiException(40300, "需要管理员权限")


@router.post("/generate")
async def generate(req: GenerateRequest, user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    _require_admin(user)
    job_id = f"job_{secrets.token_hex(6)}"
    slug = req.topic.replace(" ", "-").replace("/", "-")[:40] + f"-{secrets.token_hex(2)}"
    chapter_id = f"ch_{secrets.token_hex(4)}"
    chapter = Chapter(
        id=chapter_id, slug=slug, title=req.topic, status="draft",
        tags=json.dumps(["生成中"], ensure_ascii=False),
        prereq="[]", related="[]",
        summary=f"AI 生成的《{req.topic}》章节（待审核）",
    )
    db.add(chapter)
    db.commit()

    JOB_STORE[job_id] = {"job_id": job_id, "status": "running",
                         "stage": "撰写中", "chapter_id": chapter_id}

    # 异步撰写（演示为同步快速完成；生产放任务队列）
    try:
        llm = ai_service.get_llm()
        outline = req.outline or [
            {"part": "一、核心概念", "desc": f"{req.topic}的基础定义与要点"},
            {"part": "二、常见误区", "desc": f"求职者关于{req.topic}的常见错误"},
            {"part": "三、实操建议", "desc": "可直接执行的方法与话术"},
            {"part": "四、练习与自测", "desc": "练习题与参考答案"},
        ]
        sections = []
        for o in outline:
            md = await llm.chat([{"role": "user", "content":
                                  f"撰写求职辅导章节《{req.topic}》的「{o['part']}」小节，300-500 字，markdown 标题层级，给出可操作建议。"}],
                                max_tokens=800)
            sections.append(f"## {o['part']}\n\n{md}\n")
        body_md = (f"# {req.topic}\n\n> AI 自动生成草稿，待人工审核。来源：{req.source_ids or '示例资料来源'}\n\n"
                   + "\n".join(sections))
        chapter.body_md = body_md
        chapter.status = "review"
        chapter.version = 1
        JOB_STORE[job_id].update({"status": "done", "stage": "待审核"})
        db.commit()
    except Exception as exc:  # noqa: BLE001
        JOB_STORE[job_id].update({"status": "failed", "stage": str(exc)})
        chapter.status = "draft"
        db.commit()
    return ok({"job_id": job_id, "chapter_id": chapter_id})


@router.get("/jobs/{job_id}")
def job_status(job_id: str, user: User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    _require_admin(user)
    job = JOB_STORE.get(job_id)
    if not job:
        raise ApiException(40400, "任务不存在")
    chapter = db.get(Chapter, job["chapter_id"])
    return ok({"job_id": job_id, "status": job["status"], "stage": job["stage"],
               "chapter_id": job["chapter_id"],
               "preview_md": chapter.body_md[:4000] if chapter else ""})


@router.get("/drafts")
def drafts(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_admin(user)
    rows = (db.query(Chapter).filter(Chapter.status.in_(["draft", "review"]))
            .order_by(Chapter.updated_at.desc()).all())
    return ok({"items": [{"id": c.id, "title": c.title, "status": c.status,
                          "updated_at": str(c.updated_at)} for c in rows]})


@router.put("/{chapter_id}")
def edit_chapter(chapter_id: str, req: ChapterEdit,
                 user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_admin(user)
    chapter = db.get(Chapter, chapter_id)
    if not chapter:
        raise ApiException(40400, "章节不存在")
    data = req.model_dump(exclude_none=True)
    if "tags" in data:
        chapter.tags = json.dumps(data.pop("tags"), ensure_ascii=False)
    if "prereq" in data:
        chapter.prereq = json.dumps(data.pop("prereq"), ensure_ascii=False)
    if "related" in data:
        chapter.related = json.dumps(data.pop("related"), ensure_ascii=False)
    for k, v in data.items():
        setattr(chapter, k, v)
    db.commit()
    db.refresh(chapter)
    return ok({"id": chapter.id, "title": chapter.title, "status": chapter.status})


@router.post("/{chapter_id}/review")
def review(chapter_id: str, req: ReviewRequest, user: User = Depends(get_current_user),
           db: Session = Depends(get_db)):
    _require_admin(user)
    chapter = db.get(Chapter, chapter_id)
    if not chapter:
        raise ApiException(40400, "章节不存在")
    if req.action == "pass":
        chapter.status = "reviewed"  # 下一步 publish
    elif req.action == "revise":
        chapter.status = "draft"
    else:
        chapter.status = "rejected"
    chapter.reviewer = user.id
    db.commit()
    return ok({"id": chapter.id, "status": chapter.status})


@router.post("/{chapter_id}/publish")
def publish(chapter_id: str, req: PublishRequest, user: User = Depends(get_current_user),
            db: Session = Depends(get_db)):
    _require_admin(user)
    chapter = db.get(Chapter, chapter_id)
    if not chapter:
        raise ApiException(40400, "章节不存在")
    if req.action == "publish":
        if chapter.status not in ("reviewed", "published"):
            raise ApiException(40900, "请先通过审核再发布")
        chapter.status = "published"
        chapter.version += 1
    else:
        chapter.status = "draft"
    db.commit()
    return ok({"id": chapter.id, "status": chapter.status, "version": chapter.version})