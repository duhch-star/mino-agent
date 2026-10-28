import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from app.routers_fe import speech


class SpeechConcurrencyTests(unittest.TestCase):
    def setUp(self):
        with speech._lock:
            speech._cache.clear()
            speech._inflight.clear()

    def test_distinct_texts_are_not_serialized_by_cache_lock(self):
        barrier = threading.Barrier(2)
        def download(*args):
            barrier.wait(timeout=2)
            return b'x' * 128
        with patch.object(speech, '_download', side_effect=download), ThreadPoolExecutor(2) as pool:
            first = pool.submit(speech._audio, 'https://voice.test', 'secret', 'first')
            second = pool.submit(speech._audio, 'https://voice.test', 'secret', 'second')
            self.assertEqual(first.result(timeout=3)[1], 'miss')
            self.assertEqual(second.result(timeout=3)[1], 'miss')

    def test_identical_requests_share_one_provider_call(self):
        entered, release = threading.Event(), threading.Event()
        def download(*args):
            entered.set()
            release.wait(timeout=2)
            return b'a' * 128
        with patch.object(speech, '_download', side_effect=download) as mock, ThreadPoolExecutor(2) as pool:
            first = pool.submit(speech._audio, 'https://voice.test', 'secret', 'same')
            self.assertTrue(entered.wait(timeout=1))
            second = pool.submit(speech._audio, 'https://voice.test', 'secret', 'same')
            time.sleep(.03)
            release.set()
            self.assertEqual(first.result(timeout=2)[0], second.result(timeout=2)[0])
            self.assertEqual(mock.call_count, 1)
            self.assertEqual(speech._audio('https://voice.test', 'secret', 'same')[1], 'hit')

    def test_missing_credentials_do_not_read_external_scripts(self):
        with patch.dict('os.environ', {'MAMBO_TTS_KEY': ''}):
            with self.assertRaises(ValueError):
                speech._credentials()

    def test_provider_failure_releases_inflight_entry(self):
        with patch.object(speech, '_download', side_effect=TimeoutError('secret-url')):
            with self.assertRaises(TimeoutError):
                speech._audio('https://voice.test', 'secret', 'failure')
        self.assertEqual(speech._inflight, {})
