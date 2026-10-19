#!/usr/bin/env bash
set -Eeuo pipefail
cd /var/www/qinggai/current/apps/api
# Node 在子进程读取 env；PM2 元数据不接触应用密钥。
exec node --env-file=/var/www/qinggai/shared/.env dist/server.js
