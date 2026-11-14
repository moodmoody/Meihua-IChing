// 梅花易数 · 复刻后端（与 meihua 前端 /api/v1 契约对齐）
// 运行：node src/server.js
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { castByDatetime, castByNumbers, castByProvided, castByStrokes } from "./cast.js";
import { buildDatetime } from "./calendar.js";
import { buildCopyPrompt, buildFollowupPrompt, buildReadingPrompt } from "./prompt.js";
import { llmInfo, streamChat } from "./llm.js";
import { lookupStrokes } from "./strokes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "dist");
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "same-origin",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; form-action 'self'",
};

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    ...SECURITY_HEADERS,
  });
  res.end(body);
}

function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("请求体过大"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("请求体不是合法 JSON"));
      }
    });
    req.on("error", reject);
  });
}

// ───────────────────────── 起卦：payload → { cast, datetime } ─────────────────────────

function resolveCast(payload) {
  const method = payload.method || "datetime";
  const at = payload.at || undefined;

  if (method === "manual") {
    const nums = Array.isArray(payload.numbers) ? payload.numbers.map(String) : [];
    if (nums.length < 2) throw new Error("自报数字起卦需要两个正整数");
    for (const n of nums) if (!/^\d+$/.test(n)) throw new Error("自报数字必须是正整数");
    return castByNumbers(nums, !!payload.add_hour, at);
  }

  if (method === "strokes") {
    const chars = String(payload.chars || "");
    if (!chars) throw new Error("笔画起卦需要汉字");
    let strokes = Array.isArray(payload.strokes) ? payload.strokes.map(Number) : null;
    if (!strokes || strokes.some((n) => !Number.isInteger(n) || n <= 0)) {
      strokes = Array.from(chars).map((ch) => lookupStrokes(ch)[0].strokes);
    }
    return castByStrokes(chars, strokes, !!payload.add_hour, at);
  }

  if (method === "provided") {
    if (payload.hexagram == null) throw new Error("自报卦象需要卦序");
    return castByProvided(payload.hexagram, payload.moving_lines || [], payload.ti_side, at);
  }

  // datetime（默认）与 random（前端随机两数时可能走 manual）
  return castByDatetime(at);
}

// ───────────────────────── SSE ─────────────────────────

function sseHead(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    ...SECURITY_HEADERS,
  });
  res.write(": connected\n\n");
}

function sseSend(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function handleReadingsStream(req, res) {
  const payload = await readBody(req);
  let cast, datetime;
  try {
    ({ cast, datetime } = resolveCast(payload));
  } catch (e) {
    return json(res, 400, { error: String(e.message || e) });
  }

  sseHead(res);
  let clientGone = false;
  res.on("close", () => {
    clientGone = true;
  });

  sseSend(res, "reading", {
    cast,
    datetime,
    question: payload.question || "",
  });
  sseSend(res, "progress", { stage: "卦成，开始解卦", chars: 0 });

  const prompt = buildReadingPrompt({
    question: payload.question,
    cast,
    datetime,
    mode: payload.mode,
    waiying: payload.waiying,
  });

  try {
    const out = await streamChat({
      messages: [
        { role: "system", content: "你是精通《梅花易数》的断卦者，回答使用简体中文。" },
        { role: "user", content: prompt },
      ],
      onToken: (t) => {
        if (!clientGone) sseSend(res, "token", { text: t });
      },
      onReasoning: (t) => {
        if (!clientGone) sseSend(res, "reasoning", { text: t });
      },
    });
    if (!clientGone) sseSend(res, "done", { model: out.model, chars: out.text.length });
  } catch (e) {
    if (!clientGone) sseSend(res, "error", { message: String(e.message || e) });
  } finally {
    if (!clientGone) res.end();
  }
}

async function handleFollowupsStream(req, res) {
  const payload = await readBody(req);
  let cast, datetime, currentCast, currentDatetime;
  try {
    ({ cast, datetime } = resolveCast({
      method: payload.method || "provided",
      hexagram: payload.cast && payload.cast.ben ? payload.cast.ben.king_wen : undefined,
      moving_lines: payload.cast ? payload.cast.moving_lines : [],
      ti_side: payload.cast ? payload.cast.ti_side : undefined,
      at: payload.cast_datetime && payload.cast_datetime.iso,
      ...(payload.method ? { numbers: payload.numbers, chars: payload.chars, strokes: payload.strokes, add_hour: payload.add_hour } : {}),
    }));
  } catch (e) {
    return json(res, 400, { error: String(e.message || e) });
  }

  if (payload.current_cast && payload.current_cast.ben) {
    currentCast = payload.current_cast;
    currentDatetime = payload.current_cast_datetime || null;
  }

  sseHead(res);
  let clientGone = false;
  res.on("close", () => {
    clientGone = true;
  });

  const prompt = buildFollowupPrompt({
    question: payload.question,
    cast,
    datetime,
    message: payload.message || "",
    history: payload.history,
    currentCast,
    mode: payload.mode,
  });

  try {
    const out = await streamChat({
      messages: [
        { role: "system", content: "你是精通《梅花易数》的断卦者，回答使用简体中文。" },
        { role: "user", content: prompt },
      ],
      onToken: (t) => {
        if (!clientGone) sseSend(res, "token", { text: t });
      },
      onReasoning: (t) => {
        if (!clientGone) sseSend(res, "reasoning", { text: t });
      },
    });
    if (!clientGone) sseSend(res, "done", { model: out.model, chars: out.text.length });
  } catch (e) {
    if (!clientGone) sseSend(res, "error", { message: String(e.message || e) });
  } finally {
    if (!clientGone) res.end();
  }
}

// ───────────────────────── 静态文件 ─────────────────────────

async function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split("?")[0]);
  if (rel === "/" || rel === "") rel = "/index.html";
  const filePath = path.join(ROOT, path.normalize(rel).replace(/^([/\\])+/, ""));
  if (!filePath.startsWith(ROOT)) return json(res, 403, { error: "拒绝访问" });

  try {
    const st = await stat(filePath);
    if (!st.isFile()) throw new Error("not file");
    const ext = path.extname(filePath).toLowerCase();
    const immutable = ext === ".woff2" || ext === ".woff";
    const cache = immutable ? "public, max-age=31536000, immutable" : ext === ".html" ? "no-cache" : "public, max-age=3600";
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Length": st.size,
      "Cache-Control": cache,
      "Accept-Ranges": "bytes",
      ...SECURITY_HEADERS,
    });
    createReadStream(filePath).pipe(res);
  } catch {
    // SPA 兜底：非资源请求回首页
    if (!path.extname(rel)) {
      try {
        const html = await readFile(path.join(ROOT, "index.html"));
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": html.length,
          "Cache-Control": "no-cache",
          ...SECURITY_HEADERS,
        });
        return res.end(html);
      } catch {
        /* fallthrough */
      }
    }
    json(res, 404, { error: "未找到" });
  }
}

