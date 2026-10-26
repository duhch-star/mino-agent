"use client";
import './career-tool-bar.css';
export const CAREER_CHAT_TOOLS = [
  { name: '简历优化', icon: '▤', prompt: '请帮我优化简历。我会提供原文和目标岗位，请先了解资料，再展示前后对照建议，不虚构经历；如需保存请真实调用简历工具。' },
  { name: '岗位匹配', icon: '◎', prompt: '请帮我分析岗位匹配。我会提供简历和JD，请按要求、已有证据、优势与待补充项生成匹配卡片，不虚构匹配分数。' },
  { name: 'STAR 整理', icon: '◇', prompt: '请帮我把经历整理成STAR案例。先问我真实的情境、任务、个人行动和结果，不编造数据，并展示原文与建议表达对照。' },
  { name: '面试练习', icon: '♧', prompt: '请担任AI面试官。先确认我的目标岗位和经验，一次问一道题，等我回答后给出有依据的反馈，再继续下一题。' },
] as const;
const RESUME_TOOLS = [
 {name:'读取简历',icon:'▤',prompt:'请真实调用resume_read，读取本会话简历和当前修订号，并展示内容。'},
 {name:'修改简历',icon:'◇',prompt:'我要修改LaTeX简历。请先真实调用resume_read，再询问我需要修改的内容；先展示修改前后优化对比及修改理由，确认后用resume_update保存，保留其他字段，不虚构经历；保存后自动编译并打开最新PDF，编译失败需明确说明。'},
 {name:'选择模板',icon:'▧',prompt:'请读取本会话简历，向我介绍classic单栏和sidebar双栏原版LaTeX模板。等我选择后再调用resume_set_template，保留简历内容。'},
 {name:'生成 PDF',icon:'↗',prompt:'请真实调用resume_compile编译当前LaTeX简历PDF，并提供可打开的PDF文件。若没有简历，请先说明需要建立简历，不要虚构文件。'},
];
export function CareerToolBar({ onChoose }: { onChoose: (prompt: string) => void }) {
 return <div className="career-chat-toolbar" role="group" aria-label="求职与LaTeX简历工具"><span className="career-chat-toolbar-label">求职工具</span>{[...CAREER_CHAT_TOOLS, ...RESUME_TOOLS].map(tool=><button key={tool.name} type="button" title={`${tool.name}：填入草稿，确认后发送`} onClick={()=>onChoose(tool.prompt)}><span aria-hidden="true">{tool.icon}</span>{tool.name}</button>)}</div>;
}
