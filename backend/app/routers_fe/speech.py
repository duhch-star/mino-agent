"""Interview TTS: keep provider credentials server-side; return audio bytes."""
import ast
import hashlib
import json
import os
from pathlib import Path
import threading
import urllib.parse
import urllib.request

from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel, Field
from app.core.responses import ApiException

router = APIRouter(prefix='/interview', tags=['FE-面试语音'])
_lock = threading.Lock()
_cache = {}  # bounded in-memory cache; never expose provider download URLs

class SpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)

def _credentials():
    api = os.getenv('MAMBO_TTS_API', 'https://api.milorapart.top/apis/mbAIscvip')
    key = os.getenv('MAMBO_TTS_KEY', '')
    if not key:
        source = Path(os.getenv('MAMBO_TTS_SOURCE', r'C:\Users\24260\Desktop\市场调研-指导\下载视频\gen_tts_vip.py'))
        # Parse constants only. Do not execute the source's batch narration job.
        for node in ast.parse(source.read_text(encoding='utf-8-sig')).body:
            if isinstance(node, ast.Assign) and isinstance(node.value, ast.Constant):
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id == 'KEY':
                        key = node.value.value
                    elif isinstance(target, ast.Name) and target.id == 'API':
                        api = node.value.value
    if not isinstance(key, str) or not key:
        raise ValueError('Missing speech credentials')
    return api, key

@router.post('/speech')
def synthesize(req: SpeechRequest):
    text = req.text.strip()
    if not text:
        raise ApiException(40000, '请输入播报内容', status_code=400)
    try:
        api, key = _credentials()
        digest = hashlib.sha256((api + key + text).encode()).hexdigest()
        with _lock:
            audio = _cache.get(digest)
            if audio is None:
                query = urllib.parse.urlencode({'text': text, 'format': 'mp3', 'key': key})
                request = urllib.request.Request(api + '?' + query, headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json'})
                with urllib.request.urlopen(request, timeout=60) as response:
                    result = json.loads(response.read().decode('utf-8'))
                url = result.get('url')
                if result.get('code') != 200 or not isinstance(url, str) or not url.startswith('https://'):
                    raise ValueError('Provider returned no audio')
                request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(request, timeout=120) as response:
                    audio = response.read(12 * 1024 * 1024 + 1)
                if not 100 <= len(audio) <= 12 * 1024 * 1024:
                    raise ValueError('Invalid audio size')
                if len(_cache) >= 20:
                    _cache.pop(next(iter(_cache)))
                _cache[digest] = audio
        return Response(audio, media_type='audio/mpeg', headers={'Cache-Control': 'no-store', 'X-Speech-Voice': 'mambo'})
    except ApiException:
        raise
    except Exception:
        # Never leak API keys or provider request URLs through errors.
        raise ApiException(50300, '曼波语音生成暂不可用，请继续文字面试或稍后重试', status_code=502)
