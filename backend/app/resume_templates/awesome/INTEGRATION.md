# Awesome-CV — complete upstream distribution

- ID: `awesome`
- Upstream: https://github.com/posquit0/Awesome-CV/tree/add5bc0473b6fe385e1b46e09a8d3e9c55387d67
- Fixed commit: `add5bc0473b6fe385e1b46e09a8d3e9c55387d67` (XeTeX-compatible historical version).
- All 46 upstream archive files retained byte-for-byte, including every example, original PDF, image, and the archive representation of the symlink `examples/awesome-cv.cls`.
- Root class: `awesome-cv.cls`; original entries: `examples/resume.tex`, `examples/cv.tex`, `examples/coverletter.tex`.
- License: `LICENCE`, LPPL 1.3c. Font/icon dependencies preserve their own notices: FontAwesome5 TeX LPPL1.3c/fonts OFL1.1; Roboto license files in full package; Source Sans TeX LPPL1.3+/fonts OFL1.1.
- `dependencies/` contains complete official CTAN fontawesome5, roboto, sourcesans archives, not an icon-stripped subset. CTAN archives are content-pinned by SHA256 in `UPSTREAM-MANIFEST.json`; unlike the template source they are not Git commits. sourcesans is the current CTAN name and includes the sourcesanspro compatibility package.

## Integration macros

Preserve the upstream class. Use `\\name{first}{last}`, `\\position`, `\\address`, `\\mobile`, `\\email`, `\\homepage`, `\\github`, `\\linkedin`; `\\makecvheader`; `\\cvsection`; `cventries` containing `\\cventry{position}{organization}{location}{dates}{description}`; `cvitems` containing normal items; `cvparagraph` for summaries; `cvskills`, `cvhonors` as documented by examples. Do not redefine/remove icon macros or replace fonts to avoid dependencies.

## Compile and preview provenance

XeLaTeX or LuaLaTeX. This fixed revision uses fontawesome5, roboto, sourcesanspro, unicode-math, tcolorbox and normal TeX Live dependencies. Latest upstream master as of acquisition instead requires LuaLaTeX/HarfBuzz/fontawesome6 and is NOT Tectonic compatible; that incompatible revision was deliberately not selected.

Tectonic 0.17.0 compiled the full unchanged upstream resume with an isolated cache. The ZIP represents the example class symlink as text `../awesome-cv.cls`; direct Windows compilation therefore errors unless link semantics are restored **only in a temporary compilation copy** or the main file is placed at project root with original relative inputs preserved. The archived file is intentionally unmodified.

The original committed `examples/resume.pdf` is the gallery source (3 pages); `preview.png` and `previews/page-N.png` are direct 1.6x PDFium renders of those complete pages, not synthetic substitutes. The local recompilation PDF/log are under `.runtime/template-acquisition/awesome-output/`. Tectonic emitted font-request and pre-existing over/underfull warnings, plus FontAwesome ToUnicode CMap warnings. Icons remain embedded/rendered; text extraction of icon codepoints is not guaranteed. `VERIFICATION.json` records embedded fonts and PDF hashes. Compilation cache was copied read-only from the existing cache to `.runtime/template-acquisition/seeded-cache`, then only that isolated copy was updated. Shared cache and stage were not modified.

## Integrity

`UPSTREAM-MANIFEST.json` lists every upstream file and full font/icon package file with byte length and SHA256. Its SHA256 is `3eddbfae28bcbe0251aeb83f45ab89782c2b57b805ba2f009ac474c71be41867`. Verification checked all 6639 tracked files. Local notes/verification/previews are separate additions, not passed off as upstream source.
