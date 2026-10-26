# 实际开源模板接入与许可

当前不是自写仿版。工作台直接从固定上游源码读取导言/类文件，调用上游命令填充数据。

## Sourabh Bajaj / sb2nov/resume（classic）

- 来源：https://github.com/sb2nov/resume
- 固定提交：`7b70fe14876f97180034787f2a7f661597416a17`
- 原始文件：`sb2nov/sourabh_bajaj_resume.tex`，MIT；原始字节及许可证完整保留，SHA256 见 manifest。
- 保留原 article/letterpaper/11pt、页边距、横线章节格式及 resumeSubheading/resumeItemPlain 等命令。
- MINOS 修改范围：原 pdfTeX 专有 glyphtounicode/pdfgentounicode 包为条件执行，以兼容 XeTeX；插入 xeCJK/Fandol 中文回退字体；替换作者履历为用户内容；原双列页眉的联系方式放入可换行 minipage，避免长联系方式溢出。
- 旧 technical ID 仅兼容映射 classic，不再将一个变体冒充另一套开源模板。

## Deedy-Resume OpenFonts（sidebar）

- 来源：https://github.com/deedy/Deedy-Resume
- 固定提交：`6d06ba7d8eee5fb8870bb00cb13a777f2083aa18`
- `deedy/` 中 class、原入口与19个 Lato/Raleway 字体均来自固定提交；class 和原字体不修改。
- 许可证 Apache-2.0；字体 SIL OFL-1.1，完整版权、来源及校验值见该目录 README / manifest / fonts 下许可文件。
- 实际加载 deedy-resume-openfont 类，保留 namesection/runsubsection/descript/location/tightemize 排版，以及原 0.33 / 0.66 双栏布局。
- MINOS 修改范围：读取原入口导言，插入中文回退字体，填充用户内容。不输出作者示例个人信息或论文。
- 中文使用 Fandol，不是把中文字形声称成原 Lato/Raleway。双栏 minipage 不能自然跨页，应控制为一页。

## 模板信息展示

工作台提供完整模板画廊：上游原版效果图、原示例 PDF、作者、项目介绍、版式特点、原版章节、字体和编译器依赖、已知限制、许可证、固定提交链接及本机修改范围。README 与许可作为纯文本打开，不执行上游 HTML。

预览图与原 PDF 均来自固定上游提交，不是本机重画；其中作者个人信息仅为原版版式示例，点击使用模板不会将其导入用户简历。sb2nov 预览图、原 PDF 与 README 的 SHA256 也记录在对应 manifest 中。

## 数据与导出

Section 支持 entries（heading/subtitle/location/dates/items），对应原版履历命令；旧 items 字符串数组继续兼容。双栏 column 支持 auto/left/right，auto 将教育、技能、课程和链接放左栏，其余放右栏。

所有用户/LLM内容均做 TeX 转义，不接受任意可执行 .tex。源码包包含生成入口、原版 class/字体、许可证、固定版本 manifest 和构建说明；推荐下载 ZIP 而非只下载一份 tex。

原版目录的示例履历只作上游归档，不作为用户数据。upstream/ 为早期参考存档，不再作为接入主目录。

## 编译

优先 RESUME_XELATEX 指定的 XeLaTeX，再检查 PATH 的 XeLaTeX；本机也支持经 SHA256 校验的便携 Tectonic（XeTeX引擎）。关闭 shell escape/启用 untrusted，使用独立临时目录。新机器需要 TeX Live 的 xeCJK 与 Fandol 或允许 Tectonic 首次下载 TeX 资源。
