import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
const root = new URL('../../.runtime/', import.meta.url);
const credentials = JSON.parse(readFileSync(new URL('integration-test-account.json',root),'utf8'));
const base='http://127.0.0.1:5173';
const login=await fetch(base+'/api/minos/account',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(credentials)});
if(!login.ok) throw new Error('Login failed');
const cookie=login.headers.get('set-cookie').split(';')[0];
const result={timestamp:new Date().toISOString(),cloud:null,browser:null};
let browser;
try {
  const config=await fetch(base+'/api/business/interview/speech/config',{headers:{cookie}});
  const settings=await config.json();
  if(settings.configured) {
    const samples=[];
    for(let i=0;i<2;i++) {
      const start=performance.now();
      const response=await fetch(base+'/api/business/interview/speech',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({text:'你好，请介绍一次你主动解决问题的经历。'}),signal:AbortSignal.timeout(30000)});
      const audio=await response.arrayBuffer();
      samples.push({status:response.status,elapsedMs:Math.round(performance.now()-start),bytes:audio.byteLength,cache:response.headers.get('x-speech-cache')});
      if(response.ok)writeFileSync(new URL('interview-real-voice.mp3',root),Buffer.from(audio));
    }
    result.cloud={configured:true,samples};
  } else result.cloud={configured:false,note:'No cloud key configured; no provider request sent'};
  browser=await chromium.launch({channel:'msedge',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage();await page.goto(base+'/login');
  result.browser=await page.evaluate(async()=>{
    const s=window.speechSynthesis;if(!s)return {supported:false};
    await new Promise(resolve=>{const timer=setTimeout(resolve,1500);s.addEventListener('voiceschanged',()=>{clearTimeout(timer);resolve();},{once:true});});
    const voices=s.getVoices().filter(v=>/^zh/i.test(v.lang));
    const chosen=voices.find(v=>v.localService)||voices[0];
    if(!chosen)return {supported:true,chineseVoices:0};
    return await new Promise(resolve=>{
      const u=new SpeechSynthesisUtterance('你好，准备好后我们开始面试。');u.voice=chosen;u.lang='zh-CN';let started=null;const t=performance.now();
      const finish=data=>{clearTimeout(timer);u.onstart=u.onend=u.onerror=null;s.cancel();resolve({supported:true,chineseVoices:voices.length,voice:chosen.name,local:chosen.localService,...data});};
      const timer=setTimeout(()=>finish({status:'timeout',firstAudioMs:started}),10000);
      u.onstart=()=>{started=Math.round(performance.now()-t);};u.onend=()=>finish({status:'ended',firstAudioMs:started});u.onerror=e=>finish({status:'error',error:e.error,firstAudioMs:started});s.speak(u);
    });
  });
} catch(e) {result.error=e.name==='TimeoutError'?'Real voice probe exceeded deadline':e.message;} finally {await browser?.close();await fetch(base+'/api/minos/account',{method:'DELETE',headers:{cookie}});}
writeFileSync(new URL('interview-speech-measurement.json',root),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
