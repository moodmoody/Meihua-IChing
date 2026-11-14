// 历法：公历 / 农历 / 干支 / 节气 / 月令旺衰
import { Solar, Lunar } from "lunar-javascript";

const ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

// 月支 → 五行旺相休囚死
const SEASON_STATE = {
  寅: { 旺: "木", 相: "火", 休: "水", 囚: "金", 死: "土" },
  卯: { 旺: "木", 相: "火", 休: "水", 囚: "金", 死: "土" },
  巳: { 旺: "火", 相: "土", 休: "木", 囚: "水", 死: "金" },
  午: { 旺: "火", 相: "土", 休: "木", 囚: "水", 死: "金" },
  申: { 旺: "金", 相: "水", 休: "土", 囚: "火", 死: "木" },
  酉: { 旺: "金", 相: "水", 休: "土", 囚: "火", 死: "木" },
  亥: { 旺: "水", 相: "木", 休: "金", 囚: "土", 死: "火" },
  子: { 旺: "水", 相: "木", 休: "金", 囚: "土", 死: "火" },
  辰: { 旺: "土", 相: "金", 休: "火", 囚: "木", 死: "水" },
  戌: { 旺: "土", 相: "金", 休: "火", 囚: "木", 死: "水" },
  丑: { 旺: "土", 相: "金", 休: "火", 囚: "木", 死: "水" },
  未: { 旺: "土", 相: "金", 休: "火", 囚: "木", 死: "水" },
};

// 地支序：子1 … 亥12
export function zhiIndex(zhi) {
  const i = ZHI.indexOf(zhi);
  return i < 0 ? 1 : i + 1;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

// ISO 字符串（带时区）→ { y, m, d, H, M }
export function parseLocalIso(iso) {
  if (!iso || typeof iso !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso.trim());
  if (!m) return null;
  return { y: +m[1], mo: +m[2], d: +m[3], H: +m[4], M: +m[5] };
}

export function nowLocalIso(offsetMinutes) {
  const tz = typeof offsetMinutes === "number" ? offsetMinutes : -new Date().getTimezoneOffset();
  const d = new Date(Date.now() + tz * 60000);
  const sign = tz >= 0 ? "+" : "-";
  const abs = Math.abs(tz);
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/**
 * 构造前端 renderCast 需要的 datetime 对象。
 * at: 带时区的本地时间串；缺省取服务器当前时间。
 */
export function buildDatetime(at, offsetMinutes) {
  const iso = at || nowLocalIso(offsetMinutes);
  const p = parseLocalIso(iso) || parseLocalIso(nowLocalIso(offsetMinutes));
  const solar = Solar.fromYmdHms(p.y, p.mo, p.d, p.H, p.M, 0);
  const lunar = solar.getLunar();

  const monthZhi = lunar.getMonthZhi();
  const states = SEASON_STATE[monthZhi] || SEASON_STATE.子;

  const prev = lunar.getPrevJieQi();
  const next = lunar.getNextJieQi();
  const prevSolar = prev ? prev.getSolar() : null;
  const nextSolar = next ? next.getSolar() : null;

  // 五行 → 旺相休囚死
  const lingStates = {};
  for (const [state, wx] of Object.entries(states)) lingStates[wx] = state;

  return {
    iso,
    solar: `${p.y}年${p.mo}月${p.d}日 ${pad(p.H)}:${pad(p.M)}`,
    weekday: `星期${WEEK[solar.getWeek()]}`,
    lunar: {
      text: `农历${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
      year: lunar.getYear(),
      month: lunar.getMonth(),
      day: lunar.getDay(),
      isLeap: typeof lunar.isLeap === "function" ? lunar.isLeap() : false,
    },
    ganzhi: {
      year: lunar.getYearInGanZhi(),
      month: lunar.getMonthInGanZhi(),
      day: lunar.getDayInGanZhi(),
      hour: lunar.getTimeInGanZhi(),
      hour_name: `${lunar.getTimeZhi()}时`,
      year_zhi: lunar.getYearZhi(),
      month_zhi: monthZhi,
      day_zhi: lunar.getDayZhi(),
      time_zhi: lunar.getTimeZhi(),
    },
    jieqi: {
      current: prev ? prev.getName() : "",
      next: next ? next.getName() : "",
      next_date: nextSolar ? nextSolar.toYmd() : "",
      prev_date: prevSolar ? prevSolar.toYmd() : "",
    },
    ling_basis: "月令",
    ling_wx: states.旺,
    ling_phrase: `${states.旺}旺、${states.相}相；${states.休}休、${states.囚}囚、${states.死}死`,
    ling_states: lingStates,
    // 起卦用的原始数字
    _num: {
      year_zhi: zhiIndex(lunar.getYearZhi()),
      month: lunar.getMonth(),
      day: lunar.getDay(),
      hour_zhi: zhiIndex(lunar.getTimeZhi()),
    },
  };
}
