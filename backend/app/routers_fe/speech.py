"""Bounded interview TTS: server-only credentials, deduplication and timings."""
import hashlib
import json
import os
import threading
import time
import urllib.parse
import urllib.request
from collections import OrderedDict
from concurrent.futures import Future

from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel, Field
from app.core.responses import ApiException

router = APIRouter(prefix='/interview', tags=['FE-面试语音'])
_lock = threading.Lock()
_cache = OrderedDict()
_inflight: dict[str, Future] = {}
_slots = threading.BoundedSemaphore(4)
MAX_AUDIO = 12 * 1024 * 1024
MAX_CACHE_BYTES = 32 * 1024 * 1024


class SpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


def _credentials():
    api = os.getenv('MAMBO_TTS_API', 'https://api.milorapart.top/apis/mbAIscvip')
    key = os.getenv('MAMBO_TTS_KEY', '')
    if not key:
        raise ValueError('Missing speech credentials')
    parsed = urllib.parse.urlparse(api)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Invalid speech endpoint')
    return api, key


def _download(api: str, key: str, text: str) -> bytes:
    # No global lock spans network IO. Distinct texts can synthesize concurrently.
    query = urllib.parse.urlencode({'text': text, 'format': 'mp3', 'key': key})
    request = urllib.request.Request(api + ('&' if '?' in api else '?') + query,
                                    headers={'User-Agent': 'MINOS/1.0', 'Accept': 'application/json'})
    with urllib.request.urlopen(request, timeout=12) as response:
        raw = response.read(64 * 1024 + 1)
    if len(raw) > 64 * 1024:
        raise ValueError('Invalid provider metadata')
    result = json.loads(raw)
    url = result.get('url')
    parsed = urllib.parse.urlparse(url) if isinstance(url, str) else None
    if result.get('code') != 200 or not parsed or parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Provider returned no audio')
    request = urllib.request.Request(url, headers={'User-Agent': 'MINOS/1.0'})
    with urllib.request.urlopen(request, timeout=12) as response:
        audio = response.read(MAX_AUDIO + 1)
    if not 100 <= len(audio) <= MAX_AUDIO:
        raise ValueError('Invalid audio size')
    return audio


def _audio(api: str, key: str, text: str):
    digest = hashlib.sha256((api + key + text).encode()).hexdigest()
    with _lock:
        if digest in _cache:
            _cache.move_to_end(digest)
            return _cache[digest], 'hit'
        future = _inflight.get(digest)
        owner = future is None
        if owner:
            future = Future()
            _inflight[digest] = future
    if not owner:
        return future.result(timeout=28), 'shared'
    try:
        if not _slots.acquire(timeout=1):
            raise TimeoutError('Speech service busy')
        try:
            audio = _download(api, key, text)
        finally:
            _slots.release()
        with _lock:
            _cache[digest] = audio
            while len(_cache) > 20 or sum(map(len, _cache.values())) > MAX_CACHE_BYTES:
                _cache.popitem(last=False)
        future.set_result(audio)
        return audio, 'miss'
    except Exception as exc:
        future.set_exception(exc)
        raise
    finally:
        with _lock:
            _inflight.pop(digest, None)


@router.get('/speech/config')
def speech_config():
    return {'provider': 'mambo', 'configured': bool(os.getenv('MAMBO_TTS_KEY')),
            'browserFallback': True, 'streaming': False, 'maxTextLength': 1000}


@router.post('/speech')
def synthesize(req: SpeechRequest):
    text = req.text.strip()
    if not text:
        raise ApiException(40000, '请输入播报内容', status_code=400)
    started = time.perf_counter()
    try:
        api, key = _credentials()
        audio, cache = _audio(api, key, text)
        elapsed = round((time.perf_counter() - started) * 1000)
        return Response(audio, media_type='audio/mpeg', headers={
            'Cache-Control': 'no-store', 'X-Speech-Voice': 'mambo',
            'X-Speech-Cache': cache, 'X-Speech-Duration-Ms': str(elapsed),
            'Server-Timing': f'tts;dur={elapsed}',
        })
    except Exception:
        # Never expose API keys or provider request/download URLs.
        raise ApiException(50300, '语音暂不可用，请切换浏览器语音或文字作答', status_code=502)
