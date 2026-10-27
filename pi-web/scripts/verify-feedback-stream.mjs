import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const retryMode=process.argv.includes('--retry');
const cancelMode=process.argv.includes('--cancel') || retryMode;
let answerWrites=0;

const credentials=JSON.parse(readFileSync(new URL('../../.runtime/integration-test-account.json',import.meta.url),'utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
page.on('request',request=>{if(request.method()==='POST' && /\/interview\/sessions\/[^/]+\/answers$/.test(new URL(request.url()).pathname))answerWrites++;});
try {
 await page.addInitScript(() => {
  window.__spoken=[];
  window.SpeechSynthesisUtterance=class { constructor(text){this.text=text;} };
  Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{lang:'zh-CN',voiceURI:'local',name:'local',localService:true}],addEventListener(){},removeEventListener(){},cancel(){},speak(u){window.__spoken.push(u.text);setTimeout(()=>u.onstart?.(),10);}}});
  window.SpeechRecognition=class {start(){this.onstart?.();}abort(){this.onend?.();}};
  const original=window.fetch;
  window.fetch=async (...args)=>{
   if(String(args[0]).includes('/interview/feedback/stream')) {
    const report={score:4,dimensions:['结构','行动','结果'].map(name=>({name,stars:4,note:'已说明职责'})),strengths:['职责清晰'],suggestions:['补充真实结果'],starExample:'用真实经历补充结果',chapterId:'star',reply:'你的职责清晰，可以补充真实结果。'};
    const enc=new TextEncoder();
    return new Response(new ReadableStream({start(c){c.enqueue(enc.encode(JSON.stringify({type:'preview',reply:report.reply,elapsedMs:200})+'\n'));this.timer=setTimeout(()=>{c.enqueue(enc.encode(JSON.stringify({type:'complete',feedback:report,elapsedMs:2000})+'\n'));c.close();},2000);},cancel(){clearTimeout(this.timer);window.__cancelled=true;}}),{headers:{'content-type':'application/x-ndjson'}});
   }
   return original(...args);
  };
 });
 await page.goto('http://127.0.0.1:5173/login');await page.locator('#minos-username').fill(credentials.username);await page.locator('#minos-password').fill(credentials.password);await page.getByRole('button',{name:'登录工作区'}).click();await page.waitForURL(u=>u.pathname==='/');await page.waitForTimeout(3000);
 const permission=page.getByRole('button',{name:'我理解并启用'});if(await permission.isVisible()){await permission.click();await page.waitForTimeout(3000);}
 await page.getByRole('button',{name:'AI 面试',exact:true}).click();await page.getByRole('button',{name:'语音',exact:true}).click();await page.getByRole('button',{name:/开始.*面试/}).click();await page.getByRole('button',{name:'开始面试',exact:true}).click();await page.getByLabel('声音来源').selectOption('browser');
 await page.locator('textarea.composerInput').fill('我用性能工具定位重复请求，并添加防抖与取消旧请求，验证最后输入结果正确。');await page.getByRole('button',{name:'提交回答',exact:true}).click();await page.waitForFunction(()=>window.__spoken.includes('你的职责清晰，可以补充真实结果。'));assert.equal(await page.getByText('本轮得分 4/5').isVisible(),false);
 if(cancelMode){
  await page.getByRole('button',{name:'取消等待 · 保留回答',exact:true}).click();
  await page.waitForFunction(()=>window.__cancelled===true);
  await page.waitForTimeout(2200);
  assert.equal(await page.getByText('本轮得分 4/5').isVisible(),false);
  assert.match(await page.locator('textarea.composerInput').inputValue(),/性能工具/);
  if(retryMode){
   assert.equal(answerWrites,1);
   await page.getByRole('button',{name:'提交回答',exact:true}).click();
   await page.getByText('本轮得分 4/5').waitFor();
   assert.equal(answerWrites,1,'Retry must reuse saved pending answer');
   assert.equal(await page.evaluate(()=>window.__spoken.filter(t=>t==='你的职责清晰，可以补充真实结果。').length),2,'One preview narration per attempt');
  }
  await page.getByRole('button',{name:'结束面试',exact:true}).click();
  await page.getByRole('heading',{name:'面试复盘',exact:true}).waitFor();
  assert.equal(await page.locator('.reportView .career-ui-interview-feedback').count(),retryMode?1:0);
  assert.deepEqual(errors,[]);console.log('Cancel: reader aborted, draft retained, late score excluded, finish available.');
 } else {
 await page.getByText('本轮得分 4/5').waitFor();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.__spoken.filter(t=>t==='你的职责清晰，可以补充真实结果。').length),1);await page.getByText(/首段反馈 \d+\.\d 秒/).waitFor();
 await page.getByRole('button',{name:'结束面试',exact:true}).click();
 await page.getByRole('heading',{name:'面试复盘',exact:true}).waitFor();
 await page.locator('.reportView .career-ui-interview-feedback').waitFor();
 assert.equal(await page.locator('.reportView .career-score progress').count(),3);
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.locator('.reportView').evaluate(el=>el.scrollWidth>el.clientWidth+2),false);
 await page.screenshot({path:'../.runtime/interview-report-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('Real interview session + mocked NDJSON transport: preview, validated report, scoring and next-question controls passed.');
 }
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'导出复盘 Markdown',exact:true}).click();const download=await downloadPromise;
 assert.equal(download.suggestedFilename(),'interview-practice-report.md');
 const path=await download.path();const exported=readFileSync(path,'utf8');assert.match(exported,/性能工具/);
 if(cancelMode && !retryMode)assert.doesNotMatch(exported,/参考评分：/);else assert.match(exported,/参考评分：4 \/ 5/);
 console.log('Manual Markdown export contains answer; canceled feedback excluded from scores.');
}finally{await browser.close();}
