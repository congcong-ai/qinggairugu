#!/usr/bin/env bash
# 仅允许 China；dotenv 使用 Node 解析，绝不作为 shell 执行。
select_deploy_target() {
  [[ ${1:-china} == china && $# -le 1 ]] || { echo '本项目仅支持 china。' >&2; return 1; }
  while IFS= read -r -d '' entry; do export "$entry"; done < <(node --input-type=module - "$project_root/.deploy.env" <<'JS'
import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
const path = process.argv[2];
if (existsSync(path)) for (const [key, value] of Object.entries(parseEnv(readFileSync(path, 'utf8')))) {
  if (/^DEPLOY_(CHINA_(SSH_HOST|SSH_USER|SSH_PORT)|USE_PROXY|PROXY_HOST|PROXY_PORT|HTTP_PROXY_PORT)$/.test(key)) process.stdout.write(`${key}=${value}\0`);
}
JS
)
  DEPLOY_CHINA_SSH_HOST=${DEPLOY_CHINA_SSH_HOST:-49.235.209.193}
  DEPLOY_CHINA_SSH_USER=${DEPLOY_CHINA_SSH_USER:-deployer}
  DEPLOY_CHINA_SSH_PORT=${DEPLOY_CHINA_SSH_PORT:-22}
  [[ $DEPLOY_CHINA_SSH_HOST == 49.235.209.193 && $DEPLOY_CHINA_SSH_USER =~ ^[a-z_][a-z0-9_-]*$ && $DEPLOY_CHINA_SSH_PORT =~ ^[0-9]+$ ]] || return 1
  (( DEPLOY_CHINA_SSH_PORT >= 1 && DEPLOY_CHINA_SSH_PORT <= 65535 )) || return 1
  ssh_target="$DEPLOY_CHINA_SSH_USER@$DEPLOY_CHINA_SSH_HOST"
  ssh_options=(-o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -p "$DEPLOY_CHINA_SSH_PORT")
}
require_remote_write() {
  [[ ${QINGGAI_REMOTE_WRITE_APPROVED:-} == yes ]] || {
    echo '当前仅获服务器只读授权。上传、安装、迁移与发布均已阻止；须取得用户明确写入授权后再设置 QINGGAI_REMOTE_WRITE_APPROVED=yes。' >&2
    exit 2
  }
}
