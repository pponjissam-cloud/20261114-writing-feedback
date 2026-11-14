import { GoogleGenAI } from "@google/genai";
import { DEFAULT_MODEL_ID, MAX_OUTPUT_TOKENS, REQUEST_TIMEOUT_MS, type ModelId } from "@/config/models";
import { RUBRIC } from "@/config/rubric";
import { hashKey, redactSecrets } from "@/lib/apiKey";
import { quota as defaultQuota, QuotaError, type QuotaGuard } from "@/lib/quota";
import { buildResponseSchema, parseFeedback, type Feedback } from "@/lib/schema";
import { buildSystemInstruction, buildUserPrompt, type PreviousAttempt } from "@/lib/llm/prompts";
import { SAMPLE_FEEDBACK } from "@/lib/llm/sampleFeedback";

/** SDK 중 이 앱이 쓰는 부분만 (테스트에서 mock 하기 쉽도록) */
export interface GenAIClientLike {
  models: {
    get(params: { model: string; config?: { abortSignal?: AbortSignal } }): Promise<{ name?: string; displayName?: string }>;
    generateContent(params: {
      model: string;
      contents: string;
      config: Record<string, unknown>;
    }): Promise<{ text?: string; candidates?: { finishReason?: string }[] }>;
  };
}

export type GeminiErrorKind = "quota" | "auth" | "model" | "timeout" | "network" | "invalid_response" | "blocked" | "unknown";

export class GeminiError extends Error {
  readonly kind: GeminiErrorKind;
  readonly quota?: QuotaError;
  constructor(kind: GeminiErrorKind, message: string, quota?: QuotaError) {
    super(message);
    this.name = "GeminiError";
    this.kind = kind;
    this.quota = quota;
  }
}

export interface GeminiDeps {
  guard: QuotaGuard;
  createClient: (apiKey: string) => GenAIClientLike;
  mock: boolean;
  sleep: (ms: number) => Promise<void>;
  timeoutMs: number;
}

export type Stage = "reading" | "scoring" | "redpen" | "retrying" | "done";

export interface FeedbackRequest {
  apiKey: string;
  modelId: ModelId;
  topic: string;
  essay: string;
  previous?: PreviousAttempt;
  onStage?: (stage: Stage) => void;
}

export interface FeedbackResult {
  feedback: Feedback;
  attempts: number;
  mock: boolean;
}

// 허용하는 생성 설정 키 — 샘플링 파라미터(Gemini 3.x 지원 중단), tools(그라운딩), 컨텍스트 캐시는 의도적으로 제외
const ALLOWED_CONFIG_KEYS = ["systemInstruction", "responseMimeType", "responseSchema", "maxOutputTokens", "abortSignal"] as const;

