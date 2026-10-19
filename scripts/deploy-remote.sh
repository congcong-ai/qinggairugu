#!/usr/bin/env bash
set -Eeuo pipefail
project_root=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
source "$project_root/scripts/lib/deploy-target.sh"
select_deploy_target "$@"
node "$project_root/scripts/check-android-release.mjs"
ssh "${ssh_options[@]}" "$ssh_target" 'sudo -n test -f /var/www/qinggai/shared/.install-complete' || { echo '请先完成首次安装。' >&2; exit 1; }
work=$(mktemp -d "${TMPDIR:-/tmp}/qinggai-deploy.XXXXXX"); trap 'rm -rf "$work"' EXIT
release_id="$(date -u +%Y%m%dT%H%M%SZ)-$(openssl rand -hex 4)"
bundle="$work/release.tar.gz"
bash "$project_root/scripts/build-release.sh" "$bundle"
checksum=$(shasum -a 256 "$bundle" | awk '{print $1}')
remote=$(ssh "${ssh_options[@]}" "$ssh_target" 'mktemp /tmp/qinggai-release.XXXXXX')
scp -P "$DEPLOY_CHINA_SSH_PORT" -o BatchMode=yes -o StrictHostKeyChecking=yes "$bundle" "$ssh_target:$remote"
proxy_args=$(printf 'DEPLOY_USE_PROXY=%q DEPLOY_PROXY_HOST=%q DEPLOY_PROXY_PORT=%q DEPLOY_HTTP_PROXY_PORT=%q' "${DEPLOY_USE_PROXY:-false}" "${DEPLOY_PROXY_HOST:-127.0.0.1}" "${DEPLOY_PROXY_PORT:-1080}" "${DEPLOY_HTTP_PROXY_PORT:-1087}")
command=$(cat <<SCRIPT
set -Eeuo pipefail
[[ \$(sha256sum '$remote' | cut -d' ' -f1) == '$checksum' ]]
release=/var/www/qinggai/releases/$release_id
mkdir "\$release"
tar --no-same-owner --no-same-permissions -xzf '$remote' -C "\$release"
rm -f '$remote'
env QINGGAI_REMOTE_WRITE_APPROVED=yes $proxy_args bash "\$release/scripts/server-deploy.sh" "\$release"
SCRIPT
)
ssh -tt "${ssh_options[@]}" "$ssh_target" "sudo bash -c $(printf '%q' "$command")"
bash "$project_root/scripts/health-check.sh" https://qgrg.bebackpacker.com
