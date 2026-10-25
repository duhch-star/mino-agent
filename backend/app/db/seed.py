"""开发环境种子数据：样例用户、示例知识章节（MD 知识网络）、测验题"""
import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.chapter import Chapter, Quiz
from app.models.user import User
from app.services import user_service

SAMPLE_CHAPTERS = [
    {
        "id": "ch_resume", "slug": "resume-writing", "title": "简历撰写：让 HR 在 10 秒内记住你",
        "tags": ["简历", "写作", "入门"], "difficulty": "入门", "read_time_min": 10,
        "prereq": ["ch_intro"], "related": ["ch_star", "ch_interview"],
        "source": "课程《求职基础》第 1 章",
        "summary": "简历是求职的第一张名片：结构、关键词、量化结果是三大要素。",
        "body_md": """# 简历撰写：让 HR 在 10 秒内记住你

## 摘要
一份合格的简历要做到：结构清晰、关键词匹配、结果量化。

## 一、简历结构
| 板块 | 要点 |
|---|---|
| 基本信息 | 姓名、电话、邮箱，确保准确 |
| 教育背景 | 学校、专业、时间，按倒序 |
| 实习/项目经历 | 用 STAR 描述，突出行动与结果 |
| 技能证书 | 与岗位相关，避免堆砌 |

## 二、常见失分点
1. 只写职责不写成果——HR 无法判断你的能力。
2. 套用模板关键词——没有针对性。
3. 出现错别字或排版混乱——第一印象扣分。

## 三、实操建议
- 每个项目用一句话说清楚：**做了什么、怎么做、结果如何（量化）**。
- 对照目标岗位 JD 提取关键词，融入技能与经历描述。
- 简历控制在 1–2 页，重点前置。

## 四、练习与自测
- 练习 1：把一段职责式描述改写为量化成果式描述。
- 参考答案：原句「负责用户增长」→ 改「通过 A/B 测试优化落地页，转化率提升 12%」。

## 相关章节
- [[行为面试 STAR]]
- [[面试官如何评价 STAR 回答]]
""",
    },
    {
        "id": "ch_star", "slug": "star-method", "title": "行为面试 STAR：把经历讲成故事",
        "tags": ["面试", "STAR", "表达"], "difficulty": "入门", "read_time_min": 8,
        "prereq": ["ch_intro"], "related": ["ch_resume", "ch_interview", "ch_salary"],
        "source": "课程《面试实战》第 3 章",
        "summary": "STAR = 情境-任务-行动-结果，是行为面试回答的标准结构。",
        "body_md": """# 行为面试 STAR：把经历讲成故事

## 摘要
面试官问「讲一段经历」时，期待你用 STAR 结构组织回答：情境、任务、行动、结果。

## 一、STAR 四要素
| 要素 | 含义 | 面试官关注 |
|---|---|---|
| S 情境 | 事情发生的背景 | 复杂度、规模 |
| T 任务 | 你承担的角色与目标 | 职责边界 |
| A 行动 | 你具体做了什么 | 方法与主动性 |
| R 结果 | 带来什么成果 | 量化、影响 |

## 二、常见失分点
1. 只有背景没有行动——听起来像旁观者。
2. 行动不具体——无法判断你的真实能力。
3. 结果不量化——缺乏说服力。

## 三、练习与参考答案
- 练习：把最近一个项目经历写成 STAR 四段式。
- 参考答案：
  - S：负责上线新用户引导流程，用户基数 50 万
  - T：在 2 周内完成方案并推动开发
  - A：设计 3 版埋点方案并 A/B 测试
  - R：引导完成率提升 15%

## 相关章节
- [[简历撰写]]
- [[谈薪话术]]
""",
    },
    {
        "id": "ch_interview", "slug": "interview-basics", "title": "面试全流程：从自我介绍到反问",
        "tags": ["面试", "流程", "入门"], "difficulty": "入门", "read_time_min": 12,
        "prereq": ["ch_intro"], "related": ["ch_star", "ch_salary"],
        "source": "课程《面试实战》第 1 章",
        "summary": "自我介绍、常见问题、反问环节，一次讲清面试全流程。",
        "body_md": """# 面试全流程：从自我介绍到反问

## 摘要
一次面试通常包含自我介绍、经历深挖、专业考察、反问四个环节。

## 一、自我介绍（60–90 秒）
- 一句话定位：我是谁 + 什么方向 + 什么亮点
- 一段经历：与岗位最相关的一段经历
- 一个期待：表达对岗位的兴趣

## 二、高频问题清单
| 问题 | 考察点 |
|---|---|
| 请做自我介绍 | 沟通与提炼能力 |
| 你的优缺点 | 自我认知 |
| 为什么选择我们 | 动机与匹配度 |
| 期望薪资 | 自我定位 |

## 三、反问环节
- 问业务：这个岗位最核心的挑战是什么？
- 问团队：团队当前的架构与目标？
- 避免：一上来就问加班、假期。

## 相关章节
- [[行为面试 STAR]]
""",
    },
    {
        "id": "ch_salary", "slug": "salary-negotiation", "title": "谈薪话术：如何优雅地争取合理薪资",
        "tags": ["谈薪", "话术", "进阶"], "difficulty": "进阶", "read_time_min": 8,
        "prereq": ["ch_interview"], "related": ["ch_star"],
        "source": "课程《职场沟通》第 5 章",
        "summary": "谈薪三原则：调研、锚定、留有余地。",
        "body_md": """# 谈薪话术：如何优雅地争取合理薪资

## 摘要
薪资谈判不是博弈，而是基于市场价值的信息交换；提前调研是最大筹码。

## 一、调研定价
- 看同类岗位的薪资带（招聘平台 + 行业报告）
- 结合自身年限与成果确定「目标值 / 底线值」

## 二、回答「期望薪资」的话术
- 先反问：「想先了解一下贵司该岗位的薪资带？」
- 给区间并锚定上限：期望在 X–Y，结合我的经历更靠近 Y
- 不强硬：强调更看重成长与匹配度

## 三、常见误区
1. 报得太低——被压价。
2. 报得太高——失去机会。
3. 只谈现金——忽略期权、福利、培训等综合回报。

## 相关章节
- [[面试全流程]]
""",
    },
    {
        "id": "ch_group", "slug": "group-interview", "title": "群面技巧：在讨论中展现不可替代性",
        "tags": ["群面", "无领导小组", "进阶"], "difficulty": "进阶", "read_time_min": 10,
        "prereq": ["ch_intro"], "related": ["ch_interview"],
        "source": "课程《面试实战》第 6 章",
        "summary": "群面考的是协作与逻辑：定位角色、有效发言、推动进程。",
        "body_md": """# 群面技巧：在讨论中展现不可替代性

## 摘要
群面不是比谁说话多，而是看你在团队中的"可替代性"：能否推进讨论、凝聚共识。

## 一、常见角色定位
| 角色 | 特征 | 适合人群 |
|---|---|---|
| 领导者 | 控流程、做决策 | 有全局观 |
| 计时者 | 管理时间 | 细致 |
| 记录者 | 归纳总结 | 逻辑强 |
| 贡献者 | 输出观点 | 点子多 |

## 二、发言原则
- 前 3 分钟：提出讨论框架（问题 → 标准 → 方案）
- 讨论中：先认同再补充（「我同意，另外可以…」）
- 结束前：主动做总结

## 三、常见误区
1. 打断别人、抢话。
2. 一味附和没有观点。
3. 偏离题目自说自话。

## 相关章节
- [[面试全流程]]
""",
    },
    {
        "id": "ch_intro", "slug": "job-search-intro", "title": "求职入门：渠道、节奏与心态",
        "tags": ["求职", "入门", "渠道"], "difficulty": "入门", "read_time_min": 6,
        "prereq": [], "related": ["ch_resume"],
        "source": "课程《求职基础》第 0 章",
        "summary": "抓住校招/社招节奏，匹配渠道，管理求职心态。",
        "body_md": """# 求职入门：渠道、节奏与心态

## 摘要
求职是一场项目制任务：明确目标岗位 → 准备材料 → 多渠道投递 → 复盘迭代。

## 一、渠道盘点
| 渠道 | 特点 |
|---|---|
| 校招官网/宣讲会 | 节奏固定、名额多 |
| 招聘平台 | 覆盖面广、需筛选 |
| 内推 | 简历直达、反馈快 |
| 社群/牛客 | 信息与面经 |

## 二、求职节奏
- 提前 3 个月：确认方向、打磨简历
- 提前 1 个月：投递 + 笔试面试题
- 面试后：24 小时内复盘

## 三、心态管理
- 被拒是常态，复盘比情绪重要
- 面试是双向选择，保持自信与真实

## 相关章节
- [[简历撰写]]
""",
    },
]

