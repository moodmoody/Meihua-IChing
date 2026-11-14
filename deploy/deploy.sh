#!/usr/bin/env bash
# 一键部署：本地 → 云端服务器（Docker Compose 方式）
#
# 用法：
#   SERVER=root@1.2.3.4 DOMAIN=meihua.example.com ./deploy/deploy.sh
#
# 环境变量：
#   SERVER    必填，ssh 目标（user@host）
#   DOMAIN    必填，对外域名（Caddy 自动申请证书）
#   APP_DIR   远程目录，默认 /opt/meihua
#   SSH_PORT  默认 22
#   SKIP_CERT  =1 时只用 HTTP:80，不申请证书（内网/无域名场景）
set -euo pipefail

SERVER="${SERVER:?请设置 SERVER=user@host}"
DOMAIN="${DOMAIN:?请设置 DOMAIN=example.com}"
APP_DIR="${APP_DIR:-/opt/meihua}"
SSH_PORT="${SSH_PORT:-22}"
SKIP_CERT="${SKIP_CERT:-0}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

echo "==> 检查本地产物"
[ -f dist/index.html ] || { echo "缺少 dist/index.html"; exit 1; }
[ -f server/src/server.js ] || { echo "缺少 server/src/server.js"; exit 1; }
[ -f server/pnpm-lock.yaml ] || echo "!! 无 pnpm-lock.yaml，镜像内会退化为普通 install"

echo "==> 打包（排除 node_modules / 测试文件）"
TARBALL="$(mktemp -t meihua-XXXXXX.tar.gz)"
tar -czf "$TARBALL" \
  --exclude='server/node_modules' \
  --exclude='server/_*' \
  --exclude='node_modules' \
  --exclude='.git' \
  dist server deploy .env.example

echo "==> 上传到 $SERVER:$APP_DIR"
ssh -p "$SSH_PORT" "$SERVER" "mkdir -p '$APP_DIR'"
scp -P "$SSH_PORT" "$TARBALL" "$SERVER:$APP_DIR/site.tar.gz"
rm -f "$TARBALL"

echo "==> 远程解包并启动"
ssh -p "$SSH_PORT" "$SERVER" bash -s <<REMOTE
set -euo pipefail
cd '$APP_DIR'
tar -xzf site.tar.gz && rm -f site.tar.gz

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i 's/^LLM_API_KEY=.*/LLM_API_KEY=${LLM_API_KEY:-}/' .env 2>/dev/null || true
  echo "!! 已生成 $APP_DIR/.env —— 请填入 LLM_API_KEY 后重跑本脚本"
fi

# 写入对外域名
sed -i "s#^[a-zA-Z0-9.-]*\\.example\\.com {#$DOMAIN {#" deploy/Caddyfile
sed -i "s#meihua\\.example\\.com#$DOMAIN#g" deploy/Caddyfile
sed -i "s#admin@example\\.com#admin@$DOMAIN#" deploy/Caddyfile

if [ "$SKIP_CERT" = "1" ]; then
  sed -i "s#^https://#http://#g" deploy/Caddyfile || true
fi

# 没有 docker 就装
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

docker compose -f deploy/docker-compose.yml up -d --build

sleep 2
curl -fsS -o /dev/null -w "health: %{http_code}\n" http://127.0.0.1:8787/api/health || true
docker compose -f deploy/docker-compose.yml ps
REMOTE

echo
echo "==> 完成"
echo "    站点： $([ "$SKIP_CERT" = "1" ] && echo "http" || echo "https")://$DOMAIN"
echo "    日志： ssh -p $SSH_PORT $SERVER 'docker logs -f meihua'"
