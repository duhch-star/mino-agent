"""Structured resume rendering. User/LLM strings are always escaped, never executable TeX."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

TEMPLATES = [
 {'id':'classic','name':'经典单栏','description':'清晰分节、适合校招与通用岗位。独立中文适配版式。','source':'https://github.com/sb2nov/resume','license':'MIT','adaptation':'参考单栏信息层级，重新实现中文排版；非上游原版'},
 {'id':'technical','name':'紧凑技术型','description':'收紧段落间距，突出技术、项目与成果。','source':'https://github.com/sb2nov/resume','license':'MIT','adaptation':'同一参考来源的紧凑变体；非独立上游模板'},
 {'id':'sidebar','name':'双栏侧边栏','description':'左侧个人介绍，右侧教育与项目经历。','source':'https://github.com/deedy/Deedy-Resume','license':'Apache-2.0','adaptation':'参考双栏布局，重新实现中文排版；非上游原版'},
]

def escape(value):
    mapping={'\\':r'\textbackslash{}','{':r'\{','}':r'\}','$':r'\$','&':r'\&','#':r'\#','%':r'\%','_':r'\_','~':r'\textasciitilde{}','^':r'\textasciicircum{}'}
    return ''.join(mapping.get(c,c) for c in str(value)).replace('\n',r'\newline ')

def render(resume, template):
    if template not in {t['id'] for t in TEMPLATES}:
        raise ValueError('未知模板')
    compact=template=='technical'
    header=r'''\documentclass[10pt,a4paper,fontset=fandol]{ctexart}
\usepackage[margin=1.65cm]{geometry}
\usepackage{xcolor,enumitem,titlesec}
\pagestyle{empty}
\setlength{\parindent}{0pt}
\definecolor{accent}{HTML}{385C66}
\titleformat{\section}{\large\bfseries\color{accent}}{}{0em}{}[\titlerule]
\titlespacing*{\section}{0pt}{10pt}{5pt}
\setlist[itemize]{leftmargin=1.2em,topsep=3pt,itemsep=2pt,parsep=0pt}
\begin{document}
'''
    if compact:
        header+=r'\small\setlist[itemize]{itemsep=0pt,topsep=2pt}'+ '\n'
    intro=r'{\LARGE\bfseries '+escape(resume.name or '姓名')+r'}\par\vspace{5pt}'+escape(resume.contact)+r'\par'+'\n'
    summary=(r'\section*{个人简介}'+escape(resume.summary)+'\n') if resume.summary else ''
    sections=''
    for section in resume.sections:
        sections+=r'\section*{'+escape(section.title)+'}\n'
        if section.items:
            sections+=r'\begin{itemize}'+'\n'+''.join(r'\item '+escape(item)+'\n' for item in section.items)+r'\end{itemize}'+'\n'
    if template=='sidebar':
        # parboxes intentionally do not split across pages: compile diagnostics warn on overflow.
        body=intro+r'\vspace{10pt}\par\noindent\begin{minipage}[t]{0.27\textwidth}'+summary+r'\end{minipage}\hfill\begin{minipage}[t]{0.68\textwidth}'+sections+r'\end{minipage}'
    else:
        body=intro+summary+sections
    return '% Generated Chinese adaptation. References: sb2nov/resume (MIT), deedy/Deedy-Resume (Apache-2.0).\n'+header+body+'\n'+r'\end{document}'+'\n'

def compiler():
    configured=os.getenv('RESUME_XELATEX','')
    if configured and Path(configured).is_file(): return configured
    return shutil.which('xelatex') or (r'C:\texlive\2024\bin\windows\xelatex.exe' if Path(r'C:\texlive\2024\bin\windows\xelatex.exe').is_file() else None)

def compile_pdf(source):
    executable=compiler()
    if not executable: raise RuntimeError('未找到 XeLaTeX；可先导出 .tex，在安装 TeX Live 后编译')
    with tempfile.TemporaryDirectory(prefix='mino-resume-') as directory:
        root=Path(directory)
        (root/'resume.tex').write_text(source,encoding='utf-8')
        env=os.environ.copy()
        env.update({'openin_any':'p','openout_any':'p'})
        result=subprocess.run([executable,'-no-shell-escape','-interaction=nonstopmode','-halt-on-error','-output-directory',directory,'resume.tex'],cwd=directory,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=35)
        log=result.stdout.decode('utf-8',errors='replace')
        if result.returncode or not (root/'resume.pdf').is_file():
            raise RuntimeError('LaTeX 编译失败，请缩短内容或切换模板；'+log[-600:])
        warnings=[]
        if 'Overfull' in log: warnings.append('存在排版溢出，请检查 PDF，缩短内容或换用单栏模板。')
        return (root/'resume.pdf').read_bytes(), warnings
