#!/usr/bin/env bash
# 仅经 stdin 运行只读审计，不上传脚本，不运行 PM2 CLI，不读取密钥。
set -Eeuo pipefail
project_root=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
source "$project_root/scripts/lib/deploy-target.sh"
select_deploy_target "$@"
ssh "${ssh_options[@]}" "$ssh_target" 'sudo -n python3 -' < "$project_root/scripts/server-port-audit.py"
