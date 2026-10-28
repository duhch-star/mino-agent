"""Render real upstream templates; only data and explicit XeTeX/CJK bridges change."""
import io
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

from app.core.config import settings
from app.core.paths import resource_path

TEMPLATE_ROOT = resource_path('resume_templates')
TEMPLATES = [
    {'id': 'classic', 'name': 'Sourabh Bajaj · 原版单栏', 'description': '直接使用 sb2nov/resume 原模板的页边距、横线标题与履历命令。', 'source': 'https://github.com/sb2nov/resume', 'license': 'MIT', 'adaptation': '保留上游导言与命令；仅将 pdfTeX 专用指令改为条件执行，加入中文字体支持并填充个人内容。', 'upstream': '7b70fe14876f97180034787f2a7f661597416a17'},
    {'id': 'sidebar', 'name': 'Deedy · 原版 OpenFonts 双栏', 'description': '直接加载官方 class、Lato / Raleway 原字体及 0.33 / 0.66 双栏结构。', 'source': 'https://github.com/deedy/Deedy-Resume', 'license': 'Apache-2.0', 'adaptation': '原 class 与拉丁字体不修改；仅加入中文回退字体、填充内容。中文标题不等同于原英文字形。', 'upstream': '6d06ba7d8eee5fb8870bb00cb13a777f2083aa18'},
]


TEMPLATE_DETAILS = {
    'classic': {
        'title': 'Software Engineer Resume', 'author': 'Sourabh Bajaj',
        'authorUrl': 'https://sourabhbajaj.com/',
        'overview': '作者为软件开发者设计的单页单栏简历。项目起因是 Google Docs 中反复维护格式较困难，因此使用基础 LaTeX 模板、字体及自定义命令统一格式；主要组织教育、工作和项目经历。',
        'tags': ['单栏', '软件开发', '单页设计', 'MIT'],
        'layout': 'Letter 纸张 · 11pt · 单栏 · 横线分节 · 左右对齐履历标题',
        'fontInfo': '上游使用基础 LaTeX 字体，无专用商业字体依赖；本机中文回退使用 Fandol。',
        'compilerInfo': '上游使用 pdfLaTeX；本机为中文加入 XeTeX 兼容，可用 XeLaTeX / Tectonic。',
        'features': ['原版横线章节标题与紧凑留白', '机构、地点、职位与时间按左右对齐排列', '自定义 resumeSubheading / resumeItem 等命令统一格式', '单栏信息顺序，面向软件开发者的教育、经历与项目展示'],
        'sections': ['Education / 教育经历', 'Experience / 工作经历', 'Projects / 项目经历', 'Skills / 技能（原源码提供可选区块）'],
        'limitations': ['单页是原设计目标，不代表任意长度内容都会自动压缩为一页。', '原版示例中的作者履历属于作者个人数据，不会自动导入用户简历。', '版式许可不等于作者个人信息可自由复用；不承诺所有招聘系统都能正确解析。'],
        'adaptation': '直接读取原导言与命令，保留 Letter / 11pt、页边距、横线标题与原两行 tabular 页眉，不引入固定宽度 minipage。联系方式的显式换行填入原右侧两行；过长内容仍可能溢出。pdfTeX 专有指令改为条件执行，加入中文字体回退。替换个人内容，不复用作者经历。',
        'files': {'preview': ('resume_preview.png', 'image/png'), 'original.pdf': ('sourabh_bajaj_resume.pdf', 'application/pdf'), 'readme': ('UPSTREAM-README.md', 'text/plain; charset=utf-8'), 'license': ('LICENSE', 'text/plain; charset=utf-8')},
        'sourcePath': 'sourabh_bajaj_resume.tex',
    },
    'sidebar': {
        'title': 'Deedy Resume · OpenFonts v1.2', 'author': 'Debarghya Das',
        'authorUrl': 'https://debarghyadas.com/',
        'overview': '原作者面向计算机专业本科生设计的单页、非对称双栏 XeTeX 简历。目标是在一页内清晰展示细节；OpenFonts 分支使用自由开源的 Lato 与 Raleway 字体，区别于依赖 macOS 字体的 MacFonts 分支。',
        'tags': ['非对称双栏', '计算机专业', 'OpenFonts', 'Apache-2.0'],
        'layout': '单页 · 左栏 0.33 / 右栏 0.66 · 大号姓名 · 灰阶标题与顶部细线',
        'fontInfo': '完整保留上游 Lato / Raleway 共 19 个字体文件，字体许可为 SIL OFL 1.1；中文使用 Fandol 回退。',
        'compilerInfo': '上游要求 XeTeX / XeLaTeX；原论文引用区块需要 BibTeX。本机用户简历不自动带入作者论文。',
        'features': ['原 class 定义大号姓名、分节字号、颜色与间距', '左侧教育、链接、课程和技能；右侧经历与研究', '官方 OpenFonts 字体随源码包分发', '保留 namesection / runsubsection / descript / location / tightemize 命令'],
        'sections': ['Education / 教育', 'Links / 链接', 'Coursework / 课程', 'Skills / 技能', 'Experience / 工作经历', 'Research / 研究', 'Publications / 论文', 'Awards / 奖项', 'Societies / 社团'],
        'limitations': ['原双栏 minipage 不擅长自动跨页，某栏超高可能溢出，建议控制在一页。', '原字体不含中文字形，中文回退不代表与原英文字形完全一致。', '上游列出的已知问题包括长栏溢出、首条列表间距；请以自己的编译 PDF 检查。'],
        'adaptation': '原类文件与 Lato / Raleway 字体保持原样，直接读取原入口导言并保留 0.33 / 0.66 双栏。仅增加中文回退与结构化内容填充，原示例个人履历不导入用户数据。',
        'files': {'preview': ('sample-image.png', 'image/png'), 'original.pdf': ('deedy_resume-openfont.pdf', 'application/pdf'), 'readme': ('UPSTREAM-README.md', 'text/plain; charset=utf-8'), 'license': ('LICENSE', 'text/plain; charset=utf-8')},
        'sourcePath': 'OpenFonts/deedy_resume-openfont.xtx',
    },
}


