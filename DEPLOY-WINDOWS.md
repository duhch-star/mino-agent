# MINOS Windows 本机部署

## 日常使用

- 双击项目根目录的 `start-minos.cmd`：后台启动前后端，健康检查通过后自动打开浏览器。
- 浏览器入口：http://127.0.0.1:5173
- API 文档：http://127.0.0.1:8000/docs
- 双击 `stop-minos.cmd`：停止本部署脚本记录的进程，不按端口盲目终止其他程序。
- 默认不设置开机自启动。重启电脑后再次双击启动即可。
- 服务只监听本机回环地址，不开放局域网或公网。前端使用已构建的静态资源，由 Vite preview 提供，仅用于本机使用，不是公网生产方案。

## 演示账号

- 求职者：`demo@xiaomin.ai` / `demo123456`
- 管理员：`admin@xiaomin.ai` / `admin123456`

这些是项目自带演示账号，请勿直接将本部署暴露到公网。

## 私有配置与功能边界

后端配置保存在 `backend/.env`（Git 忽略），已生成独立随机 JWT 签名密钥。不要提交或分享此文件。

主要工作区现在使用真实 Pi SDK；Pi 对话、简历 AI 操作及面试反馈需要真实 LLM 配置。旧兼容聊天可能仍有演示逻辑，不应将其当作真实推理。首页直接进入智能对话，原求职首页和职业辅导独立入口已移除。

要接入供应商，在 `backend/.env` 填写以下字段，停止并重新启动：

```dotenv
LLM_API_KEY=你的密钥
LLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
LLM_MODEL=glm-4-flash
```

也可换成供应商的 OpenAI 兼容 API 基址和模型。不要把密钥写入前端。

本次本机环境已准备经官方 SHA256 校验的便携 Tectonic 0.17.0（`.runtime/tools/tectonic/tectonic.exe`）；该工具不在 Git 中，新机器需要自行安装 Tectonic 并加入 PATH，或在此位置放置便携版本。首次 PDF 编译会下载所需 TeX 资源。也可安装包含 xeCJK/Fandol 的 TeX 发行版，并将 xelatex 加入 PATH，或在启动前设置 `RESUME_XELATEX`。源码推荐下载完整 ZIP，包含原模板的类文件、字体和许可。

曼波语音需要后端进程环境变量 `MAMBO_TTS_KEY`，本部署未配置第三方语音密钥；失败不影响文字面试。

## 数据与日志

- SQLite：`backend/app/xiaomin.db`，首次启动自动建表并初始化演示数据。
- 上传文件：`backend/app/uploads/`。
- 日志：`.runtime/backend.log`、`.runtime/backend-error.log`、`.runtime/frontend.log`、`.runtime/frontend-error.log`。
- 启动状态：`.runtime/services.json`。
- 备份数据库前先停止服务；不要删除数据库或上传目录来解决启动问题。

## 重装依赖 / 更新前端

在项目目录执行：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements-local.txt
Set-Location pi-web
npm.cmd ci
npm.cmd run build
Set-Location ..\mino-agent
npm.cmd ci
npm.cmd run build
```

使用 `npm.cmd` 避免 Windows 对 `npm.ps1` 的执行策略限制。双击脚本只对该次 PowerShell 进程使用 Bypass，不修改系统执行策略。

若 8000 或 5173 端口被占用，脚本会报错退出。先确认并停止对应旧服务，再重新启动。
