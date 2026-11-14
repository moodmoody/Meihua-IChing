# 梅花易数 · 复刻版

原站 `https://meihua.42thinks.com/` 的完整复刻：前端原样镜像，后端按同一套 `/api/v1` 契约重新实现。

- **前端**：`dist/`，97 个文件 / 3.3 MB，含 95 个 woff2 字体分片，与原站逐字节一致（CSP、主题、动画、交互全部保留）
- **后端**：`server/`，Node 18+ / ESM / 零框架，起卦算法、农历干支节气、体用生克、AI 流式解卦全部自持，不依赖原站
- **鉴权**：原站强制 linuxdo OAuth；复刻版 `/api/v1/auth/config` 返回 `required:false`，前端直接放行，无登录页

---

## 1 目录

```
.
├── dist/                  前端（原站镜像，勿改）
│   ├── index.html         294 KB 单页，内联 CSS + 149 KB 内联 JS
│   └── fonts/             fonts.css + 95 个 woff2 分片（2.93 MB）
├── server/
│   ├── src/
│   │   ├── server.js      HTTP 路由 + 静态服务 + SSE
│   │   ├── cast.js        起卦（时间/数字/笔画/自报）→ 互卦/变卦/体用
│   │   ├── hexagrams.js   八卦表 + 64 卦表
│   │   ├── calendar.js    农历/干支/节气/月令旺衰（lunar-javascript）
│   │   ├── prompt.js      解卦 / 追问 / 可复制 prompt 构造
│   │   ├── llm.js         OpenAI 兼容流式客户端
│   │   └── strokes.js     笔画查询（cnchar）
│   └── package.json
├── deploy/
│   ├── Dockerfile         多阶段构建，非 root 运行
│   ├── docker-compose.yml app + caddy
│   ├── Caddyfile          自动 HTTPS + SSE 关缓冲
│   ├── nginx.conf         备选反代
│   ├── meihua.service     systemd 单元
│   ├── deploy.sh          一键上传部署（Docker）
│   └── install-bare.sh    裸机安装（无 Docker）
└── .env.example
```

## 2 本地运行

```bash
cd server
npm install            # 或 pnpm install
cp ../.env.example ../.env   # 填 LLM_API_KEY
node --env-file=../.env src/server.js
# → http://127.0.0.1:8787
```

不配 `LLM_API_KEY` 也能起卦：卦象、互变、体用、记录、复制 prompt 全部可用，只有解卦正文返回错误事件。

## 3 部署

### 3.1 Docker（推荐）

```bash
SERVER=root@1.2.3.4 DOMAIN=meihua.example.com bash deploy/deploy.sh
```

脚本做的事：打包 → scp → 远程解包 → 生成 `.env` → 改写 Caddyfile 域名 → 装 Docker（若无）→ `docker compose up -d --build`。
`SKIP_CERT=1` 走 80 端口纯 HTTP（内网试跑）。

### 3.2 裸机（VPS 无 Docker）

```bash
sudo bash deploy/install-bare.sh meihua.example.com
```

装 Node 22 + Caddy，建 `meihua` 用户，`/opt/meihua`，systemd 托管，Caddy 反代 127.0.0.1:8787。

### 3.3 手动

```bash
git clone <repo> /opt/meihua && cd /opt/meihua/server
npm install --omit=dev
cp ../.env.example ../.env && vi ../.env      # LLM_API_KEY
PORT=8787 node src/server.js
```

反代要点：**必须关掉响应缓冲**，否则 SSE 不吐字。
- Caddy：`flush_interval -1`
- Nginx：`proxy_buffering off;`

## 4 配置

| 变量 | 默认 | 说明 |
|---|---|---|
| `LLM_BASE_URL` | `https://api.deepseek.com/v1` | 任何 OpenAI 兼容端点（DeepSeek / OpenAI / 百炼 / Ollama） |
| `LLM_API_KEY` | — | 本地 Ollama 可留空 |
| `LLM_MODEL` | `deepseek-chat` | 模型名 |
| `LLM_TEMPERATURE` | `0.85` | 解卦要一点发散，别低于 0.6 |
| `LLM_MAX_TOKENS` | `2048` | 400–700 字足够，留余量给 reasoning 模型 |
| `PORT` / `HOST` | `8787` / `0.0.0.0` | 监听地址 |

## 5 API 契约（前端依赖，勿改形状）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/auth/config` | `{required:false}` → 前端跳过登录 |
| GET | `/api/v1/auth/wechat/config` | `{mock:false}` → 关闭微信同步面板 |
| GET | `/api/v1/me` | 401，前端容忍 |
| GET | `/api/v1/strokes?text=` | `{chars:[{ch,han,strokes}]}`，`strokes:null` 表示查不到、需手填 |
| POST | `/api/v1/readings/stream` | SSE，见下 |
| POST | `/api/v1/followups/stream` | SSE，追问 |
| POST | `/api/v1/prompt` | `{text}` 可复制的完整解卦提示词 |
| PUT | `/api/v1/sync/readings` | `{ok:true}` 回执 |
| GET | `/api/health` | 健康检查 + LLM 配置状态 |

### SSE 事件

```
event: reading    data: {cast, datetime, question}   // 卦象，前端立刻渲染
event: progress   data: {stage, chars}
event: reasoning  data: {text}                       // reasoning 模型增量
event: token      data: {text}                       // 正文增量
event: done       data: {model, chars}
event: error      data: {message}
```

### 起卦 payload

```jsonc
{"question":"…","method":"datetime","at":"2026-11-14T15:40:00+08:00"}
{"question":"…","method":"manual","numbers":["12","7"],"add_hour":false}
{"question":"…","method":"strokes","chars":"梅花","strokes":[11,7],"add_hour":false}
{"question":"…","method":"provided","hexagram":23,"moving_lines":[2],"ti_side":"upper"}
{"question":"…","method":"datetime","mode":"study"}   // 学习模式
```

## 6 起卦算法

与原站页面自述的规则一致：

- **年月日时**：年支（子1…亥12）、农历月、农历日；`上卦 = (年+月+日) % 8`，`下卦 = (年+月+日+时支) % 8`，`动爻 = 同和 % 6`，余 0 取模数本身
- **自报数字**：两数分别 `% 8` 定上下卦，和 `% 6` 定动爻，可选并时支；数字串按 BigInt 取模，支持 100 位
- **汉字笔画**：前半笔画和 `% 8` 上卦，后半 `% 8` 下卦，总和 `% 6` 动爻
- **自报卦象**：按文王卦序反查上下卦，动爻可多可空（空 = 静卦）
- **互卦**：二三四爻为下，三四五爻为上
- **变卦**：动爻取反
- **体用**：动爻所在之卦为用，另一为体；五行生克出 `用生体 / 体生用 / 体克用 / 用克体 / 比和`，无动爻则「体用未分」

## 7 排错

| 症状 | 原因 |
|---|---|
| 点了起卦没反应，一直转 | `.env` 缺 `LLM_API_KEY`，看 `curl /api/health` 的 `llm.configured` |
| 卦象出来了但正文不吐字 | 反代开了缓冲，关掉（见 3.3） |
| 提示「请先登录」 | `/api/v1/auth/config` 没返回 `required:false` |
| 笔画查不到 | 生僻字不在 cnchar 字库，前端会提示手填 |
| 记录「未完成」 | 上一轮流被中断，点「重新解读」即可 |
