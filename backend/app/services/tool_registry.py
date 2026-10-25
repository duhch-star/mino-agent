"""工具注册表 + Skill 加载（可扩展架构）

设计目标：新增工具 / 技能无需改业务代码，通过注册与 skill 文件热插拔。

三层可扩展：
1. TOOLS 注册表：声明工具元数据（id / label / icon / system hint / genui 类型）
2. Skill 文件：`app/skills/*.yaml` 或 `*.py`，声明 {id, name, description,
   keywords, modes, tools, system_prompt}；运行时扫描加载进 SKILLS，
   按对话场景（mode / tool / 文本关键词）自动激活并注入 system prompt
3. GenUI 构建器：TOOLS[tool]["genui"] 指向前端组件类型，或由 _genui_* 函数生成

新增一个工具的标准流程：
  a. 在 TOOLS 中登记一条（或复用已有 id）
  b. （可选）写一个 skill 文件声明该工具需要的知识注入
  c. 若需要专属生成式 UI，在 chat_service._build_genui 增加一条分发
"""
import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

# ---------------- 内置工具注册表 ----------------
# genui: 前端 GenUI 组件类型（resume_scorecard / job_match / knowledge_card /
#        star_builder / action_plan / interview_feedback / salary_advice / question_card）
TOOLS: dict[str, dict] = {
    "resume_analysis": {
        "id": "resume_analysis",
        "label": "分析简历",
        "icon": "📋",
        "hint": "本次请求来自简历分析场景，请围绕简历内容提出优化建议，强调量化结果与 STAR 结构。",
        "genui": "resume_scorecard",
    },
    "job_description": {
        "id": "job_description",
        "label": "分析岗位描述",
        "icon": "🎯",
        "hint": "本次请求来自岗位匹配场景，请结合岗位要求分析用户与岗位的匹配点与差距。",
        "genui": "job_match",
    },
    "knowledge_search": {
        "id": "knowledge_search",
        "label": "检索知识库",
        "icon": "📚",
        "hint": "本次请求来自知识库场景，请优先引用下方检索到的知识章节内容，并给出补课建议。",
        "genui": "knowledge_card",
    },
    "star_stories": {
        "id": "star_stories",
        "label": "整理 STAR 案例",
        "icon": "⭐",
        "hint": "本次请求来自 STAR 素材整理场景，请帮用户把经历组织成情境→任务→行动→结果四段式。",
        "genui": "star_builder",
    },
}

# ---------------- Skill 注册表（运行时动态加载） ----------------

SKILLS: dict[str, dict] = {}


def _extract_py_skill(path: Path) -> dict | None:
    """从 .py skill 文件读取 SKILL 字典（约定：模块级变量 SKILL）。"""
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location(f"_skill_{path.stem}", path)
        if not spec or not spec.loader:
            return None
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        skill = getattr(mod, "SKILL", None)
        return skill if isinstance(skill, dict) else None
    except Exception as exc:  # noqa: BLE001
        logger.warning("skill 加载失败 %s: %s", path.name, exc)
        return None


def _extract_yaml_skill(path: Path) -> dict | None:
    """从 .yaml skill 文件读取（纯声明式，无需 Python 代码）。"""
    try:
        import yaml
        with open(path, "r", encoding="utf-8") as f:
            skill = yaml.safe_load(f)
        return skill if isinstance(skill, dict) else None
    except Exception as exc:  # noqa: BLE001
        logger.warning("skill yaml 加载失败 %s: %s", path.name, exc)
        return None


def load_skills(skills_dir: str | Path | None = None) -> dict[str, dict]:
    """扫描 skills 目录，加载全部 skill 到 SKILLS（幂等，可多次调用热加载）。"""
    base = Path(skills_dir) if skills_dir else (Path(__file__).resolve().parent.parent / "skills")
    if not base.exists():
        logger.info("skills 目录不存在: %s", base)
        return SKILLS
    loaded: dict[str, dict] = {}
    for path in sorted(base.glob("*.yaml")) + sorted(base.glob("*.yml")) + sorted(base.glob("*.py")):
        if path.name.startswith("_"):
            continue
        skill = _extract_yaml_skill(path) if path.suffix.lower() in (".yaml", ".yml") else _extract_py_skill(path)
        if not skill or not skill.get("id"):
            continue
        skill.setdefault("name", skill["id"])
        skill.setdefault("description", "")
        skill.setdefault("keywords", [])
        skill.setdefault("modes", [])
        skill.setdefault("tools", [])
        skill.setdefault("system_prompt", "")
        loaded[skill["id"]] = skill
    SKILLS.clear()
    SKILLS.update(loaded)
    logger.info("skills 加载完成: %d 个", len(SKILLS))
    return SKILLS


def get_skill(skill_id: str) -> dict | None:
    return SKILLS.get(skill_id)


def list_skills() -> list[dict]:
    return [{"id": s["id"], "name": s["name"], "description": s["description"]}
            for s in SKILLS.values()]


def _skill_matches(skill: dict, mode: str, tool: str | None, text: str) -> bool:
    """skill 激活条件：mode / tool / 关键词 任一命中即激活。"""
    if skill.get("modes") and mode in skill["modes"]:
        return True
    if skill.get("tools") and tool in skill["tools"]:
        return True
    kw = skill.get("keywords") or []
    if kw and any(k and k in text for k in kw):
        return True
    return False


def active_skills(mode: str, tool: str | None, text: str) -> list[dict]:
    """根据当前对话场景选出激活的 skills（用于注入 system prompt）。"""
    return [s for s in SKILLS.values() if _skill_matches(s, mode, tool, text)]


def skill_system_blocks(activated: list[dict]) -> str:
    """把激活的 skills 转成 system prompt 片段。"""
    blocks = []
    for s in activated:
        name = s.get("name") or s.get("id")
        prompt = (s.get("system_prompt") or "").strip()
        if prompt:
            blocks.append(f"[Skill·{name}] {prompt}")
        else:
            blocks.append(f"[Skill·{name}] 已激活：{s.get('description') or ''}".strip())
    return "\n".join(blocks)


# ---------------- 对外查询 ----------------

def get_tool(tool_id: str | None) -> dict | None:
    if not tool_id:
        return None
    return TOOLS.get(tool_id)


def list_tools() -> list[dict]:
    """前端工具菜单数据：内置工具 + 关联 skills（可扩展点）。"""
    out = []
    for t in TOOLS.values():
        related = [s["id"] for s in SKILLS.values()
                   if t["id"] in (s.get("tools") or [])]
        out.append({"id": t["id"], "label": t["label"], "icon": t["icon"],
                    "genui": t["genui"], "skills": related})
    return out


# 启动时自动加载一次（幂等）
load_skills()