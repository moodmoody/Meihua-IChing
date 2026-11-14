// 解卦提示词构造：梅花易数断卦法（体用 → 卦义 → 互变 → 外应 → 落地）
import { TRIGRAMS } from "./hexagrams.js";

const YAO = ["", "初", "二", "三", "四", "五", "上"];

function yaoSymbol(v) {
  return v === 1 ? "▅▅▅▅▅" : "▅▅ ▅▅";
}

function drawHexagram(g) {
  const rows = [];
  for (let i = 5; i >= 0; i--) rows.push(`${yaoSymbol(g.lines[i])}  ${i === 5 ? "上" : i === 0 ? "初" : YAO[i + 1] || i + 1}`);
  return rows.join("\n");
}

function trigramLine(name, tri) {
  if (!tri) return "";
  return `${name}：${tri.sym} ${tri.name}（${tri.nature}·${tri.wx}）`;
}

export function castBlock(cast) {
  const mv = cast.moving_lines && cast.moving_lines.length
    ? cast.moving_lines.map((n) => `${YAO[n] || n}爻`).join("、")
    : "无（静卦）";
  const lines = [
    `【本卦】第${cast.ben.king_wen}卦 ${cast.ben.name}`,
    `卦辞：${cast.ben.judgment || "—"}`,
    drawHexagram(cast.ben),
    trigramLine("上卦", cast.ben.upper),
    trigramLine("下卦", cast.ben.lower),
    `【动爻】${mv}`,
  ];
  if (cast.hu) {
    lines.push(`【互卦】第${cast.hu.king_wen}卦 ${cast.hu.name}（事之过程）`);
    lines.push(trigramLine("互上", cast.hu.upper), trigramLine("互下", cast.hu.lower));
  }
  if (cast.bian) {
    lines.push(`【变卦】第${cast.bian.king_wen}卦 ${cast.bian.name}（事之结局）`);
    lines.push(trigramLine("变上", cast.bian.upper), trigramLine("变下", cast.bian.lower));
  }
  if (cast.ti && cast.yong) {
    lines.push(`【体用】体卦 ${cast.ti.sym}${cast.ti.name}（${cast.ti.wx}）　用卦 ${cast.yong.sym}${cast.yong.name}（${cast.yong.wx}）`);
    lines.push(`【体用关系】${cast.relation.name}——${cast.relation.desc}`);
  } else {
    lines.push(`【体用】六爻安静，体用未分`);
  }
  return lines.join("\n");
}

export function datetimeBlock(dt) {
  if (!dt) return "";
  return [
    `公历：${dt.solar} ${dt.weekday || ""}`,
    `农历：${dt.lunar ? dt.lunar.text : ""}`,
    `干支：${dt.ganzhi.year}年 ${dt.ganzhi.month}月 ${dt.ganzhi.day}日 ${dt.ganzhi.hour}时（${dt.ganzhi.hour_name || ""}）`,
    `节气：${dt.jieqi ? `${dt.jieqi.current}（下一节气 ${dt.jieqi.next} ${dt.jieqi.next_date}）` : ""}`,
    `月令：${dt.ling_wx || ""}当令　${dt.ling_phrase || ""}`,
  ].join("\n");
}

const SYSTEM = `你是一位深研《梅花易数》的断卦者。你不表演玄虚，也不给万金油式的安慰。
你以古法为骨：体用生克定吉凶，卦象卦义定事理，互卦看过程，变卦看结局，月令旺衰与外应定轻重。
你以当下为肉：把卦象落到提问者真实处境里，讲清「能不能成、卡在哪、什么时候、该怎么做」。
行文用简体中文，第二人称，克制、具体、有分寸。不用「量子」「能量」「磁场」这类词，不写免责声明，不堆四字成语。`;

export function buildReadingPrompt({ question, cast, datetime, mode, waiying }) {
  const study = mode === "study";
  const head = study
    ? `请按梅花易数完整讲这一卦（学习模式：提问者不问具体事，只想看懂这一卦）。`
    : `所问：${question || "（未填写）"}`;

  const body = [
    head,
    ``,
    `— 起卦时间 —`,
    datetimeBlock(datetime),
    ``,
    `— 卦象 —`,
    castBlock(cast),
    waiying ? `\n— 外应 —\n${waiying}` : ``,
    ``,
    `— 断卦要求 —`,
    study
      ? `1. 先讲这一卦的骨架：体用怎么分、五行什么关系、为什么这样断。
2. 本卦、互卦、变卦各主什么，串成一条事情从起念到落定的线。
3. 讲清卦名卦义在这卦里的具体含义，不要泛泛背卦辞。
4. 若有动爻，说明动爻的位置意味着什么。
5. 结尾给一句这一卦最该记住的话。`
      : `1. 先一句直断：这件事成、不成、还是成而有阻。不要绕。
2. 用体用生克说明为什么，把五行的力量对比讲成人能听懂的话。
3. 本卦是当下，互卦是过程，变卦是结局——三者连成一条线讲，说清转折点在哪。
4. 若有动爻，指出动在何处、应在何时或何事上。
5. 结合月令旺衰判断力量强弱与时间窗口（尽量给可感知的时间范围，如「这个月内」「入冬前后」）。
6. 最后给两到三条能落地的建议，具体到做什么、不做什么。
7. 篇幅 400–700 字，分小段，可用小标题。不要复述卦象数据。`,
  ];

  return `${SYSTEM}\n\n${body.filter((x) => x !== undefined).join("\n")}`;
}

export function buildFollowupPrompt({ question, cast, datetime, message, history, currentCast, mode }) {
  const hist = Array.isArray(history) && history.length
    ? history
        .slice(-12)
        .map((t) => `${t.role === "user" ? "问" : "答"}：${String(t.content || "").slice(0, 1200)}`)
        .join("\n")
    : "（无）";

  return [
    SYSTEM,
    ``,
    `— 所问 —`,
    question || "（未填写）",
    ``,
    `— 起卦时间 —`,
    datetimeBlock(datetime),
    ``,
    `— 本卦 —`,
    castBlock(cast),
    currentCast && currentCast.ben && currentCast.ben.king_wen !== (cast && cast.ben && cast.ben.king_wen)
      ? `\n— 另起之卦（正在问的这一卦）—\n${castBlock(currentCast)}`
      : ``,
    ``,
    `— 前情 —`,
    hist,
    ``,
    `— 新的追问 —`,
    message,
    ``,
    `— 要求 —`,
    mode === "study"
      ? `就这一卦继续讲透，承接前文，不要重复已说过的内容。200–500 字。`
      : `顺着这一卦继续断，承接前文，不要重复已说过的内容。有新的问题就正面回答，不回避。200–500 字。`,
  ]
    .filter((x) => x !== undefined && x !== "")
    .join("\n");
}

/** /api/v1/prompt：给用户复制去别处用的自包含提示词 */
export function buildCopyPrompt({ question, cast, datetime, mode }) {
  return [
    `请以《梅花易数》为我解这一卦。`,
    ``,
    `— 所问 —`,
    mode === "study" ? "（学习模式：只想看懂这一卦，不问具体事）" : question || "（未填写）",
    ``,
    `— 起卦时间 —`,
    datetimeBlock(datetime),
    ``,
    `— 卦象 —`,
    castBlock(cast),
    ``,
    `— 请这样解 —`,
    `先一句直断成败；再用体用生克讲为什么；再串本卦（当下）→互卦（过程）→变卦（结局）；若有动爻点明应在何处；结合月令判断时间与力量；最后给两三条能落地的建议。`,
    `简体中文，400–700 字，不复述卦象数据，不写免责声明。`,
  ].join("\n");
}
