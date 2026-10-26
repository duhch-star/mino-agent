"""Offline regression tests: run .venv/Scripts/python -m unittest discover -s backend -p test_harness.py."""
import asyncio
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from app.services import workspace_tools as tools, harness_service as harness


class WorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()

    def tearDown(self):
        self.temp.cleanup()

    def test_roundtrip(self):
        tools.execute(self.root, 'write_file', {'path': 'notes/plan.md', 'content': '学习 Python\n练习面试'})
        data = tools.execute(self.root, 'read_file', {'path': 'notes/plan.md'})
        self.assertIn('1: 学习 Python', data['content'])
        with self.assertRaises(ValueError):
            tools.execute(self.root, 'write_file', {'path': 'notes/plan.md', 'content': '覆盖'})
        tools.execute(self.root, 'edit_file', {'path': 'notes/plan.md', 'old_text': 'Python', 'new_text': 'SQL'})
        self.assertEqual(len(tools.execute(self.root, 'search_files', {'query': 'SQL'})['matches']), 1)
        self.assertEqual(tools.execute(self.root, 'list_files', {})['entries'][0]['name'], 'notes')

    def test_boundaries(self):
        for path in ['../secret', 'C:\\secret', '/etc/passwd', 'a/../../x', '.env', 'a/.env', 'x:stream', 'NUL', 'a./b']:
            with self.subTest(path=path), self.assertRaises(ValueError):
                tools.execute(self.root, 'read_file', {'path': path})
        with self.assertRaises(ValueError):
            tools.execute(self.root, 'shell', {})
        with self.assertRaises(ValueError):
            tools.execute(self.root, 'write_file', {'path':'large.txt', 'content':'x'*(tools.MAX_BYTES+1)})

    def test_ambiguous_edit(self):
        tools.execute(self.root, 'write_file', {'path':'a.txt', 'content':'aa'})
        with self.assertRaises(ValueError):
            tools.execute(self.root, 'edit_file', {'path':'a.txt','old_text':'a','new_text':'b'})


class HarnessTests(unittest.IsolatedAsyncioTestCase):
    async def test_tool_loop_and_errors(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            turn = 0
            async def provider(messages, definitions, max_tokens):
                nonlocal turn
                turn += 1
                self.assertEqual(len(definitions), 5)
                if turn == 1:
                    specs = [('write_file', {'path':'plan.md','content':'hello'}), ('read_file', {'path':'plan.md'}), ('edit_file', {'path':'plan.md','old_text':'hello','new_text':'world'}), ('read_file', {'path':'../secret'})]
                    yield {'type':'turn_end','calls':[{'id':f'call_{i}','type':'function','function':{'name':n,'arguments':json.dumps(a)}} for i,(n,a) in enumerate(specs)]}
                else:
                    self.assertEqual(messages[-1]['role'], 'tool')
                    yield {'type':'delta','delta':'完成'}
                    yield {'type':'turn_end','calls':[]}
            with patch.object(tools, 'workspace_for', return_value=root):
                events = [e async for e in harness.run([{'role':'system','content':'test'},{'role':'user','content':'save'}], 'user', 700, provider)]
            finals = [e for e in events if e['type']=='tool_call' and e['status']!='running']
            self.assertEqual([e['status'] for e in finals], ['completed','completed','completed','failed'])
            self.assertEqual(root.joinpath('plan.md').read_text(), 'world')
            self.assertEqual(turn, 2)

    async def test_requires_read_before_edit(self):
        async def provider(messages, definitions, max_tokens):
            if messages[-1]['role'] == 'tool':
                yield {'type':'turn_end','calls':[]}
            else:
                yield {'type':'turn_end','calls':[{'id':'a','type':'function','function':{'name':'edit_file','arguments':'{"path":"a.txt","old_text":"a","new_text":"b"}'}}]}
        with tempfile.TemporaryDirectory() as directory, patch.object(tools, 'workspace_for', return_value=Path(directory)):
            events=[e async for e in harness.run([{'role':'system','content':'test'}], 'user', 700, provider)]
        self.assertTrue(any(e.get('status')=='failed' for e in events))

    async def test_round_limit(self):
        async def provider(messages, definitions, max_tokens):
            yield {'type':'turn_end','calls':[{'id':'a','type':'function','function':{'name':'list_files','arguments':'{}'}}]}
        with tempfile.TemporaryDirectory() as directory, patch.object(tools, 'workspace_for', return_value=Path(directory)):
            with self.assertRaises(RuntimeError):
                _ = [e async for e in harness.run([{'role':'system','content':'test'}], 'user', 700, provider)]


if __name__ == '__main__':
    unittest.main()
