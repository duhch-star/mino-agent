"""职业辅导接口"""
import json
import secrets

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.responses import ApiException, ok
from app.db.session import get_db
from app.models.user import User
from app.schemas import PlanRequest, StarSuggestRequest
from app.services import coach_service

router = APIRouter(prefix="/coach", tags=["职业辅导"])

# 简历解析结果暂存（演示用内存；生产用任务队列 + 对象存储）
RESUME_RESULTS: dict[str, dict] = {}


@router.post("/resume/analyze")
async def analyze_resume(file: UploadFile = File(...),
                         user: User = Depends(get_current_user),
                         db: Session = Depends(get_db)):
    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = ""
    if not text.strip():
        raise ApiException(40000, "无法解析该文件，请上传文本/纯文本简历")
    job_id = f"rj_{secrets.token_hex(6)}"
    analysis = await coach_service.analyze_resume(db, job_id, text)
    RESUME_RESULTS[job_id] = analysis
    return ok({"job_id": job_id, "status": "done"})


@router.get("/resume/analysis/{job_id}")
def resume_analysis(job_id: str, user: User = Depends(get_current_user)):
    result = RESUME_RESULTS.get(job_id)
    if not result:
        raise ApiException(40400, "解析任务不存在或已过期")
    return ok(result)


@router.post("/star/suggest")
async def star_suggest(req: StarSuggestRequest,
                       user: User = Depends(get_current_user)):
    return ok(await coach_service.star_suggest(req.experience_text, req.question))


@router.post("/plan")
async def create_plan(req: PlanRequest, user: User = Depends(get_current_user),
                      db: Session = Depends(get_db)):
    plan = await coach_service.create_plan(db, user.id, req.goal, req.deadline,
                                           req.preferences)
    return ok(plan)


@router.get("/plan/{plan_id}")
def get_plan(plan_id: str, user: User = Depends(get_current_user)):
    # 演示：计划为无状态生成，直接按 id 返回占位
    return ok({"plan_id": plan_id, "note": "正式版计划持久化到数据库"})