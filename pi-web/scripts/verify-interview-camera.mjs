import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const credentials=JSON.parse(readFileSync(new URL('../../.runtime/integration-test-account.json',import.meta.url),'utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.addInitScript(()=>{
  window.__camera={stops:0,pending:[],defer:false};
  Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>{
   const stream=document.createElement('canvas').captureStream();
   const original=stream.getTracks()[0].stop.bind(stream.getTracks()[0]);stream.getTracks()[0].stop=()=>{window.__camera.stops++;original();};
   if(window.__camera.defer)return new Promise(resolve=>window.__camera.pending.push(()=>resolve(stream)));
   return stream;
  }}});
 });
 await page.goto('http://127.0.0.1:5173/login');await page.locator('#minos-username').fill(credentials.username);await page.locator('#minos-password').fill(credentials.password);await page.getByRole('button',{name:'登录工作区'}).click();await page.waitForURL(u=>u.pathname==='/');await page.waitForTimeout(3000);
 const permission=page.getByRole('button',{name:'我理解并启用'});if(await permission.isVisible()){await permission.click();await page.waitForTimeout(3000);}
 await page.getByRole('button',{name:'AI 面试',exact:true}).click();await page.getByRole('button',{name:'视频',exact:true}).click();await page.getByRole('button',{name:/开始.*面试/}).click();await page.getByRole('button',{name:'开启摄像头并开始',exact:true}).click();
 await page.getByRole('button',{name:'关闭摄像头',exact:true}).waitFor();
 await page.getByRole('button',{name:'暂停',exact:true}).click();await page.waitForFunction(()=>window.__camera.stops===1);
 await page.getByRole('button',{name:'继续',exact:true}).click();
 await page.evaluate(()=>window.__camera.defer=true);
 await page.getByRole('button',{name:'开启摄像头',exact:true}).click();await page.waitForFunction(()=>window.__camera.pending.length===1);
 await page.getByRole('button',{name:'退出',exact:true}).click();await page.getByRole('heading',{name:'面试复盘',exact:true}).waitFor();
 await page.evaluate(()=>window.__camera.pending.shift()());await page.waitForFunction(()=>window.__camera.stops===2);
 assert.equal(await page.locator('video').count(),0);assert.deepEqual(errors,[]);
 console.log('Video page wiring: active camera released on pause; pending permission result released after exit. Canvas stream only, not real hardware.');
}finally{await browser.close();}
