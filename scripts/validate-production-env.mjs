const env = process.env;
const errors = [];
const requireConfig = (valid, message) => {
  if (!valid) errors.push(message);
};
requireConfig(env.NODE_ENV === 'production', 'NODE_ENV 必须为 production');
requireConfig(env.HOST === '127.0.0.1', 'HOST 必须为 127.0.0.1');
requireConfig(
  /^\d+$/.test(env.PORT ?? '') &&
    Number(env.PORT) >= 1024 &&
    Number(env.PORT) <= 65535,
  'PORT 必须为 1024..65535 的整数',
);
requireConfig(
  env.WECHAT_APP_ID === 'wx066bf055f6b9d415',
  'WECHAT_APP_ID 必须为本项目的小程序 AppID',
);
requireConfig(
  Boolean(env.WECHAT_APP_SECRET?.trim()),
  'WECHAT_APP_SECRET 未配置',
);
requireConfig(env.ALLOW_DEV_AUTH === 'false', 'ALLOW_DEV_AUTH 必须为 false');
requireConfig(
  ['release', 'trial', 'develop'].includes(env.WECHAT_MINIAPP_ENV),
  'WECHAT_MINIAPP_ENV 必须为 release（正式版）、trial（体验版）或 develop（开发版）；体验版请拼写为 trial',
);
let validDatabase = false;
try {
  const db = new URL(env.DATABASE_URL);
  validDatabase =
    ['postgres:', 'postgresql:'].includes(db.protocol) &&
    db.hostname === '127.0.0.1' &&
    db.pathname === '/qinggai' &&
    db.username === 'qinggai' &&
    Boolean(db.password);
} catch {
  // 不输出 URL 解析异常，避免其中包含数据库密码。
}
requireConfig(
  validDatabase,
  'DATABASE_URL 必须使用本机独立 qinggai 数据库及角色，并配置密码',
);
requireConfig(
  !env.DASHSCOPE_API_KEY,
  'DASHSCOPE_API_KEY：后端不得配置用户百炼 Key',
);
if (errors.length) {
  console.error('生产配置校验失败，请检查 /var/www/qinggai/shared/.env：');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
}
