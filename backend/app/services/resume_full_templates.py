"""Fill upstream full template classes; never remove icon/font definitions or mutate archives."""
from pathlib import Path

def render(resume, template):
    from app.services.resume_service import escape as e,CJK
    if template=='awesome':
        out=r'''\documentclass[11pt,a4paper]{awesome-cv}
\geometry{left=1.4cm,top=.8cm,right=1.4cm,bottom=1.8cm,footskip=.5cm}
\colorlet{awesome}{awesome-red}
\setbool{acvSectionColorHighlight}{true}
'''+CJK+'\\name{'+e(resume.name or '姓名')+'}{}\n'
        # Contact is already plain text; do not guess email/phone/social identities.
        # Upstream custom social-information hook retains a real icon while
        # displaying exactly the contact supplied by the user.
        if resume.contact:
            out+='\\extrainfo{\\faAddressCard\\space '+e(resume.contact)+'}\n'
        out+='\\begin{document}\n\\makecvheader[C]\n'
        if resume.summary:out+='\\cvsection{个人简介}\n\\begin{cvparagraph}\n'+e(resume.summary)+'\n\\end{cvparagraph}\n'
        for section in resume.sections:
            out+='\\cvsection{'+e(section.title)+r'\relax\relax\relax'+'}\n'
            if section.entries:
                out+='\\begin{cventries}\n'
                for entry in section.entries:
                    bullets='\\begin{cvitems}\n'+''.join('\\item {'+e(i)+'}\n' for i in entry.items)+'\\end{cvitems}' if entry.items else ''
                    out+='\\cventry'+''.join('{'+x+'}' for x in [e(entry.subtitle),e(entry.heading),e(entry.location),e(entry.dates),bullets])+'\n'
                out+='\\end{cventries}\n'
            if section.items:out+='\\begin{cvparagraph}\n'+''.join(e(i)+'\\par\n' for i in section.items)+'\\end{cvparagraph}\n'
    else:
        out=r'''\documentclass[a4paper]{fortysecondscv}
\usepackage[sfdefault]{ClearSans}
'''+CJK+'\\cvname{'+e(resume.name or '姓名')+'}\n'
        out+='\\cvjobtitle{}\n'
        if resume.contact:out+='\\cvcustomdata{\\faAddressCard}{'+e(resume.contact)+'}\n'
        left=[];right=[]
        for section in resume.sections:
            isleft=section.column=='left' or (section.column=='auto' and any(x in section.title.lower() for x in ['技能','教育','语言','skills','education','language']))
            (left if isleft else right).append(section)
        out+='\\addtofrontsidebar{\n'
        if resume.summary:out+='\\sidesection{个人简介}\n'+e(resume.summary)+'\\par\n'
        for section in left:
            out+='\\sidesection{'+e(section.title)+'}\n'
            for entry in section.entries:
                out+='\\textbf{'+e(entry.heading)+'}\\par\n'+e(' · '.join(x for x in [entry.subtitle,entry.dates,entry.location] if x))+'\\par\n'
                out+=''.join(e(i)+'\\par\n' for i in entry.items)
            out+=''.join(e(i)+'\\par\n' for i in section.items)
        out+='}\n\\begin{document}\n\\makefrontsidebar\n'
        for section in right:
            out+='\\cvsection{'+e(section.title)+r'\relax\relax\relax'+'}\n'
            if section.entries:
                out+='\\begin{cvtable}[1.5]\n'
                for entry in section.entries:
                    detail=e(' · '.join(x for x in [entry.subtitle, *entry.items] if x))
                    out+='\\cvitem'+''.join('{'+x+'}' for x in [e(entry.dates),e(entry.heading),e(entry.location),detail])+'\n'
                out+='\\end{cvtable}\n'
            out+=''.join(e(i)+'\\par\n' for i in section.items)
    return '% MINOS: upstream class and icons unchanged; user text filled, CJK added.\n'+out+'\\end{document}\n'
