# MINO AGENT Backend

本地可运行的 FastAPI MVP，默认使用 SQLite。接口文档由 FastAPI 提供：`/docs` 与 `/openapi.json`。

模型服务配置文件是 `backend/.env`。填写 `MINO_LLM_BASE_URL`、`MINO_LLM_API_KEY`、`MINO_LLM_MODEL` 后重启后端；不要把 API Key 提交到代码仓库。

## 启动

```powershell
cd D:\Mino\backend
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

默认开发账号为 `demo` / `change-this-password`。首次启动会创建该账户；请在 `.env` 中更换密码和 `MINO_SECRET_KEY`。生产环境必须设置强密钥、限制 CORS、配置 HTTPS、备份数据库并设置上传文件保留和扫描策略。

健康检查：`GET http://127.0.0.1:8000/health`。Swagger：`http://127.0.0.1:8000/docs`。

## 配置模型

兼容 OpenAI Chat Completions 的服务配置：`MINO_LLM_BASE_URL`（服务根 URL）、`MINO_LLM_API_KEY`、`MINO_LLM_MODEL`。缺任一配置时，聊天接口返回明确的本地开发示例，不会声称是模型生成内容。密钥只保存在服务端环境变量中。当前机器上的旧版混元凭据可访问模型目录，但实际生成返回服务迁移错误（2030）；请按腾讯云 TokenHub 迁移说明更新兼容接口地址和 API 凭据后再启用。

## 前端接入

将 `VITE_API_BASE_URL=http://127.0.0.1:8000` 配置给 Vite。认证接口实际返回服务器账户角色，客户端传来的 role 不参与授权。受保护接口使用 `Authorization: Bearer <accessToken>`。聊天接口返回 `text/event-stream`，事件名为 `activity`、`delta`、`done` 和 `error`。

## 当前范围与后续工作

- 已提供交接文档列出的 API 路由、账户认证与 refresh token 轮换、用户数据隔离、会话 CRUD、SSE 聊天、附件上传、反馈、面试会话、职业辅导及管理员审核权限。
- SQLite 适合本地开发和单机验证。生产部署需迁移 PostgreSQL，再增加 Alembic、pgvector、对象存储、速率限制、审计与备份。
- 知识库路由目前返回空列表或明确的未导入响应；前端 `src/data` 的院校、教材、指南内容尚未迁入后端。需要确定数据授权和导入格式后运行数据导入。
- 面试提供文本流程与示例评分；实时语音/视频 WebSocket、媒体存储、真实评估仍未实现。
- 附件写入本地 `data/uploads`，限制 PDF/TXT/Markdown/DOC/DOCX，单文件默认 20 MB；PDF、DOCX、TXT、Markdown 会先提取文字再放入聊天模型上下文。扫描版或纯图片 PDF 没有文字层，当前需要 OCR 才能解析。生产环境需恶意文件扫描、对象存储与保留策略。
- 模型错误与外部服务异常会记录为 SSE `error`；上线前还需补齐结构化日志、告警、限流和供应商重试策略。

## 测试接口

登录获取 token 后，在 Swagger 页面点 Authorize 填 `Bearer <accessToken>`。接口采用 UTF-8 JSON；错误响应包含 `error.code`、`error.message` 和 `requestId`。
