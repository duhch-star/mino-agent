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


# Additional upstream templates use a clearly labelled synthetic adapted preview.
for _id, _name, _source, _commit, _layout, _path in [
    ('mcdowell', 'McDowell · 紧凑履历', 'dnl-blkv/mcdowell-cv', 'b7e2d271c64814ee02b3505b191389c8df614035', '居中姓名 · 三列履历标题 · 紧凑分节', 'McDowell_CV_Template.tex'),
    ('hunner', 'Trey Hunner · 分节单栏', 'treyhunner/resume', '7f889bfe6f7c1116cb8bd3cabbdabe7fb4b99ae3', '居中姓名 · 横线章节 · 缩进条目', 'resume.tex'),
    ('minimal', 'latexcv Classic · 蓝色极简', 'jankapunkt/latexcv', '1fc7a2033ddda0fa77003444cafcf96117ad58dd', 'A4 单栏 · 蓝色居中章节 · 日期右对齐', 'classic/main.tex'),
]:
    _adaptation = '保留上游版式命令，填充用户纯文本；使用免费字体和 Fandol 中文回退。预览为 MINOS 合成示例，不是上游作者原始 PDF。'
    TEMPLATES.append({'id': _id, 'name': _name, 'description': _layout, 'source': 'https://github.com/'+_source, 'license': 'MIT', 'upstream': _commit, 'adaptation': _adaptation})
    TEMPLATE_DETAILS[_id] = {'title': _name, 'author': _source.split('/')[0], 'authorUrl': 'https://github.com/'+_source.split('/')[0],
        'overview': _layout, 'tags': ['单栏', '中文适配', 'MIT'], 'layout': _layout,
        'fontInfo': '免费字体 + Fandol 中文回退；不依赖商业系统字体。', 'compilerInfo': 'MINOS 内置 Tectonic / XeLaTeX。',
        'features': [_layout, '支持教育、项目、工作、技能等自定义章节'], 'sections': ['自定义章节'],
        'limitations': ['合成预览仅供版式参考，不会保存为个人履历。', '字体及中文适配与上游英文效果不同，请检查最终 PDF。'],
        'adaptation': _adaptation, 'sourcePath': _path,
        'files': {'preview': ('preview.png', 'image/png'), 'original.pdf': ('example.pdf', 'application/pdf'), 'readme': ('README.md', 'text/plain; charset=utf-8'), 'license': ('LICENSE', 'text/plain; charset=utf-8')}}


for _id, _name, _repo, _commit, _pdf, _entry in [
    ('awesome', 'Awesome-CV · 完整图标版', 'posquit0/Awesome-CV', 'add5bc0473b6fe385e1b46e09a8d3e9c55387d67', 'examples/resume.pdf', 'examples/resume.tex'),
    ('fortyseconds', 'FortySecondsCV · 完整侧栏版', 'PandaScience/FortySecondsCV', '3cb0951560209cbb06ec7f8605c7f05329442ecb', 'previews/upstream-template.pdf', 'template.tex'),
]:
    TEMPLATES.append({'id': _id, 'name': _name, 'description': '上游完整版类文件、全部图标与资源，不删除组件。', 'source': 'https://github.com/'+_repo, 'license': 'LPPL-1.3c / CC-BY-SA-4.0' if _id=='awesome' else 'BSD-Source-Code', 'upstream': _commit, 'adaptation': '原类不改；个人简历仅填入用户提供信息、加入中文回退，不导入作者身份。'})
    TEMPLATE_DETAILS[_id] = {'title': _name, 'author': _repo.split('/')[0], 'authorUrl': 'https://github.com/'+_repo, 'overview': '完整上游开源模板，包括图标字体、图片、示例及许可证。', 'tags': ['完整资源', '图标', '中文回退'], 'layout': '上游原版布局', 'fontInfo': '完整 FontAwesome5 图标与上游免费字体；随离线环境打包。', 'compilerInfo': 'Tectonic / XeLaTeX（固定兼容上游版本）', 'features': ['保留图标字体与类命令', '保留完整上游示例和资源'], 'sections': ['用户自定义章节'], 'limitations': ['原例作者身份不属于用户；只有用户提供的联系方式会写入个人简历。', '个人中文回退与上游英文效果可能不同；不会删除图标来规避错误。'], 'adaptation': '上游原类与图标不修改；只填入用户数据并加入 Fandol 中文回退。', 'sourcePath': _entry, 'files': {'preview': ('preview.png', 'image/png'), 'original.pdf': (_pdf, 'application/pdf'), 'readme': ('README.md', 'text/plain; charset=utf-8'), 'license': ('LICENCE' if _id=='awesome' else 'LICENSE', 'text/plain; charset=utf-8')}}


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
    folder = {'classic': 'sb2nov', 'sidebar': 'deedy'}.get(template, template)
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