def template_catalog():
    items = []
    for template in TEMPLATES:
        info = TEMPLATE_DETAILS[template['id']]
        item = {**template, **{k: v for k, v in info.items() if k not in ('files', 'sourcePath')}}
        base = f"/api/resume/templates/{template['id']}"
        item.update(previewUrl=base+'/preview', originalPdfUrl=base+'/original.pdf', readmeUrl=base+'/readme', licenseUrl=base+'/license',
                    commitUrl=template['source']+'/tree/'+template['upstream'],
                    sourceFileUrl=template['source']+'/blob/'+template['upstream']+'/'+info['sourcePath'])
        items.append(item)
    return items


def template_resource(template, kind):
    # Fixed allowlist: never accept a filesystem path from this endpoint.
    if template not in TEMPLATE_DETAILS or kind not in TEMPLATE_DETAILS[template]['files']:
        raise ValueError('未知模板资源')
    filename, mime = TEMPLATE_DETAILS[template]['files'][kind]
    folder = 'sb2nov' if template == 'classic' else 'deedy'
    return TEMPLATE_ROOT / folder / filename, mime


def escape(value):
    mapping = {'\\': r'\textbackslash{}', '{': r'\{', '}': r'\}', '$': r'\$', '&': r'\&', '#': r'\#', '%': r'\%', '_': r'\_', '~': r'\textasciitilde{}', '^': r'\textasciicircum{}'}
    value = ''.join(c for c in str(value) if ord(c) >= 32 or c in '\n\t')
    return ''.join(mapping.get(c, c) for c in value).replace('\n', r'\newline ')


def normalize(template):
    # Old saved selections keep working but are no longer advertised as another template.
    if template == 'technical':
        template = 'classic'
    if template not in {t['id'] for t in TEMPLATES}:
        raise ValueError('未知模板')
    return template


CJK = '\n% MINOS compatibility addition: XeTeX Chinese fallback only, upstream layout unchanged.\n' + r'''\usepackage{xeCJK}
\setCJKmainfont{FandolSong-Regular.otf}[BoldFont=FandolSong-Bold.otf,ItalicFont=FandolKai-Regular.otf]
\setCJKsansfont{FandolHei-Regular.otf}[BoldFont=FandolHei-Bold.otf]
\setCJKmonofont{FandolFang-Regular.otf}
'''


def _entries(section):
    return getattr(section, 'entries', []) or []


