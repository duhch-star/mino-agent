# MINOS · MINO AGENT

基于 **Pi Web + Pi Agent SDK** 的本地求职智能体。将智能对话、LaTeX 简历、知识库、模拟面试与学习复盘放入统一的 Pi 风格工作区，保留真实工具调用、会话流式输出和业务数据。

> 当前面向可信用户的 Windows 本机部署。Pi 可运行命令、访问文件、使用终端和插件，**不是操作系统沙箱**；请勿直接暴露到公网或作为不可信多租户服务。

## 功能

| 模块 | 已实现能力 |
| --- | --- |
| 智能对话 | 真正的 Pi SDK 会话、SSE、历史会话、工具与文件预览、模型/技能设置；首页直接进入对话 |
| LaTeX 简历 | `resume_read` / `resume_update` / `resume_set_template` / `resume_compile`；修订校验、历史与撤销、原版单栏/双栏模板、PDF 编译和预览 |
| 聊天工具栏 | 简历优化、岗位匹配、STAR 整理、面试练习，以及读取简历、修改简历、选择模板、生成 PDF；点击填入草稿，确认发送后执行 |
| 生成式 UI | 岗位匹配矩阵、简历前后对照、面试反馈、行动清单、投递进展看板；严格数据协议，不执行模型提供的 HTML/脚本 |
| 知识库 | 求职指南、学院/专业/课程、章节阅读与测验；Pi 风格列表、分类、搜索和真实 API 数据 |
| AI 面试 | 岗位/难度/时长配置、会话题目、答案持久化、真实 LLM 逐题反馈、结束与重试；可选浏览器语音识别、摄像头及第三方语音播报 |
| 本地业务后端 | FastAPI、SQLAlchemy、SQLite、账号鉴权、上传文档解析；旧聊天/简历界面保留兼容入口 |

### 功能边界

- 普通 Pi 会话注册简历扩展；`Chat only` 等不启用工具的模式不会执行简历工具。
- 行动清单勾选为页面本地状态，投递进展来自用户陈述；不会自动投递，也不与招聘网站同步。显示分数必须有范围和依据，不代表录用概率。
- 逐题面试反馈由真实模型生成；结束报告仍使用现有后端规则汇总，不能等同于完整 LLM 测评。
- 语音识别依赖浏览器支持，播报依赖第三方服务配置；失败可改用文字。视频仅为本地摄像头预览，不是视觉面试评分。
- 聊天文本不设置应用层单条长度上限，但仍受模型上下文、服务请求体和供应商限制；面试回答等结构化业务字段有独立校验。

## 架构与目录

```text
mino-agent/        React 18 + Vite 7：登录、路由、知识库和面试等业务页
pi-web/            Next.js + React 19：Pi 原生 UI、API、SDK、MINOS 桥接与简历扩展
backend/           FastAPI + SQLite：账号、业务数据、简历文档、面试和 Pi 进程管理
scripts/           Windows 本机启动/停止脚本
docs/              产品与技术文档
assets/            品牌与吉祥物资源
```

入口 `127.0.0.1:5173`，业务 API `127.0.0.1:8000`。后端按账号启动独立的 Next **生产进程**（回环动态端口 `30141–30240`），隔离应用会话目录和工作区，通过一次性票据与 HttpOnly cookie 连接。业务页复用现有 React 组件，在 Pi 布局内承载，不是所有页面均重写为 Next.js。

**账号数据目录分离不等于 OS 安全隔离。** 任意命令仍使用当前 Windows 用户权限。首次进入需要明确确认本地智能体权限；后端重启后请从主入口重新连接。

## 快速开始（Windows / PowerShell）

### 1. 环境

- Python 3.12（建议），Node.js **22.19+**（本机验证使用 24.x）、npm、Git。
- PDF 编译需 Tectonic 或包含中文字体/`xeCJK` 的 XeLaTeX；第一次编译可能需要网络下载 TeX 资源。
- Pi 的原生命令/终端依赖需能在本机正常安装；不要提交本机依赖目录。

```powershell
git clone https://github.com/Akun-python/minos.git
Set-Location minos
git switch feature/pi-web-agent-integration
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements-local.txt
Copy-Item backend\.env.example backend\.env
```

编辑私有配置 `backend/.env`，设置随机 JWT 密钥及 OpenAI 兼容模型服务（配置项名称以示例与后端配置为准）：

