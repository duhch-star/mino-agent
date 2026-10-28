"""Offline compiler smoke test with synthetic Chinese only; no user documents."""
from pathlib import Path
import os, sys, tempfile

def verify(root, python=None):
    root=Path(root).resolve()
    exe=root/'tectonic.exe'
    if not exe.is_file() or not (root/'cache/bundles').is_dir():
        raise RuntimeError('Bundled offline Tectonic runtime is incomplete')
    import subprocess
    env=os.environ.copy()
    env['RESUME_XELATEX']=str(exe)
    env['MINOS_LATEX_CACHE']=str(root/'cache')
    env.pop('MINOS_APP_ROOT',None)
    # Explicit only-cached in compile_pdf prevents network fallback.
    script="""
import sys
sys.path.insert(0,sys.argv[1])
from app.resume_schemas import Resume,Section
from app.services.resume_service import render,compile_pdf
r=Resume(name='离线中文测试',contact='test@example.invalid',summary='仅用于安装包验证，不是个人经历。',sections=[Section(title='教育经历',items=['待填写真实信息'])])
for template in ['classic','sidebar']:
 pdf,warnings=compile_pdf(render(r,template),template)
 assert pdf.startswith(b'%PDF-') and len(pdf)>1000
 import pypdfium2 as pdfium
 doc=pdfium.PdfDocument(pdf)
 assert len(doc)>=1
 doc.close()
 print(template,'offline Chinese compile/render PASS',len(pdf),flush=True)
"""
    backend=Path(__file__).resolve().parent.parent/'backend'
    subprocess.run([str(python or sys.executable),'-c',script,str(backend)],env=env,check=True,timeout=180)

if __name__=='__main__':
    verify(sys.argv[1] if len(sys.argv)>1 else Path(__file__).resolve().parent.parent/'.runtime/packaging/latex',sys.argv[2] if len(sys.argv)>2 else None)
