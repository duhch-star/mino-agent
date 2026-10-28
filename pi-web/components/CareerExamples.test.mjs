import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createJiti} from 'jiti';
import {fileURLToPath} from 'node:url';
const jiti=createJiti(import.meta.url,{jsx:{runtime:'automatic'}});
const React=await jiti.import('react');
const {renderToStaticMarkup}=await jiti.import('react-dom/server');
const source=readFileSync(new URL('./CareerExamples.tsx',import.meta.url),'utf8').replace("import './career-examples.css';",'');
const {CareerExamples}=jiti.evalModule(source,{filename:fileURLToPath(new URL('./CareerExamples.tsx',import.meta.url))});
test('welcome examples are opt-in and do not load PDF embeds',()=>{
 const html=renderToStaticMarkup(React.createElement(CareerExamples,{onChooseTask:()=>{}}));
 assert.match(html,/查看简历案例/);assert.match(html,/aria-expanded="false"/);
 assert.doesNotMatch(html,/<iframe|<object|<embed|<img/);
});
test('real rendered thumbnails exist and example prompts never import author facts',()=>{
 for(const id of ['classic','sidebar'])assert.ok(existsSync(new URL(`../public/examples/${id}.png`,import.meta.url)));
 const source=readFileSync(new URL('./CareerExamples.tsx',import.meta.url),'utf8');
 assert.match(source,/不要导入示例作者/);assert.match(source,/只填入草稿/);assert.doesNotMatch(source,/fetch\(|method:\s*['"]POST/);
 assert.match(source,/resource=license/);
});
