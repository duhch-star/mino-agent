"""前端适配层：/api/career/* 职业辅导（简历分析 / 岗位匹配 / STAR 整理）"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.models.user import User
from app.routers_fe.utils import get_optional_fe_user
from app.services import ai_service

router = APIRouter(prefix="/career", tags=["FE-职业辅导"])


# ---------------- 简历分析 ----------------

class FeResumeAnalyze(BaseModel):
    text: str = ""
    attachmentIds: list = []


@router.post("/resume/analyze")
def fe_analyze_resume(req: FeResumeAnalyze, user: User | None = Depends(get_optional_fe_user)):
    return _analyze_text(req.text)


def _analyze_text(text: str) -> dict:
    """同构前端 analyzeResume 演示逻辑的启发式分析"""
    if not text.strip():
        return {"summary": "请提供简历内容后再分析。",
                "sections": [], "suggestions": [], "jobMatches": []}
    has_quant = any(ch.isdigit() or ch == "%" for ch in text)
    has_star = "情境" in text or "STAR" in text or "结果" in text
    sections = [
        {"title": "整体印象",
         "points": ["简历包含可分析内容", "建议突出与你目标岗位最相关的一段经历"]},
        {"title": "结构与表达", "points": [
            "用 STAR 结构描述项目经历" if not has_star else "经历描述包含 STAR 要素，保持简洁",
            "开头 1 行定位：我是谁 + 什么方向 + 什么亮点"]},
        {"title": "量化与证据", "points": [
            "为关键成果补充数据（如 提升 30%、日均 2 万单）" if not has_quant else "已包含量化信息，继续保持",
            "技能关键词与目标岗位 JD 对齐"]},
    ]
    suggestions = [
        "每个项目经历用 情境-任务-行动-结果 四要素描述" if not has_star else "保持 STAR 结构，删减与岗位无关内容",
        "为关键成果补充量化指标" if not has_quant else "把最亮眼的数字前置到开头",
        "将自我评价改写为与目标岗位匹配的能力关键词",
    ]
    job_matches = []
    for keyword in ("产品", "开发", "数据", "运营", "设计"):
        if keyword in text:
            job_matches.append({
                "title": f"{keyword}相关岗位",
                "matchScore": round(0.72 + (0.08 if has_quant else 0), 2),
                "reasons": [f"简历出现『{keyword}』相关经历", "建议按 JD 关键词进一步微调"],
            })
    return {"summary": f"已完成分析：共 {len(text)} 字，识别到{'量化数据。' if has_quant else '缺少量化数据。'}",
            "sections": sections, "suggestions": suggestions,
            "jobMatches": job_matches[:3]}


# ---------------- 岗位匹配 ----------------

class FeJobMatch(BaseModel):
    profile: dict = {}
    resumeId: str = ""
    target: dict = {}


@router.post("/jobs/match")
def fe_jobs_match(req: FeJobMatch, user: User | None = Depends(get_optional_fe_user)):
    target_title = (req.target or {}).get("title", "")
    profile_direction = (req.profile or {}).get("direction", "")
    items = [
        {"title": target_title or "目标岗位", "matchScore": 0.85,
         "reasons": ["画像方向匹配", "建议补充关键经历关键词"]},
        {"title": f"{profile_direction or '求职'}相关岗位", "matchScore": 0.72,
         "reasons": ["与你的方向相符", "岗位竞争激烈，建议针对性准备"]},
    ]
    return {"items": items}


# ---------------- STAR 整理 ----------------

class FeStarOrganize(BaseModel):
    experience: str = Field(min_length=1, max_length=4000)
    targetRole: str = ""


@router.post("/star/organize")
async def fe_star_organize(req: FeStarOrganize, user: User | None = Depends(get_optional_fe_user)):
    llm = ai_service.get_llm()
    prompt = (
        f"请把下面这段经历改写为 STAR 结构（情境 S / 任务 T / 行动 A / 结果 R），"
        f"每部分 1-2 句话，结果尽量量化；然后给出 2-3 条改进建议。\n"
        f"目标岗位：{req.targetRole or '（未指定）'}\n经历：{req.experience}"
    )
    answer = await llm.chat([{"role": "user", "content": prompt}], max_tokens=600)
    return {
        "situation": "（S 情境）在上一段经历中，你面对的背景与约束……",
        "task": "（T 任务）你承担的角色与要达成的目标……",
        "action": "（A 行动）你具体采取的关键行动……",
        "result": "（R 结果）带来的可量化成果……",
        "suggestions": ["按 STAR 顺序讲述", "行动部分多用「我」", "结果尽量量化"],
        "tip": answer[:200],
    }