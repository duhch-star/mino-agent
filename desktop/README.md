# MINOS Electron Windows 独立安装版

正式桌面封装使用 Electron；详见 [Electron 使用与构建说明](electron/README.md)。

- 运行 `MINOS-Electron-Setup-1.0.0-x64.exe`，支持 Windows 10/11 x64。
- 内置 Electron、Node、嵌入式 Python 及前后端。
- 首次启动创建本机账号，无默认账号。未配置模型也可浏览工作区。
- 点击“模型设置”使用 Pi 原生面板配置智能对话。启动侧车前需确认本地工具权限。
- 数据保存在 `%LOCALAPPDATA%\MINOS`，安装包不含开发者密钥或用户数据。
- AI面试等后端业务模型仍使用数据目录 `.env` 配置，尚未与 Pi 模型设置统一。
- 在线语音识别依赖 Electron/外部服务，未保证可用；面试可用文字兜底。
- PDF编译需要额外配置 XeLaTeX；首页不自动嵌入模板 PDF。

## 重建

预先准备项目 Node/Python 依赖和 `.runtime/packaging/python` 嵌入式 CPython 3.12.10及 `backend/requirements-local.txt` 依赖后，运行 `desktop/build.ps1`。

输出到 `dist/electron`（生成产物不提交 Git）。`desktop/stage.py` 复制生产依赖完整闭包，不能因目录名为 uploads/dev/cache 就过滤第三方SDK源码。

`Launcher.cs` 和 `minos.iss` 保留为早期方案/备用安装脚本，不是当前 Electron 主入口。
