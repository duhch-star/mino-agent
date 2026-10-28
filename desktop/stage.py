"""Stage explicit runtime allowlists: never copy the developer database or .env."""
from pathlib import Path
import shutil, json, subprocess
ROOT = Path(__file__).resolve().parent.parent
STAGE = ROOT / 'dist/windows/app'
# Recreate only this verified generated staging directory; never mutate the checkout.
assert STAGE.resolve() == (ROOT / 'dist/windows/app').resolve()
if STAGE.exists(): shutil.rmtree(STAGE)
STAGE.mkdir(parents=True, exist_ok=True)
def copy(source, target, ignore=None):
    if source.is_dir(): shutil.copytree(source, target, dirs_exist_ok=True, ignore=ignore)
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
def excluded(directory, names):
    return [n for n in names if n in {'__pycache__','.pytest_cache','.git','.cache','uploads','workspaces','.env'} or n.startswith('.env.') or n.endswith(('.pyc','.db','.sqlite','.sqlite3','.log'))]
copy(ROOT/'.runtime/packaging/python', STAGE/'runtime/python', excluded)
copy(Path(shutil.which('node')), STAGE/'runtime/node/node.exe')
copy(ROOT/'backend/app', STAGE/'backend/app', excluded)
for name in ['package.json','package-lock.json','tsconfig.json','LICENSE']:
    p=ROOT/'pi-web'/name
    if p.exists(): copy(p,STAGE/'pi-web'/name)
# Keep only production dependency closure; compiled UI libraries are bundled in .next.
lock=json.loads((ROOT/'pi-web/package-lock.json').read_text(encoding='utf-8'))
production={key.removeprefix('node_modules/') for key,value in lock['packages'].items() if key.startswith('node_modules/') and not value.get('dev',False)}
modules=ROOT/'pi-web/node_modules'
for relative in sorted(production,key=lambda x:(x.count('/'),x)):
    source=modules/relative
    if source.is_dir(): copy(source,STAGE/'pi-web/node_modules'/relative, lambda d,n: [x for x in n if x in {'node_modules', '.git', '__pycache__'}])
for name in ['.next','public']:
    copy(ROOT/'pi-web'/name,STAGE/'pi-web'/name, (lambda d,n: list(set(excluded(d,n) + [x for x in n if x in {'cache','dev'}]))) if name == '.next' else excluded)
# Production does not need TypeScript config transpilation or webpack loader source.
(STAGE/'pi-web/next.config.js').write_text("module.exports={images:{unoptimized:true},experimental:{proxyClientMaxBodySize:'128mb'}};\n",encoding='utf-8')
# Third-party licenses shipped alongside their original distributions.
license_path=ROOT/'.runtime/packaging/node-LICENSE'
if license_path.exists(): copy(license_path, STAGE/'runtime/node/LICENSE')
# Keep runtime SDK templates but never carry dev account material.
(STAGE/'runtime/python/python312._pth').write_text('python312.zip\n.\nLib\\site-packages\n..\\..\\backend\nimport site\n',encoding='ascii')
(STAGE/'BUILD.json').write_text(json.dumps({'product':'MINOS','version':'1.0.0','platform':'win-x64','node':subprocess.check_output(['node','-v'],text=True).strip(),'python':'3.12.10'},indent=2),encoding='utf8')
for p in STAGE.rglob('*'):
    if p.is_file() and (p.name == '.env' or p.suffix in {'.db','.sqlite','.sqlite3'}): raise RuntimeError('Private data in stage: '+str(p))
print('Staged clean runtime:',STAGE)
