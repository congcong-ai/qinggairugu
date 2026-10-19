import { spawnSync } from 'node:child_process';
const [action, path] = process.argv.slice(2);
if (action !== 'backup' || !path)
  throw new Error('仅支持 backup <绝对输出路径>');
// 凭据通过子进程环境传递，避免暴露于进程参数。
const url = new URL(process.env.DATABASE_URL);
const databaseEnv = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || '5432',
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: url.pathname.slice(1),
};
const result = spawnSync('pg_dump', ['--format=custom', '--file', path], {
  stdio: ['ignore', 'ignore', 'pipe'],
  env: databaseEnv,
});
if (result.status !== 0) throw new Error('数据库备份失败，未执行迁移');
const check = spawnSync('pg_restore', ['--list', path], {
  stdio: 'ignore',
  env: databaseEnv,
});
if (check.status !== 0) throw new Error('数据库备份不可读，未执行迁移');
