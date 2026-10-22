# MINO AGENT · 求职智能体前端

> 面向求职者的 **学习 / 模拟面试 / 职业辅导** 智能体前端。基于 DeepSeek Harness 桌面端设计风格复刻，`React + Vite + JavaScript` 实现，**纯前端、无后端依赖**。

[![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white)](https://vite.dev/)
[![Zustand](https://img.shields.io/badge/State-Zustand-4b5563)](https://zustand-demo.pmnd.rs/)
[![Three.js](https://img.shields.io/badge/3D-Three.js-000?logo=three.js&logoColor=white)](https://threejs.org/)

---

## 简介

MINO AGENT 是一个「求职教练 / 面试官」角色，陪你完成求职全流程：系统学习求职知识、进行**面对面 AI 面试**（语音 / 视频 / 文字）、优化简历与岗位匹配。前端完整实现了产品壳与交互，数据与智能能力目前为**演示逻辑**，后端接入点已预留（见文末）。

## 功能特性

| 模块 | 能力 |
|---|---|
| 🏠 首页 | 个性化问候、快捷入口、**学习路径**（按前置知识拓扑排序）、继续学习、小民陪伴卡 |
| 📚 知识库 | 章节列表 + 全文检索；章节阅读页含**目录 TOC、阅读进度、随文笔记、章节测验、`[[内链]]` 跳转、相关章节、下一篇衔接**；选中段落可「问 MINO AGENT」就地追问 |
| 🎤 AI 面试 | **语音 / 视频 / 文字**三种作答方式；3D 角色面试官 + 逐题提问/追问/暂停；**维度化复盘**（结构完整度/岗位相关性/表达清晰度 + STAR 改写示例 + 改进点跳章节补课） |
| 💼 职业辅导 | 简历上传（pdf/docx/md/txt）+ 结构化建议 + 导出 Markdown；岗位匹配；STAR 案例 |
| 💬 对话助手 | 通用 AI 问答，支持从章节带入上下文 |
| 👤 账号与角色 | 求职者 / 管理员两种角色；管理员有「内容审核」面板（章节草稿通过/驳回） |
| ⚙️ 设置 | 明暗主题、内容字号、账户管理、隐私与数据（麦克风/摄像头授权说明） |

## 技术栈

- **框架**：React 18 + Vite 7（要求 Node ≥ 20.19）
- **路由**：React Router 7（HashRouter，兼容后续 Electron 打包）
- **状态**：Zustand 5（`ui` / `chat` / `interview` / `learning` / `auth` 五个 store，`learning`/`auth`/`chat` 已持久化到 localStorage）
- **3D**：Three.js（`GLTFLoader + AnimationMixer`，**懒加载**，仅面试房间下载）
- **样式**：DeepSeek Harness `ui-theme` 设计令牌（`--dsw-*` 全套），无 CSS 框架

## 快速开始

```bash
npm install
npm run dev      # 默认 http://localhost:5173
npm run build    # 生产构建到 dist/
npm run preview  # 预览构建产物
```

## 路由导航

| 路由 | 页面 | 说明 |
|---|---|---|
| `/` | 欢迎页 | 品牌 + 能力卡片 + 开始使用/登录/设置 |
| `/onboarding` | 冷启动引导 | 选求职方向 + 经验（可跳过） |
| `/login` | 登录 | 求职者 / 管理员双入口 |
| `/home` | 首页 | 推荐 + 学习路径 |
| `/knowledge` | 知识库 | 章节列表 + 全文检索 |
| `/knowledge/:id` | 章节阅读 | MD + TOC + 闭环学习动作 |
| `/interview` | 面试配置 | 岗位/难度/时长/作答方式 |
| `/interview/room` | 面试房间 | 3D 角色 + 逐题 + 复盘（全屏） |
| `/career` | 职业辅导 | 简历优化/岗位匹配/STAR |
| `/chat` | 对话助手 | 通用问答 |
| `/review` | 内容审核 | 仅管理员可见 |

## 核心能力详解

### 面对面 AI 面试

- **三种作答方式**：语音（按住说话 + 波形）、视频（进入时提示开启摄像头 + 自拍 PiP 视图）、文字（兜底，可随时切换）。
- **3D 角色**：`CharacterView` 优先加载 `/models/xiaomin.glb`，动作状态机（待机/讲解/倾听/思考/鼓励）+ 口型随语音；无模型时降级为 2D 立绘占位。
- **流程状态机**：`配置 → 授权/测试麦克风 → 逐题（可追问/暂停/重试）→ 复盘报告`。
- **维度化复盘**：每题输出三个维度星级 + 改进建议 + STAR 改写示例，改进点一键跳转到对应知识章节。

### 知识库学习闭环

- 章节即页面，MD 渲染支持表格 / 引用 / 任务列表 / 代码块 / `[[内链]]`。
- 阅读进度条（写入 store，首页「继续学习」读取）、随文笔记、章节测验、读完自动衔接「下一篇」。
- **就地追问**：章节内选中任意文字 → 浮窗「问 MINO AGENT」→ 跳对话助手并携带章节上下文。

### 账号与角色

- 角色：`游客`（本地使用）/ `求职者`（全部能力）/ `管理员`（额外「内容审核」）。
- 登录为**前端 mock**（任意账号密码），鉴权逻辑在 `useAuthStore`，接后端时替换为 JWT。

## 目录结构

```
src/
├─ main.jsx                 # 入口：按序加载设计令牌 CSS
├─ App.jsx                  # HashRouter 路由 + 主题/字号副作用
├─ store.js                 # zustand 五类 store（ui/chat/interview/learning/auth）
├─ data/
│  ├─ chapters.js           # 知识库章节 + [[内链]] 索引 + 学习路径 + 测验题库
│  └─ interview.js          # 岗位题库 + 反馈生成（makeFeedback）
├─ styles/
│  ├─ theme/                # ★ 设计令牌（拷贝自 deepseek-harness ui-theme）
│  ├─ global.css            # 重置 + 聊天几何变量
│  ├─ app.css               # 外壳/侧边栏/聊天/设置
│  └─ pages.css             # 各业务模块 + 面试房间 + 3D + 登录/审核
├─ components/
│  ├─ Brand.jsx             # MINO AGENT 双色字标 + 副标题
│  ├─ XiaominMark.jsx       # 火箭吉祥物标记（占位）
│  ├─ CharacterView.jsx     # 3D 角色视口（懒加载 three.js）
│  ├─ Markdown.jsx          # 轻量 markdown 渲染（memo 记忆化）
│  ├─ Sidebar.jsx           # 多模块导航 + 账户区
│  ├─ Composer.jsx          # 输入框
│  ├─ Shell.jsx             # 侧边栏 + 内容区外壳
│  └─ Icons.jsx             # 内联图标
└─ pages/
   ├─ Welcome.jsx           # 欢迎页
   ├─ Onboarding.jsx        # 冷启动画像
   ├─ Login.jsx             # 登录（求职者/管理员）
   ├─ Home.jsx              # 首页
   ├─ Knowledge.jsx         # 知识库列表
   ├─ ChapterReader.jsx     # 章节阅读
   ├─ Interview.jsx         # 面试配置
   ├─ InterviewRoom.jsx     # 面试房间 + 复盘
   ├─ Career.jsx            # 职业辅导
   ├─ ChatApp.jsx           # 对话助手
   ├─ Review.jsx            # 管理员内容审核
   └─ Settings.jsx          # 设置（全局浮层）
```

## 3D 模型接入

把小民模型放到 `public/models/xiaomin.glb` 即自动生效，无需改代码：

- 推荐：GLB 2.0、体积 < 15 MiB、贴图 2048/4096、已减面。
- 口型联动依赖模型含 `mouthOpen` 或 viseme 变形目标（`AA/EE/IH/OH/UH` 等）；没有则自动退化为整体浮动。
- 详见 `public/models/README.txt`。

## 后端接口契约

接口清单、请求/响应 schema、鉴权、错误格式、SSE 事件、附件上传和页面接线情况统一维护在 [`BACKEND_API.md`](BACKEND_API.md)。`src/api.js` 目前提供 mock 函数，不会请求真实服务；已有函数签名不代表页面已经接入 API。

| 函数（接口） | 建议端点 | 说明 |
|---|---|---|
| `fetchColleges()` | `GET /api/knowledge/colleges` | 学院列表 |
| `fetchCollege(id)` | `GET /api/knowledge/colleges/:id` | 学院详情（专业列表） |
| `fetchMajor(id)` | `GET /api/knowledge/majors/:id` | 专业详情（核心课程 + 能力关键词 + 适配岗位） |
| `fetchTextbookGroups()` | `GET /api/knowledge/textbooks` | 教材章节目录 |
| `fetchGuides()` | `GET /api/guides` | 求职指南列表 |
| `fetchGuide(id)` | `GET /api/guides/:id` | 指南章节正文 |
| `fetchQuiz(id)` | `GET /api/guides/:id/quiz` | 章节测验 |
| `fetchQuestions(position, difficulty)` | `GET /api/interview/questions?position=&difficulty=` | 面试题库 |
| `fetchInterviewFeedback(position, question, answer)` | `POST /api/interview/feedback` | 维度化反馈 |
| `streamChatMessage(request, callbacks)` | `POST /api/chat`（SSE 流式） | 对话（文本、章节上下文、求职模式、工具、回答档位、附件元数据；通过回调接收内容与完成状态） |
| `apiLogin(name, password, role)` | `POST /api/auth/login` | 登录 mock（真实角色必须由服务端鉴权） |
| `analyzeResume({ text, attachmentIds })` | `POST /api/career/resume/analyze` | 简历分析 |
| `fetchReviewDrafts()` | `GET /api/review/drafts` | 待审核章节草稿 |
| `reviewDraft(id, action)` | `POST /api/review/drafts/:id` | 审核 mock；正式端点/schema见交接文档 |

> 语音/视频面试涉及 STT/TTS 与实时媒体传输，需由前后端另行确定 WebSocket 或 WebRTC 协议，当前仅使用浏览器本地权限与演示状态。

## 数据分层

```
页面/组件  →  store.js（状态）  →  api.js（接口，mock）  →  data/*.js（mock 数据）
                                         ↓ 接后端后
                                     fetch('/api/...')
```

- `src/data/` 是**纯 mock 数据**，仅用于前端设计演示，后端就绪后可删除。
- `src/api.js` 是预期接口层；当前仍有页面直接读写本地 mock，详细接线状态见 `BACKEND_API.md`。
- **已接线（async + 流式）**：对话 `useChatStore.sendMessage`、面试反馈 `useInterviewStore.submitAnswer`、登录 `useAuthStore.login`。
- **待接线（同步读 `src/data/`）**：知识库 / 指南 / 题库等只读数据，接后端时改为「进页面 → 调 `api.js` → loading → 渲染」。

## 设计系统与许可

- 设计令牌（`src/styles/theme/`）拷贝自 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 的 `packages/client/ui-theme`，遵循其 MIT 许可与品牌使用规范。
- `MINO AGENT` 品牌标记（火箭剪影）为占位，正式替换为小民 GLB 剪影/头像。

## Roadmap

- [x] 多模块导航 + 设计令牌复刻
- [x] 冷启动画像 / 学习闭环 / 就地追问
- [x] 面试（语音/视频/文字）+ 维度化复盘
- [x] 账号角色（求职者/管理员）+ 内容审核
- [x] 本地持久化 + three.js 懒加载
- [ ] 接入真实后端（LLM / STT / TTS / 鉴权）
- [ ] 替换 3D 模型与品牌最终标识
