#!/usr/bin/env bash
# /usr/local/bin/meihua-stats —— 梅花易数访问统计
# 用法: meihua-stats [天数，默认 1]
set -euo pipefail
DAYS="${1:-1}"
LOG=/var/log/nginx/meihua.access.log

[ -f "$LOG" ] || { echo "日志不存在：$LOG"; exit 1; }

echo "════════════════════════════════════════"
echo " 梅花易数访问统计（最近 ${DAYS} 天）"
echo "════════════════════════════════════════"

if [ "$DAYS" -gt 1 ] && [ -f "$LOG.gz" ]; then
  TMP=$(mktemp)
  zcat "$LOG".*.gz 2>/dev/null > "$TMP" || true
  cat "$LOG" >> "$TMP"
  SRC="$TMP"
else
  SRC="$LOG"
fi

echo
echo "【总览】"
printf "  请求总数    %s\n" "$(wc -l < "$SRC")"
printf "  独立 IP     %s\n" "$(awk '{print $1}' "$SRC" | sort -u | wc -l)"
printf "  页面加载    %s\n" "$(grep -cE '"GET / HTTP[^"]*" 200 ' "$SRC" || true)"
printf "  解卦次数    %s\n" "$(grep -c 'POST /api/v1/readings/stream.* 200 ' "$SRC" || true)"
printf "  追问次数    %s\n" "$(grep -c 'POST /api/v1/followups/stream.* 200 ' "$SRC" || true)"
printf "  笔画查询    %s\n" "$(grep -c 'GET /api/v1/strokes' "$SRC" || true)"

echo
echo "【按小时】"
awk -F'[][]' '{print $2}' "$SRC" | cut -d: -f2 | sort | uniq -c | \
  awk '{printf "  %02d时 %s\n", $2, $1}'

echo
echo "【Top IP】"
awk '{print $1}' "$SRC" | sort | uniq -c | sort -rn | head -8 | \
  awk '{printf "  %-18s %s\n", $2, $1}'

echo
echo "【UA 归类】"
sed -E 's/.*" "([^"]*)"$/\1/' "$SRC" | sed -E \
  's/.*MicroMessenger.*/微信内置浏览器/; s/.*HeadlessChrome.*/无头浏览器/; s/.*curl.*/curl/; s/.*dsh-desktop.*/DSH 桌面/; s/.*(bot|Bot|spider|Spider|GPTBot|ClaudeBot).*/爬虫/; s/.*(Chrome|Safari|Firefox|Edg).*/普通浏览器/; s/^-$/无UA/' \
  | sort | uniq -c | sort -rn | head -8 | awk '{printf "  %-16s %s\n", $2, $1}'

echo
echo "【最近 5 次解卦】"
{ grep 'POST /api/v1/readings/stream.* 200 ' "$SRC" | tail -5 | \
  awk '{print $1, $4}' | sed 's/\[//' | awk '{printf "  %-18s %s\n", $1, $2}'; } || true

[ "$DAYS" -gt 1 ] && rm -f "$SRC" || true
echo
echo "════════════════════════════════════════"
