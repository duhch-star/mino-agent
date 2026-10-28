# Bundled offline resume compiler

Windows installers include Tectonic 0.17.0 (XeTeX-compatible) and an offline cache of distribution resources required by the five shipped resume templates, including xeCJK and Fandol Chinese fonts. Users do not need to install a TeX distribution or download packages on first compile. This is a bounded template runtime, not a complete arbitrary-LaTeX installation.

Provisioning inputs (generated files remain ignored):

- `.runtime/packaging/latex/tectonic.exe`: official Windows Tectonic 0.17.0 distribution.
- `.runtime/packaging/latex/cache`: cached distribution resources from Tectonic `default_bundle_v33`, not user `.tex`, `.pdf`, resume data, logs or credentials.
- Tectonic MIT license, TeX Live distribution license and LPPL notices accompany the runtime.
- Upstream class and Lato/Raleway fonts retain their existing notices in the backend template directories.

Source/provenance:

- https://github.com/tectonic-typesetting/tectonic/releases/tag/tectonic%400.17.0
- https://relay.fullyjustified.net/default_bundle_v33.tar
- https://www.tug.org/texlive/LICENSE.TL
- https://www.latex-project.org/lppl/lppl-1-3c.txt

Before staging, `verify_latex_runtime.py` uses embedded Python to compile all five templates with synthetic Chinese, then opens each resulting PDF with PDFium. Compilation uses `--only-cached --untrusted`, with no shell escape or online fallback. A missing resource fails packaging rather than shipping a broken compiler.

Desktop startup merges only the immutable distribution cache into a private user-data runtime cache, leaving installed resources read-only. The compiler environment uses that explicit cache, so a developer's global Tectonic cache is not needed. The backend locates the executable beneath `MINOS_APP_ROOT/runtime/latex`.

A compile operates on the current document revision. It updates the derived PDF cache, not the resume text, template, or revision. Failed compile errors distinguish missing compiler, timeout and a bounded TeX diagnostic; raw logs/source/path contents are not returned to chat.