def _classic_section(section):
    out = '\\section{' + escape(section.title) + '}\n'
    if _entries(section):
        out += '\\resumeSubHeadingListStart\n'
        for entry in _entries(section):
            out += r'\resumeSubheading' + ''.join('{' + escape(v) + '}' for v in [entry.heading, entry.location, entry.subtitle, entry.dates]) + '\n'
            if entry.items:
                out += '\\resumeItemListStart\n' + ''.join(r'\resumeItemPlain{' + escape(i) + '}\n' for i in entry.items) + '\\resumeItemListEnd\n'
        out += '\\resumeSubHeadingListEnd\n'
    if section.items:
        out += '\\resumeSubHeadingListStart\n' + ''.join(r'\resumeItemPlain{' + escape(i) + '}\n' for i in section.items) + '\\resumeSubHeadingListEnd\n'
    return out


def _deedy_section(section, *, left_column=False):
    out = '\\section{' + escape(section.title) + '}\n'
    for entry in _entries(section):
        # Upstream left-column institutions use subsection, not the inline
        # runsubsection used for employers in the right column.
        command = '\\subsection{' if left_column else '\\runsubsection{'
        out += command + escape(entry.heading) + '}\n'
        if entry.subtitle:
            descriptor = entry.subtitle if left_column else '| ' + entry.subtitle
            out += '\\descript{' + escape(descriptor) + '}\n'
        if entry.dates or entry.location:
            out += '\\location{' + escape(' | '.join(v for v in [entry.dates, entry.location] if v)) + '}\n'
        if entry.items:
            out += '\\vspace{\\topsep}\n\\begin{tightemize}\n' + ''.join('\\item ' + escape(i) + '\n' for i in entry.items) + '\\end{tightemize}\n'
        out += '\\sectionsep\n'
    if section.items:
        out += '\\vspace{\\topsep}\n\\begin{tightemize}\n' + ''.join('\\item ' + escape(i) + '\n' for i in section.items) + '\\end{tightemize}\n'
    return out + '\\sectionsep\n'


def render(resume, template):
    template = normalize(template)
    if template == 'classic':
        original = (TEMPLATE_ROOT / 'sb2nov/sourabh_bajaj_resume.tex').read_text(encoding='utf-8')
        preamble = original.split(r'\begin{document}', 1)[0]
        preamble = preamble.replace(r'\input{glyphtounicode}', r'\ifdefined\pdfgentounicode\input{glyphtounicode}\fi')
        preamble = preamble.replace(r'\pdfgentounicode=1', r'\ifdefined\pdfgentounicode\pdfgentounicode=1\fi')
        license_text = (TEMPLATE_ROOT / 'sb2nov/LICENSE').read_text(encoding='utf-8')
        out = ''.join('% ' + line + '\n' for line in license_text.splitlines())
        out += '% MINOS modification: content replacement and XeTeX/CJK compatibility; upstream layout/macros retained.\n'
        out += preamble + CJK + '\\begin{document}\n'
        # Preserve the upstream two-row, natural-width tabular geometry. Contact
        # is plain text: explicit newlines select its two original right cells;
        # do not infer personal fields or introduce a different wrapping layout.
        contacts = str(resume.contact or '').splitlines()
        first = contacts[0] if contacts else ''
        second = ' | '.join(contacts[1:])
        out += r'\begin{tabular*}{\textwidth}{l@{\extracolsep{\fill}}r}' + '\n'
        out += r'  \textbf{\Large ' + escape(resume.name or '姓名') + '} & ' + escape(first) + r'\\' + '\n'
        out += '   & ' + escape(second) + r' \\' + '\n\\end{tabular*}\n'
        if resume.summary:
            out += '\\section{个人简介}\n' + escape(resume.summary) + '\n'
        out += ''.join(_classic_section(section) for section in resume.sections)
        return out + '\\end{document}\n'
    original = (TEMPLATE_ROOT / 'deedy/deedy_resume-openfont.tex').read_text(encoding='utf-8')
    preamble = original.split(r'\begin{document}', 1)[0]
    out = '% MINOS modification: replace personal data; add CJK fallback. Original class/fonts unchanged.\n' + preamble + CJK + '\\begin{document}\n\\lastupdated\n'
    out += '\\namesection{' + escape(resume.name or '姓名') + '}{}{' + escape(resume.contact) + '}\n'
    left, right = [], []
    for index, section in enumerate(resume.sections):
        column = getattr(section, 'column', 'auto')
        on_left = column == 'left' or (column == 'auto' and any(k in section.title.casefold() for k in ['教育', '技能', '课程', '链接', 'education', 'skills', 'coursework', 'links']))
        (left if on_left else right).append(section)
    out += '\\begin{minipage}[t]{0.33\\textwidth}\n'
    if resume.summary:
        out += '\\section{个人简介}\n' + escape(resume.summary) + '\n\\sectionsep\n'
    out += ''.join(_deedy_section(s, left_column=True) for s in left)
    out += '\\end{minipage}\n\\hfill\n\\begin{minipage}[t]{0.66\\textwidth}\n'
    out += ''.join(_deedy_section(s) for s in right)
    return out + '\\end{minipage}\n\\end{document}\n'


