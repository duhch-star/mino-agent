import asyncio
import json
from unittest.mock import patch, AsyncMock
from fastapi import Response
from app.core.responses import ApiException
from app.routers_fe.interview import fe_feedback
import unittest
from app.routers_fe.interview import validate_feedback, FeFeedbackRequest
from pydantic import ValidationError

VALID = {'score':4, 'dimensions':[{'name':n,'stars':4,'note':'基于回答中的个人职责'} for n in ['结构','行动','结果']], 'strengths':['交代了个人责任'], 'suggestions':['补充可核实结果'], 'reply':'你清晰说明了自己的行动，可以进一步补充结果。', 'starExample':'S：项目背景；T：个人任务；A：实际行动；R：待补充真实结果。'}
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
