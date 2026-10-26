import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import ts from 'typescript';
import bundledWebpack from 'next/dist/compiled/webpack/webpack.js';
const webpack = bundledWebpack.webpack;
const output=resolve('../.runtime/card-browser');mkdirSync(output,{recursive:true});
const source=readFileSync('components/CareerGeneratedUI.tsx','utf8').replace('import "./career-generated-ui.css";','');
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
  for(const width of [1100,390]) {await page.setViewportSize({width,height:900});assert.equal(await card.evaluate(el=>el.scrollWidth>el.clientWidth+2),false);}
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.screenshot({path:'../.runtime/career-ui-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('Eight real React layouts: collapse/expand, evidence disclosure, copy, local checks, explicit draft confirmation, 390px/1100px overflow and no page errors passed.');
} finally {await browser.close();}
