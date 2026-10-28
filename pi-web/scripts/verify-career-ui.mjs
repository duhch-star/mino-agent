import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import ts from 'typescript';
import {createJiti} from 'jiti';
const {parseCareerUI} = await createJiti(import.meta.url).import('../lib/career-ui.ts');
import bundledWebpack from 'next/dist/compiled/webpack/webpack.js';
const webpack = bundledWebpack.webpack;
const output=resolve('../.runtime/card-browser');mkdirSync(output,{recursive:true});
const source=readFileSync('components/CareerGeneratedUI.tsx','utf8').replace('import "./career-generated-ui.css";','').replace('"../lib/career-ui"',JSON.stringify(resolve(output,'protocol.cjs')));
writeFileSync(resolve(output,'protocol.cjs'),ts.transpileModule(readFileSync('lib/career-ui.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
writeFileSync(resolve(output,'entry.cjs'),compiled+`\nconst React=require('react');const {createRoot}=require('react-dom/client');window.cardRoot=createRoot(document.getElementById('root'));window.renderCard=data=>window.cardRoot.render(React.createElement(exports.CareerGeneratedUI,{key:data.type,data,onAction:prompt=>{window.drafts.push(prompt)}}));window.drafts=[];`);
await new Promise((ok,fail)=>webpack({mode:'development',devtool:false,entry:resolve(output,'entry.cjs'),output:{path:output,filename:'bundle.js'},resolve:{modules:[resolve('node_modules')]}}).run((error,stats)=>error||stats.hasErrors()?fail(error||new Error(stats.toString())):ok()));
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1100,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 // Isolated harness of actual component source; no production server needed.
 await page.setContent('<html><body style="margin:20px;background:#f4f5f7;color:#182221"><div id="root"></div></body></html>');
 await page.addStyleTag({content:':root{--bg:#f4f5f7;--bg-panel:#fff;--text:#182221;--text-muted:#536358;--border:#ccd6cf;--accent:#387d60}'+readFileSync('components/career-generated-ui.css','utf8')});
 await page.addScriptTag({path:resolve(output,'bundle.js')});
 await page.evaluate(()=>{window.copied='';Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copied=text;}}});});
 const items=[{id:'one',title:'研发岗位 A',description:'真实材料中的岗位条件',status:'strength',evidence:'用户提供的 JD'},{id:'two',title:'研发岗位 B',status:'unknown',description:'薪酬尚待确认'}];
 for(const type of ['job-match','resume-review','interview-feedback','action-plan','application-tracker','learning-roadmap','offer-compare','skill-matrix']) {
  await page.evaluate(data=>window.renderCard(data),{version:1,type,title:'生成式体验 · '+type,items});
  const card=page.locator('.career-ui-'+type);await card.waitFor();
  await card.getByRole('button',{name:'收起卡片'}).click();assert.equal(await card.locator('.career-body').isVisible(),false);
  await card.getByRole('button',{name:'展开卡片'}).click();await card.locator('summary').first().click();
  await card.locator('details[open]').first().waitFor();
  await card.getByRole('button',{name:/复制生成式体验/}).click();await card.getByRole('status').filter({hasText:'已复制'}).waitFor();assert.match(await page.evaluate(()=>window.copied),/研发岗位 A/);
  if(type==='offer-compare') {await card.getByRole('button',{name:'选择深入比较'}).first().click();assert.equal(await page.evaluate(()=>window.drafts.length),0);await card.getByRole('button',{name:/将比较问题填入草稿/}).click();assert.equal(await page.evaluate(()=>window.drafts.length),1);}
  if(type==='action-plan') {await card.getByRole('checkbox').first().check();assert.match(await card.locator('.career-notice').textContent(),/1 \/ 2/);}
  if(type==='learning-roadmap') {
   const reset=card.getByRole('button',{name:'重置本地进度',exact:true});assert.equal(await reset.isDisabled(),true);
   const check=card.getByRole('checkbox').first();await check.focus();await page.keyboard.press('Space');
   await card.getByRole('status').filter({hasText:'本地练习进度 1 / 2'}).waitFor();assert.equal(await reset.isDisabled(),false);
   await reset.click();assert.equal(await check.isChecked(),false);assert.equal(await reset.isDisabled(),true);
  }
  if(type==='skill-matrix') {
   const gap=card.getByRole('button',{name:'待提升0',exact:true});await gap.focus();await page.keyboard.press('Enter');
   await card.getByText('当前筛选暂无项目，可切换“全部”查看。',{exact:true}).waitFor();assert.equal(await gap.getAttribute('aria-pressed'),'true');
   await card.getByRole('button',{name:'待确认1',exact:true}).click();assert.equal(await card.locator('.career-skill-grid article').count(),1);
   await card.getByRole('button',{name:'全部2',exact:true}).click();assert.equal(await card.locator('.career-skill-grid article').count(),2);
  }
  for(const width of [1100,390]) {await page.setViewportSize({width,height:900});assert.equal(await card.evaluate(el=>el.scrollWidth>el.clientWidth+2),false);}
 }
 if(process.argv.includes('--real-model')) {
  const sample=JSON.parse(readFileSync('../.runtime/career-model-probe.json','utf8'));
  assert.equal(sample.mocked,false);
  const parsed=parseCareerUI(sample.text);const cards=parsed.segments.filter(s=>s.kind==='ui');
  assert.equal(cards.length,1,'Real model failed to emit one validated card');assert.equal(cards[0].data.type,'skill-matrix');
  await page.evaluate(data=>window.renderCard(data),cards[0].data);
  await page.getByRole('heading',{name:cards[0].data.title,exact:true}).waitFor();
  assert.equal(await page.locator('.career-skill-grid article').count(),3);
  console.log('Real model -> strict protocol parser -> actual React skill matrix browser render passed.');
 }
 // Theme and keyboard checks on the actual rendered component.
 for(const dark of [false,true]) {
  await page.evaluate(dark=>{const s=document.documentElement.style;s.colorScheme=dark?'dark':'light';s.setProperty('--bg-panel',dark?'#19201e':'#ffffff');s.setProperty('--text',dark?'#e6eae6':'#182221');s.setProperty('--text-muted',dark?'#a2aaa3':'#536358');},dark);
  for(const type of ['learning-roadmap','offer-compare','skill-matrix']) {
   await page.evaluate(data=>window.renderCard(data),{version:1,type,title:'主题与键盘验收',items});
   const card=page.locator('.career-ui-'+type);await card.waitFor();
   const ratio=await card.evaluate(el=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
    const rgb=value=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);};
    const color=rgb(getComputedStyle(el.querySelector('.career-kicker')).color);
    const bg=rgb(getComputedStyle(el).backgroundColor);
    const lum=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
    const a=lum(color),b=lum(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   });assert.ok(ratio>=4.5,`${type} theme contrast ${ratio}`);
   const toggle=card.locator('button[aria-controls]');await toggle.focus();await page.keyboard.press('Enter');assert.equal(await toggle.getAttribute('aria-expanded'),'false');await page.keyboard.press('Enter');assert.equal(await toggle.getAttribute('aria-expanded'),'true');
   const evidence=card.locator('summary').first();await evidence.focus();await page.keyboard.press('Enter');await card.locator('details[open]').waitFor();
  }
 }
 await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw new Error('denied');};});
 await page.locator('.career-ui').getByRole('button',{name:/复制/}).click();
 await page.getByRole('status').filter({hasText:'复制失败，请手动选择文字'}).waitFor();
 console.log('Clipboard denial is recoverable. Light/dark accent contrast >= 4.5:1 and keyboard disclosure/collapse passed.');
 await page.emulateMedia({reducedMotion:'reduce'});await page.screenshot({path:'../.runtime/career-ui-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('Eight real React layouts: collapse/expand, evidence disclosure, copy, local checks, explicit draft confirmation, 390px/1100px overflow and no page errors passed.');
} finally {await browser.close();}
