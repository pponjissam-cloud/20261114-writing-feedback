export type DiffPart = { type: "same" | "add" | "del"; text: string };

/** 단어·구두점·공백 단위 토큰 (공백도 보존해 그대로 이어 붙이면 원문이 된다) */
export function tokenize(s: string): string[] {
  return s.match(/\s+|[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu) ?? [];
}

/**
 * 학생 문장(a) → 최소 첨삭 문장(b)의 단어 단위 차이 (LCS).
 * 문장 하나 단위라 O(n·m)로 충분하다.
 */
export function diffWords(a: string, b: string): DiffPart[] {
  const x = tokenize(a);
  const y = tokenize(b);
  const n = x.length;
  const m = y.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = x[i] === y[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const parts: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.text += text;
    else parts.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      push("same", x[i]!);
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      push("del", x[i++]!);
    } else {
      push("add", y[j++]!);
    }
  }
  while (i < n) push("del", x[i++]!);
  while (j < m) push("add", y[j++]!);
  return absorbWhitespace(parts);
}

// 바뀐 단어 사이의 공백 하나 때문에 "same"이 끼어 조각나 보이지 않게, 변경 사이의 공백은 변경에 붙인다
function absorbWhitespace(parts: DiffPart[]): DiffPart[] {
  const out: DiffPart[] = [];
  for (let k = 0; k < parts.length; k++) {
    const p = parts[k]!;
    const prev = out[out.length - 1];
    const next = parts[k + 1];
    if (p.type === "same" && /^\s+$/.test(p.text) && prev && prev.type !== "same" && next && next.type !== "same") {
      prev.text += p.text;
      continue;
    }
    out.push({ ...p });
  }
  return out;
}

export function hasChanges(parts: DiffPart[]): boolean {
  return parts.some((p) => p.type !== "same" && p.text.trim() !== "");
}
