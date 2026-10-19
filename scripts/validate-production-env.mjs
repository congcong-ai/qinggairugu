const env = process.env;
if (
  env.NODE_ENV !== 'production' ||
  env.HOST !== '127.0.0.1' ||
  !/^\d+$/.test(env.PORT ?? '') ||
  Number(env.PORT) < 1024 ||
  Number(env.PORT) > 65535 ||
  env.WECHAT_APP_ID !== 'wx066bf055f6b9d415' ||
  !env.WECHAT_APP_SECRET ||
  env.ALLOW_DEV_AUTH !== 'false' ||
  !['release', 'trial', 'develop'].includes(env.WECHAT_MINIAPP_ENV)
)
  throw new Error('生产配置不完整或不安全，请检查 shared/.env（不输出配置值）');
const db = new URL(env.DATABASE_URL);
if (
  !['postgres:', 'postgresql:'].includes(db.protocol) ||
  db.hostname !== '127.0.0.1' ||
  db.pathname !== '/qinggai' ||
  db.username !== 'qinggai' ||
  !db.password
)
  throw new Error('数据库必须使用本机独立 qinggai 数据库及角色');
if (env.DASHSCOPE_API_KEY) throw new Error('后端不得配置用户百炼 Key');
