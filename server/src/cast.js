// 梅花易数 · 起卦与卦变
import { TRIGRAMS, HEX_TABLE, ORDER_TO_TRIGRAMS, hexagramOfLines, trigramOfLines } from "./hexagrams.js";
import { buildDatetime, zhiIndex } from "./calendar.js";

const YAO_NAME = ["", "初", "二", "三", "四", "五", "上"];
const CN_NUM = ["", "一", "二", "三", "四", "五", "六"];

// 五行相生：金→水→木→火→土→金
const SHENG = { 金: "水", 水: "木", 木: "火", 火: "土", 土: "金" };
// 五行相克：金→木→土→水→火→金
const KE = { 金: "木", 木: "土", 土: "水", 水: "火", 火: "金" };

export function modOr(n, m) {
  const r = ((n % m) + m) % m;
  return r === 0 ? m : r;
}

function bigMod(str, m) {
  let r = 0n;
  const bm = BigInt(m);
  for (const ch of String(str)) r = (r * 10n + BigInt(ch)) % bm;
  return Number(r);
}

function linesOfTrigrams(upperNum, lowerNum) {
  const up = TRIGRAMS[upperNum].bits.split("").map(Number);
  const lo = TRIGRAMS[lowerNum].bits.split("").map(Number);
  return [...lo, ...up]; // 下卦为初二三爻，上卦为四五六爻
}

/** 体用五行生克 */
export function relationOf(tiWx, yongWx, movingLines) {
  if (!movingLines || !movingLines.length) {
    return { tone: "neutral", name: "体用未分", desc: "六爻安静，无动无变，以本卦卦义断之" };
  }
  if (tiWx === yongWx) {
    return { tone: "good", name: "体用比和", desc: "同气相求，谋为顺遂，得人相助" };
  }
  if (SHENG[yongWx] === tiWx) {
    return { tone: "good", name: "用生体", desc: "生我者为进，主有意外之助，事多顺遂" };
  }
  if (SHENG[tiWx] === yongWx) {
    return { tone: "warn", name: "体生用", desc: "我生者为泄，主耗散精力，费力而功少" };
  }
  if (KE[tiWx] === yongWx) {
    return { tone: "mid", name: "体克用", desc: "我克者为财，事可成而须费力经营" };
  }
  if (KE[yongWx] === tiWx) {
    return { tone: "bad", name: "用克体", desc: "克我者为鬼，主有阻隔，事多拂逆" };
  }
  return { tone: "neutral", name: "体用平和", desc: "休戚相当，宜守常待时" };
}

function mvPhrase(movingLines) {
  if (!movingLines.length) return "六爻安静";
  return `${movingLines.map((n) => CN_NUM[n] || n).join("、")}爻动`;
}

/**
 * 组装完整卦象。
 * @param {number[]} lines 六爻，自下而上
 * @param {number[]} movingLines 动爻（1..6）
 * @param {object} meta 附加信息（method / numbers / chars / add_hour / waiying / ti_side）
 */
export function assembleCast(lines, movingLines, meta = {}) {
  const ben = hexagramOfLines(lines);
  if (!ben) throw new Error("卦象非法");

  // 互卦：下卦取二三四爻，上卦取三四五爻
  const huLines = [lines[1], lines[2], lines[3], lines[2], lines[3], lines[4]];
  const hu = hexagramOfLines(huLines);

  // 变卦：动爻取反
  const bianLines = lines.slice();
  for (const m of movingLines) {
    const i = m - 1;
    if (i >= 0 && i < 6) bianLines[i] = bianLines[i] ? 0 : 1;
  }
  const bian = hexagramOfLines(bianLines);

  // 体用：动爻所在之卦为用，另一卦为体
  const first = movingLines.length ? movingLines.slice().sort((a, b) => a - b)[0] : 0;
  let tiSide = null;
  if (first) tiSide = first <= 3 ? "upper" : "lower";
  if (meta.ti_side) tiSide = meta.ti_side;

  const upper = ben.upper;
  const lower = ben.lower;
  const tiTri = tiSide === "lower" ? lower : tiSide === "upper" ? upper : null;
  const yongTri = tiSide === "lower" ? upper : tiSide === "upper" ? lower : null;

  const relation =
    tiTri && yongTri
      ? relationOf(tiTri.wx, yongTri.wx, movingLines)
      : relationOf(upper.wx, lower.wx, []);

  const movingText = movingLines.length
    ? movingLines.map((n) => `${YAO_NAME[n] || n}爻`).join("、")
    : "无（静卦）";

  const process = buildProcessText(ben, hu, bian, movingLines, meta);

  return {
    method: meta.method || "datetime",
    ...(meta.chars ? { chars: meta.chars } : {}),
    ...(meta.numbers ? { numbers: meta.numbers } : {}),
    ...(meta.add_hour !== undefined ? { add_hour: !!meta.add_hour } : {}),
    ...(meta.waiying ? { waiying: meta.waiying } : {}),
    moving_line: movingLines.length ? movingLines[0] : 0,
    moving_lines: movingLines.slice(),
    ti_side: tiSide,
    ben,
    hu,
    bian,
    upper,
    lower,
    ti: tiTri ? { name: tiTri.name, wx: tiTri.wx, sym: tiTri.sym, nature: tiTri.nature } : null,
    yong: yongTri ? { name: yongTri.name, wx: yongTri.wx, sym: yongTri.sym, nature: yongTri.nature } : null,
    relation,
    moving_text: movingText,
    process,
  };
}

