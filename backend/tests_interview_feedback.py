import asyncio
import json
from unittest.mock import patch, AsyncMock
from fastapi import Response
from app.core.responses import ApiException
from app.routers_fe.interview import fe_feedback, feedback_events, preview_reply
import unittest
from app.routers_fe.interview import validate_feedback, FeFeedbackRequest
from pydantic import ValidationError

VALID = {'score':4, 'dimensions':[{'name':n,'stars':4,'note':'基于回答中的个人职责'} for n in ['结构','行动','结果']], 'strengths':['交代了个人责任'], 'suggestions':['补充可核实结果'], 'reply':'你清晰说明了自己的行动，可以进一步补充结果。', 'starExample':'S：项目背景；T：个人任务；A：实际行动；R：待补充真实结果。'}
class FeedbackStreamTests(unittest.IsolatedAsyncioTestCase):
    async def test_preview_precedes_validated_report(self):
        raw = json.dumps({'reply': VALID['reply']} | VALID, ensure_ascii=False)
        class Provider:
            async def stream_chat(self, *args, **kwargs):
                for i in range(0, len(raw), 3): yield raw[i:i+3]
        with patch('app.routers_fe.interview.ai_service.get_llm', return_value=Provider()):
            events = [json.loads(item) async for item in feedback_events(FeFeedbackRequest(answer='真实回答'))]
        self.assertEqual([e['type'] for e in events], ['preview','complete'])
        self.assertEqual(events[0]['reply'], VALID['reply'])
    async def test_failure_after_preview_never_becomes_complete(self):
        class Provider:
            async def stream_chat(self, *args, **kwargs):
                yield '{"reply":"仅预览",'
                raise ValueError('private-key')
        with patch('app.routers_fe.interview.ai_service.get_llm', return_value=Provider()):
            events = [json.loads(item) async for item in feedback_events(FeFeedbackRequest(answer='真实回答'))]
        self.assertEqual([e['type'] for e in events], ['preview','error'])
        self.assertNotIn('private-key', str(events))
    async def test_error_codes_are_bounded_and_do_not_leak_provider_details(self):
        for error, code in [(TimeoutError('secret'), 'feedback_timeout'), (ValueError('secret'), 'feedback_invalid'), (RuntimeError('secret'), 'feedback_upstream'), (__import__('app.services.ai_service', fromlist=['LLMOutputTruncated']).LLMOutputTruncated('secret'), 'feedback_truncated')]:
            class Provider:
                async def stream_chat(self, *args, **kwargs):
                    raise error
                    yield ''
            with patch('app.routers_fe.interview.ai_service.get_llm', return_value=Provider()):
                events = [json.loads(item) async for item in feedback_events(FeFeedbackRequest(answer='真实回答'))]
            self.assertEqual(events[0]['code'], code)
            self.assertNotIn('secret', str(events))
    def test_preview_requires_complete_first_json_string(self):
        self.assertIsNone(preview_reply('{"reply":"未完成'))
        self.assertIsNone(preview_reply('{"score":4,"reply":"不提前预览"}'))
        self.assertEqual(preview_reply('{"reply":"包含\\"转义\\"文字",'), '包含"转义"文字')

class FeedbackEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def test_success_has_measurement_headers(self):
        from app.core.config import settings
        provider = type('Provider', (), {'chat': AsyncMock(return_value=json.dumps(VALID))})()
        with patch.object(settings, 'llm_api_key', 'test'), patch.object(settings, 'llm_base_url', 'https://example.test'), patch('app.routers_fe.interview.ai_service.get_llm', return_value=provider):
            response = Response()
            result = await fe_feedback(FeFeedbackRequest(answer='真实回答'), response)
            self.assertEqual(result['score'], 4)
            self.assertIn('X-Feedback-Duration-Ms', response.headers)
    async def test_provider_failure_is_masked_and_not_replaced_with_mock(self):
        from app.core.config import settings
        provider = type('Provider', (), {'chat': AsyncMock(side_effect=TimeoutError('private-provider-key'))})()
        with patch.object(settings, 'llm_api_key', 'test'), patch.object(settings, 'llm_base_url', 'https://example.test'), patch('app.routers_fe.interview.ai_service.get_llm', return_value=provider):
            with self.assertRaises(ApiException) as context:
                await fe_feedback(FeFeedbackRequest(answer='真实回答'), Response())
            self.assertNotIn('private-provider-key', str(context.exception))

class FeedbackValidationTests(unittest.TestCase):
    def test_valid_feedback_returns_only_known_fields(self):
        value = validate_feedback(VALID | {'chapterId':'malicious','extra':'ignored'})
        self.assertEqual(value['chapterId'],'star')
        self.assertNotIn('extra',value)
    def test_score_must_be_integer_not_bool_float_or_nan(self):
        for score in [True, 3.5, float('nan'), 0, 6]:
            with self.subTest(score=score), self.assertRaises(ValueError): validate_feedback(VALID | {'score':score})
    def test_invalid_dimensions_and_unbounded_text_are_rejected(self):
        cases=[VALID | {'dimensions':[]}, VALID | {'dimensions':[{'name':'x','stars':4.5,'note':'x'}]*3}, VALID | {'reply':'x'*1001},VALID | {'suggestions':[{}]},VALID | {'starExample':None}]
        for value in cases:
            with self.assertRaises(ValueError): validate_feedback(value)
    def test_request_fields_are_bounded(self):
        with self.assertRaises(ValidationError): FeFeedbackRequest(question='x'*2001,answer='answer')