SAMPLE_QUIZZES = [
    ("ch_resume", "简历中的项目经历应优先采用哪种结构描述？",
     ["职责式罗列", "STAR 结构", "流水账", "只写结果"],
     "STAR 结构", "STAR 结构最能体现行动与结果。"),
    ("ch_resume", "简历控制在几页以内最合适？", ["3 页以上", "1–2 页", "越多越好", "无所谓"],
     "1–2 页", "重点前置，HR 平均停留仅 10 秒左右。"),
    ("ch_star", "STAR 中的 A 代表什么？",
     ["行动 Action", "态度 Attitude", "评估 Assessment", "安排 Arrange"],
     "行动 Action", "A = Action 行动。"),
    ("ch_salary", "回答期望薪资时，以下哪种策略更专业？",
     ["直接报一个固定高价", "先了解岗位薪资带再给区间", "说无所谓", "报低于市场价"],
     "先了解岗位薪资带再给区间", "先调研再锚定，是成熟的做法。"),
]


def seed(db: Session) -> None:
    # 管理员与演示用户
    if not user_service.get_by_account(db, "admin@xiaomin.ai"):
        admin = user_service.create_user(db, "admin@xiaomin.ai", "admin123456",
                                         "小民管理员")
        admin.role = "admin"
    if not user_service.get_by_account(db, "demo@xiaomin.ai"):
        user_service.create_user(db, "demo@xiaomin.ai", "demo123456", "求职小明")

    # 章节
    for c in SAMPLE_CHAPTERS:
        if not db.get(Chapter, c["id"]):
            db.add(Chapter(
                id=c["id"], slug=c["slug"], title=c["title"],
                tags=json.dumps(c["tags"], ensure_ascii=False),
                prereq=json.dumps(c["prereq"], ensure_ascii=False),
                related=json.dumps(c["related"], ensure_ascii=False),
                difficulty=c["difficulty"], read_time_min=c["read_time_min"],
                source=c["source"], summary=c["summary"], body_md=c["body_md"],
                status="published", version=1,
            ))

    # AI 章节生成流水线的草稿队列（人工审核环节演示数据）
    DRAFT_CHAPTERS = [
        {
            "id": "draft_group", "slug": "draft-group-interview",
            "title": "群面技巧", "tags": ["面试", "群面"],
            "prereq": [], "related": ["ch_interview"],
            "difficulty": "进阶", "read_time_min": 15,
            "source": "AI 章节流水线（草稿）",
            "summary": "无领导小组面试的定位选择、发言节奏与加分动作（AI 生成，待审核）。",
            "body_md": "# 群面技巧（草稿）\n\n## 无领导小组的角色与定位\n...",
        },
        {
            "id": "draft_onboard", "slug": "draft-intern-onboard",
            "title": "实习转正指南", "tags": ["求职", "实习"],
            "prereq": [], "related": ["ch_resume"],
            "difficulty": "入门", "read_time_min": 10,
            "source": "AI 章节流水线（草稿）",
            "summary": "实习期如何建立存在感、争取转正名额（AI 生成，待审核）。",
            "body_md": "# 实习转正指南（草稿）\n\n## 转正考察什么\n...",
        },
    ]
    draft_status = {"draft_group": "review", "draft_onboard": "draft"}
    for c in DRAFT_CHAPTERS:
        if not db.get(Chapter, c["id"]):
            db.add(Chapter(
                id=c["id"], slug=c["slug"], title=c["title"],
                tags=json.dumps(c["tags"], ensure_ascii=False),
                prereq=json.dumps(c["prereq"], ensure_ascii=False),
                related=json.dumps(c["related"], ensure_ascii=False),
                difficulty=c["difficulty"], read_time_min=c["read_time_min"],
                source=c["source"], summary=c["summary"], body_md=c["body_md"],
                status=draft_status[c["id"]], version=1,
            ))

    # 测验：仅当章节还没有测验时补入（按章节去重，避免重复启动冗余）
    chapter_counts: dict[str, int] = {}
    for chapter_id, stem, options, answer, explain in SAMPLE_QUIZZES:
        if chapter_id not in chapter_counts:
            existing = db.query(Quiz).filter(Quiz.chapter_id == chapter_id).count()
            # -1 表示该章节已有测验，整章跳过；0 表示从 1 开始编号
            chapter_counts[chapter_id] = -1 if existing else 0
        if chapter_counts[chapter_id] == -1:
            continue  # 该章节已有测验，跳过本章全部题目
        chapter_counts[chapter_id] += 1
        idx = chapter_counts[chapter_id]
        db.add(Quiz(
            id=f"qz_{chapter_id}_{idx}",
            chapter_id=chapter_id, type="single", stem=stem,
            options=json.dumps(options, ensure_ascii=False),
            answer=answer, answer_explain=explain,
        ))
    db.commit()