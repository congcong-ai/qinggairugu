import QRCode from 'qrcode';
import { z } from 'zod';
export type MiniappEnv = 'release' | 'trial' | 'develop';
export async function sessionQr(
  id: string,
  appId?: string,
  secret?: string,
  miniappEnv: MiniappEnv = 'release',
  page = 'pages/session/index',
) {
  const miniappPath = `/${page}?sid=${id}`;
  if (!appId || !secret)
    return {
      mode: 'debug',
      miniappPath,
      imageDataUrl: await QRCode.toDataURL(miniappPath, {
        width: 600,
        margin: 4,
      }),
    };
  const tokenUrl = new URL('https://api.weixin.qq.com/cgi-bin/token');
  tokenUrl.search = new URLSearchParams({
    grant_type: 'client_credential',
    appid: appId,
    secret,
  }).toString();
  const authResponse = await fetch(tokenUrl, {
    signal: AbortSignal.timeout(10000),
  });
  const auth = z
    .object({ access_token: z.string() })
    .parse(await authResponse.json());
  const result = await fetch(
    `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${encodeURIComponent(auth.access_token)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        scene: id.replaceAll('-', ''),
        page,
        width: 600,
        check_path: miniappEnv === 'release',
        env_version: miniappEnv,
      }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!result.ok || !result.headers.get('content-type')?.startsWith('image/'))
    throw new Error('小程序码生成失败');
  return {
    mode: 'wechat',
    miniappPath,
    imageDataUrl: `data:image/png;base64,${Buffer.from(await result.arrayBuffer()).toString('base64')}`,
  };
}
