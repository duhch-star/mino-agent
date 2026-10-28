import hashlib,json,tempfile,unittest
from pathlib import Path
from app.services.bundled_skills import install_bundled_skills

class BundledSkillsTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name);self.source=self.root/'bundle';self.source.mkdir();self.agent=self.root/'agent';self.agent.mkdir()
        d=self.source/'career-test';d.mkdir();text=b'---\nname: career-test\ndescription: Synthetic test only\n---\nNever invent facts.';(d/'SKILL.md').write_bytes(text)
        self.manifest={'skills':[{'id':'career-test','path':'career-test','files':{'SKILL.md':hashlib.sha256(text).hexdigest()}}]};self.save()
    def save(self): (self.source/'manifest.json').write_text(json.dumps(self.manifest))
    def tearDown(self):self.temp.cleanup()
    def test_install_offline_and_never_overwrite_user_edits(self):
        self.assertEqual(install_bundled_skills(self.agent,self.source),['career-test'])
        p=self.agent/'skills/career-test/SKILL.md';p.write_text('user edited')
        self.assertEqual(install_bundled_skills(self.agent,self.source),[])
        self.assertEqual(p.read_text(),'user edited')
        self.assertFalse((self.agent/'settings.json').exists())
    def test_corrupt_or_escape_is_rejected_before_copy(self):
        self.manifest['skills'][0]['files']['SKILL.md']='0'*64;self.save()
        with self.assertRaises(RuntimeError):install_bundled_skills(self.agent,self.source)
        self.assertFalse((self.agent/'skills/career-test').exists())
        self.manifest['skills'][0]['path']='../outside';self.save()
        with self.assertRaises(RuntimeError):install_bundled_skills(self.agent,self.source)
    def test_packaged_skills_are_verified_and_about_ten(self):
        from app.core.paths import resource_path
        source=resource_path('bundled_skills')
        if not (source/'manifest.json').exists():self.skipTest('acquisition still pending')
        data=json.loads((source/'manifest.json').read_text(encoding='utf-8-sig'))
        self.assertGreaterEqual(len(data['skills']),8);self.assertLessEqual(len(data['skills']),12)
        self.assertEqual(len(install_bundled_skills(self.agent,source)),len(data['skills']))
        for entry in data['skills']:
            self.assertTrue(entry['source']);self.assertTrue(entry['commit']);self.assertTrue(entry['license'])
            self.assertTrue((self.agent/'skills'/entry['id']/'SKILL.md').is_file())
