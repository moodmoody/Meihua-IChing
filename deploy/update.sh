#!/usr/bin/env bash
# 服务器端更新：从 GitHub 拉取 → 同步到 /opt/meihua → 重启
#
# 用法（服务器上执行）：
#   sudo bash /opt/meihua-src/deploy/update.sh
#   sudo bash /opt/meihua-src/deploy/update.sh v1.0.0    # 指定标签/分支
#
# 说明：git 以仓库所有者身份执行（deploy key 在 ~ubuntu/.ssh 下），
#       文件同步与重启以 root 执行。
set -euo pipefail

SRC="${SRC:-/opt/meihua-src}"
APP="${APP:-/opt/meihua}"
APP_USER="${APP_USER:-meihua}"
REF="${1:-origin/main}"

[ -d "$SRC/.git" ] || { echo "✗ $SRC 不是 git 仓库"; exit 1; }
[ -d "$APP" ]      || { echo "✗ $APP 不存在"; exit 1; }

# 仓库所有者：有 sudo 时取 SUDO_USER，否则取当前用户
OWNER="${SUDO_USER:-$(id -un)}"
if [ "$OWNER" = "root" ]; then
  OWNER="$(stat -c %U "$SRC")"
fi
echo "仓库所有者：$OWNER"

as_owner() {
  if [ "$(id -un)" = "$OWNER" ]; then
    "$@"
  else
    sudo -u "$OWNER" -H "$@"
  fi
}

echo "== 1. 拉取 $REF =="
as_owner git -C "$SRC" fetch --all --tags --prune
as_owner git -C "$SRC" reset --hard "$REF"
echo "    HEAD: $(as_owner git -C "$SRC" log --oneline -1)"

echo "== 2. 同步代码（保留 .env 与 node_modules）=="
rsync -a --delete \
  --exclude='.env' \
  --exclude='node_modules' \
  "$SRC/server/" "$APP/server/"

rsync -a --delete "$SRC/dist/" "$APP/dist/"

echo "== 3. 依赖（package.json 变化时才装）=="
cd "$APP/server"
if [ ! -d node_modules ] || [ "$SRC/server/package.json" -nt node_modules ]; then
  as_owner npm install --omit=dev --no-audit --no-fund
else
  echo "    package.json 未变，跳过"
fi

echo "== 4. 权限 =="
chown -R "$APP_USER:$APP_USER" "$APP"
chmod 600 "$APP/.env" 2>/dev/null || true

echo "== 5. 重启 =="
systemctl restart meihua
sleep 2
systemctl is-active meihua

echo "== 6. 自检 =="
curl -fsS --max-time 5 http://127.0.0.1:8787/api/health || echo "✗ health 失败"
echo
echo "✓ 完成：$(as_owner git -C "$SRC" log --oneline -1)"
