// 梅花易数 · 八卦与六十四卦表
// 爻序统一为「自下而上」：lines[0] = 初爻，lines[5] = 上爻。

// 先天数 1..8 索引（0 位留空）
export const TRIGRAMS = [
  null,
  { num: 1, name: "乾", sym: "☰", bits: "111", wx: "金", nature: "天" },
  { num: 2, name: "兑", sym: "☱", bits: "110", wx: "金", nature: "泽" },
  { num: 3, name: "离", sym: "☲", bits: "101", wx: "火", nature: "火" },
  { num: 4, name: "震", sym: "☳", bits: "100", wx: "木", nature: "雷" },
  { num: 5, name: "巽", sym: "☴", bits: "011", wx: "木", nature: "风" },
  { num: 6, name: "坎", sym: "☵", bits: "010", wx: "水", nature: "水" },
  { num: 7, name: "艮", sym: "☶", bits: "001", wx: "土", nature: "山" },
  { num: 8, name: "坤", sym: "☷", bits: "000", wx: "土", nature: "地" },
];

export const BITS_TO_NUM = Object.fromEntries(
  TRIGRAMS.filter(Boolean).map((t) => [t.bits, t.num]),
);

// 六十四卦：HEX_TABLE[上卦先天数][下卦先天数]
// 每项：king_wen 文王卦序、name 通行卦名、judgment 一句卦义（供 prompt / 摘要使用）
export const HEX_TABLE = {
  1: {
    1: { king_wen: 1, name: "乾为天", judgment: "刚健中正，自强不息" },
    2: { king_wen: 10, name: "天泽履", judgment: "履虎尾，不咥人，亨" },
    3: { king_wen: 13, name: "天火同人", judgment: "同人于野，亨" },
    4: { king_wen: 25, name: "天雷无妄", judgment: "无妄，元亨利贞" },
    5: { king_wen: 44, name: "天风姤", judgment: "女壮，勿用取女" },
    6: { king_wen: 6, name: "天水讼", judgment: "有孚窒惕，中吉终凶" },
    7: { king_wen: 33, name: "天山遁", judgment: "遁亨，小利贞" },
    8: { king_wen: 12, name: "天地否", judgment: "否之匪人，不利君子贞" },
  },
  2: {
    1: { king_wen: 43, name: "泽天夬", judgment: "扬于王庭，孚号有厉" },
    2: { king_wen: 58, name: "兑为泽", judgment: "和悦以说，朋友讲习" },
    3: { king_wen: 49, name: "泽火革", judgment: "巳日乃孚，元亨利贞" },
    4: { king_wen: 17, name: "泽雷随", judgment: "随，元亨利贞，无咎" },
    5: { king_wen: 28, name: "泽风大过", judgment: "栋桡，利有攸往" },
    6: { king_wen: 47, name: "泽水困", judgment: "困亨，贞大人吉" },
    7: { king_wen: 31, name: "泽山咸", judgment: "亨，利贞，取女吉" },
    8: { king_wen: 45, name: "泽地萃", judgment: "亨，王假有庙" },
  },
  3: {
    1: { king_wen: 14, name: "火天大有", judgment: "元亨，顺天休命" },
    2: { king_wen: 38, name: "火泽睽", judgment: "小事吉，天地睽而其事同" },
    3: { king_wen: 30, name: "离为火", judgment: "利贞亨，畜牝牛吉" },
    4: { king_wen: 21, name: "火雷噬嗑", judgment: "亨，利用狱" },
    5: { king_wen: 50, name: "火风鼎", judgment: "元吉亨，圣人亨以享上帝" },
    6: { king_wen: 64, name: "火水未济", judgment: "亨，小狐汔济，濡其尾" },
    7: { king_wen: 56, name: "火山旅", judgment: "小亨，旅贞吉" },
    8: { king_wen: 35, name: "火地晋", judgment: "康侯用锡马蕃庶" },
  },
  4: {
    1: { king_wen: 34, name: "雷天大壮", judgment: "利贞，大壮者壮也" },
    2: { king_wen: 54, name: "雷泽归妹", judgment: "征凶，无攸利" },
    3: { king_wen: 55, name: "雷火丰", judgment: "亨，王假之勿忧" },
    4: { king_wen: 51, name: "震为雷", judgment: "亨，震来虩虩" },
    5: { king_wen: 32, name: "雷风恒", judgment: "亨，无咎利贞" },
    6: { king_wen: 40, name: "雷水解", judgment: "利西南，无所往其来复吉" },
    7: { king_wen: 62, name: "雷山小过", judgment: "亨，利贞，可小事" },
    8: { king_wen: 16, name: "雷地豫", judgment: "利建侯行师" },
  },
  5: {
    1: { king_wen: 9, name: "风天小畜", judgment: "亨，密云不雨" },
    2: { king_wen: 61, name: "风泽中孚", judgment: "豚鱼吉，利涉大川" },
    3: { king_wen: 37, name: "风火家人", judgment: "利女贞，家人有严君焉" },
    4: { king_wen: 42, name: "风雷益", judgment: "利有攸往，利涉大川" },
    5: { king_wen: 57, name: "巽为风", judgment: "小亨，利有攸往" },
    6: { king_wen: 59, name: "风水涣", judgment: "亨，王假有庙" },
    7: { king_wen: 53, name: "风山渐", judgment: "女归吉，利贞" },
    8: { king_wen: 20, name: "风地观", judgment: "盥而不荐，有孚颙若" },
  },
  6: {
    1: { king_wen: 5, name: "水天需", judgment: "有孚，光亨贞吉" },
    2: { king_wen: 60, name: "水泽节", judgment: "亨，苦节不可贞" },
    3: { king_wen: 63, name: "水火既济", judgment: "亨小，利贞，初吉终乱" },
    4: { king_wen: 3, name: "水雷屯", judgment: "元亨利贞，勿用有攸往" },
    5: { king_wen: 48, name: "水风井", judgment: "改邑不改井，无丧无得" },
    6: { king_wen: 29, name: "坎为水", judgment: "习坎，有孚，维心亨" },
    7: { king_wen: 39, name: "水山蹇", judgment: "利西南，不利东北" },
    8: { king_wen: 8, name: "水地比", judgment: "吉，原筮元永贞" },
  },
  7: {
    1: { king_wen: 26, name: "山天大畜", judgment: "利贞，不家食吉" },
    2: { king_wen: 41, name: "山泽损", judgment: "有孚，元吉，无咎" },
    3: { king_wen: 22, name: "山火贲", judgment: "亨，小利有攸往" },
    4: { king_wen: 27, name: "山雷颐", judgment: "贞吉，观颐自求口实" },
    5: { king_wen: 18, name: "山风蛊", judgment: "元亨，利涉大川" },
    6: { king_wen: 4, name: "山水蒙", judgment: "亨，匪我求童蒙" },
    7: { king_wen: 52, name: "艮为山", judgment: "艮其背，不获其身" },
    8: { king_wen: 23, name: "山地剥", judgment: "不利有攸往" },
  },
  8: {
    1: { king_wen: 11, name: "地天泰", judgment: "小往大来，吉亨" },
    2: { king_wen: 19, name: "地泽临", judgment: "元亨利贞，至于八月有凶" },
    3: { king_wen: 36, name: "地火明夷", judgment: "利艰贞，晦其明也" },
    4: { king_wen: 24, name: "地雷复", judgment: "亨，出入无疾" },
    5: { king_wen: 46, name: "地风升", judgment: "元亨，用见大人" },
    6: { king_wen: 7, name: "地水师", judgment: "贞，丈人吉，无咎" },
    7: { king_wen: 15, name: "地山谦", judgment: "亨，君子有终" },
    8: { king_wen: 2, name: "坤为地", judgment: "元亨，利牝马之贞" },
  },
};

