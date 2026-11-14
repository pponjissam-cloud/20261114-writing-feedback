export const MIN_WORDS = 50;
export const MAX_WORDS = 1200;
export const MIN_ENGLISH_RATIO = 0.8;

export function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter((tok) => /[\p{L}\p{N}]/u.test(tok)).length;
}

/** 전체 문자(letter) 중 라틴 알파벳 비율 — 한국어로 쓴 글을 API 호출 전에 걸러내기 위함 */
export function englishRatio(text: string): number {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return 0;
  const latin = letters.filter((c) => /[A-Za-z]/.test(c)).length;
  return latin / letters.length;
}

export type EssayCheck = { ok: true; words: number } | { ok: false; words: number; message: string };

/** 제출 전 검사 — 통과하지 못하면 API 를 호출하지 않으므로 한도를 아낄 수 있다 */
export function checkEssay(text: string): EssayCheck {
  const words = countWords(text);
  if (words < MIN_WORDS) {
    return { ok: false, words, message: `최소 ${MIN_WORDS}단어 이상 써야 피드백을 받을 수 있어요. (지금 ${words}단어, ${MIN_WORDS - words}단어 더!)` };
  }
  if (words > MAX_WORDS) {
    return { ok: false, words, message: `글이 너무 길어요. ${MAX_WORDS}단어 이하로 줄여 주세요. (지금 ${words}단어)` };
  }
  const ratio = englishRatio(text);
  if (ratio < MIN_ENGLISH_RATIO) {
    return { ok: false, words, message: `영어로 쓴 부분이 적어요 (영어 비율 ${Math.round(ratio * 100)}%). 논설문은 영어로 써 주세요.` };
  }
  return { ok: true, words };
}
