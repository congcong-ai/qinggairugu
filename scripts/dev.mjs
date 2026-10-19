import { execFileSync, spawn } from 'node:child_process';
const [port, command, ...args] = process.argv.slice(2);
if (!port || !command || !/^\d+$/.test(port))
  throw new Error('缺少端口或启动命令');
let pids = [];
try {
  pids = execFileSync('lsof', ['-tiTCP:' + port, '-sTCP:LISTEN'], {
    encoding: 'utf8',
  })
    .trim()
    .split(/\s+/)
    .filter(Boolean);
} catch (error) {
  if (error.status !== 1) throw error;
}
for (const pid of pids) {
  try {
    process.kill(Number(pid), 'SIGTERM');
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}
for (let attempt = 0; attempt < 40; attempt++) {
  let alive = false;
  for (const pid of pids) {
    try {
      process.kill(Number(pid), 0);
      alive = true;
    } catch {}
  }
  if (!alive) break;
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (attempt === 39) throw new Error('旧服务未退出，请检查端口 ' + port);
}
const child = spawn(command, args, { stdio: 'inherit', env: process.env });
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 1));
