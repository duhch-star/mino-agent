// 面试题库（演示数据）。正式版由后端按岗位/难度下发题目与结构化反馈。

export const positions = ['产品经理', '后端开发', '前端开发', '数据分析']

export const difficulties = ['初级', '中级', '高级']

export const questionBank = {
  产品经理: [
    '请用 STAR 结构描述一次你推动项目落地的经历，重点说明你的具体行动。',
    '如果产品上线后数据不达预期，你会从哪些角度排查？',
    '说说一款你常用的产品，你会如何改进它？',
  ],
  后端开发: [
    '请描述一次你排查线上性能问题的过程，最后如何定位和解决的？',
    '你如何设计一个高并发下的接口？请说明你的考虑。',
    '谈谈你对数据库索引的理解，以及一个用错的案例。',
  ],
  前端开发: [
    '请讲一次你优化前端首屏性能的经历，最终指标提升了多少？',
    '你如何组织一个中型前端项目的目录与状态管理？',
    '谈谈你对组件复用与抽象边界的理解。',
  ],
  数据分析: [
    '请描述一次你用数据发现业务问题的经历，结论如何落地？',
    '面对一份缺失较多的数据，你会怎么清洗和处理？',
    '解释一下 A/B 测试中你如何判断结果是否显著。',
  ],
}

export const durations = ['10 分钟', '20 分钟', '30 分钟']

// 根据回答生成结构化反馈（演示逻辑，正式版由 LLM 按维度输出并映射章节）
export function makeFeedback(position, question, answer) {
  const text = answer || ''
  const len = text.length
  const hasData = /\d/.test(text)
  const hasSelf = /我/.test(text)

  const structure = len > 50 ? 4 : len > 25 ? 3 : 2
  const relevance = hasSelf ? 4 : 3
  const clarity = len > 70 ? 4 : len > 35 ? 3 : 2

  const dimensions = [
    { name: '结构完整度', stars: structure, note: structure >= 4 ? '有情境、行动与结果' : '缺少行动或结果，建议用 STAR 结构' },
    { name: '岗位相关性', stars: relevance, note: relevance >= 4 ? '能突出个人贡献' : '多用「我」而非「我们」' },
    { name: '表达清晰度', stars: clarity, note: clarity >= 4 ? '有细节、逻辑清晰' : '可补充更具体的细节' },
  ]
  const score = Math.round((structure + relevance + clarity) / 3)

  return {
    score,
    dimensions,
    strengths: [
      hasSelf ? '突出个人贡献' : '建议多用「我」',
      hasData ? '有量化数据' : '建议补量化结果',
    ],
    suggestions: structure < 4
      ? ['用 STAR 结构展开：情境 → 任务 → 行动 → 结果']
      : ['可再补一个量化结果增强说服力'],
    starExample:
      'S（情境）：在一次 XX 项目中……\nT（任务）：我负责……\nA（行动）：我具体做了……（突出「我」做了什么）\nR（结果）：带来……（尽量量化）',
    chapterId: structure < 4 ? 'star' : 'behavior',
  }
}
