# 实际开源模板接入与许可

当前不是自写仿版。工作台直接从固定上游源码读取导言/类文件，调用上游命令填充数据。

## Sourabh Bajaj / sb2nov/resume（classic）

- 来源：https://github.com/sb2nov/resume
- 固定提交：`7b70fe14876f97180034787f2a7f661597416a17`
- 原始文件：`sb2nov/sourabh_bajaj_resume.tex`，MIT；原始字节及许可证完整保留，SHA256 见 manifest。
- 保留原 article/letterpaper/11pt、页边距、横线章节格式及 resumeSubheading/resumeItemPlain 等命令。
- MINOS 修改范围：原 pdfTeX 专有 glyphtounicode/pdfgentounicode 包为条件执行，以兼容 XeTeX；插入 xeCJK/Fandol 中文回退字体；替换作者履历为用户内容。保留原双列、两行、自然列宽的 tabular 页眉，不再引入固定宽度 minipage。contact 的首行与后续行填入原右侧两个格；第三行起用 ` | ` 连接到第二格。当前 schema 无独立网站字段，左下格留空，不猜测用户网站。长联系方式可能溢出，请缩短内容或显式换行。
- 旧 technical ID 仅兼容映射 classic，不再将一个变体冒充另一套开源模板。

## Deedy-Resume OpenFonts（sidebar）

- 来源：https://github.com/deedy/Deedy-Resume
- 固定提交：`6d06ba7d8eee5fb8870bb00cb13a777f2083aa18`
- `deedy/` 中 class、原入口与19个 Lato/Raleway 字体均来自固定提交；class 和原字体不修改。
- 许可证 Apache-2.0；字体 SIL OFL-1.1，完整版权、来源及校验值见该目录 README / manifest / fonts 下许可文件。
- 实际加载 deedy-resume-openfont 类，保留 namesection/runsubsection/descript/location/tightemize 排版，以及原 0.33 / 0.66 双栏布局。
- MINOS 修改范围：读取原入口导言，插入中文回退字体，填充用户内容；左栏机构使用上游 subsection，右栏机构使用 runsubsection，右栏职位保留上游 `|` 分隔。不输出作者示例个人信息或论文。
- 中文使用 Fandol，不是把中文字形声称成原 Lato/Raleway。双栏 minipage 不能自然跨页，应控制为一页。

## 模板信息展示

工作台提供完整模板画廊：上游原版效果图、原示例 PDF、作者、项目介绍、版式特点、原版章节、字体和编译器依赖、已知限制、许可证、固定提交链接及本机修改范围。README 与许可作为纯文本打开，不执行上游 HTML。

预览图与原 PDF 均来自固定上游提交，不是本机重画；其中作者个人信息仅为原版版式示例，点击使用模板不会将其导入用户简历。sb2nov 预览图、原 PDF 与 README 的 SHA256 也记录在对应 manifest 中。

## 数据与导出

Section 支持 entries（heading/subtitle/location/dates/items），对应原版履历命令；旧 items 字符串数组继续兼容。双栏 column 支持 auto/left/right，auto 将教育、技能、课程和链接放左栏，其余放右栏。

所有用户/LLM内容均做 TeX 转义，不接受任意可执行 .tex。源码包包含生成入口、原版 class/字体、许可证、固定版本 manifest 和构建说明；推荐下载 ZIP 而非只下载一份 tex。

原版目录的示例履历只作上游归档，不作为用户数据。upstream/ 为早期参考存档，不再作为接入主目录。

初始完整原版样本由 `GET /api/resume/templates/{id}/original.pdf` 提供，直接返回上游已编译 PDF，而非对空白用户数据重新渲染。结构化编辑器不是任意 LaTeX 文档的原位编辑器：summary 与自定义 sections 会插入用户指定内容，不能承诺任意原样本的所有文字槽位（网站、姓名轻/常规字体拆分、奖项表格、论文等）一一映射；不改变此事实来声称像素级原版一致。

## 资源审计

两套固定上游均不使用图标包或图标字体，无需添加替代图标。Deedy 的 19 个原字体、class、原入口、PDF、预览图均已保留，无需替换或重画；字体许可说明为本地补充，不冒充上游文件。Fandol 中文字体及通用 LaTeX 包由 TeX 发行版/Tectonic 资源提供，并未随源码 ZIP 内嵌，因此源码包不是离线独立 TeX 环境。

本次复核：全部现有 manifest 哈希通过，Deedy 26 个上游资源与缓存 git archive 完全一致；但直接读取缓存固定提交的 Git 对象时发现部分文本仅有换行差异（现有归档为 CRLF、对象为 LF）：Deedy 的 LICENSE / UPSTREAM-README.md / publications.bib，以及 sb2nov 的源码 / LICENSE / UPSTREAM-README.md。字体、class、Deedy 入口、PDF、PNG 未发现差异。现有 manifest 中 Git blob 值是归档字节的计算值，不应将其视为已经向远端对象独立认证；原 manifest 的“无换行转换”说明存在这一限制。本次未改写现有资源或 manifest。新鲜远端复核因 TLS 连接重置未完成。

`test_resume_templates.py` 默认离线验证双方 manifest SHA256、Deedy Git blob SHA1/字节长度/文件完整性、class 的字体引用、全部 19 个字体与许可的 ZIP 字节、原 PDF/预览资源响应和布局回归。设置 `RESUME_VERIFY_UPSTREAM=1` 可额外逐文件下载固定 commit 的上游原资源进行字节对比；网络不可用会让该显式审计失败，不静默降级。

## 编译

优先 RESUME_XELATEX 指定的 XeLaTeX，再检查 PATH 的 XeLaTeX；本机也支持经 SHA256 校验的便携 Tectonic（XeTeX引擎）。关闭 shell escape/启用 untrusted，使用独立临时目录。新机器需要 TeX Live 的 xeCJK 与 Fandol 或允许 Tectonic 首次下载 TeX 资源。
