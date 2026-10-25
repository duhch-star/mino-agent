"""Skill 示例（Python 扩展式）：薪资谈判

与 YAML skill 的区别：可在 system_prompt 之外附带自定义逻辑（如
_extract 解析薪资区间），注册表只读取 SKILL 字典并注入 prompt。

约定：模块级变量 SKILL = {...}
"""
import re

SKILL = {
    "id": "salary_negotiation",
    "name": "薪资谈判技巧",
    "description": "市场薪资带调研、期望报价策略、总包拆解与开场话术",
    "modes": [],
    "tools": [],
    "keywords": ["薪资", "谈薪", "薪酬", "工资", "报价", "期望薪资"],
    "system_prompt": (
        "你熟悉薪资谈判方法论：先锚定市场价而非底线价；涨幅诉求锚定到量化成果；"
        "报价取区间中上位留让步空间；总包要看五险一金基数、绩效占比、年终结构。"
        "用户问薪资时，先给出市场区间（结合岗位与年限），再给 2-3 条谈判要点和一句开场话术。"
    ),
}


def extract_salary_band(text: str) -> dict:
    """（可选扩展逻辑）从文本中提取薪资数字区间。"""
    nums = [int(v) for v in re.findall(r"(\d{2})", text or "") if 8 <= int(v) <= 60]
    if not nums:
        return {"low": 12, "high": 25}
    return {"low": min(nums) - 2, "high": max(nums) + 3}