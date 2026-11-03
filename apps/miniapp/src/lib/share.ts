import { sessionIdFromRoute } from './session-route';

const homePath = '/pages/activity/index';
const homeTitle = '倾盖如故 · 把每一次见面留下来';

/** 只携带公开入口和场次编号，不携带身份凭证或私人内容。 */
export function buildShareMessage(sessionId = '', title = '') {
  if (!sessionId) return { title: homeTitle, path: homePath };
  try {
    sessionIdFromRoute({ sid: sessionId });
  } catch {
    return { title: homeTitle, path: homePath };
  }
  return {
    title: title.trim()
      ? `一起来参加：${title.trim()}`
      : '邀请你加入这场见面 · 倾盖如故',
    path: `/pages/session/index?sid=${encodeURIComponent(sessionId)}`,
  };
}
