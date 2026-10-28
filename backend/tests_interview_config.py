import unittest
from unittest.mock import patch, AsyncMock
from pydantic import ValidationError
from app.core.config import Settings, settings
from app.services.ai_service import get_llm

class InterviewConfigTests(unittest.IsolatedAsyncioTestCase):
    def test_defaults_preserve_existing_model(self):
        value=Settings(_env_file=None)
        self.assertEqual(value.interview_llm_model,'')
        self.assertEqual(value.interview_max_tokens,1000)
    def test_budget_and_temperature_have_safe_bounds(self):
        for kwargs in [{'interview_max_tokens':0},{'interview_max_tokens':2401},{'interview_temperature':float('nan')},{'interview_temperature':1.1}]:
            with self.assertRaises(ValidationError): Settings(_env_file=None,**kwargs)
    async def test_override_is_request_local_not_global_mutation(self):
        original=settings.llm_model
        with patch.object(settings,'llm_api_key','test'),patch.object(settings,'llm_base_url','https://example.test'),patch('app.services.ai_service._openai_compatible_chat',new_callable=AsyncMock,return_value='ok') as call:
            await get_llm(model='fast-test').chat([])
            self.assertEqual(call.call_args.kwargs['model'],'fast-test')
            await get_llm().chat([])
            self.assertIsNone(call.call_args.kwargs['model'])
        self.assertEqual(settings.llm_model,original)
