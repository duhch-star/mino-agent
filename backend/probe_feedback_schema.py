"""Manual provider schema probe. Logs shape metadata, never raw output or keys."""
import asyncio
import json
from pathlib import Path
from app.routers_fe.interview import FeFeedbackRequest, feedback_messages, validate_feedback
from app.services.ai_service import get_llm

async def main():
    results=[]
    for i in range(3):
        raw=''
        row={'sample':i+1}
        try:
            async with asyncio.timeout(30):
                async for chunk in get_llm().stream_chat(feedback_messages(FeFeedbackRequest(position='数据分析',question='讲一次分析数据的经历',answer='课程中清洗公开销售数据，检查缺失值和重复行，按月汇总画图，回查异常原始记录。报告注明缺失数据可能影响结论，没有将相关性解释成因果。')),json_mode=True,temperature=0.2,max_tokens=1000):
                    raw+=chunk
            row['chars']=len(raw)
            parsed=json.loads(raw)
            row['fields']={k:type(v).__name__ for k,v in parsed.items()} if isinstance(parsed,dict) else {'root':type(parsed).__name__}
            validate_feedback(parsed)
            row['valid']=True
        except json.JSONDecodeError as e:
            row.update(valid=False,reason='json_decode',chars=len(raw),errorOffset=e.pos)
        except ValueError as e:
            row.update(valid=False,reason=str(e) if str(e).startswith(('Invalid','Expected')) else 'provider_value_error',chars=len(raw))
        except Exception as e:
            row.update(valid=False,reason=type(e).__name__,chars=len(raw))
        results.append(row)
    target=Path(__file__).resolve().parent.parent/'.runtime/feedback-schema-probe.json'
    target.write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(results,ensure_ascii=False,indent=2))

if __name__=='__main__':asyncio.run(main())
