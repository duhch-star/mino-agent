"""Fail packaging before staging if embedded parsing modules/native DLLs are absent."""
from pathlib import Path
import subprocess
import sys

MODULES = ('pdfplumber', 'pypdf', 'docx', 'olefile', 'lxml.etree')


def verify(python: Path):
    # Actual imports (not find_spec) detect missing transitive/native dependencies.
    code = 'import importlib; ' + '; '.join(f'importlib.import_module({name!r})' for name in MODULES)
    subprocess.run([str(python), '-I', '-c', code], check=True)


if __name__ == '__main__':
    verify(Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / '.runtime/packaging/python/python.exe')
    print('Embedded PDF/DOCX/DOC parser imports verified')
