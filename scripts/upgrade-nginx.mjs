// 仅给现有受管站点追加私有文字同步大小例外，保留 Certbot 的 TLS 配置。
import {
  readFileSync,
  writeFileSync,
  renameSync,
  lstatSync,
  mkdirSync,
  existsSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
export function upgradedNginx(content, port) {
  if (!/^\d+$/.test(String(port)) || Number(port) < 1 || Number(port) > 65535)
    throw new Error('API 端口不正确');
  if (!content.includes('# Managed by qinggai server-install.sh'))
    throw new Error('不是倾盖如故受管站点，停止自动修改');
  const proxy = `proxy_pass http://127.0.0.1:${port};`;
  const exact = /(^[ \t]*)location\s*=\s*\/me\/private-ai\s*\{([^{}]*)\}/gm;
  const matches = [...content.matchAll(exact)];
  if (matches.length > 1) throw new Error('同步代理配置不唯一，需要人工核对');
  if (matches.length) {
    const match = matches[0];
    if (!match[2].includes(proxy))
      throw new Error('同步代理端口不符，停止修改');
    if (/client_max_body_size\s+4m\s*;/i.test(match[2])) return content;
    const body = match[2]
      .replace(/client_max_body_size\s+[^;]+;/g, '')
      .trimEnd();
    return content.replace(
      exact,
      `${match[1]}location = /me/private-ai {${body}\n${match[1]}    client_max_body_size 4m;\n${match[1]}}`,
    );
  }
  const roots = [
    ...content.matchAll(/(^[ \t]*)location\s+\/\s*\{([^{}]*)\}/gm),
  ].filter((match) => match[2].includes(proxy));
  if (roots.length !== 1)
    throw new Error('未找到唯一的原 API 代理，请核对站点配置');
  const [match] = roots;
  const body = match[2].replace(/client_max_body_size\s+[^;]+;/g, '').trimEnd();
  const addition = `${match[1]}location = /me/private-ai {${body}\n${match[1]}    client_max_body_size 4m;\n${match[1]}}\n`;
  return content.slice(0, match.index) + addition + content.slice(match.index);
}
export function applyNginxUpgrade(site, port, backup, actions) {
  const stat = lstatSync(site);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error('受管站点必须是普通文件');
  const original = readFileSync(site, 'utf8');
  const next = upgradedNginx(original, port);
  if (next === original) return false;
  actions.validate(); // 先确认既有配置可用。
  mkdirSync(dirname(backup), { recursive: true, mode: 0o700 });
  if (existsSync(backup)) {
    const previous = lstatSync(backup);
    if (
      !previous.isFile() ||
      previous.isSymbolicLink() ||
      readFileSync(backup, 'utf8') !== original
    )
      throw new Error('已有备份与当前站点不同，停止以免覆盖恢复依据');
  } else writeFileSync(backup, original, { flag: 'wx', mode: 0o600 });
  const temporary = `${site}.qinggai-${process.pid}.tmp`;
  function replace(value) {
    writeFileSync(temporary, value, { mode: stat.mode & 0o777 });
    renameSync(temporary, site);
  }
  try {
    replace(next);
    actions.validate();
    actions.reload();
  } catch (error) {
    replace(original);
    try {
      actions.validate();
      actions.reload();
    } catch {
      /* 保留原始失败信息，原配置已写回。 */
    }
    throw error;
  }
  return true;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (
    process.env.QINGGAI_REMOTE_WRITE_APPROVED !== 'yes' ||
    process.getuid?.() !== 0
  )
    throw new Error('需要明确远端写入授权与 root');
  const [, , site, port, backup] = process.argv;
  if (
    site !== '/etc/nginx/sites-available/qinggai.conf' ||
    !backup?.startsWith('/var/www/qinggai/shared/backups/')
  )
    throw new Error('必须使用既有受管站点及项目备份目录');
  if (!existsSync(site)) throw new Error('站点配置不存在，停止发布');
  const changed = applyNginxUpgrade(site, port, backup, {
    validate: () => execFileSync('nginx', ['-t'], { stdio: 'inherit' }),
    reload: () =>
      execFileSync('systemctl', ['reload', 'nginx'], { stdio: 'inherit' }),
  });
  console.log(
    changed
      ? '本项目 Nginx 私有文字同步规则已升级，原配置已备份'
      : '本项目 Nginx 规则已兼容，无需修改',
  );
}
