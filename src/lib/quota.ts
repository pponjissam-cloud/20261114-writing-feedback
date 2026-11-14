import { z } from "zod";
import { MODELS, type ModelConfig, type ModelId } from "@/config/models";
import { localRepo, readJSON, STORAGE_PREFIX, writeJSON, type StorageRepository } from "@/lib/storage";

/**
 * 무료 한도 가드.
 * 모든 Gemini 네트워크 호출은 guardedCall() 안에서만 일어나야 한다 (gemini.ts 참고).
 * 사용량은 "호출을 시작한 시점"에 먼저 차감한다 — 실패한 요청도 Google 쪽에서는
 * 요청 수로 집계될 수 있으므로 보수적으로 센다.
 */

export const PACIFIC_TZ = "America/Los_Angeles";
export const DISPLAY_TZ = "Asia/Seoul";

/* ---------- 시간대 계산 (순수 함수) ---------- */

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
function zonedParts(ms: number, timeZone: string) {
  let f = partsFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(timeZone, f);
  }
  const get = (type: string) => Number(f!.formatToParts(ms).find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** 해당 시각의 (현지 시각 − UTC) 차이 (ms). LA 는 -7h(PDT) 또는 -8h(PST) */
export function timeZoneOffsetMs(ms: number, timeZone: string): number {
  const p = zonedParts(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - (ms - (((ms % 1000) + 1000) % 1000));
}

/** 태평양 시간 기준 날짜 키 (일일 사용량 리셋 단위) */
export function pacificDayKey(ms: number): string {
  const p = zonedParts(ms, PACIFIC_TZ);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** 다음 태평양 시간 자정의 UTC 타임스탬프 (서머타임 자동 반영) */
export function nextPacificMidnight(ms: number): number {
  const p = zonedParts(ms, PACIFIC_TZ);
  const targetLocal = Date.UTC(p.year, p.month - 1, p.day + 1, 0, 0, 0);
  // 자정과 현재의 오프셋이 다를 수 있어(서머타임 전환일) 자정 시점의 오프셋으로 한 번 더 보정
  let guess = targetLocal - timeZoneOffsetMs(ms, PACIFIC_TZ);
  guess = targetLocal - timeZoneOffsetMs(guess, PACIFIC_TZ);
  return guess;
}

/** "오후 5시" / "오후 4시" (한국 시간) */
export function formatKstTime(ms: number): string {
  const p = zonedParts(ms, DISPLAY_TZ);
  const ampm = p.hour < 12 ? "오전" : "오후";
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${ampm} ${h12}시${p.minute ? ` ${p.minute}분` : ""}`;
}

/** "오늘 오후 5시" / "내일 오후 5시" */
export function formatResetLabel(nowMs: number): string {
  const reset = nextPacificMidnight(nowMs);
  const a = zonedParts(nowMs, DISPLAY_TZ);
  const b = zonedParts(reset, DISPLAY_TZ);
  const sameDay = a.year === b.year && a.month === b.month && a.day === b.day;
  return `${sameDay ? "오늘" : "내일"} ${formatKstTime(reset)}`;
}

/* ---------- 사용량 기록 ---------- */

const UsageSchema = z.object({
  day: z.string(),
  counts: z.record(z.string(), z.number()),
  /** 429 를 받아 오늘 잠긴 모델 */
  locked: z.record(z.string(), z.boolean()),
  lastCallAt: z.record(z.string(), z.number()),
});
type Usage = z.infer<typeof UsageSchema>;

export const ANON_KEY_HASH = "nokey";
const usageKey = (keyHash: string) => `${STORAGE_PREFIX}quota:v1:${keyHash}`;

export type BlockReason = "daily_limit" | "rate_limited" | "interval" | "in_flight" | "unknown_model";

export interface ModelQuotaStatus {
  model: ModelConfig;
  used: number;
  limit: number;
  remaining: number;
  /** 429 수신으로 오늘 잠김 */
  lockedBy429: boolean;
  /** 최소 간격 때문에 남은 대기 시간 (ms) */
  waitMs: number;
  resetAt: number;
  blocked: BlockReason | null;
}

export class QuotaError extends Error {
  readonly reason: BlockReason;
  readonly modelId: string;
  readonly waitMs: number;
  readonly resetAt: number;
  /** 같은 키로 아직 쓸 수 있는 다른 모델 (자동 전환하지 않고 버튼으로만 제안) */
  readonly alternative: ModelId | null;

  constructor(init: { reason: BlockReason; modelId: string; message: string; waitMs?: number; resetAt: number; alternative?: ModelId | null }) {
    super(init.message);
    this.name = "QuotaError";
    this.reason = init.reason;
    this.modelId = init.modelId;
    this.waitMs = init.waitMs ?? 0;
    this.resetAt = init.resetAt;
    this.alternative = init.alternative ?? null;
  }
}

export function isRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: unknown; code?: unknown; message?: unknown };
  if (e.status === 429 || e.code === 429) return true;
  return typeof e.message === "string" && /\b429\b|RESOURCE_EXHAUSTED/i.test(e.message);
}

export interface QuotaGuardOptions {
  repo: StorageRepository;
  models?: readonly ModelConfig[];
  now?: () => number;
}

type Listener = () => void;

export class QuotaGuard {
  private readonly repo: StorageRepository;
  private readonly models: readonly ModelConfig[];
  private readonly now: () => number;
  private readonly inFlight = new Set<string>();
  private readonly listeners = new Set<Listener>();

  constructor(opts: QuotaGuardOptions) {
    this.repo = opts.repo;
    this.models = opts.models ?? MODELS;
    this.now = opts.now ?? Date.now;
  }

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private load(keyHash: string): Usage {
    const today = pacificDayKey(this.now());
    const stored = readJSON(this.repo, usageKey(keyHash), UsageSchema);
    if (!stored || stored.day !== today) {
      // 날짜가 바뀌면 횟수와 잠금은 초기화, 최소 간격 판단용 마지막 호출 시각은 유지
      return { day: today, counts: {}, locked: {}, lastCallAt: stored?.lastCallAt ?? {} };
    }
    return stored;
  }

  private save(keyHash: string, usage: Usage) {
    writeJSON(this.repo, usageKey(keyHash), usage);
    this.emit();
  }

  private findModel(modelId: string) {
    return this.models.find((m) => m.id === modelId);
  }

  status(keyHash: string, modelId: string): ModelQuotaStatus {
    const model = this.findModel(modelId);
    if (!model) throw new Error(`Unknown model: ${modelId}`);
    const now = this.now();
    const usage = this.load(keyHash);
    const used = Math.min(usage.counts[modelId] ?? 0, model.safeRpd);
    const lockedBy429 = usage.locked[modelId] === true;
    const last = usage.lastCallAt[modelId];
    const waitMs = last === undefined ? 0 : Math.max(0, last + model.minIntervalMs - now);
    const remaining = lockedBy429 ? 0 : Math.max(0, model.safeRpd - used);

    let blocked: BlockReason | null = null;
    if (lockedBy429) blocked = "rate_limited";
    else if (remaining <= 0) blocked = "daily_limit";
    else if (this.inFlight.has(keyHash)) blocked = "in_flight";
    else if (waitMs > 0) blocked = "interval";

    return { model, used, limit: model.safeRpd, remaining, lockedBy429, waitMs, resetAt: nextPacificMidnight(now), blocked };
  }

  allStatuses(keyHash: string): ModelQuotaStatus[] {
    return this.models.map((m) => this.status(keyHash, m.id));
  }

  /** 오늘 한도가 남아 있는 다른 모델 */
  alternativeFor(keyHash: string, modelId: string): ModelId | null {
    const alt = this.models.find((m) => m.id !== modelId && this.status(keyHash, m.id).remaining > 0);
    return (alt?.id as ModelId | undefined) ?? null;
  }

  /** 호출 전 검사. 막혀 있으면 QuotaError 를, 아니면 null 을 반환 */
  check(keyHash: string, modelId: string): QuotaError | null {
    const model = this.findModel(modelId);
    const resetAt = nextPacificMidnight(this.now());
    if (!model) {
      return new QuotaError({ reason: "unknown_model", modelId, resetAt, message: "알 수 없는 모델이에요. 설정을 확인해 주세요." });
    }
    const s = this.status(keyHash, modelId);
    if (!s.blocked) return null;
    const when = formatResetLabel(this.now());
    const messages: Record<BlockReason, string> = {
      rate_limited: `오늘 무료 사용량을 모두 썼어요. ${when}에 다시 쓸 수 있어요.`,
      daily_limit: `오늘 ${model.shortLabel} 사용 가능 횟수(${model.safeRpd}회)를 모두 썼어요. ${when}에 다시 쓸 수 있어요.`,
      interval: `조금만 기다려 주세요. ${Math.ceil(s.waitMs / 1000)}초 후에 다시 요청할 수 있어요.`,
      in_flight: "이미 요청을 처리하고 있어요. 끝날 때까지 기다려 주세요.",
      unknown_model: "알 수 없는 모델이에요.",
    };
    const dayBlocked = s.blocked === "rate_limited" || s.blocked === "daily_limit";
    return new QuotaError({
      reason: s.blocked,
      modelId,
      waitMs: s.waitMs,
      resetAt,
      message: messages[s.blocked],
      alternative: dayBlocked ? this.alternativeFor(keyHash, modelId) : null,
    });
  }

  /** 429 를 받으면 오늘은 해당 모델을 더 호출하지 않는다 (자동 재시도 없음) */
  markExhausted(keyHash: string, modelId: string) {
    const model = this.findModel(modelId);
    if (!model) return;
    const usage = this.load(keyHash);
    usage.counts[modelId] = Math.max(usage.counts[modelId] ?? 0, model.safeRpd);
    usage.locked[modelId] = true;
    this.save(keyHash, usage);
  }

  isInsideCall(keyHash: string) {
    return this.inFlight.has(keyHash);
  }

  /**
   * 유일한 Gemini 호출 경로. 검사 → 사용량 선차감 → 실행 → 429 처리.
   * fn 은 이 함수 안에서만 실행되므로 가드를 우회할 수 없다.
   */
  async guardedCall<T>(keyHash: string, modelId: string, fn: () => Promise<T>): Promise<T> {
    const blocked = this.check(keyHash, modelId);
    if (blocked) throw blocked;

    const usage = this.load(keyHash);
    usage.counts[modelId] = (usage.counts[modelId] ?? 0) + 1;
    usage.lastCallAt[modelId] = this.now();
    this.inFlight.add(keyHash);
    this.save(keyHash, usage);

    try {
      return await fn();
    } catch (err) {
      if (isRateLimitError(err)) {
        this.markExhausted(keyHash, modelId);
        throw new QuotaError({
          reason: "rate_limited",
          modelId,
          resetAt: nextPacificMidnight(this.now()),
          message: `오늘 무료 사용량을 모두 썼어요. ${formatResetLabel(this.now())}에 다시 쓸 수 있어요.`,
          alternative: this.alternativeFor(keyHash, modelId),
        });
      }
      throw err;
    } finally {
      this.inFlight.delete(keyHash);
      this.emit();
    }
  }
}

export const quota = new QuotaGuard({ repo: localRepo });
