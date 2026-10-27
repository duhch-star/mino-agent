"""AI 服务抽象层：LLM / STT / TTS 均可替换（默认 mock，生产切换真实供应商）

设计原则：
- 客户端永不持有厂商密钥，全部由后端代理
- Provider 通过配置切换：llm_provider / stt_provider / tts_provider
- 生产接入 GLM/DeepSeek（OpenAI 兼容 /v1/chat/completions）
"""
import asyncio
import json
import logging
import re
from typing import AsyncIterator

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


# ---------- LLM ----------

class LLMOutputTruncated(ValueError):
    """Upstream explicitly exhausted its output budget; never treat partial text as final."""


class LLMProvider:
    async def chat(self, messages: list[dict], *, json_mode: bool = False,
                   temperature: float = 0.7, max_tokens: int = 1200) -> str:
        raise NotImplementedError

    async def stream_chat(self, messages: list[dict], *, json_mode: bool = False,
                          temperature: float = 0.7, max_tokens: int = 1200) -> AsyncIterator[str]:
        """流式对话：逐段产出增量文本（真流式）。默认回退为一次性 chat。"""
        full = await self.chat(messages, json_mode=json_mode,
                               temperature=temperature, max_tokens=max_tokens)
        yield full


class MockLLM(LLMProvider):
    """本地 mock：不依赖网络，供开发/测试/演示"""

    async def chat(self, messages, *, json_mode=False, temperature=0.7, max_tokens=1200):
        last = messages[-1]["content"] if messages else ""
        if json_mode:
            return json.dumps({"ok": True, "echo": last[:60]}, ensure_ascii=False)
        q = re.sub(r"\s+", " ", last)[:120]
        return (
            f"【小民演示回复】针对「{q}」：建议结合 STAR 原则组织回答，先讲情境与任务，"
            "再突出行为与结果。此回复由本地 Mock 生成，接入真实大模型后可获得更完整的结构化建议。"
        )

    async def stream_chat(self, messages, *, json_mode=False, temperature=0.7,
                          max_tokens=1200):
        full = await self.chat(messages, json_mode=json_mode,
                               temperature=temperature, max_tokens=max_tokens)
        # 模拟流式：按句切分，逐段产出
        import re as _re
        for seg in _re.findall(r".{1,24}", full):
            yield seg
            await asyncio.sleep(0.01)


