# Deedy Resume OpenFonts — 原始依赖存档

## 来源与完整性

官方仓库：https://github.com/deedy/Deedy-Resume （历史作者路径 deedydas/Deedy-Resume）。
固定提交：`6d06ba7d8eee5fb8870bb00cb13a777f2083aa18`，提交时间 2015-12-02T10:39:03-05:00。
使用 git archive 从提交对象导出，避免 Windows core.autocrlf 改写原文件换行。
原始 OpenFonts 目录的所有文件均已保留，包括 19 个原字体、示例 PDF/PNG、publications.bib。
上游入口实际名为 deedy_resume-openfont.xtx；额外的 deedy_resume-openfont.tex 仅为逐字节相同的扩展名别名，未修复、替换或重写内容。
LICENSE 与 UPSTREAM-README.md 也是原始字节。上游此提交没有 NOTICE，也没有独立字体许可文本，未伪造上游 NOTICE。
manifest.json 记录所有其他文件 SHA-256、字节数、来源类型及上游路径/URL；不包含自身哈希以避免自引用。

## 字体许可检查

19 个原字体的 name 表逐个检查：Lato 为 1.104（Western+Polish opensource），Raleway 为 2.001，均明确声明 SIL Open Font License 1.1。
字体二进制及内嵌版权、保留名称均未改动；Lato、Raleway 是 Reserved Font Names。
licenses/font-metadata.json 保留 name ID 0/1/2/5/8/9/13/14 的去重原文，包含 Lato 部分 name ID 13 自带的 `2011-2011` 年份原文，未纠正。
licenses/OFL-1.1-original.txt 是从 https://openfontlicense.org/documents/OFL.txt 原样下载的官方通用全文（顶部有官方模板占位符，不是字体版权声明）。
fonts/lato/OFL.txt 与 fonts/raleway/OFL.txt 是本地补齐的许可汇编：各字体的实际内嵌版权/许可声明 + 上述官方 OFL 正文；不是声称上游自带的文件。
因此字体具备可读的实际版权声明及完整 OFL 1.1 条款；模板 Apache-2.0 不覆盖字体的 OFL 条款。
分发时一起保留上述版权和许可证；勿单独出售字体，修改字体需遵守保留名称规定。

## 主 agent 接入 / 编译注意

- 必须使用 XeLaTeX（不是 pdfLaTeX），且以此目录或完整复制该目录的工作目录为 cwd；类中 `Path = fonts/lato/` 和 `fonts/raleway/` 为相对路径。无需系统安装或替换字体。
- 系统 TeX 包依赖（本次未安装、未编译验证）：article、geometry、hyperref、cite、xcolor、fontspec、textpos、isodate（UKenglish）、titlesec、fancyhdr；XeTeX/fontspec 需要相应字体加载支持。
- 示例引用 publications.bib 和标准 abbrv.bst；后续如需完整示例参考文献，一般按 XeLaTeX → BibTeX → XeLaTeX → XeLaTeX 流程；abbrv 是 TeX 发行版标准样式，不是本仓库文件。
- 保留上游瑕疵：示例末尾 `\end{document}` 后还有 `\documentclass[]{article}`，通常会在 end document 后被忽略；本存档未改动。
- 布局采用两个 minipage，内容超过列高不会自动良好跨页。原字体主要西文字形，不提供中文覆盖，不能声称原版已支持中文；中文适配需主 agent 在派生文件中明确处理，勿改此处原始存档。
- 示例含作者个人履历，仅作为原模板原样保留；接入产品时不要把原作者个人资料当作用户资料。
- 本次仅获取/核对依赖与来源，未修改业务代码，未安装 TeX，未构建、运行编译或重启服务。
