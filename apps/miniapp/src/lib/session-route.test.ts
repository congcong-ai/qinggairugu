import { expect, it } from 'vitest';
import { sessionIdFromRoute } from './session-route';
const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
it('页面显式 sid 不被另一个活动写入的全局编号覆盖', () => {
  expect(sessionIdFromRoute({ sid: a }, b)).toBe(a);
  expect(sessionIdFromRoute({ sid: b }, a)).toBe(b);
});
it('官方 scene 还原原场次，与旧 sid 路径一致', () => {
  expect(sessionIdFromRoute({ scene: a.replaceAll('-', '') }, b)).toBe(a);
});
it('旧入口仅在没有显式编号或 scene 时使用原有当前场次', () => {
  expect(sessionIdFromRoute({}, a)).toBe(a);
  expect(sessionIdFromRoute({})).toBe('');
});
it.each([
  { scene: '%invalid' },
  { scene: 'not-a-session' },
  { sid: '../other' },
  { sid: 'bad', scene: a.replaceAll('-', '') },
])('损坏或注入路由 %j 不回退到其他场次', (options) => {
  expect(() => sessionIdFromRoute(options, a)).toThrow('活动');
});
