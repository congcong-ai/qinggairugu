-- 新账号设备必须同时具备有效产品令牌；既有匿名设备保留原能力。
ALTER TABLE installations ADD COLUMN account_required BOOLEAN NOT NULL DEFAULT false;
