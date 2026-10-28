# latexcv Classic — acquisition and integration notes

- Template ID suggestion: `minimal`; display name should be **latexcv Classic / blue single-column**, not the unrelated `minimalistic/` photo template.
- Official source: https://github.com/jankapunkt/latexcv
- Pinned commit: `1fc7a2033ddda0fa77003444cafcf96117ad58dd`.
- License: MIT, root copyright (c) 2017 Jan Küster; main.tex additionally contains its 2015 MIT notice. Preserve both.
- main.tex is byte-identical to upstream classic/main.tex; LICENSE, root UPSTREAM-README.md, and UPSTREAM-CLASSIC-README.md also retained. No photos, icons, PDFs, font binaries or external personal-data sources downloaded. Sample text already inside public upstream source is archival only.

## Entry and commands

There is no custom class. Read original main.tex preamble through the first `\begin{document}`, then generate a fresh body, not string substitutions across author's sample. Name/header is plain centered TeX rather than a named macro. Reuse `\cvsection{title}`, `\metasection{right}{left}`, and `\cvevent{dates}{title}{institution}{items}`. cvevent iterates its fourth argument using PGF foreach: each escaped user bullet must be individually braced, joined by comma, e.g. `{{first bullet},{second, comma-containing bullet}}` as the overall argument. No arbitrary TeX from user input. Prefer subtitle as title, heading as institution, and include location in controlled plain text; empty headings should not produce a dangling dash.

## Fonts, XeTeX and known layout constraints

Original loads inputenc, T1 fontenc and TeX `raleway` package (free font distribution, NOT commercial/system Raleway). For XeTeX an adapter may conditionally omit inputenc/fontenc and use fontspec with audited existing Deedy Raleway files (carry their OFL notices) or an available TeX Raleway package. Do not silently change fonts then claim exact original fidelity. Add xeCJK and existing Fandol fallback separately for Chinese.

Other packages: xifthen, moresize, geometry, fancyhdr, multicol, multirow, array, graphicx, wrapfig, float, tikz (+ shapes/backgrounds/mindmap/trees libraries), color. Several are unused decorations but kept in original source. Requires more cache packages than Hunner. No active includegraphics calls. cvevent uses hard-coded 13.6cm + 3.9cm columns plus tabular padding, so may overflow the 18cm text width. Geometry has bottom=-.6cm and headheight=-5pt: test clipping/warnings and document any adapter correction. Body is a single flowing column; table title lines cannot break but event bullets are outside that table.

## Verification status

Sources and explicit license acquired from fixed raw GitHub URLs, per-file SHA256 and Git-object verification recorded in manifest.json. MINOS adapter verified synthetic Chinese PDF compilation with Tectonic 0.17.0 using only the bundled offline cache. Adapter uses Latin Modern and Fandol instead of Raleway, removes unused TikZ libraries, expands already-escaped bullets directly instead of PGF foreach (so user commas stay text), sets bottom margin 1.5cm/headheight 14pt and relative title-column widths. Synthetic PDF and PNG are local adapted examples, not upstream originals. Extremely long user content still needs final PDF review. Preserve upstream archive unchanged; exported/generated entry should explain local adaptations.
