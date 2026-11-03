import { useShareAppMessage, useShareTimeline } from '@tarojs/taro';
import { buildShareMessage } from './share';

export function usePageShare(
  getSession?: () => { id: string; title?: string },
) {
  const message = () => {
    const session = getSession?.();
    return buildShareMessage(session?.id, session?.title);
  };
  useShareAppMessage(message);
  useShareTimeline(() => {
    const share = message();
    // 朋友圈固定打开当前页；通用页面回到各自页面，不透传原来的私密参数。
    return { title: share.title, query: share.path.split('?')[1] || '' };
  });
}
