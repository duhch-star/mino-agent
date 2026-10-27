import {readFileSync,writeFileSync} from 'node:fs';
import {readFeedbackStream} from '../components/minos/lib/feedback-stream.mjs';
const root=new URL('../../.runtime/',import.meta.url),base='http://127.0.0.1:5173';
const credentials=JSON.parse(readFileSync(new URL('integration-test-account.json',root),'utf8'));
const login=await fetch(base+'/api/minos/account',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(credentials)});if(!login.ok)throw new Error('Login failed');
const cookie=login.headers.get('set-cookie').split(';')[0],result={timestamp:new Date().toISOString(),mocked:false};
try {
 const start=performance.now();
 const response=await fetch(base+'/api/business/interview/feedback/stream',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({position:'前端开发工程师',question:'请介绍一次主动解决问题的经历。',answer:'课程项目搜索响应慢。我负责前端，用性能工具发现每次按键重复请求。我添加输入防抖和旧请求取消，并测试连续输入与清空搜索。最终页面稳定显示最后输入的结果，没有记录具体性能数值。',history:[]}),signal:AbortSignal.timeout(30000)});
 result.status=response.status;result.headersMs=Math.round(performance.now()-start);
 if(response.ok){const feedback=await readFeedbackStream(response,{onPreview:preview=>{result.previewMs=Math.round(performance.now()-start);result.serverPreviewMs=preview.elapsedMs;result.reply=preview.reply;}});result.completeMs=Math.round(performance.now()-start);result.dimensionCount=feedback.dimensions.length;}
 else result.error='Stream request rejected';
} catch(e){result.error=e.name==='TimeoutError'?'Probe exceeded deadline':e.message;}finally{await fetch(base+'/api/minos/account',{method:'DELETE',headers:{cookie}});}
writeFileSync(new URL('interview-stream-measurement.json',root),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
