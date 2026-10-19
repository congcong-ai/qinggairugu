#!/usr/bin/env bash
set -Eeuo pipefail
base=${1:?需要 API 根地址}
for attempt in $(seq 1 20); do
  if body=$(curl --noproxy '*' -fsS --max-time 3 "$base/health") && printf '%s' "$body" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);if(v.status!=="ok"||v.service!=="pengtou-api")process.exit(1)})' && curl --noproxy '*' -fsS --max-time 3 "$base/health/db" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{if(JSON.parse(s).status!=="ok")process.exit(1)})'; then
    echo 'API 与数据库健康检查通过。'; exit 0
  fi
  sleep 1
done
echo '健康检查失败。' >&2; exit 1
