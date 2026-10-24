/** 兼容旧 sid 和官方小程序码 scene；编号由页面保存，避免多个活动页面串场。 */
export function sessionIdFromRoute(
  options: { sid?: string; scene?: string },
  fallback = '',
) {
  let id = options.sid;
  if (!id && options.scene) {
    let scene: string;
    try {
      scene = decodeURIComponent(options.scene);
    } catch {
      throw new Error('活动码格式不正确，请重新扫码');
    }
    if (!/^[a-f0-9]{32}$/i.test(scene))
      throw new Error('活动码格式不正确，请重新扫码');
    id = `${scene.slice(0, 8)}-${scene.slice(8, 12)}-${scene.slice(12, 16)}-${scene.slice(16, 20)}-${scene.slice(20)}`;
  }
  id ||= fallback;
  if (
    id &&
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
  )
    throw new Error('活动编号不正确，请重新扫码');
  return id;
}
