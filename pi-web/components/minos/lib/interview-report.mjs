/** Data-only Markdown export. Unfinished previews never become scored entries. */
const literal = value => String(value ?? '').replace(/\r\n?/g,'\n').replace(/[\\`*_{}\[\]<>#!|~]/g,'\\$&').replace(/\n/g,'  \n');
export function interviewReportMarkdown({position='',transcript=[],messages=[]}) {
 const lines=['# 面试练习复盘',`岗位：${literal(position)}`,'仅供练习参考，不构成招聘、录用或人格判断。','以下评分仅包含已完成反馈；未完成、取消或失败的反馈不计分。'];
 if(!transcript.length)lines.push('本次没有完成评分的回答。');
 transcript.forEach((entry,index)=>{
  const f=entry.feedback;
  lines.push(`## 第 ${index+1} 题`, `问题：${literal(entry.q)}`,`原始回答：${literal(entry.a)}`,`参考评分：${f.score} / 5`,`反馈：${literal(f.reply)}`,'### 维度与依据');
  f.dimensions.forEach(d=>lines.push(`- ${literal(d.name)}：${d.stars} / 5 — ${literal(d.note)}`));
  lines.push('### 优点',...f.strengths.map(s=>`- ${literal(s)}`),'### 改进建议',...f.suggestions.map(s=>`- ${literal(s)}`),'### STAR 练习示例',literal(f.starExample));
 });
 lines.push('## 本次对话记录','记录可能包含尚未评分的回答，不代表均已完成反馈。');
 messages.forEach(m=>lines.push(`**${m.role==='user'?'你':'面试官'}**`,literal(m.text)));
 return lines.join('\n\n')+'\n';
}
export function downloadInterviewReport(data) {
 const blob=new Blob([interviewReportMarkdown(data)],{type:'text/markdown;charset=utf-8'});
 const url=URL.createObjectURL(blob),anchor=document.createElement('a');
 anchor.href=url;anchor.download='interview-practice-report.md';document.body.append(anchor);anchor.click();anchor.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
