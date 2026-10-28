import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../../.runtime/',import.meta.url);
const credentials=JSON.parse(readFileSync(new URL('integration-test-account.json',root),'utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1366,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto('http://127.0.0.1:5173/login');await page.locator('#minos-username').fill(credentials.username);await page.locator('#minos-password').fill(credentials.password);await page.getByRole('button',{name:'登录工作区'}).click();await page.waitForURL(u=>u.pathname==='/');await page.waitForTimeout(3500);
 const permission=page.getByRole('button',{name:'我理解并启用'});if(await permission.isVisible()){await permission.click();await page.waitForTimeout(3500);}
 const composer=page.getByRole('textbox',{name:'告诉 MINO 你的求职需求',exact:true});await composer.waitFor();
 const prompt='验收场景：我目标初级前端开发，会 React，课程项目做过搜索页面，排查重复请求后加防抖和旧请求取消，没有量化数据。请直接用一个 skill-matrix 交互卡片列3项能力（优势与未知项），不要评分，不调用工具。附一个继续完善的草稿按钮。';
 await composer.fill(prompt);const started=Date.now();await composer.press('Enter');
 const card=page.locator('.career-ui-skill-matrix').last();await card.waitFor({timeout:90000});
 await card.locator('.career-actions button').first().waitFor({timeout:10000});
 const title=await card.locator('h3').textContent();
 await card.locator('.career-actions button').first().click();
 await page.waitForFunction(()=>document.querySelector('.chat-input-textarea')?.value.trim().length>0);
 const draft=await composer.inputValue();assert.notEqual(draft,prompt);assert.ok(draft.length>0);
 assert.equal(await card.locator('.career-skill-grid article').count(),3);
 assert.deepEqual(errors,[]);
 const result={mocked:false,elapsedMs:Date.now()-started,title,items:3,draftOnly:true,pageErrors:errors};
 writeFileSync(new URL('pi-generative-e2e.json',root),JSON.stringify(result,null,2));
 await page.screenshot({path:'../.runtime/pi-generative-e2e.png',fullPage:true});console.log(JSON.stringify(result,null,2));
}catch(error){console.log('PAGE:',await page.locator('body').innerText());await page.screenshot({path:'../.runtime/pi-generative-failure.png',fullPage:true});throw error;}finally{await browser.close();}
