# MINO AGENT · 前端

基于 DeepSeek Harness 桌面端设计风格复刻，改造为**面向求职者的学习 / 模拟面试 / 职业辅导智能体**前端（React + Vite + JS，无后端链路）。

## 运行

```bash
npm install
npm run dev      # http://localhost:5173
```

要求 Node 20.19+（Vite 7）。

## 模块导航

| 路由 | 模块 | 说明 |
|---|---|---|
| `/` | 欢迎页 | 品牌 + 开始使用 |
| `/home` | 首页 | 快捷入口 + 为你推荐章节 |
| `/knowledge` | 知识库 | 章节列表 + 搜索 |
| `/knowledge/:id` | 章节阅读 | MD 渲染 + 目录 TOC + `[[内链]]` 跳转 + 收藏 |
| `/interview` | AI 面试 | 配置岗位/难度/时长/作答方式 |
| `/interview/room` | 面试房间 | 3D 角色 + 逐题问答 + 复盘报告（全屏） |
| `/career` | 职业辅导 | 简历优化 / 岗位匹配 / STAR |
| `/chat` | 对话助手 | 通用 AI 问答 |

## 面对面 AI 面试（核心）

- **3D 角色**：`src/components/CharacterView.jsx` 优先加载 `/models/xiaomin.glb`，动画状态机（待机/讲解/倾听/思考/鼓励）+ 口型随语音；**无模型时降级为 2D 立绘占位**。
- **流程状态机**：`配置 → 麦克风授权 → 逐题 → 复盘报告`，见 `src/store.js` 的 `useInterviewStore`。
- **作答双通道**：语音（按住说话/波形，识别接入中）+ 文字兜底。

## 放模型（稍后提供 GLB 时）

把处理好的模型丢到 `public/models/xiaomin.glb` 即自动生效，无需改代码。口型联动依赖模型里有 `mouthOpen` 或 viseme 变形目标（如 `AA/EE/IH/OH/UH`），没有则自动退化为整体浮动。

## 目录结构

```
src/
├─ main.jsx                # 入口：加载设计令牌 CSS
├─ App.jsx                 # HashRouter 路由 + 主题/字号副作用
├─ store.js                # zustand：ui / chat / interview / learning
├─ data/
│  ├─ chapters.js          # 知识库章节（含 [[内链]] 元数据）
│  └─ interview.js         # 岗位题库 + 反馈生成
├─ styles/
│  ├─ theme/               # ★ 原样拷贝自 deepseek-harness ui-theme（--dsw-*）
│  ├─ global.css           # 重置 + 聊天几何变量
│  ├─ app.css              # 外壳/侧边栏/聊天/设置
│  └─ pages.css            # 各业务模块 + 面试房间 + 3D
├─ components/             # XiaominMark / Icons / Markdown / Sidebar / Composer / CharacterView / Shell
└─ pages/                  # Welcome / Home / Knowledge / ChapterReader / Interview / InterviewRoom / Career / ChatApp / Settings
```

## 接入真实后端

- 对话：`src/store.js` 的 `useChatStore.sendMessage`（替换 `cannedReply`）。
- 面试：`useInterviewStore.submitAnswer`（替换 `makeFeedback`）+ 题库从后端拉取。
- 语音：`CharacterView` 的 `speaking` 与 `InterviewRoom` 的 `micBtn` 处接入 STT/TTS。

## 说明

设计令牌（`src/styles/theme/`）拷贝自 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 的 `packages/client/ui-theme`，遵循其 MIT 许可与品牌使用规范（见 `../ds_src/BRAND_GUIDELINES.md`）。MINO AGENT 品牌标记为占位，正式替换为 MINO AGENT GLB 剪影/头像。
