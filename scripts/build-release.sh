#!/usr/bin/env bash
# 隔离副本构建，不改变工作区；不打包移动端/小程序或本机依赖。
set -Eeuo pipefail
project_root=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
out=${1:?请提供发布包绝对路径（建议 /tmp/qinggai-release.tar.gz）}
[[ $out == /* && ! -e $out ]] || { echo '输出必须为尚不存在的绝对路径。' >&2; exit 1; }
work=$(mktemp -d "${TMPDIR:-/tmp}/qinggai-build.XXXXXX")
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/source" "$work/release"
rsync -a --exclude=.git --exclude=node_modules --exclude='.env*' --exclude=.deploy.env --exclude=.turbo --exclude=dist --exclude=.expo --exclude=.taro --exclude=android --exclude=ios --exclude=/assets/ --exclude=coverage "$project_root/" "$work/source/"
cd "$work/source"
pnpm install --frozen-lockfile --offline
pnpm exec eslint apps/api/src
pnpm exec prettier --check --ignore-unknown scripts deploy ecosystem.config.cjs docs/PRODUCTION_DEPLOYMENT.md .deploy.env.example package.json apps/api/src/server.ts
pnpm --filter @pengtou/api... typecheck
pnpm exec vitest run apps/api/src/app.test.ts apps/api/src/qr.test.ts apps/api/src/website.test.ts apps/api/src/releases/download.test.ts apps/web/content/product.test.mjs scripts/android-release.test.mjs
pnpm build:web
pnpm --filter @pengtou/api build
pnpm --filter @pengtou/api exec tsup ../../packages/database/src/migrate-cli.ts --format esm --out-dir ../../packages/database/dist
stage="$work/release"
cp package.json pnpm-workspace.yaml ecosystem.config.cjs "$stage/"
python3 scripts/stage-lockfile.py pnpm-lock.yaml "$stage/pnpm-lock.yaml"
# 仅保留 API 依赖的 workspace manifest；裁剪锁文件 importers，保留版本与 integrity。
for manifest in apps/api/package.json packages/database/package.json packages/contracts/package.json; do
  mkdir -p "$stage/$(dirname "$manifest")"; cp "$manifest" "$stage/$manifest"
done
cp -R patches deploy "$stage/"
mkdir -p "$stage/scripts/lib"
cp scripts/server-install.sh scripts/server-deploy.sh scripts/native-service.sh scripts/health-check.sh scripts/server-port-audit.py scripts/validate-production-env.mjs scripts/database-command.mjs "$stage/scripts/"
cp scripts/lib/deploy-proxy.sh "$stage/scripts/lib/"
cp -R apps/api/dist "$stage/apps/api/"
mkdir -p "$stage/apps/web"
cp -R apps/web/dist "$stage/apps/web/"
cp -R packages/database/dist packages/database/migrations "$stage/packages/database/"
# 迁移入口打包后仍相对 packages/database/dist 定位历史 SQL。
if find "$stage" \( -name '.env' -o -name '.env.*' -o -name node_modules -o -name .git \) | read -r _; then
  echo '发布包包含禁入文件。' >&2; exit 1
fi
find "$stage/scripts" -name '*.sh' -exec chmod +x {} +
COPYFILE_DISABLE=1 tar --format=ustar -czf "$out" -C "$stage" .
shasum -a 256 "$out" > "$out.sha256"
echo "本地发布包：$out"
