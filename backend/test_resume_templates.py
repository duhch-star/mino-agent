"""Regression tests for upstream-source resume integration."""
import io
import json
from pathlib import Path
import hashlib
import unittest
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
        self.assertIn(r'\runsubsection{示例大学}', result)
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
        self.assertEqual(len(catalog), 2)
        for template in catalog:
            for field in ['author', 'overview', 'features', 'sections', 'fontInfo', 'compilerInfo', 'limitations', 'previewUrl', 'originalPdfUrl', 'sourceFileUrl', 'commitUrl']:
                self.assertTrue(template[field], field)
            for resource in ['preview', 'original.pdf', 'readme', 'license']:
                path, mime = service.template_resource(template['id'], resource)
                self.assertTrue(path.is_file())
                self.assertTrue(mime)
        for template, resource in [('unknown','preview'),('classic','../../.env'),('technical','preview')]:
            with self.assertRaises(ValueError): service.template_resource(template, resource)

    def test_fixed_sb2nov_hashes(self):
        folder=service.TEMPLATE_ROOT/'sb2nov'
        data=json.loads((folder/'manifest.json').read_text(encoding='utf-8'))
        for filename,digest in data['files'].items():
            self.assertEqual(hashlib.sha256((folder/filename).read_bytes()).hexdigest(),digest)


if __name__=='__main__':unittest.main()
