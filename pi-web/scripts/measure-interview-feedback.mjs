import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../../.runtime/',import.meta.url), base='http://127.0.0.1:5173';
const credentials=JSON.parse(readFileSync(new URL('integration-test-account.json',root),'utf8'));
const login=await fetch(base+'/api/minos/account',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(credentials)});
if(!login.ok)throw new Error('Login failed');
const cookie=login.headers.get('set-cookie').split(';')[0];
const result={timestamp:new Date().toISOString(),mocked:false};
try {
 const start=performance.now();
 const response=await fetch(base+'/api/business/interview/feedback',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({position:'前端开发工程师',question:'请介绍一次你主动解决问题的经历。',answer:'课程项目中页面搜索响应很慢。我负责前端，先用性能工具观察请求，发现每次按键都请求同一接口。我添加输入防抖和旧请求取消，并和同学测试了连续输入及清空搜索的场景。最终重复请求减少，页面能稳定展示最后一次输入的结果，没有记录具体性能数值。',history:[]}),signal:AbortSignal.timeout(30000)});
 result.roundTripMs=Math.round(performance.now()-start);result.status=response.status;result.serverMs=response.headers.get('x-feedback-duration-ms');
 const data=await response.json();
 if(response.ok) {result.dimensionCount=data.dimensions?.length;result.spokenChars=data.reply?.length;result.score=data.score;result.reply=data.reply;}
 else result.error=data.error?.message||data.detail||'Feedback not available';
} catch(e) {result.error=e.name==='TimeoutError'?'Feedback exceeded 30 second probe deadline':e.message;} finally {await fetch(base+'/api/minos/account',{method:'DELETE',headers:{cookie}});}
writeFileSync(new URL('interview-feedback-measurement.json',root),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
