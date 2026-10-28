# FortySecondsCV — complete upstream distribution

- ID: `fortyseconds`
- Upstream: https://github.com/PandaScience/FortySecondsCV/tree/3cb0951560209cbb06ec7f8605c7f05329442ecb
- Fixed commit: `3cb0951560209cbb06ec7f8605c7f05329442ecb`.
- All 13 parent-repository archive files retained byte-for-byte, including `template.tex`, `fortysecondscv.cls`, original JPG previews, original XDV, all pictures/readmes/license.
- The Git submodule omitted by GitHub ZIP was explicitly resolved at the parent's gitlink commit: `gosquared/flags` `1d382a9ea87667ac59c493b8fd771f49ce837e6a`; all 8964 files preserved at `pics/gosquared-flags/`, including flags in every format/style and both licenses.
- Root entry: `template.tex`; class: `fortysecondscv.cls`.

## License accuracy

The actual source headers say SPDX `BSD-Source-Code`. The retained root `LICENSE` grants source redistribution and no-endorsement, with disclaimer (two numbered conditions); it is NOT standard BSD-3-Clause even though upstream README uses that label. Preserve the actual license text and attribution. GoSquared flags have their own MIT license. All bundled font/icon package notices are retained: FontAwesome5 TeX LPPL1.3c/fonts OFL1.1; Academicons notices in its full package; Clear Sans Apache2.0 font license and package notices.

## Dependencies

`dependencies/` contains complete official CTAN fontawesome5, academicons, clearsans packages (all sty, fonts, sources, docs and notices), not stripped icons. Their fetched archive bytes are content-pinned by SHA256 in the manifest; they are CTAN snapshots, not claimed to be fixed Git commits. General LaTeX dependencies remain the standard TeX/Tectonic bundle: tikz/pgf, smartdiagram, graphbox, xkeyval, xhfill, etc. No substitute/stub icons were created.

## Compile and macros

Use XeLaTeX or LuaLaTeX to retain FontAwesome5 AND Academicons. Do not use pdfLaTeX: upstream explicitly disables Academicons for it. Tectonic 0.17.0 (XeTeX) compiled the **complete original unmodified `template.tex`** including avatar, logos, four flags, diagrams, skill dots/bars, memberships, both sidebars and all text.

Suggested integration: `\\cvname`, `\\cvjobtitle`, `\\cvprofilepic`, `\\cvlogopic`, `\\cvbirthday`, `\\cvaddress`, `\\cvphone`, `\\cvmail`, `\\cvsite`, `\\cvcustomdata`; `\\addtofrontsidebar`, `\\addtobacksidebar`, `\\makefrontsidebar`, `\\makebacksidebar`; `\\sidesection`, `\\skill`, `\\pointskill`, `\\barskill`; body `\\cvsection`, `\\cvsubsection`, `cvtable` containing `\\cvitem{dates}{title}{location}{description}` and `\\cvpubitem`. Keep original class and layout; preserve all relative resources when copying into a temporary compilation workspace.

## Original-example PDF and preview provenance

Upstream did not commit a PDF at this revision. `previews/upstream-template.pdf` is the actual full original example compiled locally, not a synthetic approximation. Two pages, 411529 bytes, SHA256 `86b1a72fc68829f2b512097786a3cef9c0848a0728336b5882e41596ad97ef42`. `preview.png` and `previews/page-N.png` are direct 1.6x PDFium renders. All text, icons and images remain. FontAwesome5 Solid and Brands are embedded; pypdf verified 7 raster-image instances, including flags/pictures, and nonempty text on both pages. First-page visual inspection confirmed contact/social/skills icons and CN/DE/GB/FR flags.

Output/logs: `.runtime/template-acquisition/fortyseconds-output/`. Cache: `.runtime/template-acquisition/seeded-cache`; the original shared cache was read/copied, never modified. Tectonic warnings include requested-font chatter and FontAwesome ToUnicode CMap failures: these affect semantic extraction of icon codepoints, not icon rendering. Initial missing fontconfig default config warning did not prevent font embedding or PDF production. PowerShell reports native stderr as an error status even after PDF generation; inspect generated PDF and log rather than claiming no warnings. Cold cache needs network/general TeX packages; `--only-cached` requires the isolated warmed cache copied into packaging by the integrator.

## Integrity

`UPSTREAM-MANIFEST.json` records every parent source byte, the pinned flags submodule and complete CTAN dependency files with sizes/SHA256. Manifest SHA256: `27e1f560389542844d8cb2cf2fb5ee379a4bcdb897311032155de9748421f8f7`. All 9200 tracked files were verified. Preview files, verification report, and this note are clearly local additions, not purported original upstream files.