def assets(template):
    template = normalize(template)
    folder = TEMPLATE_ROOT / ('deedy' if template == 'sidebar' else 'sb2nov')
    return {p.relative_to(folder).as_posix(): p.read_bytes() for p in folder.rglob('*') if p.is_file()}


def source_bundle(resume, template):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('resume.tex', render(resume, template))
        for name, content in assets(template).items():
            archive.writestr('upstream/' + name, content)
            if name == 'deedy-resume-openfont.cls' or name.startswith('fonts/'):
                archive.writestr(name, content)
        archive.writestr('BUILD.txt', 'Compile resume.tex with XeLaTeX (TeX Live with xeCJK + Fandol).\nKeep bundled class, fonts and licenses with this source.\nMINOS only fills content and adds Chinese fallback; upstream layout retained.\n')
    return buffer.getvalue()


def compiler():
    app_root = os.getenv('MINOS_APP_ROOT')
    if app_root:
        bundled = Path(app_root) / 'runtime/latex/tectonic.exe'
        if bundled.is_file():
            return str(bundled)
    configured = os.getenv('RESUME_XELATEX', settings.resume_xelatex)
    if configured and Path(configured).is_file():
        return configured
    xelatex = shutil.which('xelatex')
    if xelatex:
        return xelatex
    portable = TEMPLATE_ROOT.parents[2] / '.runtime/tools/tectonic/tectonic.exe'
    return str(portable) if portable.is_file() else shutil.which('tectonic')


def compile_pdf(source, template='classic'):
    executable = compiler()
    if not executable:
        raise RuntimeError('未找到 XeLaTeX / Tectonic')
    with tempfile.TemporaryDirectory(prefix='mino-resume-') as directory:
        root = Path(directory)
        (root / 'resume.tex').write_text(source, encoding='utf-8')
        for name, content in assets(template).items():
            if name == 'deedy-resume-openfont.cls' or name.startswith('fonts/'):
                dest = root / name
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(content)
        env = os.environ.copy()
        env.update({'openin_any': 'p', 'openout_any': 'p'})
        if 'tectonic' in Path(executable).name.lower():
            bundled_cache = Path(executable).parent / 'cache'
            cache = os.getenv('MINOS_LATEX_CACHE')
            if cache:
                env['TECTONIC_CACHE_DIR'] = cache
            elif bundled_cache.is_dir():
                env['TECTONIC_CACHE_DIR'] = str(bundled_cache)
            command = [executable, '--untrusted', '--keep-logs', '--keep-intermediates', '--outdir', directory, 'resume.tex']
            if cache or bundled_cache.is_dir():
                command.insert(1, '--only-cached')
        else:
            command = [executable, '-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', '-output-directory', directory, 'resume.tex']
        result = subprocess.run(command, cwd=directory, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=90)
        log = result.stdout.decode('utf-8', errors='replace')
        if (root / 'resume.log').is_file():
            log += (root / 'resume.log').read_text(encoding='utf-8', errors='replace')
        if result.returncode or not (root / 'resume.pdf').is_file():
            raise RuntimeError('LaTeX 编译失败；' + log[-1000:])
        warnings = []
        for marker, message in [('Overfull', '存在排版溢出，请缩短内容或切换单栏。'), ('Missing character', '存在缺失字形，请检查 PDF 字体。')]:
            if marker in log:
                warnings.append(message)
        return (root / 'resume.pdf').read_bytes(), warnings
