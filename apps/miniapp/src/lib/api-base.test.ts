import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRuntimePlatform, resolveApiBase } from './api-base';

afterEach(() => vi.unstubAllGlobals());

describe('miniapp API host selection', () => {
  it('reads the platform from the current WeChat device API', () => {
    vi.stubGlobal('wx', {
      getDeviceInfo: () => ({ platform: 'devtools' }),
    });

    expect(getRuntimePlatform()).toBe('devtools');
  });

  it('falls back to the legacy system info API when needed', () => {
    vi.stubGlobal('wx', {
      getSystemInfoSync: () => ({ platform: 'ios' }),
    });

    expect(getRuntimePlatform()).toBe('ios');
  });

  it('uses the local API only in WeChat DevTools', () => {
    expect(resolveApiBase('devtools')).toBe('http://127.0.0.1:9001');
  });

  it.each(['ios', 'android', 'windows', 'mac', undefined])(
    'uses the production API on platform %s',
    (platform) => {
      expect(resolveApiBase(platform)).toBe('https://qgrg.bebackpacker.com');
    },
  );
});
