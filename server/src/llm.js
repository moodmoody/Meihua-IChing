// LLM 客户端：OpenAI 兼容 /chat/completions 流式
// 环境变量：LLM_BASE_URL / LLM_API_KEY / LLM_MODEL / LLM_TEMPERATURE / LLM_MAX_TOKENS

const cfg = () => ({
  base: (process.env.LLM_BASE_URL || "https://api.deepseek.com/v1").replace(/\/+$/, ""),
  key: process.env.LLM_API_KEY || "",
  model: process.env.LLM_MODEL || "deepseek-chat",
  temperature: process.env.LLM_TEMPERATURE ? Number(process.env.LLM_TEMPERATURE) : 0.85,
  maxTokens: process.env.LLM_MAX_TOKENS ? Number(process.env.LLM_MAX_TOKENS) : 2048,
});

export function llmInfo() {
  const c = cfg();
  return { model: c.model, base: c.base, configured: !!c.key || /localhost|127\.0\.0\.1/.test(c.base) };
}

/**
 * 流式对话。
 * @param {object} p
 * @param {Array<{role:string,content:string}>} p.messages
 * @param {(t:string)=>void} [p.onToken]
 * @param {(t:string)=>void} [p.onReasoning]
 * @param {AbortSignal} [p.signal]
 * @returns {Promise<{text:string, reasoning:string, model:string}>}
 */
export async function streamChat({ messages, onToken, onReasoning, signal }) {
  const c = cfg();
  if (!c.key && !/localhost|127\.0\.0\.1/.test(c.base)) {
    throw new Error("未配置 LLM_API_KEY（在 .env 里设置，或把 LLM_BASE_URL 指向本地 Ollama）");
  }

  const res = await fetch(`${c.base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(c.key ? { Authorization: `Bearer ${c.key}` } : {}),
    },
    body: JSON.stringify({
      model: c.model,
      messages,
      stream: true,
      temperature: c.temperature,
      max_tokens: c.maxTokens,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LLM ${res.status}：${detail.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  let reasoning = "";
  let model = c.model;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() || "";
    for (const block of parts) {
      for (const line of block.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        let j;
        try {
          j = JSON.parse(data);
        } catch {
          continue;
        }
        if (j.model) model = j.model;
        const delta = j.choices && j.choices[0] && j.choices[0].delta;
        if (!delta) continue;
        if (typeof delta.reasoning_content === "string" && delta.reasoning_content) {
          reasoning += delta.reasoning_content;
          onReasoning && onReasoning(delta.reasoning_content);
        }
        if (typeof delta.content === "string" && delta.content) {
          text += delta.content;
          onToken && onToken(delta.content);
        }
      }
    }
  }

  return { text, reasoning, model };
}