async def _openai_compatible_chat(messages, *, json_mode=False, temperature=0.7,
                                  max_tokens=1200, model=None) -> str:
    """GLM/DeepSeek/通义 均兼容 OpenAI ChatCompletions"""
    url = settings.llm_base_url.rstrip("/") + "/chat/completions"
    body = {
        "model": model or settings.llm_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(url, headers={
            "Authorization": f"Bearer {settings.llm_api_key}"}, json=body)
        resp.raise_for_status()
        data = resp.json()
    return data["choices"][0]["message"]["content"]


async def _openai_compatible_stream(messages, *, json_mode=False, temperature=0.7,
                                    max_tokens=1200, model=None) -> AsyncIterator[str]:
    """真流式：OpenAI SSE 逐 chunk 解析 content delta"""
    url = settings.llm_base_url.rstrip("/") + "/chat/completions"
    body = {
        "model": model or settings.llm_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream("POST", url, headers={
            "Authorization": f"Bearer {settings.llm_api_key}"}, json=body) as resp:
            resp.raise_for_status()
            terminated = False
            async for line in resp.aiter_lines():
                if not line or not line.startswith("data:"):
                    continue
                payload = line[len("data:"):].strip()
                if payload == "[DONE]":
                    terminated = True
                    break
                try:
                    chunk = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                choice = (chunk.get("choices") or [{}])[0]
                delta = choice.get("delta") or {}
                content = delta.get("content")
                if content:
                    yield content
                finish = choice.get('finish_reason')
                if finish == 'length':
                    raise LLMOutputTruncated('Model output exceeded generation budget')
                if finish in ('stop', 'tool_calls', 'function_call'):
                    terminated = True
                elif finish:
                    raise RuntimeError('Model stream ended without a usable completion')
            if not terminated:
                raise RuntimeError('Model stream disconnected before completion')


def get_llm(*, model=None) -> LLMProvider:
    if settings.llm_api_key and settings.llm_base_url:
        class _OpenAICompat(LLMProvider):
            async def chat(self, messages, *, json_mode=False, temperature=0.7,
                           max_tokens=1200):
                return await _openai_compatible_chat(
                    messages, json_mode=json_mode, temperature=temperature,
                    max_tokens=max_tokens, model=model)

            async def stream_chat(self, messages, *, json_mode=False, temperature=0.7,
                                  max_tokens=1200):
                async for chunk in _openai_compatible_stream(
                        messages, json_mode=json_mode, temperature=temperature,
                        max_tokens=max_tokens, model=model):
                    yield chunk
        return _OpenAICompat()
    return MockLLM()


# ---------- STT ----------

class STTProvider:
    async def transcribe(self, audio_bytes: bytes, language: str = "zh") -> str:
        raise NotImplementedError


class MockSTT(STTProvider):
    async def transcribe(self, audio_bytes, language="zh"):
        logger.info("MockSTT 收到 %d 字节音频", len(audio_bytes))
        return "我在上一份实习中负责用户增长，通过 A/B 测试把转化率提升了 12%。"


def get_stt() -> STTProvider:
    if settings.stt_provider != "mock":
        # 讯飞/火山/阿里 各家的语义化接口不同，这里保留扩展点
        logger.warning("STT provider %s 尚未适配，使用 mock", settings.stt_provider)
    return MockSTT()


# ---------- TTS ----------

class TTSProvider:
    async def synthesize(self, text: str) -> bytes:
        raise NotImplementedError


class MockTTS(TTSProvider):
    async def synthesize(self, text):
        # 返回一个极短的 WAV 静音帧，保证客户端播放链路可用
        import struct
        sample_rate = 16000
        duration = 0.3
        n = int(sample_rate * duration)
        # fmt 块大小(16) 用 I；audio_format/channels 用 HH；sample_rate/byte_rate 用 II
        header = struct.pack("<4sI4s4sIHHIIHH4sI",
                             b"RIFF", 36 + n * 2, b"WAVE", b"fmt ",
                             16, 1, 1, sample_rate, sample_rate * 2, 2, 16,
                             b"data", n * 2)
        data = bytes(2 * n)
        return header + data


def get_tts() -> TTSProvider:
    if settings.tts_provider != "mock":
        logger.warning("TTS provider %s 尚未适配，使用 mock", settings.tts_provider)
    return MockTTS()


# ---------- 面试题生成 ----------

QUESTION_BANK = {
    "产品经理": [
        ("请用 STAR 原则讲一个你推动跨团队协作完成目标的经历。", "behavioral"),
        ("如何给一个全新的功能做需求优先级排序？", "professional"),
        ("如果开发团队说你的需求要延期两周，你怎么办？", "situational"),
    ],
    "前端开发": [
        ("讲一个你遇到的最难排查的前端性能问题，怎么解决的？", "behavioral"),
        ("React 与 Vue 的 diff 算法有什么区别？", "professional"),
        ("线上出现白屏，你的排查思路是什么？", "situational"),
    ],
    "数据分析": [
        ("讲一个你用数据驱动业务决策的项目。", "behavioral"),
        ("AB 实验的显著性怎么判定？常见坑有哪些？", "professional"),
        ("指标上涨了 20%，如何判断是真实增长还是口径问题？", "situational"),
    ],
}


def generate_questions(job_role: str, difficulty: str, level: str,
                       count: int = 4, tags: list | None = None) -> list:
    pool = QUESTION_BANK.get(job_role, QUESTION_BANK["产品经理"])
    base = list(pool)
    outro = ("" if False else
             "如果让你给现在的自己一个求职建议，你会说什么？")
    questions = [
        {"id": f"q{i+1}", "text": text, "type": qtype,
         "followups": ["可以再具体一点吗？当时你承担了什么角色？",
                       "结果如何衡量？如果重来一次你会怎么改进？"],
         "hints": ["注意情境-行动-结果的完整性", "尽量量化结果"]}
        for i, (text, qtype) in enumerate(base[:count])
    ]
    if len(questions) < count:
        for i in range(len(questions), count):
            questions.append({
                "id": f"q{i+1}", "text": f"谈谈你对「{job_role}」这个岗位当前挑战的理解。",
                "type": "professional", "followups": [], "hints": []})
    questions.append({"id": f"q{count+1}", "text": outro, "type": "closing",
                      "followups": [], "hints": []})
    return questions


# ---------- 面试反馈 ----------

def grade_answer(question: str, answer: str) -> dict:
    """基于启发式规则的评分：结构完整度 + 关键点命中 + 长度 + 量化"""
    a = answer.strip()
    structure_score = 0
    if any(k in a for k in ("情境", "背景", "当时")):
        structure_score += 25
    if any(k in a for k in ("任务", "目标", "负责")):
        structure_score += 25
    if any(k in a for k in ("行动", "做法", "执行", "推动")):
        structure_score += 25
    if any(k in a for k in ("结果", "提升", "降低", "获得", "%", "倍")):
        structure_score += 25
    length_score = min(100, len(a) // 8)
    score = round(structure_score * 0.7 + length_score * 0.3, 1)
    score = max(30, min(95, score))
    comment = (
        "回答结构完整，建议进一步量化结果。" if score >= 80 else
        "有基本框架，但「行动」和「结果」偏弱，建议用 STAR 补齐。" if score >= 60 else
        "回答较简短，建议按情境-任务-行动-结果四要素重新组织。"
    )
    return {"score": score, "structure": structure_score,
            "relevance": min(100, structure_score + 10), "comment": comment}


def build_report(session) -> dict:
    import json
    import secrets
    questions = json.loads(session.questions_json)
    answers = json.loads(session.answers_json) if session.answers_json else []
    per_question = []
    answer_map = {a.get("question_id"): a for a in answers}
    piles = []
    for q in questions:
        a = answer_map.get(q.get("id"))
        if not a:
            continue
        grade = grade_answer(q.get("text", ""), a.get("text", ""))
        per_question.append({
            "question_id": q["id"], "text": q.get("text", ""),
            "answer": a.get("text", ""), **grade,
        })
        if grade["score"] < 60:
            piles.append(q.get("text", ""))
    total = len(per_question)
    overall = round(sum(p["score"] for p in per_question) / total, 1) if total else 0
    return {
        "report_id": session.report_id or f"rp_{secrets.token_hex(6)}",
        "session_id": session.id,
        "per_question": per_question,
        "summary": {
            "overall": overall,
            "strengths": ["能完整描述项目经历"] if overall >= 60 else [],
            "weaknesses": ["行动与结果量化不足", "可再补充数据支撑"] if overall < 80 else [],
            "suggestions": ["按 STAR 四要素组织回答，重点突出量化结果",
                            "面试前后查看对应知识章节补课"],
        },
        "next_steps": [{"chapter_id": "ch_star", "reason": "STAR 结构不完整，建议补课"},
                       {"chapter_id": "ch_resume", "reason": "建议同步优化简历中的项目描述"}],
    }