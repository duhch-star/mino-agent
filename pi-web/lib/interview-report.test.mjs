import test from 'node:test';
import assert from 'node:assert/strict';
import {interviewReportMarkdown} from '../components/minos/lib/interview-report.mjs';
test('report contains completed feedback and original evidence',()=>{
 const text=interviewReportMarkdown({position:'前端',transcript:[{q:'问题',a:'真实回答',feedback:{score:4,reply:'建议',dimensions:[{name:'结构',stars:4,note:'先后顺序'}],strengths:['职责'],suggestions:['结果'],starExample:'S/T/A/R'}}],messages:[]});
 for(const value of ['真实回答','参考评分：4 / 5','先后顺序','S/T/A/R','不构成招聘'])assert.ok(text.includes(value));
});
test('unfinished answer is retained as conversation only, never scored',()=>{
 const text=interviewReportMarkdown({transcript:[],messages:[{role:'user',text:'未完成回答'}],feedbackPreview:{reply:'不应该导出成最终反馈'}});
 assert.match(text,/未完成回答/);assert.match(text,/没有完成评分/);assert.doesNotMatch(text,/参考评分：|不应该导出/);
});
test('model and user markup stays literal in Markdown',()=>{
 const text=interviewReportMarkdown({messages:[{role:'user',text:'<script>alert(1)</script> ![x](https://bad.test)\n# fake'}]});
 assert.ok(text.includes('\\<script\\>'));assert.ok(text.includes('\\!\\[x\\]'));assert.ok(text.includes('\\# fake'));
});