// ───────────────────────── 路由 ─────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const p = url.pathname;

  try {
    // —— 鉴权：复刻版不设门槛，前端读到 required:false 即跳过登录 ——
    if (p === "/api/v1/auth/config" && req.method === "GET") {
      return json(res, 200, { required: false, provider: null, login_path: null, callback: null });
    }
    if (p === "/api/v1/auth/wechat/config" && req.method === "GET") {
      return json(res, 200, { mock: false });
    }
    if (p === "/api/v1/me" && req.method === "GET") {
      return json(res, 401, { error: "未登录" });
    }
    if (p === "/api/v1/auth/logout" && req.method === "POST") {
      return json(res, 200, { ok: true });
    }

    // —— 笔画 ——
    if (p === "/api/v1/strokes" && req.method === "GET") {
      const text = url.searchParams.get("text") || "";
      return json(res, 200, { chars: lookupStrokes(text) });
    }

    // —— 解卦流 ——
    if (p === "/api/v1/readings/stream" && req.method === "POST") {
      return handleReadingsStream(req, res);
    }
    if (p === "/api/v1/followups/stream" && req.method === "POST") {
      return handleFollowupsStream(req, res);
    }

    // —— 可复制提示词 ——
    if (p === "/api/v1/prompt" && req.method === "POST") {
      const payload = await readBody(req);
      let cast, datetime;
      try {
        ({ cast, datetime } = resolveCast({
          method: "provided",
          hexagram: payload.cast && payload.cast.ben ? payload.cast.ben.king_wen : payload.hexagram,
          moving_lines: payload.cast ? payload.cast.moving_lines : payload.moving_lines,
          ti_side: payload.cast ? payload.cast.ti_side : payload.ti_side,
          at: payload.cast_datetime && payload.cast_datetime.iso,
          numbers: payload.numbers,
          chars: payload.chars,
          strokes: payload.strokes,
          add_hour: payload.add_hour,
        }));
      } catch (e) {
        return json(res, 400, { error: String(e.message || e) });
      }
      const text = buildCopyPrompt({
        question: payload.question,
        cast,
        datetime,
        mode: payload.mode,
      });
      return json(res, 200, { text });
    }

    // —— 记录同步（复刻版不做跨端，回执即成功，前端不再重试）——
    if (p === "/api/v1/sync/readings" && req.method === "PUT") {
      await readBody(req);
      return json(res, 200, { ok: true, records: [], tombstones: [] });
    }

    if (p === "/api/health") {
      return json(res, 200, { ok: true, llm: llmInfo(), uptime: Math.round(process.uptime()) });
    }

    if (p.startsWith("/api/")) {
      return json(res, 404, { error: "接口不存在" });
    }

    return serveStatic(req, res, p);
  } catch (e) {
    if (!res.headersSent) json(res, 500, { error: String(e.message || e) });
    else res.end();
  }
});

// 大模型响应可能很慢：关掉默认超时
server.requestTimeout = 0;
server.headersTimeout = 0;
server.keepAliveTimeout = 65000;

server.listen(PORT, HOST, () => {
  const info = llmInfo();
  console.log(`[meihua] listening on http://${HOST}:${PORT}`);
  console.log(`[meihua] static root: ${ROOT}`);
  console.log(`[meihua] llm: ${info.model} @ ${info.base} ${info.configured ? "(configured)" : "(missing API key)"}`);
});

export { server };
