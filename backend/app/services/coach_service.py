"""职业辅导：简历解析 / STAR 改写 / 学习计划"""
import json
import secrets

from sqlalchemy.orm import Session

from app.models.interview import QaHistory
from app.services import ai_service, chapter_service


def _mock_parse_resume(text: str) -> dict:
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    keywords = []
    for kw in ("增长", "转化", "用户", "运营", "产品", "开发", "数据分析", "管理"):
        if kw in text:
            keywords.append(kw)
    return {
        "structure": {
            "has_contact": any(c in text for c in ("电话", "邮箱", "@")),
            "has_education": "大学" in text or "本科" in text or "研究生" in text,
            "has_experience": any(k in text for k in ("实习", "工作", "项目")),
            "has_skills": "技能" in text or "熟练" in text,
        },
        "keywords": keywords[:8],
        "gaps": [
            "缺少量化结果（建议补充 数据/百分比）" if not any(c in text for c in ("%", "提升", "增长")) else "",
            "缺少 STAR 化项目描述" if "情境" not in text else "",
        ],
        "suggestions": [
            "每个项目经历用 情境-任务-行动-结果 四要素描述",
            "为关键成果补充量化指标（如 提升 30%）",
            "将自我评价改写为与目标岗位匹配的能力关键词",
        ],
        "severity": "需优化" ,
    }


async def analyze_resume(db: Session, job_id: str, text: str) -> dict:
    analysis = _mock_parse_resume(text)
    analysis["job_id"] = job_id
    return analysis


async def star_suggest(experience_text: str, question: str | None) -> dict:
    llm = ai_service.get_llm()
    prompt = (
        "请把下面这段经历改写为 STAR 结构（情境/任务/行动/结果），"
        "每部分一句话，结果尽量量化；附一条改进建议。\n"
        f"{experience_text}" + (f"\n围绕问题：{question}" if question else "")
    )
    answer = await llm.chat([{"role": "user", "content": prompt}], max_tokens=600)
    # mock 场景下结构化解析
    parts = {"S": "情境", "T": "任务", "A": "行动", "R": "结果"}
    star = []
    for k, label in parts.items():
        star.append({"part": k, "label": label,
                     "text": f"（{label}部分由AI生成之一行示例）"})
    return {"star": star, "tip": answer[:200]}


async def create_plan(db: Session, user_id: str, goal: str, deadline: str | None,
                      preferences: dict | None) -> dict:
    chapters = db.query(__import__("app.models.chapter", fromlist=["Chapter"]).Chapter)\
        .filter(__import__("app.models.chapter", fromlist=["Chapter"]).Chapter.status == "published")\
        .order_by(__import__("app.models.chapter", fromlist=["Chapter"]).Chapter.id).limit(5).all()
    plan_id = f"pl_{secrets.token_hex(6)}"
    return {
        "plan_id": plan_id,
        "goal": goal,
        "deadline": deadline,
        "phases": [
            {"phase": 1, "title": "知识打底",
             "actions": ["完成简历章节学习", "完成面试章节学习"],
             "chapters": [c.id for c in chapters[:2]]},
            {"phase": 2, "title": "实战练习",
             "actions": ["完成 3 次模拟面试", "针对薄弱点补课"],
             "chapters": [c.id for c in chapters[2:4]]},
            {"phase": 3, "title": "冲刺优化",
             "actions": ["简历终稿", "模拟面试复盘"],
             "chapters": [c.id for c in chapters[4:5]]},
        ],
    }