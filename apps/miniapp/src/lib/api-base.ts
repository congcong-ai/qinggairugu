const localApiBase = 'http://127.0.0.1:9001';
const productionApiBase = 'https://qgrg.bebackpacker.com';

type WechatRuntime = {
  getDeviceInfo?: () => { platform?: string };
  getSystemInfoSync?: () => { platform?: string };
};

export function getRuntimePlatform(): string | undefined {
  const wxRuntime = (globalThis as typeof globalThis & { wx?: WechatRuntime })
    .wx;
  if (!wxRuntime) return undefined;

  try {
    return (
      wxRuntime.getDeviceInfo?.().platform ??
      wxRuntime.getSystemInfoSync?.().platform
    );
  } catch {
    return undefined;
  }
}

export function resolveApiBase(platform: string | undefined): string {
  return platform === 'devtools' ? localApiBase : productionApiBase;
}
