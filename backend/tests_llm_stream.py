import unittest
from unittest.mock import patch
import json
from app.services.ai_service import _openai_compatible_stream, LLMOutputTruncated

class StreamTests(unittest.IsolatedAsyncioTestCase):
    async def collect(self, finish, done=True):
        class Response:
            async def __aenter__(self): return self
            async def __aexit__(self,*args): return False
            def raise_for_status(self): pass
            async def aiter_lines(self):
                yield 'data: '+json.dumps({'choices':[{'delta':{'content':'partial'}}]})
                yield 'data: '+json.dumps({'choices':[{'delta':{},'finish_reason':finish}]})
                if done: yield 'data: [DONE]'
        class Client:
            def __init__(self,*args,**kwargs): pass
            async def __aenter__(self): return self
            async def __aexit__(self,*args): return False
            def stream(self,*args,**kwargs):return Response()
        with patch('app.services.ai_service.httpx.AsyncClient',Client):
            return [chunk async for chunk in _openai_compatible_stream([])]
    async def test_length_finish_never_treats_partial_as_success(self):
        with self.assertRaises(LLMOutputTruncated):await self.collect('length')
    async def test_disconnected_stream_is_not_success(self):
        with self.assertRaises(RuntimeError): await self.collect(None,done=False)
    async def test_content_filter_is_failure_even_with_done(self):
        with self.assertRaises(RuntimeError): await self.collect('content_filter')
    async def test_finish_without_done_is_supported(self):
        self.assertEqual(await self.collect('stop',done=False),['partial'])
    async def test_done_only_compatible_provider_is_supported(self):
        self.assertEqual(await self.collect(None),['partial'])
    async def test_normal_finish_preserves_stream(self):
        self.assertEqual(await self.collect('stop'),['partial'])
