"""Manual real-provider probe; writes no credentials, only generated sample data."""
import asyncio
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from app.core.config import settings
from app.services.ai_service import get_llm

async def main():
    if not settings.llm_api_key or not settings.llm_base_url:
        raise SystemExit('Real model is not configured')
    root = Path(__file__).resolve().parent.parent
    prompt = (root / 'pi-web/lib/career-ui-prompt.ts').read_text(encoding='utf-8')
    # The TypeScript wrapper is constant text; never eval source code.
    prompt = prompt.split('`', 1)[1].rsplit('`', 1)[0].replace('\\`', '`')
    raw = await asyncio.wait_for(get_llm().chat([
        {'role':'system','content':prompt},
        {'role':'user','content':'这是验收用的虚构求职场景，不要认为是用户真实资料：候选人目标是初级前端开发，会React，做过课程搜索页面，解决重复请求但没有量化数据，每周可学习6小时。请只输出一个skill-matrix卡片，列3个能力，包括有证据优势和未知项，不要给分数。'}
    ], max_tokens=900), timeout=35)
    output = root / '.runtime/career-model-probe.json'
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps({'mocked':False,'text':raw},ensure_ascii=False),encoding='utf-8')
    print('Real model career sample saved for protocol verification; credentials not exported.')

if __name__ == '__main__':
    asyncio.run(main())
