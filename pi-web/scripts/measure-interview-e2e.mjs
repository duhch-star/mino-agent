import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {summarizeInterviewSamples} from '../lib/interview-benchmark.mjs';
const targets={firstAudioMs:Number(process.env.INTERVIEW_TARGET_FIRST_AUDIO_MS||3000),completeMs:Number(process.env.INTERVIEW_TARGET_COMPLETE_MS||15000)};
summarizeInterviewSamples([],targets); // Validate before any provider request.
import {chromium} from 'playwright';
const root=new URL('../../.runtime/',import.meta.url),base='http://127.0.0.1:5173';
const credentials=JSON.parse(readFileSync(new URL('integration-test-account.json',root),'utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage();const result={timestamp:new Date().toISOString(),mocked:false,note:'Browser synthesis start events, not acoustic latency. Sequential small sample, not an SLA.',samples:[]};
try {
 await page.goto(base+'/login');
 await page.evaluate(async credentials=>{const r=await fetch('/api/minos/account',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(credentials)});if(!r.ok)throw Error('Login failed');},credentials);
 await page.evaluate(async()=>{if(!speechSynthesis.getVoices().length)await new Promise(resolve=>{const timer=setTimeout(resolve,2000);speechSynthesis.addEventListener('voiceschanged',()=>{clearTimeout(timer);resolve();},{once:true});});});
 const scenarios=[
 ['前端开发','介绍一次解决问题的经历','课程项目里搜索页面重复发送请求。我用网络面板定位到每次按键都会触发请求，增加防抖和旧请求取消，测试连续输入后只显示最后输入的结果。我没有记录优化前后的数值。'],
 ['产品助理','如何处理团队意见分歧','课程小组对是否增加新功能有分歧。我先收集大家担心的时间和展示效果，再列出必须完成和可以延后的功能，组织讨论后确认先完成核心流程，最终按时演示。'],
 ['数据分析','讲一次分析数据的经历','我在课程中清洗一份公开销售数据，检查缺失值和重复行，按月汇总并画趋势图。发现一段异常后回查原始记录，报告注明了缺失数据可能影响结论，没有把相关性解释成因果。']
 ];
 for(const [position,question,answer] of scenarios) {
  const sample=await page.evaluate(async payload=>{
   const start=performance.now(),out={position:payload.position};let utterance,voicePromise=Promise.resolve(),voiceTimer;
   try {
    const voices=speechSynthesis.getVoices().filter(v=>/^zh/i.test(v.lang));const voice=voices.find(v=>v.localService)||voices[0];out.voice=voice?.name;out.localVoice=voice?.localService;
    const response=await fetch('/api/business/interview/feedback/stream',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...payload,history:[]}),signal:AbortSignal.timeout(30000)});out.status=response.status;if(!response.ok)throw Error('Request rejected');
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
    const consume=line=>{if(!line.trim())return;const e=JSON.parse(line);
     if(e.type==='error'){out.errorCode=e.code;out.errorReason=e.reason;throw Error(e.message);}
     if(e.type==='preview'){
      out.previewMs=Math.round(performance.now()-start);out.serverPreviewMs=e.elapsedMs;
      if(!voice){out.speechError='No Chinese voice';return;}
      const requested=performance.now();utterance=new SpeechSynthesisUtterance(e.reply);utterance.voice=voice;utterance.lang='zh-CN';
      voicePromise=new Promise(resolve=>{voiceTimer=setTimeout(()=>{out.speechError='Speech deadline';resolve();},15000);utterance.onstart=()=>{out.firstAudioMs=Math.round(performance.now()-start);out.voiceStartupMs=Math.round(performance.now()-requested);};utterance.onend=()=>{clearTimeout(voiceTimer);resolve();};utterance.onerror=e=>{out.speechError=e.error;clearTimeout(voiceTimer);resolve();};});speechSynthesis.speak(utterance);
     }
     if(e.type==='complete'){out.completeMs=Math.round(performance.now()-start);out.dimensionCount=e.feedback.dimensions.length;}
    };
    try {while(true){const {value,done}=await reader.read();if(done){buffer+=decoder.decode();if(buffer.trim())consume(buffer);break;}buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n'))>=0){consume(buffer.slice(0,end));buffer=buffer.slice(end+1);}}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    if(!out.completeMs)throw Error('Incomplete report');await voicePromise;
   }catch(e){out.error=e.message;out.failureMs=Math.round(performance.now()-start);}finally{clearTimeout(voiceTimer);if(utterance)utterance.onstart=utterance.onend=utterance.onerror=null;speechSynthesis.cancel();}
   return out;
  },{position,question,answer});result.samples.push(sample);
 }
 result.summary=summarizeInterviewSamples(result.samples,targets);
 if(process.argv.includes('--enforce')&&!result.summary.allPassed)process.exitCode=1;
}finally{await page.evaluate(()=>fetch('/api/minos/account',{method:'DELETE'})).catch(()=>{});await browser.close();writeFileSync(new URL('interview-e2e-measurement.json',root),JSON.stringify(result,null,2));appendFileSync(new URL('interview-e2e-history.ndjson',root),JSON.stringify(result)+'\n');console.log(JSON.stringify(result,null,2));}
