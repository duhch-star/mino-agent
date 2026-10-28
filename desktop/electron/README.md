# MINOS Electron 独立安装版

Windows 10/11 x64；内置 Electron、Node 和 Python，不依赖系统 Node/Python，也不是浏览器快捷方式。

## 使用
运行 MINOS-Electron-Setup-1.0.0-x64.exe，选择安装位置并完成。桌面快捷方式打开 Electron 原生窗口，程序自动启动仅监听本机的前后端。
首次使用需创建本机账号（无预设演示密码）。右上角“模型设置”打开 Pi 原生配置面板，设置聊天供应商、接口地址、密钥与模型 ID 并保存，然后在会话中选择模型。AI面试等后端业务仍通过应用菜单打开个人环境配置，填写 LLM_API_KEY / LLM_BASE_URL / LLM_MODEL 并重启服务；两套模型配置尚未统一。模型和可选云端解析/语音服务需要网络及用户自己的服务权限，安装包不附带密钥或模型权重。完整图文指南见 [项目 README](../../README.md)。

## 数据
默认数据目录 `%LOCALAPPDATA%\MINOS`，账号库/工作区/配置与安装资源分离。卸载保留用户数据；重装可继续使用。不要分享数据目录的 .env、数据库或会话文件。退出应用会停止本次启动的服务；与源码开发服务端口分离。

## 面试语音限制
实测本机构建的 SpeechRecognition 接口存在，但用模拟音频设备启动识别后8秒内未返回识别结果；不能视为在线ASR已可用。Electron 中摄像头、麦克风需要单独授权。语音播报与识别属于不同能力：即使存在 SpeechRecognition 接口，也不代表在线识别服务可用。当前浏览器 Web Speech 识别并没有成为 Electron 自带的可保证服务；若识别不可用，请文字作答。此版不宣称支持全双工实时音视频；后续可接专用ASR流服务。真实设备权限/声卡/网络仍需安装后测试。

简历源文件/模板包含在安装包；PDF编译需额外XeLaTeX及xeCJK/Fandol，可在配置中指定RESUME_XELATEX。

## 安全与发布
渲染窗口关闭 NodeIntegration、启用contextIsolation/sandbox，仅加载本机服务。麦克风/摄像头只向本应用本机来源授权。未做商业代码签名，SmartScreen可能提示未知发布者；请核验来源及SHA256，不要关闭系统安全防护。

## 重建
先将 `backend/requirements-local.txt`（包含PDF、DOCX、DOC解析依赖，不只是核心requirements.txt）安装到 `.runtime/packaging/python`；`desktop/verify_document_runtime.py` 会实际导入解析模块及其原生依赖，stage会在清空旧暂存目录之前运行这一检查。然后构建 pi-web 生产资源，运行 desktop/stage.py 生成排除秘密的payload；在本目录 npm ci 后 npm run pack（electron-builder NSIS）。输出 dist/electron。desktop/Launcher.cs 为早期原生启动器方案，不是本次交付目标；minos.iss 也可将 win-unpacked Electron 应用制作成兼容性备用安装器。
