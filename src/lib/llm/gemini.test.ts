import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashKey } from "@/lib/apiKey";
import { QuotaGuard } from "@/lib/quota";
import { memoryRepo } from "@/lib/storage";
import { SAMPLE_FEEDBACK } from "./sampleFeedback";
import type { ModelConfig } from "@/config/models";

/* SDK 전체를 mock: 모든 SDK 메서드 호출 시점에 가드 안인지 기록한다 */
const sdk = vi.hoisted(() => ({
  constructed: [] as unknown[],
  calls: [] as { method: string; insideGuard: boolean; params: any }[],
  generateImpl: (async () => ({ text: "" })) as (p: any) => Promise<any>,
  getImpl: (async () => ({ name: "models/x", displayName: "X" })) as (p: any) => Promise<any>,
  isInside: (() => false) as () => boolean,
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      generateContent: (p: any) => {
        sdk.calls.push({ method: "generateContent", insideGuard: sdk.isInside(), params: p });
        return sdk.generateImpl(p);
      },
      get: (p: any) => {
        sdk.calls.push({ method: "get", insideGuard: sdk.isInside(), params: p });
        return sdk.getImpl(p);
      },
    };
    constructor(opts: unknown) {
      sdk.constructed.push({ insideGuard: sdk.isInside(), hasKey: !!(opts as any)?.apiKey });
    }
  },
}));

const { GoogleGenAI } = await import("@google/genai");
const { createGeminiService, mockFeedbackFor, GeminiError } = await import("./gemini");

const KEY = "AIzaSyTEST_KEY_1234567890abcdefghij";
const LITE = "gemini-3.5-flash-lite" as const;
const MODELS = [
  { id: LITE, label: "lite", shortLabel: "Lite", freeRpd: 10, safeRpd: 3, minIntervalMs: 5000 },
  { id: "gemini-3.8-flash", label: "flash", shortLabel: "Flash", freeRpd: 3, safeRpd: 2, minIntervalMs: 10000 },
] as unknown as ModelConfig[];

let now = Date.parse("2026-01-15T01:00:00Z");
let guard: QuotaGuard;
let keyHash: string;
const sleep = vi.fn(async (ms: number) => void (now += ms));

function service(mock = false) {
  return createGeminiService({ guard, createClient: (apiKey) => new GoogleGenAI({ apiKey }) as any, mock, sleep, timeoutMs: 60_000 });
}

const valid = () => Promise.resolve({ text: JSON.stringify(SAMPLE_FEEDBACK), candidates: [{ finishReason: "STOP" }] });
const invalid = () => Promise.resolve({ text: '{"scores": []}', candidates: [{ finishReason: "STOP" }] });
const req = { apiKey: KEY, modelId: LITE, topic: "Homework", essay: "Many people thinks homework is bad. ".repeat(20) };

beforeEach(async () => {
  now = Date.parse("2026-01-15T01:00:00Z");
  guard = new QuotaGuard({ repo: memoryRepo(), models: MODELS, now: () => now });
  keyHash = await hashKey(KEY);
  sdk.isInside = () => guard.isInsideCall(keyHash);
  sdk.calls = [];
  sdk.constructed = [];
  sleep.mockClear();
});

function expectAllCallsGuarded(expectedCalls: number) {
  expect(sdk.calls).toHaveLength(expectedCalls);
  expect(sdk.calls.every((c) => c.insideGuard)).toBe(true);
  expect(sdk.constructed.every((c: any) => c.insideGuard)).toBe(true);
}

