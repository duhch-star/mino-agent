# MINOS — 小民（MINO AGENT）求职智能体

AI 求职辅导智能体：基于 AG-UI 声明式生成式 UI，本地多格式文档解析（PDF / Word / Excel / PPT / RTF 等），真流式 SSE 回答，工具 + Skill 可扩展架构，3D 吉祥物 IP 设计。

## 目录结构

```
├── mino-agent/            # 前端（React 18 + Vite 7 + Zustand）
│   └── src/
│       ├── components/    # GenUI 生成式 UI、ThinkingIndicator 蛇形动画等
│       ├── pages/         # 对话助手 / 面试 / 知识库 / 简历工坊等
│       └── styles/        # 主题与组件样式
├── backend/               # 后端（FastAPI + SQLAlchemy + SQLite）
│   └── app/
│       ├── services/      # chat / document(多格式解析) / tool_registry / skills
│       ├── routers_fe/    # 前端适配 API（/api，camelCase + SSE）
│       └── skills/        # Skill 热插拔（YAML/Python 声明式）
├── docs/                  # 产品与技术方案、API 接口设计（md + docx）
└── assets/                # IP 设计参考（吉祥物概念图、3D GLB 成品）
```

## 快速开始

### 后端（Python 3.12）

```bash
cd backend
pip install -r requirements.txt   # 或 pip install fastapi uvicorn sqlalchemy pydantic pydantic-settings python-jose passlib bcrypt httpx pdfplumber python-docx openpyxl xlrd python-pptx striprtf lxml
cp .env.example .env              # 配置 LLM API Key 等
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 前端

```bash
cd mino-agent
npm install
npm run dev        # http://localhost:5173
```

## 核心特性

- **真流式回答**：SSE `activity|delta|ui|done`，逐 token 输出，首 token 延迟低
- **生成式 UI（GenUI v2）**：8 种结构化卡片（简历评分卡 / 岗位匹配 / 知识卡片 / STAR 整理 / 行动计划 / 面试点评 / 谈薪建议 / 高频面试题），SVG 环形图与雷达图可视化
- **多格式本地解析**：PDF、DOCX、XLSX、XLS、PPTX、RTF、CSV、JSON、HTML、TXT/MD，服务端本地纯 Python 解析，附件内容注入问答
- **工具注册表 + Skill**：`app/services/tool_registry.py` + `app/skills/*` 热插拔，按模式 / 工具 / 关键词自动激活并注入上下文
- **蛇形思考动画**：SVG ∞ 字轨道 + 光点循环（ThinkingIndicator）
- **3D 吉祥物 IP**：火箭吉祥物 GLB 成品与概念设计图

## API 契约

详见 `docs/小民求职智能体_API接口设计方案.md`（`/api` 前端适配层 camelCase + 传统 `/v1` 兼容层）。
