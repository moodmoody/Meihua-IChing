// 汉字笔画查询（cnchar 内置字库；生僻字返回 null，交前端手填）
import cnchar from "cnchar";

const HAN = /^\p{Script=Han}$/u;

export function strokeOf(ch) {
  if (!ch || !HAN.test(ch)) return null;
  let n = 0;
  try {
    n = cnchar.stroke(ch);
  } catch {
    return null;
  }
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** text → [{ ch, han, strokes }] */
export function lookupStrokes(text) {
  const chars = Array.from(String(text || "")).slice(0, 40);
  return chars.map((ch) => {
    const han = HAN.test(ch);
    return { ch, han, strokes: han ? strokeOf(ch) : null };
  });
}
