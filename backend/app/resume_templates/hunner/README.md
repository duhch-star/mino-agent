# Trey Hunner resume — acquisition and integration notes

- Template ID suggestion: `hunner`; plain single-column, serif, centered-name CV suitable for graduates or technical applicants.
- Official source: https://github.com/treyhunner/resume
- Pinned commit: `7f889bfe6f7c1116cb8bd3cabbdabe7fb4b99ae3`.
- Repository license: MIT, Copyright (c) 2011 Trey Hunner. The class additionally retains its 2010 permissive copying notice; preserve both in exports.
- Unmodified upstream files: resume.cls, resume.tex, LICENSE, UPSTREAM-README.md. Fixed raw URLs, Git blob IDs and SHA256 are in manifest.json. No font binaries or images needed. Public sample is an archive reference, never user data.

## Rendering entry and commands

Generate a fresh resume.tex with `\documentclass{resume}` and original geometry preamble. Set `\name{escaped name}` and at most TWO `\address{...}` calls before `\begin{document}`. Header is automatic via AtBeginDocument; do not manually print it again. Within address, `\\` is converted into a diamond separator, not a line break. More than two address calls overwrite an existing slot. Combine contacts into two deliberately bounded lines; centerline does not wrap.

Use `\begin{rSection}{title}...\end{rSection}`. Structured entries: `\begin{rSubsection}{heading}{dates}{subtitle}{location}\item ...\end{rSubsection}`. If subtitle is empty the original class hides the ENTIRE second line, including location; place location in another safe slot or explicitly document an adapter change. rSubsection always opens a list; if items is empty avoid an empty-list error by adding a deliberate empty item or rendering a simple text heading instead. Free section items can use an ordinary itemize inside rSection. The original tabular skill example has unbounded columns; prefer controlled wrapping for long multilingual text.

## XeTeX/free fonts

Original uses ordinary article default fonts (no commercial requirement). Class has no pdfTeX-only primitives. Add xeCJK/Fandol in the generated preamble for Chinese. Optional fontspec/Latin Modern is a deliberate adapter choice, not an upstream font requirement. Dependencies are only article, parskip, array, ifthen; sample adds geometry. This is the lowest-dependency candidate and should be the first offline smoke test.

## Verification status

Acquired source and explicit license, with SHA256 and Git-object verification recorded in manifest.json. MINOS adapter verified synthetic Chinese PDF compilation with Tectonic 0.17.0 using only the bundled offline cache. Adapter adds Fandol Chinese fallback and 0.65in margins while preserving the class. Included example.pdf/preview.png contain synthetic placeholders, not upstream author data. Copy class into isolated render/export workspace with LICENSE and manifest; never compile the upstream author sample as a user resume.
