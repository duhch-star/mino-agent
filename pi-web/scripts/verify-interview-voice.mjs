import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const credentials=JSON.parse(readFileSync(new URL('../../.runtime/integration-test-account.json',import.meta.url),'utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1366,height:900}});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
let cloudRequests=0;
page.on('request',request=>{if(new URL(request.url()).pathname==='/api/business/interview/speech')cloudRequests++;});
try {
  // Deterministic media adapters: validate real UI wiring, not provider performance.
  await page.addInitScript(()=>{
    window.__voice={starts:0,cancels:0};
    class Utterance { constructor(text){this.text=text;} }
    window.SpeechSynthesisUtterance=Utterance;
    Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{lang:'zh-CN',voiceURI:'test-local',name:'验收音色',localService:true}],addEventListener(){},removeEventListener(){},cancel(){window.__voice.cancels++;},speak(u){window.__voice.starts++;setTimeout(()=>u.onstart?.(),30);}}});
    class Recognition { start(){this.onstart?.();} abort(){this.onend?.();} }
    window.SpeechRecognition=Recognition;
  });
  await page.route('**/api/business/interview/speech/config',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({configured:false})}));
  await page.route('**/api/business/interview/speech',route=>route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({error:{message:'验收模拟云端故障'}})}));
  await page.goto('http://127.0.0.1:5173/login');
  await page.locator('#minos-username').fill(credentials.username);await page.locator('#minos-password').fill(credentials.password);
  await page.getByRole('button',{name:'登录工作区'}).click();await page.waitForURL(url=>url.pathname==='/');
  await page.waitForTimeout(3000);
  const permission=page.getByRole('button',{name:'我理解并启用'});if(await permission.isVisible()){await permission.click();await page.waitForTimeout(3500);}
  await page.getByRole('button',{name:'AI 面试',exact:true}).click();
  await page.getByRole('button',{name:'语音',exact:true}).click();
  await page.getByRole('button',{name:/开始.*面试/}).click();
  await page.getByRole('button',{name:'开始面试',exact:true}).click();
  await page.getByText('本轮首响', {exact:false}).waitFor();
  assert.equal(cloudRequests,0,'Auto mode must not call unconfigured cloud');
  await page.getByLabel('声音来源').selectOption('mambo');
  await page.getByText('云端语音未就绪，请改用浏览器语音或文字。',{exact:true}).waitFor();
  assert.equal(cloudRequests,1,'Explicit cloud selection should remain available');
  assert.equal(await page.getByRole('checkbox',{name:/开启停顿自动提交/}).isChecked(),false);
  await page.getByLabel('声音来源').selectOption('browser');
  await page.getByRole('button',{name:'停止播报 · 我要回答'}).click();
  await page.waitForTimeout(100);
  await page.getByRole('button',{name:'重播当前内容'}).click();
  await page.waitForTimeout(100);
  assert.ok((await page.evaluate(()=>window.__voice)).starts>=2);
  await page.locator('textarea.composerInput').fill('我的回答先保留为草稿，不自动发送。');
  assert.equal(await page.locator('textarea.composerInput').inputValue(),'我的回答先保留为草稿，不自动发送。');
  await page.getByRole('button',{name:'文字更正 / 手动提交',exact:true}).click();
  // End editing by restarting voice, then test hiding while playback is active.
  await page.getByRole('button',{name:'重试收音',exact:true}).click();
  await page.getByRole('button',{name:'重播当前内容',exact:true}).click();
  await page.getByText('面试官正在播报',{exact:true}).waitFor();
  const beforeHidden=await page.evaluate(()=>window.__voice.cancels);
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  await page.getByRole('button',{name:'继续',exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>window.__voice.cancels)>beforeHidden);
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await page.getByRole('button',{name:'继续',exact:true}).isVisible(),true,'Returning visible must not auto resume');
  assert.equal(await page.locator('textarea.composerInput').inputValue(),'我的回答先保留为草稿，不自动发送。');
  await page.getByRole('button',{name:'继续',exact:true}).click();
  await page.screenshot({path:'../.runtime/interview-voice-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'../.runtime/interview-voice-mobile.png',fullPage:true});
  const overflow=await page.locator('.interviewRoom').evaluate(el=>el.scrollWidth>el.clientWidth+2);assert.equal(overflow,false);
  assert.deepEqual(errors,[]);
  console.log('Real interview UI: cloud failure fallback, onset metric, interruption, replay, manual draft, default submission safety and 390px overflow passed. Media mocked; no real voice latency claimed.');
} catch(e) { console.log(await page.locator('body').innerText());await page.screenshot({path:'../.runtime/voice-failure.png',fullPage:true});throw e; } finally {await browser.close();}
