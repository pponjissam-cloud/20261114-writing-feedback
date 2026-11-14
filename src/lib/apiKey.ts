import { localRepo, sessionRepo, STORAGE_PREFIX, type StorageRepository } from "@/lib/storage";

/**
 * API 키 저장 — 키 원문은 이 모듈과 Gemini 클라이언트 생성 지점 외에는 다루지 않는다.
 * 로그·에러 메시지·URL 에 절대 넣지 말 것.
 */
export type KeyStorageMode = "session" | "local";

const KEY = `${STORAGE_PREFIX}apiKey`;

type Listener = () => void;

export function createApiKeyStore(session: StorageRepository, local: StorageRepository) {
  const listeners = new Set<Listener>();
  const emit = () => listeners.forEach((l) => l());

  return {
    subscribe(l: Listener) {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    get(): string | null {
      return session.get(KEY) ?? local.get(KEY);
    },
    mode(): KeyStorageMode | null {
      if (session.get(KEY)) return "session";
      if (local.get(KEY)) return "local";
      return null;
    },
    save(rawKey: string, mode: KeyStorageMode) {
      const key = normalizeApiKey(rawKey);
      // 한쪽에만 남도록 반대편은 지운다 (모드 변경 시 이전 위치에 키가 남는 것 방지)
      (mode === "session" ? local : session).remove(KEY);
      (mode === "session" ? session : local).set(KEY, key);
      emit();
    },
    clear() {
      session.remove(KEY);
      local.remove(KEY);
      emit();
    },
  };
}

export function normalizeApiKey(raw: string): string {
  const key = raw.trim();
  if (!key) throw new Error("API 키를 입력해 주세요.");
  if (/\s/.test(key)) throw new Error("API 키에 공백이 들어 있어요. 복사할 때 다른 글자가 섞이지 않았는지 확인해 주세요.");
  if (key.length < 20) throw new Error("API 키가 너무 짧아요. AI Studio에서 키 전체를 복사해 주세요.");
  return key;
}

/** 사용량 기록 구분용: 키 원문 대신 SHA-256 해시 앞 8자리 */
export async function hashKey(key: string): Promise<string> {
  const bytes = new TextEncoder().encode(key);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 8);
}

/** 에러 메시지 등에 키가 섞여 들어갔을 경우를 대비한 마스킹 */
export function redactSecrets(text: string, key?: string | null): string {
  let out = text;
  if (key) out = out.split(key).join("[REDACTED]");
  // Google API 키 패턴(AIza...)과 URL 쿼리의 key= 도 가린다
  return out.replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED]").replace(/([?&]key=)[^&\s]+/gi, "$1[REDACTED]");
}

export const apiKeyStore = createApiKeyStore(sessionRepo, localRepo);