describe("generateFeedback", () => {
  it("1회 호출로 5개 섹션 전체를 받고, 호출은 가드 안에서만 일어난다", async () => {
    sdk.generateImpl = valid;
    const r = await service().generateFeedback(req);
    expect(r.attempts).toBe(1);
    expect(r.feedback.scores).toHaveLength(6);
    expectAllCallsGuarded(1);
    expect(guard.status(keyHash, LITE).used).toBe(1);
  });

  it("금지된 생성 파라미터·도구를 보내지 않는다", async () => {
    sdk.generateImpl = valid;
    await service().generateFeedback(req);
    const { config, model } = sdk.calls[0]!.params;
    expect(model).toBe(LITE);
    expect(config.responseMimeType).toBe("application/json");
    expect(config.responseSchema.type).toBe("OBJECT");
    expect(config.maxOutputTokens).toBe(12288);
    for (const k of ["temperature", "topP", "topK", "tools", "toolConfig", "cachedContent"]) expect(config).not.toHaveProperty(k);
  });

  it("검증 실패 시 최소 간격을 기다린 뒤 가드를 거쳐 딱 1회만 재시도한다", async () => {
    let n = 0;
    sdk.generateImpl = () => (n++ === 0 ? invalid() : valid());
    const r = await service().generateFeedback(req);
    expect(r.attempts).toBe(2);
    expectAllCallsGuarded(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep.mock.calls[0]![0]).toBeGreaterThanOrEqual(5000);
    expect(guard.status(keyHash, LITE).used).toBe(2);
  });

  it("두 번 모두 실패하면 더 재시도하지 않고 오류를 낸다", async () => {
    sdk.generateImpl = invalid;
    const err = await service().generateFeedback(req).catch((e) => e);
    expect(err).toBeInstanceOf(GeminiError);
    expect(err.kind).toBe("invalid_response");
    expectAllCallsGuarded(2);
  });

  it("재시도 시점에 한도가 없으면 재시도하지 않는다", async () => {
    guard.markExhausted(keyHash, "gemini-3.8-flash");
    // Lite 를 2회 써서 남은 1회만 남긴다
    sdk.generateImpl = valid;
    await service().generateFeedback(req);
    now += 5000;
    await service().generateFeedback(req);
    now += 5000;
    sdk.calls = [];
    sdk.generateImpl = invalid;
    const err = await service().generateFeedback(req).catch((e) => e);
    expect(err.kind).toBe("quota");
    expect(sdk.calls).toHaveLength(1);
    expect(guard.status(keyHash, LITE).used).toBe(3);
  });

  it("한도 초과 상태에서는 SDK 클라이언트조차 만들지 않는다", async () => {
    guard.markExhausted(keyHash, LITE);
    sdk.generateImpl = valid;
    const err = await service().generateFeedback(req).catch((e) => e);
    expect(err.kind).toBe("quota");
    expect(err.quota.alternative).toBe("gemini-3.8-flash");
    expect(sdk.constructed).toHaveLength(0);
    expect(sdk.calls).toHaveLength(0);
  });

  it("429 는 재시도 없이 당일 잠금 처리한다", async () => {
    sdk.generateImpl = () => Promise.reject(Object.assign(new Error("429 RESOURCE_EXHAUSTED"), { status: 429 }));
    const err = await service().generateFeedback(req).catch((e) => e);
    expect(err.kind).toBe("quota");
    expect(err.message).toContain("오늘 무료 사용량을 모두 썼어요");
    expect(sdk.calls).toHaveLength(1);
    expect(guard.status(keyHash, LITE).lockedBy429).toBe(true);
  });

  it("오류 메시지에 API 키가 절대 포함되지 않는다", async () => {
    sdk.generateImpl = () => Promise.reject(Object.assign(new Error(`API key not valid: ${KEY} ?key=${KEY}`), { status: 400 }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const err = await service().generateFeedback(req).catch((e) => e);
    expect(err.kind).toBe("auth");
    expect(err.message).not.toContain(KEY);
    for (const call of warn.mock.calls) expect(String(call)).not.toContain(KEY);
    warn.mockRestore();
  });

  it("VITE_MOCK 모드에서는 SDK 를 호출하지 않고 사용량도 차감하지 않는다", async () => {
    const r = await service(true).generateFeedback(req);
    expect(r.mock).toBe(true);
    expect(r.feedback.structure.parts[0]!.fromNo).toBe(1);
    expect(r.feedback.sentenceReview.items).toHaveLength(20);
    expect(sdk.calls).toHaveLength(0);
    expect(sdk.constructed).toHaveLength(0);
    expect(guard.status(keyHash, LITE).used).toBe(0);
  });
});

describe("testConnection", () => {
  it("models.get 을 가드 안에서 호출하고 사용량에 포함한다", async () => {
    const r = await service().testConnection(KEY, LITE);
    expect(r.modelName).toBe("X");
    expectAllCallsGuarded(1);
    expect(sdk.calls[0]!.method).toBe("get");
    expect(guard.status(keyHash, LITE).used).toBe(1);
  });

  it("404 는 모델 ID 확인 안내로 바뀐다", async () => {
    sdk.getImpl = () => Promise.reject({ status: 404, message: "not found" });
    const err = await service().testConnection(KEY, LITE).catch((e) => e);
    expect(err.kind).toBe("model");
  });
});

describe("기본 인스턴스 연결", () => {
  it("앱 기본 gemini 서비스도 전역 quota.guardedCall 을 통해서만 호출한다", async () => {
    const { gemini } = await import("./gemini");
    const { quota } = await import("@/lib/quota");
    const spy = vi.spyOn(quota, "guardedCall");
    sdk.isInside = () => quota.isInsideCall(keyHash);
    sdk.getImpl = async () => ({ displayName: "X" });
    await gemini.testConnection(KEY, LITE);
    expect(spy).toHaveBeenCalledTimes(1);
    expectAllCallsGuarded(1);
  });
});

describe("소스 정적 검사", () => {
  const sources = import.meta.glob(["/src/**/*.{ts,tsx}", "!/src/**/*.test.{ts,tsx}"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;

  it("@google/genai 는 gemini.ts 에서만 import 한다", () => {
    const importers = Object.entries(sources).filter(([, src]) => /from\s+["']@google\/genai["']/.test(src)).map(([p]) => p);
    expect(importers).toEqual(["/src/lib/llm/gemini.ts"]);
  });

  it("gemini.ts 에서 SDK 클라이언트는 guardedCall 콜백 안에서만 생성된다", () => {
    const src = sources["/src/lib/llm/gemini.ts"]!;
    const createCalls = src.match(/deps\.createClient\(/g) ?? [];
    expect(createCalls).toHaveLength(1);
    expect(src).toMatch(/deps\.guard\.guardedCall\([^)]*\(\)\s*=>\s*withTimeout\([^]*?deps\.createClient\(apiKey\)/);
  });

  it("dangerouslySetInnerHTML, 그라운딩·캐시·배치 API, 키 로그를 쓰지 않는다", () => {
    for (const [path, src] of Object.entries(sources)) {
      expect(src, path).not.toMatch(/dangerouslySetInnerHTML/);
      expect(src, path).not.toMatch(/googleSearch|googleMaps|caches\.create|batches\.create|cachedContent/);
      expect(src, path).not.toMatch(/console\.\w+\((?!redactSecrets\()[^)]*apiKey/);
    }
  });
});

describe("mockFeedbackFor", () => {
  it("학생 글 문장 수에 맞춰 구조·문장별 첨삭을 만든다", () => {
    const fb = mockFeedbackFor("Schools should start later. Students need sleep. Sleep helps memory. So start later.");
    expect(fb.structure.parts.map((p) => p.role)).toEqual(["claim", "reason", "reason", "conclusion"]);
    expect(fb.sentenceReview.items).toHaveLength(4);
  });
});

describe("transcribe (손글씨 사진)", () => {
  const images = [
    { mimeType: "image/jpeg", data: "AAAA" },
    { mimeType: "image/jpeg", data: "BBBB" },
  ];
  const transcriptJson = (over: Record<string, unknown> = {}) =>
    Promise.resolve({ text: JSON.stringify({ isEssay: true, topic: "Homework", text: "Many people thinks homework is bad.", unreadableCount: 0, ...over }) });

  it("여러 장을 한 번의 호출로 순서대로 보내고, 가드를 거쳐 1회 차감한다", async () => {
    sdk.generateImpl = () => transcriptJson();
    const t = await service().transcribe({ apiKey: KEY, modelId: LITE, images });
    expect(t.text).toBe("Many people thinks homework is bad.");
    expectAllCallsGuarded(1);
    const { contents, config } = sdk.calls[0]!.params;
    expect(contents[0].inlineData.data).toBe("AAAA");
    expect(contents[1].inlineData.data).toBe("BBBB");
    expect(config.systemInstruction).toMatch(/NEVER correct/);
    expect(config.responseMimeType).toBe("application/json");
    for (const k of ["temperature", "topP", "topK", "tools"]) expect(config).not.toHaveProperty(k);
    expect(guard.status(keyHash, LITE).used).toBe(1);
  });

  it("에세이가 없는 사진이면 안내 오류를 낸다 (자동 재시도 없음)", async () => {
    sdk.generateImpl = () => transcriptJson({ isEssay: false, text: "" });
    const err = await service().transcribe({ apiKey: KEY, modelId: LITE, images }).catch((e) => e);
    expect(err.message).toMatch(/에세이를 찾지 못했어요/);
    expect(sdk.calls).toHaveLength(1);
  });

  it("사진 수 제한을 호출 전에 검사한다", async () => {
    const five = Array.from({ length: 5 }, () => images[0]!);
    await expect(service().transcribe({ apiKey: KEY, modelId: LITE, images: five })).rejects.toThrow(/최대 4장/);
    await expect(service().transcribe({ apiKey: KEY, modelId: LITE, images: [] })).rejects.toThrow();
    expect(sdk.calls).toHaveLength(0);
    expect(guard.status(keyHash, LITE).used).toBe(0);
  });

  it("한도가 없으면 사진 읽기도 차단된다", async () => {
    guard.markExhausted(keyHash, LITE);
    const err = await service().transcribe({ apiKey: KEY, modelId: LITE, images }).catch((e) => e);
    expect(err.kind).toBe("quota");
    expect(sdk.calls).toHaveLength(0);
  });

  it("mock 모드는 사용량을 차감하지 않는다", async () => {
    const t = await service(true).transcribe({ apiKey: KEY, modelId: LITE, images });
    expect(t.isEssay).toBe(true);
    expect(guard.status(keyHash, LITE).used).toBe(0);
  });

  it("손글씨 제출이면 채점 프롬프트에 [?] 처리 안내를 넣는다", async () => {
    sdk.generateImpl = valid;
    await service().generateFeedback({ ...req, handwritten: true });
    expect(sdk.calls[0]!.params.contents).toMatch(/transcribed from a photo/);
    now += 5000;
    await service().generateFeedback(req);
    expect(sdk.calls[1]!.params.contents).not.toMatch(/transcribed from a photo/);
  });
});
