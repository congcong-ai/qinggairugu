/** 所有人可见的离线示例；不写入个人数据库、不调用模型或联网。 */
export const exampleSession = {
  title: '示例 · AI 硬件交流',
  summary:
    '小林和阿禾讨论了如何先验证录音硬件的实际需求，再安排小范围试用。双方决定先关注锁屏录音可靠性与用户知情提示。',
  topics: ['AI 硬件', '锁屏录音', '用户试用'],
  actions: [
    '小林：周五前完成锁屏录音测试。',
    '阿禾：邀请三位活动组织者试用，并记录反馈。',
  ],
  segments: [
    {
      id: 'example-1',
      speaker: '小林',
      time: '00:12',
      text: '我们先验证 AI 硬件的实际需求，第一步是保证锁屏后录音还能继续。',
      tags: ['硬件', '锁屏', '录音', '后台', '可靠'],
    },
    {
      id: 'example-2',
      speaker: '阿禾',
      time: '00:38',
      text: '我来邀请三位活动组织者试用，录音前要让在场的人知道并同意。',
      tags: ['试用', '用户', '组织者', '同意', '隐私'],
    },
    {
      id: 'example-3',
      speaker: '小林',
      time: '01:05',
      text: '我周五前完成锁屏录音测试，你收集试用反馈，我们再决定下一版做什么。',
      tags: ['行动', '安排', '周五', '测试', '反馈', '下一版'],
    },
  ],
};
export function searchExample(query: string) {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/[\s，。？！、,.?!]+/)
    .filter(Boolean);
  if (!terms.length) return [];
  return exampleSession.segments.filter((segment) =>
    terms.some(
      (term) =>
        segment.text.toLowerCase().includes(term) ||
        segment.tags.some((tag) => term.includes(tag)),
    ),
  );
}
