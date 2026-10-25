# 小民求职智能体 · 后端（Python / FastAPI）

mino-agent 前端配套的 Python 后端：FastAPI + SQLAlchemy + SQLite，双 API 架构。

## 快速启动

```bash
cd backend
pip install -r requirements.txt        # 首次
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

数据文件 `app/xiaomin.db` 首次启动自动建表，并写入种子数据（测试账号 / 知识库 / 求职指南 / 题库 / 审核草稿）。前端 dev server 运行在 `http://localhost:5173`，通过 `VITE_API_BASE_URL`（默认 `http://127.0.0.1:8000`）对接本后端。

## 测试账号

| 账号 | 密码 | 角色 |
| --- | --- | --- |
| `demo@xiaomin.ai` | `demo123456` | 求职者 |
| `admin@xiaomin.ai` | `admin123456` | 管理员（可审核内容） |

## 双 API 架构

- `/v1/*`（legacy）：严格按《API 接口设计方案》，统一 `{code,data,message}` 包装、配额扣减、WS 会话、验证码注册等。
- `/api/*`（前端适配层，`app/routers_fe/`）：直接返回前端期望的 JSON（camelCase），错误统一 `{error:{code,message,details},requestId}`，SSE 流式 `activity|delta|done|error`，上传返回 `{files:[{id,name,mimeType,size,status:'ready'}]}`。

前端 `mino-agent/src/api.js` 只调用 `/api/*`，两条链路并存互不干扰。

## 接入真实大模型（GLM / DeepSeek 等）

代码已内置 LLM 抽象层（`app/services/ai_service.py`），配置即切换，无需改代码：

```bash
# backend/.env
LLM_API_KEY=你的密钥
LLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
LLM_MODEL=glm-4-flash

# 可选：配额（access token 有效期 / 每日额度）
ACCESS_TOKEN_MINUTES=15
QUOTA_LLM_TOKENS=200000
```

未配置 `LLM_API_KEY` 或 `LLM_BASE_URL` 时自动回退本地 Mock（离线可跑，用于开发/演示）。STT / TTS 同样支持 `STT_PROVIDER` / `TTS_PROVIDER` 切换（默认 mock）。

## 核心能力

- **账号**：JWT 登录 / refresh 轮换 / 登出、用户画像、今日 AI 额度、注销清除数据
- **知识库**：20 个学院 → 专业 → 教材目录树
- **求职指南**：章节 + 随堂测验；管理员审核通过即发布
- **AI 面试**：面试会话（开始 / 逐题提交 / 结束复盘）、按岗位难度出题、结构化反馈
- **职业辅导**：简历分析、岗位匹配、STAR 话术整理（支持 Markdown 导出）
- **对话助手**：SSE 流式对话、会话管理（列表/重命名/删除/分支）、附件上传、消息反馈
- **学习状态**：阅读进度 / 收藏 / 笔记 / 测验结果，登录后自动保存与合并

## 目录

```
backend/
  app/
    core/         配置、安全(JWT)、统一响应
    db/           会话与种子数据（seed.py）
    models/       用户/章节/学习/文档 ORM
    services/     AI 抽象(LLM/STT/TTS)、用户、学习路径等
    routers/      legacy /v1
    routers_fe/   前端适配 /api
```