def _render_additional(resume, template):
    e = escape
    if template == 'minimal':
        pre = (TEMPLATE_ROOT/'minimal/main.tex').read_text(encoding='utf-8').split(r'\begin{document}', 1)[0]
        pre = pre.replace(r'\usepackage[utf8]{inputenc}', '').replace(r'\usepackage[T1]{fontenc}', '')
        pre = pre.replace(r'\usepackage[default]{raleway}', r'\usepackage{fontspec}\setsansfont{lmroman10-regular.otf}')
        pre = pre.replace('bottom=-.6cm', 'bottom=1.5cm').replace(r'\setlength{\headheight}{-5pt}', r'\setlength{\headheight}{14pt}')
        pre = pre.replace('p{13.6cm}  x{3.9cm}', r'p{0.70\textwidth} x{0.23\textwidth}')
        # The selected Classic layout does not use the optional arrow graphics.
        # Remove unused TikZ libraries and serialize bullets directly (user commas
        # must not become PGF list separators).
        import re
        pre = re.sub(r'\\usepackage\{tikz\}', '', pre)
        pre = re.sub(r'\\usetikzlibrary\{[^}]*\}', '', pre)
        pre = re.sub(r'\\foreach \\desc in \{#4\}\{.*?\n\s*\}', lambda _: '#4', pre, flags=re.DOTALL)
        out = pre + CJK + '\n\\begin{document}\n\\pagestyle{empty}\n'
        out += r'\begin{center}{\Huge\textbf{' + e(resume.name or '姓名') + '}}\\\\[8pt]' + e(resume.contact) + '\n\\end{center}\n'
    else:
        cls = 'resume' if template == 'hunner' else 'mcdowellcv'
        out = '\\documentclass{' + cls + '}\n' + CJK
        if template == 'hunner':
            out += '\\usepackage[margin=0.65in]{geometry}\n'
        out += '\\name{' + e(resume.name or '姓名') + '}\n\\address{' + e(resume.contact) + '}\n\\begin{document}\n'
        if template == 'mcdowell':
            out += '\\makeheader\n'
    sections = list(resume.sections)
    if resume.summary:
        from app.resume_schemas import Section
        sections.insert(0, Section(title='个人简介', items=[resume.summary]))
    for section in sections:
        title = e(section.title)
        if template == 'minimal':
            out += '\\cvsection{' + title + '}\n'
            for entry in _entries(section):
                items = ''.join(r'$\cdot$ ' + e(i) + r'\\[3pt]' for i in entry.items)
                out += '\\cvevent' + ''.join('{' + v + '}' for v in [e(entry.dates), e(entry.heading), e(' · '.join(x for x in [entry.subtitle, entry.location] if x)), items]) + '\n'
            for item in section.items:
                out += e(item) + '\\par\n'
        elif template == 'hunner':
            out += '\\begin{rSection}{' + title + '}\n'
            for entry in _entries(section):
                # An empty list still needs an item; preserve standalone location.
                subtitle = entry.subtitle or (' ' if entry.location else '')
                out += '\\begin{rSubsection}' + ''.join('{' + e(x) + '}' for x in [entry.heading, entry.dates, subtitle, entry.location]) + '\n'
                out += ''.join('\\item ' + e(i) + '\n' for i in entry.items) if entry.items else '\\item[]\n'
                out += '\\end{rSubsection}\n'
            out += ''.join(e(i) + '\\par\n' for i in section.items) + '\\end{rSection}\n'
        else:
            out += '\\begin{cvsection}{' + title + '}\n'
            for entry in _entries(section):
                out += '\\begin{cvsubsection}[1]' + ''.join('{' + e(x) + '}' for x in [entry.subtitle, entry.heading, entry.dates]) + '\n'
                if entry.location:
                    out += e(entry.location) + '\\par\n'
                if entry.items:
                    out += '\\begin{itemize}\n' + ''.join('\\item ' + e(i) + '\n' for i in entry.items) + '\\end{itemize}\n'
                out += '\\end{cvsubsection}\n'
            out += ''.join(e(i) + '\\par\n' for i in section.items) + '\\end{cvsection}\n'
    return '% MINOS adapted upstream template; free fonts and CJK. User fields escaped.\n' + out + '\\end{document}\n'


def render(resume, template):
    template = normalize(template)
    if template in ('awesome', 'fortyseconds'):
        from app.services.resume_full_templates import render as render_full
        return render_full(resume, template)
    if template in ('hunner', 'mcdowell', 'minimal'):
        return _render_additional(resume, template)
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
    folder = TEMPLATE_ROOT / {'classic': 'sb2nov', 'sidebar': 'deedy'}.get(template, template)
    result = {p.relative_to(folder).as_posix(): p.read_bytes() for p in folder.rglob('*') if p.is_file()}
    if template == 'mcdowell':
        # Keep the archived upstream class intact; ship a labelled free-font copy.
        result['mcdowellcv.cls'] = result['mcdowellcv.cls'].replace(b'Times New Roman', b'lmroman10-regular.otf').replace(rb'\textls[110]{\textsc{\@name}}', rb'\textsc{\@name}')
    return result


def source_bundle(resume, template):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('resume.tex', render(resume, template))
        for name, content in assets(template).items():
            archive.writestr('upstream/' + name, (TEMPLATE_ROOT/'mcdowell'/name).read_bytes() if template == 'mcdowell' and name == 'mcdowellcv.cls' else content)
            if template in ('awesome', 'fortyseconds') or name.endswith('.cls') or name.startswith('fonts/'):
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
            if template in ('awesome', 'fortyseconds') or name.endswith('.cls') or name.startswith('fonts/'):
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
