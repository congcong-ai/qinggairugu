#!/usr/bin/env bash
set -Eeuo pipefail
[[ ${QINGGAI_REMOTE_WRITE_APPROVED:-} == yes && $(id -u) -eq 0 ]] || { echo '需要明确远端写入授权与 root。' >&2; exit 2; }
root=/var/www/qinggai
release=$(readlink -f -- "${1:?需要已解压的 release 目录}")
[[ $release == "$root/releases/"* && -f $root/shared/.install-complete && -f $release/apps/api/dist/server.js ]] || exit 1
exec 9> "$root/shared/deploy.lock"
flock -n 9 || { echo '已有发布进行中。' >&2; exit 1; }
source "$release/scripts/lib/deploy-proxy.sh"
configure_deploy_proxy
node --env-file="$root/shared/.env" "$release/scripts/validate-production-env.mjs"
port=$(node --env-file="$root/shared/.env" -p 'process.env.PORT')
old=
if [[ -L $root/current ]]; then old=$(readlink -f "$root/current"); fi
[[ -z $old || $old == "$root/releases/"* ]] || exit 1
# Linux production dependencies，只在锁文件与 Node ABI 相同时复用，原有 release 不被原地修改。
node -p 'process.versions.modules' > "$release/.node-abi"
if [[ -n $old && -f $old/.dependencies-ready ]] && cmp -s "$old/pnpm-lock.yaml" "$release/pnpm-lock.yaml" && cmp -s "$old/.node-abi" "$release/.node-abi"; then
  while IFS= read -r -d '' modules; do
    relative=${modules#"$old/"}; mkdir -p "$release/$(dirname "$relative")"
    cp -a -- "$modules" "$release/$relative"
  done < <(find "$old" -name node_modules -type d -prune -print0)
else
  (cd "$release" && pnpm --filter @pengtou/api... install --prod --no-optional --frozen-lockfile)
fi
node --input-type=module - "$release" <<'JS'
import { createRequire } from 'node:module';
const root = process.argv[2];
for (const [workspace, names] of [['apps/api', ['hono', '@hono/node-server', 'pino', 'qrcode', 'zod']], ['packages/database', ['postgres']]]) {
  const require = createRequire(`${root}/${workspace}/package.json`);
  for (const name of names) require.resolve(name);
}
JS
touch "$release/.dependencies-ready"
# 迁移前备份；失败不切换。备份文件受 shared 目录权限保护。
umask 077
backup="$root/shared/backups/$(basename "$release").dump"
node --env-file="$root/shared/.env" "$release/scripts/database-command.mjs" backup "$backup"
node --env-file="$root/shared/.env" "$release/packages/database/dist/migrate-cli.js"
chown -R root:qinggai "$release"
chmod -R g+rX,o-rwx "$release"
pm() { (cd /var/lib/qinggai && runuser -u qinggai -- env -u DATABASE_URL -u WECHAT_APP_SECRET HOME=/var/lib/qinggai PM2_HOME=/var/lib/qinggai/.pm2 pm2 "$@"); }
health() { "$release/scripts/health-check.sh" "http://127.0.0.1:$port"; }
rollback_on_failure() {
  status=$?
  trap - EXIT
  if (( status != 0 )); then
    echo '发布失败，恢复上一应用；数据库迁移不自动逆转。' >&2
    pm delete qinggai-api >/dev/null 2>&1 || true
    if [[ -n $old ]]; then
      ln -s "$old" "$root/current.rollback"; mv -Tf "$root/current.rollback" "$root/current"
      pm start "$old/ecosystem.config.cjs" --only qinggai-api
      "$old/scripts/health-check.sh" "http://127.0.0.1:$port"
      pm save
      if systemctl cat pm2-qinggai >/dev/null 2>&1; then
        pm kill
        systemctl restart pm2-qinggai
        "$old/scripts/health-check.sh" "http://127.0.0.1:$port"
      fi
    else
      rm -f "$root/current"
    fi
  fi
  exit "$status"
}
trap rollback_on_failure EXIT
# 先停止本项目，释放端口；若仍有占用，拒绝杀死其他项目。
if [[ -S /var/lib/qinggai/.pm2/rpc.sock ]]; then pm delete qinggai-api || true; fi
if ss -H -lnt | awk '{print $4}' | grep -Eq ":$port$"; then echo 'API 端口仍被占用，停止发布。' >&2; exit 1; fi
ln -s "$release" "$root/current.next"; mv -Tf "$root/current.next" "$root/current"
pm start "$release/ecosystem.config.cjs" --only qinggai-api
health
pm save
pm2 startup systemd -u qinggai --hp /var/lib/qinggai >/dev/null
# 将 daemon 交给 systemd，并再次核查健康。
pm kill
systemctl enable pm2-qinggai
systemctl restart pm2-qinggai
systemctl is-enabled --quiet pm2-qinggai
systemctl is-active --quiet pm2-qinggai
health
trap - EXIT
# 仅保留当前与刚切换前的健康 release；备份独立保存。
for candidate in "$root"/releases/*; do
  [[ -d $candidate && $candidate != "$release" && $candidate != "$old" ]] || continue
  rm -rf -- "$candidate"
done
echo 'China API 发布与本机健康检查通过。请继续验收公网 HTTPS 和真实双端业务。'