// 卦序 → { upper, lower }（自报卦象反查用）
export const ORDER_TO_TRIGRAMS = (() => {
  const map = new Map();
  for (const u of Object.keys(HEX_TABLE)) {
    for (const l of Object.keys(HEX_TABLE[u])) {
      const hex = HEX_TABLE[u][l];
      map.set(hex.king_wen, { upper: Number(u), lower: Number(l), ...hex });
    }
  }
  return map;
})();

// 二进制串（下→上）→ 先天数；非法返回 0
export function bitsToTrigramNum(bits) {
  return BITS_TO_NUM[bits] || 0;
}

// 爻数组 → 上/下卦对象
export function trigramOfLines(lines, top) {
  const seg = top ? lines.slice(3, 6) : lines.slice(0, 3);
  const bits = seg.map((v) => (v === 1 ? 1 : 0)).join("");
  const num = BITS_TO_NUM[bits];
  return num ? TRIGRAMS[num] : null;
}

export function hexagramOfLines(lines) {
  const upper = trigramOfLines(lines, true);
  const lower = trigramOfLines(lines, false);
  if (!upper || !lower) return null;
  const hex = HEX_TABLE[upper.num][lower.num];
  return {
    king_wen: hex.king_wen,
    name: hex.name,
    judgment: hex.judgment,
    lines: lines.slice(),
    upper,
    lower,
  };
}
