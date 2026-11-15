export interface Sentence {
  /** 1부터 시작하는 번호 */
  no: number;
  text: string;
  /** 원문에서의 시작 위치 */
  start: number;
  /** 몇 번째 문단인지 (0부터) */
  paragraph: number;
}

// 마침표 뒤에서 문장을 끊으면 안 되는 흔한 약어
const TITLES = new Set(["mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st"]);
const ABBREVIATIONS = new Set(["vs", "etc", "e.g", "i.e", "a.m", "p.m", "no", "fig", "approx"]);

/** 이 문장 끝 후보 뒤에서 실제로 끊어도 되는지 */
function isBoundary(before: string, after: string): boolean {
  const next = after.trimStart()[0];
  if (next === undefined) return true;
  const word = before.match(/([A-Za-z][A-Za-z.]*)\.$/)?.[1]?.toLowerCase();
  if (word && TITLES.has(word)) return false; // Dr. Kim
  if (word && ABBREVIATIONS.has(word) && /[a-z0-9,]/.test(next)) return false; // e.g. after
  if (/(^|\s)[A-Z]\.$/.test(before) && /[A-Z]/.test(next)) return false; // J. K. Rowling
  return true;
}

/**
 * 학생 글을 문장 단위로 나눈다. AI가 아니라 코드가 나누므로
 * 번호가 항상 원문과 정확히 일치하고, 어떤 문장도 목록에서 빠지지 않는다.
 */
export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  const paraRe = /[^\n]*(?:\n(?!\s*\n)[^\n]*)*/g; // 빈 줄로 구분된 문단
  let paragraph = 0;
  let m: RegExpExecArray | null;
  while ((m = paraRe.exec(text)) !== null) {
    if (m[0] === "") {
      paraRe.lastIndex++;
      if (paraRe.lastIndex > text.length) break;
      continue;
    }
    const para = m[0];
    const base = m.index;
    if (!para.trim()) continue;
    const endRe = /[.!?]+["'”’)\]]*(?=\s|$)/g;
    let from = 0;
    let e: RegExpExecArray | null;
    const cuts: number[] = [];
    while ((e = endRe.exec(para)) !== null) {
      const end = e.index + e[0].length;
      if (isBoundary(para.slice(0, end), para.slice(end))) cuts.push(end);
    }
    if (cuts[cuts.length - 1] !== para.length) cuts.push(para.length);
    let added = false;
    for (const cut of cuts) {
      const raw = para.slice(from, cut);
      const trimmed = raw.trim();
      if (trimmed) {
        const lead = raw.length - raw.trimStart().length;
        out.push({ no: out.length + 1, text: trimmed.replace(/\s*\n\s*/g, " "), start: base + from + lead, paragraph });
        added = true;
      }
      from = cut;
    }
    if (added) paragraph++;
  }
  return out;
}
