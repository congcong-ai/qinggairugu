#!/usr/bin/env bash
# 只有取得远端写入授权后才可运行。当前阶段仅交付并本地检查。
set -Eeuo pipefail
[[ ${QINGGAI_REMOTE_WRITE_APPROVED:-} == yes && $(id -u) -eq 0 ]] || { echo '需要明确远端写入授权与 root。' >&2; exit 2; }
base=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
root=/var/www/qinggai
[[ ! -f $root/shared/.install-complete ]] || { echo '首次安装已完成。'; exit 0; }
source "$base/scripts/lib/deploy-proxy.sh"
configure_deploy_proxy
# 该共享服务器已有依赖；缺失时停止，避免自动升级影响其他项目。
for tool in node pnpm pm2 nginx psql certbot python3 flock ss runuser; do
  command -v "$tool" >/dev/null || { echo "缺少 $tool；停止，请按文档审阅依赖安装。" >&2; exit 1; }
done
node -e 'if(Number(process.versions.node.split(".")[0])<22) process.exit(1)'
[[ $(pnpm --version) == 11.17.0 ]] || { echo '需要项目锁定的 pnpm 11.17.0；不修改全局版本。' >&2; exit 1; }
: "${LETSENCRYPT_EMAIL:?请提供 TLS 通知邮箱}"
[[ $LETSENCRYPT_EMAIL =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$ ]] || exit 1
site=/etc/nginx/sites-available/qinggai.conf
# 不覆盖任何已有站点（含 Certbot 修改后的站点）。
[[ ! -e $site && ! -e /etc/nginx/sites-enabled/qinggai.conf ]] || { echo '站点已存在，停止以便检查中断的安装。' >&2; exit 1; }
python3 "$base/scripts/server-port-audit.py"
choice=$(python3 "$base/scripts/server-port-audit.py" --choose)
port=$(node -e 'console.log(JSON.parse(process.argv[1]).api_port)' "$choice")
read -r -p "建议 API 端口 $port，仅监听本机，确认使用？输入 yes：" answer
[[ $answer == yes ]] || exit 1
python3 "$base/scripts/server-port-audit.py" --check "$port"
# 不认领已有用户或数据库，防止中断重试时覆盖既有密码。
if id qinggai >/dev/null 2>&1 || [[ -e $root/shared/.env ]] || [[ $(runuser -u postgres -- psql -XAt -d postgres -c "SELECT count(*) FROM pg_database WHERE datname='qinggai'") != 0 ]] || [[ $(runuser -u postgres -- psql -XAt -d postgres -c "SELECT count(*) FROM pg_roles WHERE rolname='qinggai'") != 0 ]]; then
  echo '检测到已有用户、数据库或环境文件；停止，请先核对安装状态。' >&2; exit 1
fi
useradd --system --create-home --home-dir /var/lib/qinggai --shell /usr/sbin/nologin qinggai
install -d -m 0755 "$root" "$root/releases"
install -d -m 0750 -o root -g qinggai "$root/shared"
install -d -m 0750 -o qinggai -g qinggai "$root/shared/logs" "$root/shared/backups"
password=$(openssl rand -hex 24)
# 密码通过 stdin，不出现在命令行或日志。
runuser -u postgres -- psql -Xq -v ON_ERROR_STOP=1 -d postgres <<SQL
CREATE ROLE qinggai LOGIN PASSWORD '$password';
CREATE DATABASE qinggai OWNER qinggai;
SQL
umask 027
cat > "$root/shared/.env" <<ENV
NODE_ENV=production
HOST=127.0.0.1
PORT=$port
DATABASE_URL=postgresql://qinggai:$password@127.0.0.1:5432/qinggai
WECHAT_APP_ID=wx066bf055f6b9d415
WECHAT_APP_SECRET=
WECHAT_MINIAPP_ENV=release
ALLOW_DEV_AUTH=false
ENV
chown root:qinggai "$root/shared/.env"
chmod 0640 "$root/shared/.env"
printf 'PORT=%s\nSERVER_ROLE=china\n' "$port" > "$root/shared/install.env"
# 此时尚无应用，无监听；写站点前再次检查。
python3 "$base/scripts/server-port-audit.py" --check "$port"
sed "s/__API_PORT__/$port/g" "$base/deploy/nginx.conf.template" > "$site"
ln -s "$site" /etc/nginx/sites-enabled/qinggai.conf
nginx -t
systemctl reload nginx
certbot --nginx --non-interactive --agree-tos --redirect --email "$LETSENCRYPT_EMAIL" -d qgrg.bebackpacker.com
# PM2 自启动在首次应用成功发布时配置，避免空 daemon/空单元。
touch "$root/shared/.install-complete"
echo "基础设施已安装；应用尚未发布。请在 $root/shared/.env 填写正式 WECHAT_APP_SECRET，再执行日常发布。"
