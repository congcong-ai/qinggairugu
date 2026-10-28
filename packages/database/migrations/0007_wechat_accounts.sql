-- 不改写旧用户 ID，也不自动认领设备历史。
ALTER TABLE users ALTER COLUMN openid DROP NOT NULL;
CREATE TABLE wechat_identities (
  app_id TEXT NOT NULL,
  openid TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  PRIMARY KEY (app_id, openid)
);
CREATE TABLE wechat_unions (
  platform_id TEXT NOT NULL,
  unionid TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  PRIMARY KEY (platform_id, unionid)
);
