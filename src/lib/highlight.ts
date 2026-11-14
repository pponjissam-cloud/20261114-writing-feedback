export interface HighlightMark {
  id: string;
  original: string;
}

export interface Segment {
  text: string;
  start: number;
  markId?: string;
}

export type UnmatchedReason = "not_found" | "overlap" | "empty";

export interface HighlightResult {
  segments: Segment[];
  matched: string[];
  unmatched: { id: string; reason: UnmatchedReason }[];
}

/**
 * 원문을 첨삭 구간과 일반 구간으로 나눈다 (HTML 문자열이 아닌 데이터로 → React 노드로 렌더).
 * - 원문에서 글자 그대로 찾을 수 있는 경우에만 하이라이트 (첫 번째 일치 위치)
 * - 이미 잡힌 구간과 겹치면 앞 항목을 우선하고 뒤 항목은 하이라이트하지 않음
 */
export function buildSegments(text: string, marks: readonly HighlightMark[]): HighlightResult {
  const accepted: { id: string; start: number; end: number }[] = [];
  const unmatched: HighlightResult["unmatched"] = [];

  for (const mark of marks) {
    if (!mark.original.trim()) {
      unmatched.push({ id: mark.id, reason: "empty" });
      continue;
    }
    const start = text.indexOf(mark.original);
    if (start === -1) {
      unmatched.push({ id: mark.id, reason: "not_found" });
      continue;
    }
    const end = start + mark.original.length;
    if (accepted.some((r) => start < r.end && r.start < end)) {
      unmatched.push({ id: mark.id, reason: "overlap" });
      continue;
    }
    accepted.push({ id: mark.id, start, end });
  }

  accepted.sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let cursor = 0;
  for (const r of accepted) {
    if (r.start > cursor) segments.push({ text: text.slice(cursor, r.start), start: cursor });
    segments.push({ text: text.slice(r.start, r.end), start: r.start, markId: r.id });
    cursor = r.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), start: cursor });

  return { segments, matched: accepted.map((r) => r.id), unmatched };
}
