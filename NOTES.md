# 项目说明（供后续开发/交接）

## 这是什么

`https://meihua.guohua.cloud` 的实现。前端镜像自 `https://meihua.42thinks.com/`，后端按同一套 `/api/v1` 契约重写。

## 关键约束

1. **`dist/` 是原站逐字节镜像，不要改。** 除非明确要脱离「与原站一致」这个前提，否则改动会破坏比对基线。样式调整请另做覆盖层。
2. **`dist/fonts/` 的 95 个 woff2（2.93 MB）是完整分片**，删了中文会退回系统字体。
3. **`/api/v1/*` 的响应形状由 `dist/index.html` 里 149 KB 的内联 JS 决定**，改后端前先读前端怎么解析。
4. **`.env` 含 API key，永远不要提交。**

## 后端模块

| 文件 | 职责 | 改动风险 |
|---|---|---|
| `server/src/server.js` | 路由、静态、SSE | 中 — 改事件名会断前端 |
| `server/src/cast.js` | 起卦、互卦、变卦、体用 | 高 — 算法错则全站错 |
| `server/src/hexagrams.js` | 八卦表、64 卦表 | 中 — 卦名/卦辞笔误需核对 |
| `server/src/calendar.js` | 农历、干支、节气、月令 | 中 — 依赖 `lunar-javascript` |
| `server/src/prompt.js` | 提示词构造 | 低 — 只影响文案质量 |
| `server/src/llm.js` | OpenAI 兼容流式 | 低 |
| `server/src/strokes.js` | 笔画查询 | 低 — 依赖 `cnchar` |

## 起卦公式（改算法前先对照）

- 年支：子=1 … 亥=12
- 上卦 = (年支 + 农历月 + 农历日) % 8，余 0 取 8
- 下卦 = (年支 + 农历月 + 农历日 + 时支) % 8，余 0 取 8
- 动爻 = 同和 % 6，余 0 取 6
- 互卦：二三四爻为下卦，三四五爻为上卦
- 变卦：动爻取反
- 体用：动爻所在之卦为「用」，另一卦为「体」

## 本地开发

```bash
cd server
npm install
cp ../.env.example ../.env   # 填 LLM_API_KEY
node --env-file=../.env src/server.js
# → http://127.0.0.1:8787
```

服务端也要开 SSE：浏览器端解析 `event: token` 等分块，本地反代（如有）须关缓冲。

## 部署（生产）

当前生产环境：

- 主机：`ubuntu@124.220.36.240`（腾讯云 Ubuntu 22.04）
- 目录：`/opt/meihua`，systemd `meihua.service`，监听 `127.0.0.1:8787`
- 反代：nginx `sites-available/meihua`，域名走 443，裸 IP 走 80
- 证书：Let's Encrypt，certbot 自动续期

改代码后：

```bash
rsync -av server/src/ ubuntu@124.220.36.240:/opt/meihua/server/src/
ssh ubuntu@124.220.36.240 'sudo systemctl restart meihua'
```

## 验证清单

```bash
curl -s https://meihua.guohua.cloud/api/health          # llm.configured 应为 true
curl -s https://meihua.guohua.cloud/api/v1/auth/config  # required 应为 false
curl -s "https://meihua.guohua.cloud/api/v1/strokes?text=梅花"
```

顺便注意：同机还跑着 `guohua-app`（3000 端口），它的 nginx default_server 配置不能动。

## 已知边界

- 默认模型 `deepseek-ai/DeepSeek-V4.1-Flash` 有推理过程，一次解卦约 27–31 秒。想更快可换非推理模型。
- 生僻字笔画查不到时，`/api/v1/strokes` 返回 `strokes: null`，前端提示手填。
- 记录只存浏览器 localStorage；跨端同步接口 `/api/v1/sync/readings` 目前是空回执。
