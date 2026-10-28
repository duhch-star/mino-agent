# MINOS · 你的 AI 求职搭档

把智能对话、LaTeX 简历、知识库、模拟面试、学习复盘和求职画像，放进一个本地桌面工作区。

**MINOS 基于 Pi Web + Pi Agent SDK，使用 Electron 封装。** Windows 安装版内置前后端、Node 和 Python，无需用户另装这些运行环境；模型服务使用你自己的账号和密钥。

> **当前为预发布版，不是已全面验收的稳定版本。** 本地智能体可按当前 Windows 用户权限读写文件、执行命令；账号数据分目录不等于操作系统安全沙箱。仅在可信本机使用，不要直接暴露到公网。

![MINOS 智能对话首页](<docs/screenshots/05-chat.png>)

## 目录

- [下载安装](#下载安装)
- [第一次使用](#第一次使用)
- [各页面操作指南](#各页面操作指南)
- [模型与可选服务](#模型与可选服务)
- [数据备份与安全](#数据备份与安全)
- [常见问题](#常见问题)
- [开发与构建](#开发与构建)
- [验证范围与限制](#验证范围与限制)

## 下载安装

支持 **Windows 10/11 x64**。

- [Release 页面：v1.0.0-electron-preview.3](https://github.com/Akun-python/minos/releases/tag/v1.0.0-electron-preview.3)
- [Windows 安装包（约 301 MiB）](https://github.com/Akun-python/minos/releases/download/v1.0.0-electron-preview.3/MINOS-Electron-Setup-1.0.0-x64.exe)
- [SHA256 校验文件](https://github.com/Akun-python/minos/releases/download/v1.0.0-electron-preview.3/SHA256SUMS.txt)

仓库目前为私有仓库，下载需要有仓库访问权限的 GitHub 账号；无权限时会显示 404。

1. 下载安装包和校验文件；PowerShell 可用 `Get-FileHash .\MINOS-Electron-Setup-1.0.0-x64.exe -Algorithm SHA256` 核对散列。
2. 退出正在运行的旧版 MINOS，运行安装器，选择安装位置。
3. 安装完成后使用桌面快捷方式启动，不要继续打开旧构建目录中的程序。
4. 等待程序启动本机服务；首次启动可能较慢。

安装包尚未商业签名，Windows 可能提示未知发布者。请核验来源和散列，不要为了安装关闭系统安全防护。升级默认保留数据，但建议提前备份。

## 第一次使用

### 1. 创建自己的本机账号

首次启动填写账号和密码，点击“创建账号并进入”。**没有预置的默认账号或管理员密码**，也不会带上开发者的账号、聊天记录或 API 密钥。后续启动使用自己创建的账号登录。

![首次创建账号](<docs/screenshots/01-account.png>)

### 2. 可先浏览，再配置模型

未配置模型时也能进入首页，查看功能入口。点击右上角“模型设置”或“配置模型，开始对话”进入配置流程。

![首次进入欢迎页](<docs/screenshots/02-welcome.png>)

### 3. 理解本地工具权限

首次启用 Pi 工作区需要确认本地智能体权限。它能够访问文件和运行命令，不是账号安全沙箱。不希望现在启用时，可以选择“稍后启用，继续浏览”。不要对不可信项目随意启用高权限工具。

![本地智能体权限确认](<docs/screenshots/03-permission.png>)

### 4. 配置并选择聊天模型

在 Pi 原生模型面板中，点击“添加 Provider”，选择供应商或自定义 OpenAI/Anthropic 兼容端点，根据供应商文档填写接口类型、Base URL、API Key 和准确的模型 ID，保存后在输入框下方的模型选择器选择模型。模型展示名称不等于模型 ID；不要填写不受服务端支持的名称。

![Pi 原生模型设置](<docs/screenshots/04-models.png>)

截图全部来自隔离账号真实运行界面，无真实密钥或个人简历；空列表代表该测试账号尚未配置或创建相应数据，不是预置业务成果。

## 各页面操作指南

### 智能对话

左侧点击“智能对话”。可以上传简历、粘贴 JD，或描述自己的求职目标。首页任务卡和底部求职工具会帮助填写草稿，**确认内容并发送后才执行**。

- **建立简历 / 简历精修**：先给真实经历，再逐项修改；不要让模型虚构学历、公司或业绩。
- **匹配岗位 / 机会对比**：提供岗位要求、Offer 条件及个人优先级。
- **求职规划 / 成长路线 / 投递进展**：根据你提供的事实整理行动与进度；不会自动向招聘网站投递。
- **STAR 整理 / 面试练习**：围绕具体经历练习表达。
- 历史会话在左侧切换；新建会话前检查当前工作区和所选模型。

![智能对话与求职工具栏](<docs/screenshots/05-chat.png>)

### LaTeX 简历

左侧点击“LaTeX 简历”，在简历专用会话中使用“读取简历”“修改简历”“选择模板”“生成 PDF”等工具。该入口复用 Pi 对话和简历扩展，不是独立的拖拽排版器。

1. 描述目标岗位和真实经历，或上传已有简历。
2. 先读取当前简历，再确认修改内容，保留未涉及字段。
3. 点击“选择模板”，了解单栏/双栏原版模板，确认后再切换；作者示例经历不属于你的简历。
4. 确认内容后生成 PDF。缺少 TeX 编译器时可保留、导出源文件，不能把源文件生成视为 PDF 编译成功。

首页提供可展开的简历案例，使用作者原版 PDF 渲染的完整第一页图片，不依赖内嵌 PDF 插件。案例默认收起，不自动导入作者经历；“按这个版式开始”只填入草稿。

![LaTeX 简历入口](<docs/screenshots/06-resume.png>)

### 知识库

左侧点击“知识库”，按分类或搜索查找求职指南、专业课程与章节。点击条目进入阅读页面，按页面提供的入口完成章节学习或测验。新安装的内容取决于本机实际数据库；空列表不表示已经完成内容导入。

![知识库页面](<docs/screenshots/07-knowledge.png>)

章节内可使用目录跳转、收藏、随文笔记和测验。记录保存在当前本机账号下；阅读页面需要滚动查看完整测验。

![知识章节阅读](<docs/screenshots/11-reader.png>)

### AI 面试

左侧点击“AI 面试”，选择目标岗位、难度和时长等参数，再创建练习。面试反馈默认复用当前对话的有效模型；没有当前对话选择时使用 Pi 默认模型。也可在面试页明确选择兼容模型，无需再次填写密钥。所选协议不兼容或模型不可用时会明确提示，不会静默切换供应商。

1. 按页面提示创建面试，等待真实题目生成。
2. 使用文字作答；如需要，再明确授权摄像头/麦克风。
3. 提交回答后查看反馈，逐题继续并结束面试。
4. 语音不可用时切换文字；摄像头仅作本地预览，不参与视觉评分。

![AI 面试配置页](<docs/screenshots/08-interview.png>)

在线语音识别尚未保证在 Electron 中可用，也不宣称支持全双工实时音视频。逐题反馈与结束汇总的机制不同，不应把汇总分数当成录用预测。

### 学习复盘

左侧点击“学习复盘”，查看本机账号已有的学习与测验记录，再按页面提示回顾内容。首次使用可能为空；先完成相关学习活动，再回来查看，不会自动生成虚假学习成果。

![学习复盘页面](<docs/screenshots/09-review.png>)

### 求职画像

左侧点击“求职画像”，填写或更新求职方向与个人背景，按实际情况保存。避免把模板作者或模型猜测的信息写成自己的经历；涉及敏感个人资料时先确认保存和上传范围。

![求职画像页面](<docs/screenshots/10-profile.png>)

## 模型与可选服务

Pi 对话和面试反馈现在复用同一账户的供应商认证；其他可选后端服务仍有独立配置：

| 能力 | 配置方式 |
| --- | --- |
| Pi 智能对话、会话内简历工具 | 右上角“模型设置”，使用 Pi 原生面板保存供应商配置 |
| AI 面试反馈 | 自动复用当前对话模型／Pi 默认；面试页可明确另选兼容模型，密钥只在服务端使用 |
| PDF 编译 | 额外安装 XeLaTeX 与中文依赖，并配置 `RESUME_XELATEX` |
| 可选在线解析/语音播报 | 按相应服务填写个人密钥；需要网络和服务权限 |

可选旧后端业务配置示例（新面试反馈不依赖这里；全部为占位值，不是可用凭据）：

```dotenv
LLM_API_KEY=your-provider-key
LLM_BASE_URL=https://your-provider.example/v1
LLM_MODEL=your-real-model-id
INTERVIEW_LLM_MODEL=your-real-model-id
# 可选
RESUME_XELATEX=C:\path\to\xelatex.exe
MINERU_API_KEY=
MAMBO_TTS_KEY=
```

个人环境配置文件位于 `%LOCALAPPDATA%\MINOS`，**不要修改安装目录，也不要提交真实配置到 Git**。修改后从顶栏“···”应用菜单执行重启服务。具体配置项见 [便携运行说明](<backend/PORTABLE_RUNTIME.md>)。

## 数据备份与安全

- 默认数据目录：`%LOCALAPPDATA%\MINOS`。包含账号数据库、工作区、会话、模型配置与日志。
- 安装资源与用户数据分离；程序可安装在另一盘。卸载默认保留数据。
- 备份前完全退出 MINOS，再复制整个数据目录到受保护的位置；恢复前先备份当前数据，避免覆盖较新的内容。
- 不要分享整个数据目录或日志压缩包而不检查内容：配置、模型密钥、聊天记录和个人材料均可能敏感。
- 后端仅监听本机回环地址，不应映射公网。工具仍使用当前 Windows 用户权限，Electron 渲染隔离不等于智能体工具沙箱。

## 常见问题

| 问题 | 处理方法 |
| --- | --- |
| Release 链接显示 404 | 确认 GitHub 账号拥有私有仓库访问权限 |
| 忘记账号密码 | 没有通用默认密码；请先备份数据，再由操作者明确执行密码重置，不要删除数据库 |
| 工作区连接失败 | 核对正在运行的是最新版；退出旧进程后重开，从顶栏菜单查看日志；不要删除账号数据 |
| `Cannot find module ... uploads.mjs` | 旧打包版漏了 SDK 文件；升级至本 README 链接的完整依赖版，并重启服务 |
| 能浏览但不能对话 | 检查是否已启用工作区、保存并选择模型，以及供应商接口/额度/网络是否正常 |
| 聊天正常但 AI 面试失败 | 查看面试页显示的实际模型和协议兼容提示；确保工作区已连接，必要时明确选择兼容模型，不用重复填写密钥 |
| 模板 PDF 黑屏 | 首页案例使用可靠图片预览，不依赖 PDF 插件；完整 PDF 按需打开，不把预览成功等同于编译成功 |
| 文档已上传却读不到 | PDF/DOCX/DOC 引用在工具模式下由 `document_read` 提取正文；扫描PDF需OCR、加密或不支持旧DOC需另存DOCX，不会把二进制当正文 |
| PDF 编译失败 | 检查 XeLaTeX 路径、xeCJK/Fandol 与字体；具体见 [简历工作台](<backend/RESUME_WORKBENCH.md>) |
| 麦克风允许了仍无识别 | Electron 在线识别服务未保证可用，先用文字作答；播报与识别是不同能力 |

## 开发与构建

### 目录

```text
pi-web/       Next.js + React：当前唯一前端、Pi UI/API/SDK 集成
backend/      FastAPI + SQLite：账号、业务数据、简历与侧车进程管理
desktop/      Electron 主进程、预加载脚本、Windows 打包脚本
scripts/      Windows 源码部署启动/停止脚本
docs/         指南、架构说明及本 README 真实界面截图
assets/       品牌与 IP 资源（2D 素材位于 assets/ip/2d）
rocket_rig/   保留的 IP 设计工程、渲染图、表情、贴图及分析脚本
mino-agent/   历史前端源码，仅作回退参考
```

### 源码运行

需要 Git、Python 3.12、Node.js 22.19+ 与 npm。当前 Windows 构建验证使用 Node 24.x。

```powershell
git clone https://github.com/Akun-python/minos.git
Set-Location minos
git switch main
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements-local.txt
Set-Location pi-web
npm.cmd ci
npm.cmd run build
Set-Location ..
.\start-minos.cmd
```

源码部署统一入口通常为 `http://127.0.0.1:5173`，后端通常为 `http://127.0.0.1:8000`；Electron 优先使用 5175/8005，并按可用情况分配端口。按程序实际打开的地址使用，不要混用不同实例。

当前后端只读取个人数据目录的环境配置，不自动继承源码目录中的私有环境文件。需要隔离运行时可设置绝对路径 `MINOS_DATA_DIR`，详见 [便携运行说明](<backend/PORTABLE_RUNTIME.md>)。不要在同一构建目录的 `next dev` 运行时执行 `next build`。

### Electron 打包

按 [桌面构建说明](<desktop/README.md>) 和 [Electron 说明](<desktop/electron/README.md>) 准备嵌入式 Python 及运行依赖，执行：

```powershell
.\desktop\build.ps1
```

输出目录为 `dist/electron`。打包不是简单网页快捷方式；Electron 会管理本机前后端进程及退出清理。不要上传依赖目录、运行数据和生成产物到源码提交；二进制通过 Releases 分发。

## 验证范围与限制

最近一次验证记录：

- 后端运行 80 项测试，跳过 1 项，其余通过。
- 本次相关前端回归 24 项通过，生产构建通过。
- 实测跨盘启动、账号创建/登录、模型设置保存与读回、重启后配置保留。
- 审计生产依赖文件无缺失，并验证 OpenAI / Pi AI SDK 导入成功。
- 实测首页不嵌入 PDF、不自动请求模板 PDF，保留选择模板入口。
- 本文截图来自隔离账号真实 Electron 页面；页面截图不代表所有后端业务流程或远程 AI 服务已完成验收。

**未完成项：** 另一台干净电脑的全面验收；最新发布版真实远程模型回复与在线 ASR 的可用性确认。全量上游前端测试存在失败，部分为中文文案与英文断言不一致，其余未逐项定位，不能宣称全量测试全绿。

## 文档与致谢

- [Windows 源码部署](<DEPLOY-WINDOWS.md>)
- [Pi 集成架构与安全边界](<pi-web/MINOS-INTEGRATION.md>)
- [本地智能体 Harness](<backend/HARNESS.md>)
- [简历工作台](<backend/RESUME_WORKBENCH.md>)
- [原版简历模板与许可](<backend/app/resume_templates/README.md>)

Pi Web 上游：[agegr/pi-web](https://github.com/agegr/pi-web)，版本 `0.12.2`，基准提交 `e533d9b3975f8a74b378d5007c92fdf4d15d3fba`。本项目保留真实 Pi UI/API/SDK 实现并进行 MINOS 集成。分发须保留 [Pi Web MIT 许可](<pi-web/LICENSE>)、字体 OFL 与简历模板原始许可。