export function buildGenerateConfig(abortSignal?: AbortSignal) {
  const config = {
    systemInstruction: buildSystemInstruction(RUBRIC),
    responseMimeType: "application/json",
    responseSchema: buildResponseSchema(),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    abortSignal,
  } satisfies Partial<Record<(typeof ALLOWED_CONFIG_KEYS)[number], unknown>>;
  return config;
}

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new GeminiError("timeout", `응답이 ${Math.round(ms / 1000)}초 안에 오지 않았어요. 잠시 후 "다시 시도"를 눌러 주세요.`));
    }, ms);
  });
  try {
    return await Promise.race([run(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** SDK 오류를 학생용 안내로 변환. 원문 메시지는 키가 섞였을 수 있어 그대로 노출하지 않는다 */
export function toGeminiError(err: unknown, apiKey?: string): GeminiError {
  if (err instanceof GeminiError) return err;
  if (err instanceof QuotaError) return new GeminiError("quota", err.message, err);
  const e = (err ?? {}) as { status?: number; message?: string; name?: string };
  const msg = redactSecrets(String(e.message ?? ""), apiKey);
  if (e.name === "AbortError") return new GeminiError("timeout", "요청이 중단되었어요. 다시 시도해 주세요.");
  if (e.status === 400 && /api key|API_KEY_INVALID/i.test(msg)) {
    return new GeminiError("auth", "API 키가 올바르지 않아요. 설정 화면에서 키를 다시 확인해 주세요.");
  }
  if (e.status === 401 || e.status === 403) {
    return new GeminiError("auth", "이 API 키로는 Gemini를 쓸 수 없어요. AI Studio에서 키 권한을 확인해 주세요.");
  }
  if (e.status === 404) {
    return new GeminiError("model", "모델을 찾을 수 없어요. src/config/models.ts 의 모델 ID를 AI Studio에서 확인해 주세요.");
  }
  if (e.status !== undefined && e.status >= 500) {
    return new GeminiError("network", "Gemini 서버가 잠시 불안정해요. 조금 뒤 \"다시 시도\"를 눌러 주세요.");
  }
  if (/fetch|network|Failed to fetch|NetworkError/i.test(msg)) {
    return new GeminiError("network", "인터넷 연결을 확인한 뒤 다시 시도해 주세요.");
  }
  return new GeminiError("unknown", "알 수 없는 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
}

/** 개발용 로그 — 키는 마스킹하고, 응답/에세이 본문은 남기지 않는다 */
function devWarn(message: string, apiKey?: string) {
  if (import.meta.env.DEV) console.warn(redactSecrets(message, apiKey));
}

export function createGeminiService(deps: GeminiDeps) {
  /**
   * 클라이언트는 guardedCall 콜백 안에서만 만들어진다.
   * 따라서 한도 검사 없이 SDK 를 호출할 수 있는 경로가 존재하지 않는다.
   */
  async function guarded<T>(apiKey: string, modelId: string, fn: (client: GenAIClientLike, signal: AbortSignal) => Promise<T>) {
    const keyHash = await hashKey(apiKey);
    return deps.guard.guardedCall(keyHash, modelId, () => withTimeout(deps.timeoutMs, (signal) => fn(deps.createClient(apiKey), signal)));
  }

  async function testConnection(apiKey: string, modelId: ModelId = DEFAULT_MODEL_ID): Promise<{ modelName: string }> {
    if (deps.mock) {
      await deps.sleep(300);
      return { modelName: `${modelId} (mock)` };
    }
    try {
      // models.get 은 토큰을 쓰지 않지만 요청 수 보수 집계를 위해 사용량에 포함한다
      const model = await guarded(apiKey, modelId, (client, signal) => client.models.get({ model: modelId, config: { abortSignal: signal } }));
      return { modelName: model.displayName ?? model.name ?? modelId };
    } catch (err) {
      throw toGeminiError(err, apiKey);
    }
  }

  async function attempt(req: FeedbackRequest): Promise<{ ok: true; feedback: Feedback } | { ok: false; reason: string }> {
    const contents = buildUserPrompt({ topic: req.topic, essay: req.essay, previous: req.previous });
    const response = await guarded(req.apiKey, req.modelId, (client, signal) =>
      client.models.generateContent({ model: req.modelId, contents, config: buildGenerateConfig(signal) }),
    );
    const finish = response.candidates?.[0]?.finishReason;
    if (finish === "SAFETY" || finish === "PROHIBITED_CONTENT" || finish === "BLOCKED") {
      throw new GeminiError("blocked", "글 내용 때문에 AI가 답변을 만들지 못했어요. 표현을 바꿔서 다시 제출해 보세요.");
    }
    if (finish === "MAX_TOKENS") return { ok: false, reason: "응답이 너무 길어 중간에 잘렸어요." };
    const parsed = parseFeedback(response.text ?? "");
    return parsed.ok ? { ok: true, feedback: parsed.data } : { ok: false, reason: parsed.error };
  }

  async function generateFeedback(req: FeedbackRequest): Promise<FeedbackResult> {
    req.onStage?.("reading");
    if (deps.mock) {
      await deps.sleep(900);
      req.onStage?.("redpen");
      await deps.sleep(600);
      req.onStage?.("done");
      return { feedback: mockFeedbackFor(req.essay), attempts: 0, mock: true };
    }

    try {
      req.onStage?.("scoring");
      const first = await attempt(req);
      if (first.ok) {
        req.onStage?.("done");
        return { feedback: first.feedback, attempts: 1, mock: false };
      }
      devWarn(`[gemini] 응답 검증 실패, 1회 재시도: ${first.reason}`, req.apiKey);

      // 재시도도 한 번의 요청이므로 반드시 가드를 거친다. 최소 간격만큼은 기다린 뒤 다시 검사.
      req.onStage?.("retrying");
      const keyHash = await hashKey(req.apiKey);
      const status = deps.guard.status(keyHash, req.modelId);
      if (status.blocked === "interval") await deps.sleep(status.waitMs + 50);
      const second = await attempt(req);
      if (second.ok) {
        req.onStage?.("done");
        return { feedback: second.feedback, attempts: 2, mock: false };
      }
      throw new GeminiError("invalid_response", `AI 응답을 읽지 못했어요 (${second.reason}). "다시 시도"를 눌러 주세요.`);
    } catch (err) {
      throw toGeminiError(err, req.apiKey);
    }
  }

  return { testConnection, generateFeedback };
}

/** VITE_MOCK 모드: 고정 샘플 + 학생 글 첫 문장을 첨삭 예시로 넣어 하이라이트를 확인할 수 있게 한다 */
export function mockFeedbackFor(essay: string): Feedback {
  const fb = structuredClone(SAMPLE_FEEDBACK);
  const firstSentence = essay.match(/[^.!?\n]+[.!?]/)?.[0]?.trim();
  if (firstSentence && firstSentence !== fb.redPen[0]?.original) {
    fb.redPen.unshift({
      id: "m1",
      original: firstSentence,
      revised: `In my opinion, ${firstSentence.charAt(0).toLowerCase()}${firstSentence.slice(1)}`,
      reason: "(모의 응답) 첫 문장에 In my opinion을 붙이면 내 주장이라는 것이 더 분명해져요.",
    });
  }
  return fb;
}

const isMock = import.meta.env.VITE_MOCK === "true";

export const gemini = createGeminiService({
  guard: defaultQuota,
  createClient: (apiKey) => new GoogleGenAI({ apiKey }) as unknown as GenAIClientLike,
  mock: isMock,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  timeoutMs: REQUEST_TIMEOUT_MS,
});

export const MOCK_MODE = isMock;
