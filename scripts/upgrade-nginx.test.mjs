import { it, expect } from 'vitest';
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { upgradedNginx, applyNginxUpgrade } from './upgrade-nginx.mjs';
const legacy = `# Managed by qinggai server-install.sh
server {
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/qgrg.bebackpacker.com/fullchain.pem;
    server_name qgrg.bebackpacker.com;
    client_max_body_size 1m;
    location / {
        proxy_pass http://127.0.0.1:9001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
server {
    listen 80;
    server_name qgrg.bebackpacker.com;
    return 301 https://$host$request_uri;
}
`;
it('旧 TLS 站点只增加大小例外，保留证书、重定向和原代理头；重复执行幂等', () => {
  const result = upgradedNginx(legacy, 9001);
  expect(result).toContain('client_max_body_size 4m;');
  expect(result).toContain(
    'ssl_certificate /etc/letsencrypt/live/qgrg.bebackpacker.com/fullchain.pem;',
  );
  expect(result).toContain('return 301 https://$host$request_uri;');
  expect(result.split('proxy_set_header Host $host;')).toHaveLength(3);
  expect(upgradedNginx(result, 9001)).toBe(result);
});
it('不修改未知站点、不同端口或重复同步路由', () => {
  expect(() =>
    upgradedNginx(
      legacy.replace('# Managed by qinggai server-install.sh', ''),
      9001,
    ),
  ).toThrow('受管');
  expect(() => upgradedNginx(legacy, 9002)).toThrow('唯一');
  const current = upgradedNginx(legacy, 9001);
  expect(() => upgradedNginx(current, 9002)).toThrow('端口');
  expect(() => upgradedNginx(current + current, 9001)).toThrow('不唯一');
});
it.each(['语法失败', '重载失败'])('%s 时恢复旧文件并保留私密备份', (mode) => {
  const dir = mkdtempSync(join(tmpdir(), 'qinggai-nginx-rollback-'));
  try {
    const site = join(dir, 'site.conf'),
      backup = join(dir, 'backup/site.conf');
    writeFileSync(site, legacy);
    let validations = 0,
      reloads = 0;
    expect(() =>
      applyNginxUpgrade(site, 9001, backup, {
        validate() {
          validations++;
          if (mode === '语法失败' && validations === 2) throw new Error(mode);
        },
        reload() {
          reloads++;
          if (mode === '重载失败' && reloads === 1) throw new Error(mode);
        },
      }),
    ).toThrow(mode);
    expect(readFileSync(site, 'utf8')).toBe(legacy);
    expect(readFileSync(backup, 'utf8')).toBe(legacy);
    expect(statSync(backup).mode & 0o777).toBe(0o600);
    expect(
      applyNginxUpgrade(site, 9001, backup, { validate() {}, reload() {} }),
    ).toBe(true);
    expect(readFileSync(backup, 'utf8')).toBe(legacy);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
it('成功升级后再次发布不重复重载，不覆盖已有备份', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qinggai-nginx-apply-'));
  try {
    const site = join(dir, 'site.conf'),
      backup = join(dir, 'backup.conf');
    writeFileSync(site, legacy);
    let reloads = 0;
    const actions = {
      validate() {},
      reload() {
        reloads++;
      },
    };
    expect(applyNginxUpgrade(site, 9001, backup, actions)).toBe(true);
    expect(applyNginxUpgrade(site, 9001, backup, actions)).toBe(false);
    expect(reloads).toBe(1);
    expect(readFileSync(backup, 'utf8')).toBe(legacy);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it('既有备份内容不同时不覆盖站点或备份', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qinggai-nginx-backup-'));
  try {
    const site = join(dir, 'site.conf'),
      backup = join(dir, 'backup.conf');
    writeFileSync(site, legacy);
    writeFileSync(backup, '原有恢复依据');
    expect(() =>
      applyNginxUpgrade(site, 9001, backup, { validate() {}, reload() {} }),
    ).toThrow('备份');
    expect(readFileSync(site, 'utf8')).toBe(legacy);
    expect(readFileSync(backup, 'utf8')).toBe('原有恢复依据');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