function buildProcessText(ben, hu, bian, movingLines, meta) {
  const parts = [];
  if (meta.method === "datetime" && meta._nums) {
    const { year_zhi, month, day, hour_zhi } = meta._nums;
    parts.push(
      `以${meta._solarText || "起卦之时"}推之：年支${year_zhi}、农历月${month}、日${day}，三数之和取八，得上卦${ben.upper.name}${ben.upper.sym}；再加时支${hour_zhi}取下卦${ben.lower.name}${ben.lower.sym}；总数取六，${mvPhrase(movingLines)}。`,
    );
  } else if (meta.method === "manual" && meta.numbers) {
    parts.push(
      `以所报之数起卦：${meta.numbers[0]}取八得上卦${ben.upper.name}${ben.upper.sym}，${meta.numbers[1]}取八得下卦${ben.lower.name}${ben.lower.sym}，合数${meta.add_hour ? "并时支" : ""}取六，${mvPhrase(movingLines)}。`,
    );
  } else if (meta.method === "strokes" && meta.chars) {
    parts.push(
      `以「${meta.chars}」笔画起卦：上卦${ben.upper.name}${ben.upper.sym}，下卦${ben.lower.name}${ben.lower.sym}，${mvPhrase(movingLines)}。`,
    );
  } else if (meta.method === "provided") {
    parts.push(
      `自报卦象：第${ben.king_wen}卦${ben.name}，上${ben.upper.name}下${ben.lower.name}，${mvPhrase(movingLines)}。`,
    );
  } else {
    parts.push(`得第${ben.king_wen}卦${ben.name}，上${ben.upper.name}下${ben.lower.name}。`);
  }
  parts.push(
    `本卦${ben.name}，上${ben.upper.nature}下${ben.lower.nature}；互卦${hu ? hu.name : "—"}；变卦${bian ? bian.name : "—"}。`,
  );
  if (meta.waiying) parts.push(`外应：${meta.waiying}。`);
  return parts.join("");
}

/** 时间起卦 */
export function castByDatetime(at, meta = {}) {
  const dt = buildDatetime(at, meta.offsetMinutes);
  const { year_zhi, month, day, hour_zhi } = dt._num;
  const upSum = year_zhi + month + day;
  const lowerSum = upSum + hour_zhi;
  const upperNum = modOr(upSum, 8);
  const lowerNum = modOr(lowerSum, 8);
  const moving = modOr(lowerSum, 6);
  const lines = linesOfTrigrams(upperNum, lowerNum);
  const nums = dt._num;
  delete dt._num;
  const cast = assembleCast(lines, [moving], {
    ...meta,
    method: "datetime",
    _nums: nums,
    _solarText: dt.solar,
  });
  return { cast, datetime: dt };
}

/** 自报数字起卦（数字串，支持大数） */
export function castByNumbers(nums, addHour = false, at, meta = {}) {
  const [a, b] = nums.map(String);
  const upperNum = modOr(bigMod(a, 8), 8);
  const lowerNum = modOr(bigMod(b, 8), 8);
  const dt = buildDatetime(at, meta.offsetMinutes);
  delete dt._num;
  const hourExtra = addHour ? zhiIndex(dt.ganzhi.time_zhi) : 0;
  const sumMod = (bigMod(a, 6) + bigMod(b, 6) + hourExtra) % 6;
  const moving = sumMod === 0 ? 6 : sumMod;
  const lines = linesOfTrigrams(upperNum, lowerNum);
  const cast = assembleCast(lines, [moving], {
    ...meta,
    method: "manual",
    numbers: [a, b],
    add_hour: !!addHour,
  });
  return { cast, datetime: dt };
}

/** 汉字笔画起卦 */
export function castByStrokes(chars, strokes, addHour = false, at, meta = {}) {
  const list = Array.from(String(chars || ""));
  const counts = (strokes && strokes.length === list.length ? strokes : null) || list.map(() => 0);
  if (!list.length) throw new Error("没有可起卦的汉字");
  if (counts.some((c) => !Number.isInteger(c) || c <= 0)) throw new Error("笔画数缺失");

  const total = counts.reduce((a, b) => a + b, 0);
  let upperNum, lowerNum;
  if (list.length === 1) {
    upperNum = modOr(counts[0], 8);
    lowerNum = modOr(counts[0] + 1, 8);
  } else {
    const half = Math.ceil(list.length / 2);
    const head = counts.slice(0, half).reduce((a, b) => a + b, 0);
    const tail = counts.slice(half).reduce((a, b) => a + b, 0);
    upperNum = modOr(head, 8);
    lowerNum = modOr(tail, 8);
  }

  const dt = buildDatetime(at, meta.offsetMinutes);
  delete dt._num;
  const hourExtra = addHour ? zhiIndex(dt.ganzhi.time_zhi) : 0;
  const sumMod = (total + hourExtra) % 6;
  const moving = sumMod === 0 ? 6 : sumMod;
  const lines = linesOfTrigrams(upperNum, lowerNum);
  const cast = assembleCast(lines, [moving], {
    ...meta,
    method: "strokes",
    chars: String(chars),
    add_hour: !!addHour,
  });
  return { cast, datetime: dt };
}

/** 自报卦象 */
export function castByProvided(hexagram, movingLines, tiSide, at, meta = {}) {
  const kw = Number(hexagram);
  const t = ORDER_TO_TRIGRAMS.get(kw);
  if (!t) throw new Error(`未知卦序：${hexagram}`);
  const lines = linesOfTrigrams(t.upper, t.lower);
  const mv = (Array.isArray(movingLines) ? movingLines : [movingLines])
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 6);
  const dt = buildDatetime(at, meta.offsetMinutes);
  delete dt._num;
  const cast = assembleCast(lines, mv, {
    ...meta,
    method: "provided",
    ti_side: tiSide || undefined,
  });
  return { cast, datetime: dt };
}

export function triOf(lines, top) {
  return trigramOfLines(lines, top);
}