```dotenv
LLM_API_KEY=replace-with-your-provider-key
LLM_BASE_URL=https://your-provider.example/v1
LLM_MODEL=your-model-id
```

不要将真实密钥写进前端、README 或 Git。没有真实模型配置时，Pi/面试 AI 能力不可用，不应把旧演示回复视为真实推理。

### 2. 安装并构建

```powershell
Set-Location pi-web
npm.cmd ci
npm.cmd run build
Set-Location ..\mino-agent
npm.cmd ci
npm.cmd run build
Set-Location ..
```

Pi 后端启动要求已存在生产构建。**不要在 `next dev` 运行时执行 `next build`**，也不要启动多个共享同一构建目录的开发服务器。原版 Noto Sans Mono 字体已随源码附带 OFL 许可，构建不必访问 Google Fonts。

### 3. 启动 / 停止

双击根目录 `start-minos.cmd`，或运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\local-deploy.ps1 -Action Start -NoBrowser
```

- 工作区：<http://127.0.0.1:5173/#/chat>
- 知识库：<http://127.0.0.1:5173/#/knowledge>
- AI 面试：<http://127.0.0.1:5173/#/interview>
- API 文档：<http://127.0.0.1:8000/docs>

停止：双击 `stop-minos.cmd`。脚本只停止它记录且校验过的服务进程，不按端口盲杀其他程序。服务未设置开机自启。

演示账号：`demo@xiaomin.ai / demo123456`；管理员演示账号：`admin@xiaomin.ai / admin123456`。**均为公开演示凭据，不可作为公网部署凭据。**

### 4. PDF 与语音（可选）

- 将 `tectonic` / `xelatex` 加入 PATH，或通过 `RESUME_XELATEX` 指定编译器可执行文件。便携工具和下载缓存不随 Git 分发；具体支持项见后端简历文档。
- 第三方曼波语音使用后端环境变量 `MAMBO_TTS_KEY`；缺失时文字面试仍可使用。
- 摄像头/麦克风仅在明确授权后启用。请注意语音识别、播报和模型服务各自的数据传输边界。

## 数据与更新

SQLite、上传文件、账号工作区、Pi 凭据和运行日志均应留在本机，不加入版本控制。先停止服务再备份数据库；不要通过删除用户数据解决启动问题。前端使用生产静态资源，修改后需重新构建；修改 Pi 后需重新连接/重启对应生产进程。

旧兼容入口：`/#/chat-legacy`、`/#/resume-legacy`。`/#/home` 与已移除的职业辅导入口转到智能对话。

## 验证

```powershell
# 后端单元/集成测试（使用临时数据库，避免污染运行数据）
.\.venv\Scripts\python.exe -m unittest discover -s backend -p '*test*.py' -q

# Pi 求职 UI、路由桥接与聊天回归
Set-Location pi-web
node --test lib/career-ui.test.mjs lib/minos-business.test.mjs components/ChatInput.test.mjs components/ChatWindow.attach-files.test.mjs components/ChatWindow.lazy-load.test.mjs
```

本次集成已通过前后端生产构建、40 项后端测试及 66 项选定 Pi 回归测试；真实浏览器验证了知识库搜索/导航和文字面试“创建 → 保存作答 → 模型反馈 → 完成”。这些不是对全部上游功能、浏览器、供应商或语音硬件的全覆盖保证。

## 文档与上游致谢

- [Windows 部署](<DEPLOY-WINDOWS.md>)
- [Pi 集成架构、安全边界与生成式 UI 协议](<pi-web/MINOS-INTEGRATION.md>)
- [本地智能体 Harness](<backend/HARNESS.md>)
- [简历工作台](<backend/RESUME_WORKBENCH.md>)
- [原版简历模板与许可](<backend/app/resume_templates/README.md>)

Pi Web 来源：[agegr/pi-web](https://github.com/agegr/pi-web)，上游版本 `0.12.2`，基准提交 `e533d9b3975f8a74b378d5007c92fdf4d15d3fba`。本仓库直接保留上游 UI/API/SDK 实现并作 MINOS 集成，不是视觉仿制。分发时请保留 [Pi Web MIT 许可](<pi-web/LICENSE>)、字体 OFL 与各简历模板的原始许可。
