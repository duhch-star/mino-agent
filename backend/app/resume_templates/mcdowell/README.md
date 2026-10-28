# McDowell CV — acquisition and integration notes

- Template ID suggestion: `mcdowell`; compact single-column engineering / graduate CV.
- Official source: https://github.com/dnl-blkv/mcdowell-cv
- Pinned commit: `b7e2d271c64814ee02b3505b191389c8df614035`.
- License: MIT, Copyright (c) 2015 Daniil Belyakov. Preserve LICENSE and source notices in exports. No external font binaries acquired.
- Unmodified upstream files: `mcdowellcv.cls`, `McDowell_CV_Template.tex`, `LICENSE`, `UPSTREAM-README.md`. Per-file raw URLs, Git blob IDs and SHA256 are in manifest.json. Public upstream sample text is an archival layout reference only; never copy it into user resumes.

## Actual commands (source authoritative, README has stale names)

Use `\documentclass{mcdowellcv}`, preamble `\name{...}`, `\address{...}`, `\contacts{...}`, then `\begin{document}\makeheader` (not the upstream README's `makecvheader` / `printheader`). Sections use `\begin{cvsection}{Title}...\end{cvsection}`. Entries use `\begin{cvsubsection}[1]{left}{center}{right} ... \end{cvsubsection}` with itemize; for MINOS map subtitle/role to left, heading/organization to center, dates to right. Put location as text before bullets or within a controlled second title line; optional [2] only adjusts spacing and does not create the line itself.

## XeTeX/free-font adaptation required

Upstream advertises LuaLaTeX, not verified XeTeX support. Class uses fontspec without Lua-only primitives; XeTeX is a candidate, NOT a tested claim. Original default `Times New Roman` and option `calibri` are commercial/platform fonts: do not rely on them. In an isolated generated class copy, replace `\def\mainfontface{Times New Roman}` with `\def\mainfontface{Latin Modern Roman}` (or audited cached TeX Gyre Termes). Keep this archive unchanged. Changing setmainfont after documentclass is too late because the original class attempts the unavailable font while loading. Add xeCJK and existing Fandol fallback in generated preamble for Chinese.

Packages: article, geometry, fontspec, parskip, array, etoolbox, tabu, changepage, enumitem, ifthen, ifplatform, microtype. `tabu` is old and microtype textls/font small-caps behavior needs actual engine testing. ifplatform may warn with shell escape disabled; never enable shell escape just to suppress it. No icons or local images required.

## Verification status

Sources and license downloaded from fixed raw GitHub URLs. SHA256 and Git-object verification performed separately; see manifest.json. MINOS adapter verified synthetic Chinese PDF compilation with Tectonic 0.17.0 using only the bundled offline cache. Generated class uses Latin Modern instead of Times New Roman and removes the name's textls letterspacing unsupported by XeTeX; Fandol supplies Chinese. The archived upstream class stays byte-identical. Included example.pdf/preview.png are synthetic adapted examples, not upstream originals. Suggested isolated entry is a generated resume.tex plus adapted mcdowellcv.cls, not a mutation of the upstream sample.
