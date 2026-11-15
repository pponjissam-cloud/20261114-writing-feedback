import type { SentenceReview } from "@/lib/schema";
import { splitSentences } from "@/lib/sentences";
import { diffWords, hasChanges, type DiffPart } from "@/lib/diff";

export type ReviewRow =
  | {
      kind: "sentence";
      no: number;
      paragraph: number;
      original: string;
      action: "keep" | "revise" | "delete";
      minimal: string;
      recommended: string;
      note: string;
      /** 학생 문장 → 최소 첨삭 문장 차이 */
      diff: DiffPart[];
    }
  | { kind: "insert"; afterNo: number; sentence: string; reason: string };

/**
 * AI의 문장별 첨삭을 코드가 나눈 문장 목록에 맞춰 붙인다.
 * AI가 빠뜨린 번호는 "그대로 두기"로, 범위를 벗어난 번호·중복은 버린다 —
 * 학생의 모든 문장이 반드시 한 줄씩 나오게 하기 위함.
 */
export function buildReviewRows(essay: string, review: SentenceReview | undefined): ReviewRow[] {
  const sentences = splitSentences(essay);
  const byNo = new Map<number, SentenceReview["items"][number]>();
  for (const item of review?.items ?? []) if (!byNo.has(item.no)) byNo.set(item.no, item);

  const inserts = new Map<number, SentenceReview["insertions"]>();
  for (const ins of review?.insertions ?? []) {
    if (!ins.sentence.trim()) continue;
    const at = Math.min(Math.max(0, ins.afterNo), sentences.length);
    inserts.set(at, [...(inserts.get(at) ?? []), ins]);
  }

  const rows: ReviewRow[] = [];
  const pushInserts = (at: number) => {
    for (const ins of inserts.get(at) ?? []) rows.push({ kind: "insert", afterNo: at, sentence: ins.sentence.trim(), reason: ins.reason });
  };

  pushInserts(0);
  for (const s of sentences) {
    const item = byNo.get(s.no);
    let action = item?.action ?? "keep";
    const minimal = action === "delete" ? "" : item?.minimal.trim() || s.text;
    const recommended = action === "delete" ? "" : item?.recommended.trim() || minimal;
    const diff = action === "delete" ? [] : diffWords(s.text, minimal);
    // AI가 revise 라고 했지만 실제로 바뀐 게 없으면 keep 으로 본다 (그 반대도)
    if (action !== "delete") action = hasChanges(diff) ? "revise" : "keep";
    rows.push({ kind: "sentence", no: s.no, paragraph: s.paragraph, original: s.text, action, minimal, recommended, note: item?.note ?? "", diff });
    pushInserts(s.no);
  }
  return rows;
}

/** 프롬프트에 넣을 번호 붙은 문장 목록 */
export function numberedSentences(essay: string): string {
  return splitSentences(essay)
    .map((s) => `[${s.no}] ${s.text}`)
    .join("\n");
}
