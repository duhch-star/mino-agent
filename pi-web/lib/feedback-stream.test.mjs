import test from 'node:test';
import assert from 'node:assert/strict';
import {readFeedbackStream} from '../components/minos/lib/feedback-stream.mjs';
const feedback={score:4,dimensions:['结构','行动','结果'].map(name=>({name,stars:4,note:'回答依据'})),strengths:['事实'],suggestions:['建议'],reply:'完整反馈',starExample:'真实经历示例',chapterId:'star'};
function response(events,step=7){const bytes=new TextEncoder().encode(events.map(e=>JSON.stringify(e)).join('\n')+'\n');return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=step)c.enqueue(bytes.slice(i,i+step));c.close();}}));}
test('unicode NDJSON split across bytes preserves preview before report',async()=>{const seen=[];const result=await readFeedbackStream(response([{type:'preview',reply:'你好，完整句子。',elapsedMs:12},{type:'complete',feedback}]),{onPreview:v=>seen.push(v)});assert.equal(seen[0].reply,'你好，完整句子。');assert.deepEqual(result,feedback);});
test('preview without final report is never treated as success',async()=>{await assert.rejects(readFeedbackStream(response([{type:'preview',reply:'预览',elapsedMs:10}])),/中断/);});
test('server error after preview retains failure semantics',async()=>{await assert.rejects(readFeedbackStream(response([{type:'preview',reply:'预览',elapsedMs:10},{type:'error',message:'详细反馈失败'}])),/详细反馈失败/);});
test('malformed dimensions and repeated previews are rejected',async()=>{
 for(const invalid of [{...feedback,dimensions:[{},{},{}]},{...feedback,score:true},{...feedback,starExample:null},{...feedback,chapterId:'other'}])await assert.rejects(readFeedbackStream(response([{type:'complete',feedback:invalid}])),/数据无效/);
 await assert.rejects(readFeedbackStream(response([{type:'preview',reply:'预览',elapsedMs:1},{type:'preview',reply:'重复',elapsedMs:2}])),/预览无效/);
});
test('aborted stream never returns complete result',async()=>{const controller=new AbortController();controller.abort();await assert.rejects(readFeedbackStream(response([{type:'complete',feedback}]),{signal:controller.signal}),{name:'AbortError'});});
