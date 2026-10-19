#!/usr/bin/env bash
set -Eeuo pipefail
project_root=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
source "$project_root/scripts/lib/deploy-target.sh"
select_deploy_target "$@"
if ssh "${ssh_options[@]}" "$ssh_target" 'sudo -n test -f /var/www/qinggai/shared/.install-complete'; then echo '已完成首次安装。'; exit 0; fi
: "${LETSENCRYPT_EMAIL:?请在当前命令环境提供 TLS 通知邮箱}"
[[ $LETSENCRYPT_EMAIL =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$ ]] || exit 1
work=$(mktemp -d "${TMPDIR:-/tmp}/qinggai-install.XXXXXX"); trap 'rm -rf "$work"' EXIT
bundle="$work/bootstrap.tar.gz"
tar -czf "$bundle" -C "$project_root" scripts/server-install.sh scripts/server-port-audit.py scripts/lib/deploy-proxy.sh deploy/nginx.conf.template
checksum=$(shasum -a 256 "$bundle" | awk '{print $1}')
# 显式执行安装入口后，由远端 mktemp 创建唯一临时文件。
remote=$(ssh "${ssh_options[@]}" "$ssh_target" 'mktemp /tmp/qinggai-bootstrap.XXXXXX')
scp -P "$DEPLOY_CHINA_SSH_PORT" -o BatchMode=yes -o StrictHostKeyChecking=yes "$bundle" "$ssh_target:$remote"
proxy_args=$(printf 'DEPLOY_USE_PROXY=%q DEPLOY_PROXY_HOST=%q DEPLOY_PROXY_PORT=%q DEPLOY_HTTP_PROXY_PORT=%q' "${DEPLOY_USE_PROXY:-false}" "${DEPLOY_PROXY_HOST:-127.0.0.1}" "${DEPLOY_PROXY_PORT:-1080}" "${DEPLOY_HTTP_PROXY_PORT:-1087}")
command=$(cat <<SCRIPT
set -Eeuo pipefail
[[ \$(sha256sum '$remote' | cut -d' ' -f1) == '$checksum' ]]
work=\$(mktemp -d /tmp/qinggai-bootstrap.XXXXXX)
trap 'rm -rf "\$work" "$remote"' EXIT
tar --no-same-owner --no-same-permissions -xzf '$remote' -C "\$work"
env QINGGAI_REMOTE_WRITE_APPROVED=yes LETSENCRYPT_EMAIL='$LETSENCRYPT_EMAIL' $proxy_args bash "\$work/scripts/server-install.sh"
SCRIPT
)
ssh -tt "${ssh_options[@]}" "$ssh_target" "sudo bash -c $(printf '%q' "$command")"
