/**
 * Gemini 모델 및 무료 등급 한도 설정 — 한도 수치는 이 파일에서만 관리합니다.
 * 무료 등급 한도는 Google이 수시로 바꿉니다. AI Studio의 "Rate limits" 페이지에서
 * 확인한 뒤 freeRpd / safeRpd / minIntervalMs 를 수정하세요.
 */
export const MODELS = [
  {
    id: "gemini-3.5-flash-lite", // 기본값
    label: "Gemini 3.5 Flash-Lite (빠름 · 하루 여유 많음)",
    shortLabel: "3.5 Flash-Lite",
    freeRpd: 500, // 무료 등급 일일 요청 수
    safeRpd: 450, // 앱 내부 하드캡 (여유분 10%)
    minIntervalMs: 5000, // 연속 호출 최소 간격
  },
  {
    id: "gemini-3.8-flash", // ※ 실제 모델 ID는 AI Studio에서 확인 후 수정
    label: "Gemini 3.8 Flash (고품질 · 하루 20회)",
    shortLabel: "3.8 Flash",
    freeRpd: 20,
    safeRpd: 18,
    minIntervalMs: 10000,
  },
] as const;

export type ModelConfig = (typeof MODELS)[number];
export type ModelId = ModelConfig["id"];

export const DEFAULT_MODEL_ID: ModelId = MODELS[0].id;

/** 한 번의 응답에서 허용할 최대 출력 토큰 (과도한 출력 방지) */
export const MAX_OUTPUT_TOKENS = 8192;

/** 응답 대기 최대 시간 */
export const REQUEST_TIMEOUT_MS = 60_000;

export function getModel(id: string): ModelConfig | undefined {
  return MODELS.find((m) => m.id === id);
}

export function isModelId(id: string): id is ModelId {
  return MODELS.some((m) => m.id === id);
}
