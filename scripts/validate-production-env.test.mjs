import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const script = fileURLToPath(
  new URL('./validate-production-env.mjs', import.meta.url),
);
const valid = {
  NODE_ENV: 'production',
  HOST: '127.0.0.1',
  PORT: '10240',
  DATABASE_URL: 'postgresql://qinggai:test-db-password@127.0.0.1:5432/qinggai',
  WECHAT_APP_ID: 'wx066bf055f6b9d415',
  WECHAT_APP_SECRET: 'test-wechat-secret',
  ALLOW_DEV_AUTH: 'false',
  WECHAT_MINIAPP_ENV: 'release',
};
function validate(overrides = {}) {
  return spawnSync(process.execPath, [script], {
    env: { ...valid, ...overrides },
    encoding: 'utf8',
  });
}
describe('生产配置校验', () => {
  it('只接受正式版小程序码', () => {
    expect(validate({ WECHAT_MINIAPP_ENV: 'release' }).status).toBe(0);
  });
  it.each(['trial', 'develop', 'trail'])('拒绝 %s 小程序码', (env) => {
    const result = validate({ WECHAT_MINIAPP_ENV: env });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('WECHAT_MINIAPP_ENV');
    expect(result.stderr).toContain('生产环境不能使用体验版或开发版');
    expect(result.stderr).not.toContain(valid.WECHAT_APP_SECRET);
    expect(result.stderr).not.toContain('test-db-password');
  });
  it('一次报告多项错误，数据库解析异常与百炼 Key 不泄漏', () => {
    const result = validate({
      DATABASE_URL: 'invalid-test-db-password',
      WECHAT_APP_SECRET: '',
      ALLOW_DEV_AUTH: 'true',
      DASHSCOPE_API_KEY: 'test-bailian-secret',
    });
    expect(result.status).toBe(1);
    for (const key of [
      'DATABASE_URL',
      'WECHAT_APP_SECRET',
      'ALLOW_DEV_AUTH',
      'DASHSCOPE_API_KEY',
    ])
      expect(result.stderr).toContain(key);
    expect(result.stderr).not.toContain('invalid-test-db-password');
    expect(result.stderr).not.toContain('test-bailian-secret');
    expect(result.stderr).not.toContain('Error:');
  });
});
