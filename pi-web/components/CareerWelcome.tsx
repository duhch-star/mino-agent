"use client";

import Image from "next/image";
import "./minos-career.css";

const CAREER_TASKS = [
  { title: "建立简历", detail: "把经历变成亮点", icon: "resume", prompt: "我想建立一份适合目标岗位的简历。请先了解我的求职方向和经历，帮我梳理简历结构与亮点。" },
  { title: "匹配岗位", detail: "找到适合的机会", icon: "match", prompt: "我想分析自己与目标岗位的匹配度。我会提供简历和岗位 JD，请帮我找出优势、差距和简历优化方向。" },
  { title: "模拟面试", detail: "让下一次表达更从容", icon: "interview", prompt: "我想进行一场模拟面试。请先询问我的目标岗位和经验，再逐题提问，并在我回答后给出反馈。" },
  { title: "求职规划", detail: "生成可勾选行动清单", icon: "plan", prompt: "我想制定一份可执行的求职计划。请先了解我的背景、目标岗位和时间安排，再用交互行动清单一起确定步骤。" },
  { title: "简历精修", detail: "逐条查看修改前后对照", icon: "resume", prompt: "我会提供简历原文。请针对目标岗位提出修改建议，并用前后对照卡展示。保留真实事实，不虚构经历或数字，先不要自动保存。" },
  { title: "成长路线", detail: "把技能提升拆成阶段里程碑", icon: "plan", prompt: "请先了解我的目标岗位、现有技能和每周可投入时间，再用 learning-roadmap 成长路线卡展示阶段、产出与验收方式，不编造日期。" },
  { title: "机会对比", detail: "并列比较岗位与 Offer", icon: "match", prompt: "我想比较几个岗位或 Offer。请先收集真实条件和我的优先级，用 offer-compare 卡列出事实、风险和未知项，不替我接受或投递。" },
  { title: "能力盘点", detail: "用证据识别优势与未知项", icon: "resume", prompt: "请通过我的项目经历和目标岗位要求做一次技能盘点，用 skill-matrix 能力矩阵展示优势、待提升和未知项，没有证据不要打零分。" },
  { title: "投递进展", detail: "把机会整理成进展看板", icon: "match", prompt: "我想梳理已有的投递进度。请先询问公司、岗位、实际进展和下一步，再用投递看板展示。不要代替我投递，也不要虚构面试或录用状态。" },
] as const;

function TaskIcon({ kind }: { kind: typeof CAREER_TASKS[number]["icon"] }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === "resume" && <><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5M9 12h6M9 16h6" /></>}
      {kind === "match" && <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5m-13-10 2 2 4-4" /></>}
      {kind === "interview" && <><path d="M20 11a7 7 0 0 1-7 7H8l-5 3V7a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3z" /><path d="M7 9h9M7 13h5" /></>}
      {kind === "plan" && <><path d="M5 21V4m0 1c5-5 9 5 14 0v10c-5 5-9-5-14 0" /></>}
    </svg>
  );
}

export function CareerWelcome({ onChooseTask }: { onChooseTask: (prompt: string) => void }) {
  return (
    <section className="minos-career-welcome" aria-labelledby="minos-career-heading">
      <div className="minos-career-brand">
        <Image src="/icons/minos-mark.svg" width={46} height={46} alt="" priority className="minos-career-logo" />
        <div>
          <p className="minos-career-name">MINO AGENT</p>
          <h1 id="minos-career-heading">你的求职搭档</h1>
        </div>
      </div>
      <div className="minos-career-tasks" aria-label="选择求职任务，填入草稿">
        {CAREER_TASKS.map((task) => (
          <button key={task.title} type="button" className="minos-career-task" onClick={() => onChooseTask(task.prompt)} title={`将「${task.title}」填入输入框`}>
            <span className="minos-career-task-icon"><TaskIcon kind={task.icon} /></span>
            <span className="minos-career-task-copy"><strong>{task.title}</strong><span>{task.detail}</span></span>
            <span className="minos-career-task-arrow" aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
    </section>
  );
}
