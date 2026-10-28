"""Regression tests for upstream-source resume integration."""
import io
import json
from pathlib import Path
import hashlib
import os
import re
import unittest
from concurrent.futures import ThreadPoolExecutor
from urllib.request import urlopen
import zipfile

from app.routers_fe.resume import Resume
from app.services import resume_service as service


class ResumeTemplatesTests(unittest.TestCase):
    def setUp(self):
        self.resume = Resume.model_validate({'name':'张三', 'contact':'a@example.com', 'summary':'真实履历', 'sections':[{'title':'教育经历','entries':[{'heading':'示例大学','subtitle':'计算机本科','dates':'2020–2024','location':'北京','items':['完成课程项目，效率提升 20%']}]}]})

    def test_original_single_column_commands_retained(self):
        raw = (service.TEMPLATE_ROOT/'sb2nov/sourabh_bajaj_resume.tex').read_text(encoding='utf-8')
        result = service.render(self.resume, 'classic')
        macros = raw.split('% Custom commands',1)[1].split(r'\begin{document}',1)[0]
        self.assertIn(macros, result)
        self.assertIn(r'\resumeSubheading{示例大学}{北京}{计算机本科}{2020–2024}', result)
        self.assertIn(r'\documentclass[letterpaper,11pt]{article}', result)
        self.assertNotIn('Sourabh Bajaj}}', result)
        self.assertNotIn('ctexart', result)

    def test_original_double_column_and_assets(self):
        result=service.render(self.resume, 'sidebar')
        self.assertIn(r'\documentclass[]{deedy-resume-openfont}', result)
        self.assertIn(r'\begin{minipage}[t]{0.33\textwidth}', result)
        self.assertIn(r'\begin{minipage}[t]{0.66\textwidth}', result)
        self.assertIn(r'\subsection{示例大学}', result)
        self.assertNotIn(r'\runsubsection{示例大学}', result)
        files=service.assets('sidebar')
        self.assertIn('deedy-resume-openfont.cls',files)
        self.assertIn('fonts/lato/Lato-Lig.ttf',files)
        self.assertIn(b'fonts/raleway/',files['deedy-resume-openfont.cls'])
        self.assertNotIn('deedy@fb.com',result)

    def test_escape_injection_and_legacy(self):
        self.resume.name=r'\input{secret} & 20%'
        result=service.render(self.resume,'classic')
        self.assertNotIn(r'\input{secret}',result)
        self.assertIn(r'\textbackslash{}input\{secret\}',result)
        self.assertEqual(service.render(self.resume,'technical'),result)
        with self.assertRaises(ValueError):service.render(self.resume,'unknown')

    def test_bundle_is_self_contained(self):
        with zipfile.ZipFile(io.BytesIO(service.source_bundle(self.resume,'sidebar'))) as bundle:
            self.assertIn('resume.tex',bundle.namelist())
            self.assertIn('deedy-resume-openfont.cls',bundle.namelist())
            self.assertIn('fonts/lato/OFL.txt',bundle.namelist())
            self.assertIn('upstream/LICENSE',bundle.namelist())
            self.assertNotIn('..', ''.join(bundle.namelist()))

    def test_catalog_and_original_resources(self):
        catalog = service.template_catalog()
        self.assertEqual(len(catalog), 7)
        for template in catalog:
            for field in ['author', 'overview', 'features', 'sections', 'fontInfo', 'compilerInfo', 'limitations', 'previewUrl', 'originalPdfUrl', 'sourceFileUrl', 'commitUrl']:
                self.assertTrue(template[field], field)
            for resource in ['preview', 'original.pdf', 'readme', 'license']:
                path, mime = service.template_resource(template['id'], resource)
                self.assertTrue(path.is_file())
                self.assertTrue(mime)
        for template, resource in [('unknown','preview'),('classic','../../.env'),('technical','preview')]:
            with self.assertRaises(ValueError): service.template_resource(template, resource)

    def test_new_templates_preserve_content_and_escape(self):
        for template in ['mcdowell', 'hunner', 'minimal']:
            self.resume.name = r'\input{secret} & 张三'
            source = service.render(self.resume, template)
            self.assertNotIn(r'\input{secret}', source)
            self.assertIn(r'\textbackslash{}input\{secret\}', source)
            for text in ['示例大学', '计算机本科', '北京', '2020–2024', '真实履历']:
                self.assertIn(text, source)
            with zipfile.ZipFile(io.BytesIO(service.source_bundle(self.resume, template))) as bundle:
                self.assertIn('upstream/LICENSE', bundle.namelist())
                if template != 'minimal':
                    self.assertTrue(any(n.endswith('.cls') and '/' not in n for n in bundle.namelist()))
        self.assertNotIn(b'Times New Roman', service.assets('mcdowell')['mcdowellcv.cls'])
        self.assertIn('Times New Roman', (service.TEMPLATE_ROOT/'mcdowell/mcdowellcv.cls').read_text())

    def test_full_templates_keep_upstream_classes_and_icon_fonts(self):
        for template, cls in [('awesome', 'awesome-cv.cls'), ('fortyseconds', 'fortysecondscv.cls')]:
            self.assertEqual(service.assets(template)[cls], (service.TEMPLATE_ROOT/template/cls).read_bytes())
            source = service.render(self.resume, template)
            self.assertIn(r'\faAddressCard', source)
            self.assertIn('示例大学', source)
            self.assertNotIn('Panda Bear', source)
            self.assertNotIn('Byungjin', source)
            self.assertNotIn(r'\renewcommand{\fa', source)
        from app.resume_schemas import Section
        self.resume.sections = [Section(title='技能', items=['真实技能'])]
        self.assertIn(r'技能\relax\relax\relax', service.render(self.resume, 'awesome'))

    def test_fixed_sb2nov_hashes(self):
        folder=service.TEMPLATE_ROOT/'sb2nov'
        data=json.loads((folder/'manifest.json').read_text(encoding='utf-8'))
        for filename,digest in data['files'].items():
            self.assertEqual(hashlib.sha256((folder/filename).read_bytes()).hexdigest(),digest)

    def test_classic_heading_preserves_original_two_row_geometry(self):
        self.resume.contact = 'Email: a@example.com\nMobile: 123 & 456\nCity: Beijing'
        result = service.render(self.resume, 'classic')
        heading = result.split(r'\begin{document}', 1)[1].split(r'\end{tabular*}', 1)[0]
        self.assertIn(r'\begin{tabular*}{\textwidth}{l@{\extracolsep{\fill}}r}', heading)
        self.assertIn(r'\textbf{\Large 张三} & Email: a@example.com\\', heading)
        self.assertIn(r'& Mobile: 123 \& 456 | City: Beijing \\', heading)
        self.assertEqual(heading.count('\\\\'), 2)
        self.assertNotIn('minipage', heading)
        self.assertNotIn(r'\newline', heading)

    def test_deedy_right_column_uses_upstream_inline_descriptor(self):
        self.resume.sections[0].column = 'right'
        result = service.render(self.resume, 'sidebar')
        self.assertIn(r'\runsubsection{示例大学}', result)
        self.assertIn(r'\descript{| 计算机本科}', result)

    def test_deedy_manifest_integrity_and_provenance(self):
        folder = service.TEMPLATE_ROOT / 'deedy'
        manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(manifest['commit'], service.TEMPLATES[1]['upstream'])
        listed = set()
        for entry in manifest['files']:
            with self.subTest(path=entry['path']):
                listed.add(entry['path'])
                content = (folder / entry['path']).read_bytes()
                self.assertEqual(len(content), entry['size_bytes'])
                self.assertEqual(hashlib.sha256(content).hexdigest(), entry['sha256'])
                if entry['kind'] == 'upstream-unmodified':
                    blob = b'blob ' + str(len(content)).encode() + b'\0' + content
                    self.assertEqual(hashlib.sha1(blob).hexdigest(), entry['git_blob_sha1'])
                    self.assertIn('/' + manifest['commit'] + '/', entry['raw_url'])
        actual = {p.relative_to(folder).as_posix() for p in folder.rglob('*') if p.is_file()}
        self.assertEqual(actual, listed | {'manifest.json'})
        self.assertEqual((folder / 'deedy_resume-openfont.tex').read_bytes(),
                         (folder / 'deedy_resume-openfont.xtx').read_bytes())

    def test_all_upstream_font_dependencies_and_licenses_bundled(self):
        files = service.assets('sidebar')
        fonts = [name for name in files if name.endswith(('.ttf', '.otf'))]
        self.assertEqual(len(fonts), 19)
        cls = files['deedy-resume-openfont.cls'].decode('utf-8')
        references = set(re.findall(r'(?:Lato|Raleway)-[A-Za-z]+', cls))
        for reference in references:
            self.assertTrue(any(Path(font).stem == reference for font in fonts), reference)
        for family in ('lato', 'raleway'):
            self.assertIn(b'SIL OPEN FONT LICENSE', files[f'fonts/{family}/OFL.txt'])
        # Neither selected upstream template has an icon-font/package dependency.
        for source in (cls, service.render(self.resume, 'classic')):
            self.assertNotRegex(source.lower(), r'fontawesome|academicons|\\usepackage\{[^}]*icon')
        with zipfile.ZipFile(io.BytesIO(service.source_bundle(self.resume, 'sidebar'))) as bundle:
            for font in fonts:
                self.assertEqual(bundle.read(font), files[font])
                self.assertEqual(bundle.read('upstream/' + font), files[font])
            for license_name in ('LICENSE', 'fonts/lato/OFL.txt', 'fonts/raleway/OFL.txt', 'manifest.json'):
                self.assertEqual(bundle.read('upstream/' + license_name), files[license_name])

    def test_original_pdf_and_preview_responses_serve_archived_bytes(self):
        from app.routers_fe.resume import template_resource
        for template in ('classic', 'sidebar'):
            for resource in ('original.pdf', 'preview'):
                response = template_resource(template, resource)
                expected, _ = service.template_resource(template, resource)
                self.assertEqual(Path(response.path), expected)
                self.assertEqual(response.headers['x-content-type-options'], 'nosniff')
                if resource == 'original.pdf':
                    self.assertTrue(expected.read_bytes().startswith(b'%PDF-'))

    @unittest.skipUnless(os.getenv('RESUME_VERIFY_UPSTREAM') == '1', 'opt-in pinned upstream network audit')
    def test_pinned_remote_upstream_bytes(self):
        checks = []
        for folder_name in ('sb2nov', 'deedy'):
            folder = service.TEMPLATE_ROOT / folder_name
            manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf-8'))
            if folder_name == 'deedy':
                checks.extend((folder / entry['path'], entry['raw_url']) for entry in manifest['files']
                              if entry['kind'] == 'upstream-unmodified')
            else:
                for name in manifest['files']:
                    upstream = 'README.md' if name == 'UPSTREAM-README.md' else name
                    url = manifest['repository'].replace('https://github.com/', 'https://raw.githubusercontent.com/')
                    checks.append((folder / name, url + '/' + manifest['commit'] + '/' + upstream))
        def verify(check):
            path, url = check
            with urlopen(url, timeout=45) as response:
                remote = response.read()
            self.assertEqual(remote, path.read_bytes(), url)
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(verify, checks))


if __name__=='__main__':unittest.main()
