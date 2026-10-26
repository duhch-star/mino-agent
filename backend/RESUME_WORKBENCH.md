# LaTeX 简历工作台

## 入口与流程

前端：`http://127.0.0.1:5173/#/resume`，侧栏「LaTeX 简历」或职业辅导页面进入。

1. 选择直接接入的 Sourabh Bajaj 原版单栏或 Deedy OpenFonts 原版双栏（仅增加中文字体兼容与安全内容填充）。
2. 在对话框粘贴真实履历并描述修改要求，或展开结构化编辑，填写 JSON。
3. AI 返回完整候选版本和待补充问题；逐字段显示前后差异。
4. 点击确认应用后更新当前简历，放弃不会改变原文；可撤销上次应用。
5. 生成 PDF 查看实际 LaTeX 排版，导出 `.tex` 或备份 JSON。

网页内容预览不是精确排版预览，PDF 才是真实 XeLaTeX 结果。双栏模板使用 minipage，不适合长简历；溢出时提示换模板或缩短内容。

## 后端 API

- GET /api/resume/templates：模板信息与编译器可用性。
- POST /api/resume/edit：`{resume, instruction}`，调用已配置 LLM，只返回待确认候选，不写入持久化数据。
- POST /api/resume/source：`{resume, template}`，返回安全生成的 TeX。
- POST /api/resume/compile：相同入参，返回 PDF 字节；X-Resume-Warnings 为溢出警告数量。

数据结构：

```json
{"name":"姓名","contact":"邮箱 / 电话","summary":"个人简介","sections":[{"title":"教育经历","items":["真实经历文字"]}]}
```

## 依赖和安全

可用 RESUME_XELATEX 环境变量指定 XeLaTeX 编译器路径，或使用 PATH 中的 XeLaTeX。本机另准备了经官方 SHA256 校验的便携 Tectonic（XeTeX 引擎）；首次编译会下载所需 TeX 包和 Fandol 中文字体，后续使用缓存。原 Deedy class 与 Lato / Raleway 字体随源码包提供。

- 用户/LLM 内容均视为纯文本，进行 TeX 特殊字符转义。
- 不接受执行任意 .tex，不支持在网页直接编辑可执行源码。
- 使用 -no-shell-escape、受限读写、临时工作目录和 35 秒超时。
- 此为开发版防护，不是完整容器沙箱。公网部署还需非特权隔离编译进程、资源限额、身份认证、限流和任务队列。
- 未配置真实 LLM 时明确报错，不用 Mock 生成简历。
- 提示词禁止编造，不代表模型绝不会犯错：必须人工核对差异后确认。
- 默认内存会话；勾选本机保存才把简历 JSON 保存到 localStorage。对话会发送到已配置 LLM 服务。未实现账户级简历历史、PDF/Word 自动导入或任意上游 TeX 直接运行。

## 来源

两套真实上游模板源码直接接入：sb2nov/resume 和 deedy/Deedy-Resume OpenFonts。固定版本、完整原文件、字体许可与修改范围详见 app/resume_templates/README.md；下载 /api/resume/bundle 源码包可获取全部编译资源。
