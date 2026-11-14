#!/usr/bin/env bash
# 裸机部署：Debian/Ubuntu，无 Docker
# 远程服务器上执行：sudo ./deploy/install-bare.sh meihua.example.com
set -euo pipefail

DOMAIN="${1:?用法: install-bare.sh <domain>}"
APP_DIR=/opt/meihua
USER_NAME=meihua

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "==> 源目录 $HERE"

echo "==> 依赖"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
command -v caddy >/dev/null 2>&1 || {
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update && apt-get install -y caddy
}

echo "==> 用户与目录"
id -u "$USER_NAME" >/dev/null 2>&1 || useradd -r -s /usr/sbin/nologin -d "$APP_DIR" "$USER_NAME"
mkdir -p "$APP_DIR"
rsync -a --exclude node_modules --exclude '_*' "$HERE"/ "$APP_DIR"/

echo "==> 安装后端依赖"
cd "$APP_DIR/server"
corepack enable 2>/dev/null || true
npm install --omit=dev --no-audit --no-fund

echo "==> 环境变量"
[ -f "$APP_DIR/.env" ] || cp "$APP_DIR/.env.example" "$APP_DIR/.env"
chown -R "$USER_NAME:$USER_NAME" "$APP_DIR"
chmod 600 "$APP_DIR/.env"

echo "==> systemd"
sed "s#/opt/meihua#$APP_DIR#g" "$APP_DIR/deploy/meihua.service" > /etc/systemd/system/meihua.service
systemctl daemon-reload
systemctl enable --now meihua
sleep 2
systemctl --no-pager --lines=5 status meihua || true

echo "==> Caddy 反代"
sed "s#meihua.example.com#$DOMAIN#g" "$APP_DIR/deploy/Caddyfile" > /etc/caddy/Caddyfile
sed -i "s#meihua:8787#127.0.0.1:8787#" /etc/caddy/Caddyfile
systemctl reload caddy 2>/dev/null || systemctl restart caddy

echo "==> 完成： https://$DOMAIN"
