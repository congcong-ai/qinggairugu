import { describe, expect, it } from 'vitest';
import { buildShareMessage } from './share';
import { sessionIdFromRoute } from './session-route';

describe('小程序分享入口', () => {
  it('普通分享只进入首页', () => {
    expect(buildShareMessage()).toEqual({
      title: '倾盖如故 · 把每一次见面留下来',
      path: '/pages/activity/index',
    });
  });
  it('从官方小程序码进入后，分享仍保留同一个场次', () => {
    const id = sessionIdFromRoute({
      scene: '123456781234123412341234567890ab',
    });
    const share = buildShareMessage(id, ' 周末见面 ');
    expect(share.path).toBe('/pages/session/index?sid=' + id);
    expect(share.title).toBe('一起来参加：周末见面');
    expect(sessionIdFromRoute({ sid: share.path.split('sid=')[1] })).toBe(id);
  });
  it('无效场次编号回退首页，不透传注入的参数', () => {
    expect(buildShareMessage('bad&token=secret').path).toBe(
      '/pages/activity/index',
    );
  });
});
