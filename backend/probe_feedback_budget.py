"""Manual paid-provider experiment; request-local budgets, synthetic data, no raw logs."""
import asyncio
import json
import time
from pathlib import Path
from app.routers_fe.interview import FeFeedbackRequest, feedback_messages, validate_feedback, preview_reply
from app.services.ai_service import get_llm, LLMOutputTruncated

async def main():
    request=FeFeedbackRequest(position='前端开发',question='介绍一次解决问题的经历',answer='课程项目里搜索页面重复发送请求。我用网络面板定位每次按键都会触发请求，增加防抖和旧请求取消，测试连续输入后只显示最后输入的结果。我没有记录优化前后的数值。')
    rows=[]
    # Interleave budgets to reduce systematic ordering bias. Small sample only.
    for budget in (1000,1800,1800,1000):
        raw='';start=time.perf_counter();row={'budget':budget}
        try:
            async with asyncio.timeout(25):
                async for chunk in get_llm().stream_chat(feedback_messages(request),json_mode=True,temperature=0.2,max_tokens=budget):
                    raw+=chunk
                    if len(raw)>24000:raise ValueError('output_limit')
                    if 'previewMs' not in row and preview_reply(raw):row['previewMs']=round((time.perf_counter()-start)*1000)
            validate_feedback(json.loads(raw));row['valid']=True
        except LLMOutputTruncated:row.update(valid=False,reason='truncated')
        except TimeoutError:row.update(valid=False,reason='timeout')
        except json.JSONDecodeError:row.update(valid=False,reason='json')
        except ValueError:row.update(valid=False,reason='schema')
        except Exception as error:row.update(valid=False,reason=type(error).__name__)
        row.update(elapsedMs=round((time.perf_counter()-start)*1000),chars=len(raw));rows.append(row)
    target=Path(__file__).resolve().parent.parent/'.runtime/feedback-budget-probe.json'
    target.write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(rows,ensure_ascii=False,indent=2))

if __name__=='__main__':asyncio.run(main())
