import { describe, expect, it } from 'vitest';
import { exampleSession, searchExample } from './example-experience';
describe('公开离线示例的来源搜索', () => {
  it('自然问题能找回对应原文，返回的来源来自示例原文', () => {
    const hits = searchExample('谁来邀请组织者试用？');
    expect(hits.some((hit) => hit.speaker === '阿禾')).toBe(true);
    for (const hit of hits) expect(exampleSession.segments).toContain(hit);
  });
  it('没有匹配时不编造回答或引用', () => {
    expect(searchExample('量子计算融资')).toEqual([]);
    expect(searchExample('   ')).toEqual([]);
  });
  it('可通过行动问题找回明确的时间和责任人', () => {
    expect(searchExample('行动安排')).toEqual([exampleSession.segments[2]]);
  });
});
