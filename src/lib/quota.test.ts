import { describe, expect, it, vi } from "vitest";
import {
  QuotaError,
  QuotaGuard,
  formatKstTime,
  formatResetLabel,
  isRateLimitError,
  nextPacificMidnight,
  pacificDayKey,
} from "./quota";
import { memoryRepo } from "./storage";
import type { ModelConfig } from "@/config/models";

const LITE = "gemini-3.5-flash-lite";
const FLASH = "gemini-3.8-flash";
const utc = (iso: string) => Date.parse(iso);

const TEST_MODELS: ModelConfig[] = [
  { id: LITE, label: "lite", shortLabel: "3.5 Flash-Lite", freeRpd: 5, safeRpd: 3, minIntervalMs: 5000 } as unknown as ModelConfig,
  { id: FLASH, label: "flash", shortLabel: "3.8 Flash", freeRpd: 3, safeRpd: 2, minIntervalMs: 10000 } as unknown as ModelConfig,
];

function setup(startIso = "2026-01-15T10:00:00Z", models = TEST_MODELS) {
  let now = utc(startIso);
  const repo = memoryRepo();
  const guard = new QuotaGuard({ repo, models, now: () => now });
  return {
    guard,
    repo,
    advance: (ms: number) => void (now += ms),
    setNow: (iso: string) => void (now = utc(iso)),
  };
}

const ok = () => Promise.resolve("ok");
const H = "abcd1234";

async function expectQuotaError(p: Promise<unknown>, reason: string) {
  const err = await p.catch((e) => e);
  expect(err).toBeInstanceOf(QuotaError);
  expect((err as QuotaError).reason).toBe(reason);
  return err as QuotaError;
}

describe("태평양 시간 자정 계산", () => {
  it("겨울(PST, UTC-8): 자정 = 한국 오후 5시", () => {
    const now = utc("2026-01-15T10:00:00Z"); // 1/15 02:00 PST
    expect(pacificDayKey(now)).toBe("2026-01-15");
    expect(new Date(nextPacificMidnight(now)).toISOString()).toBe("2026-01-16T08:00:00.000Z");
    expect(formatKstTime(nextPacificMidnight(now))).toBe("오후 5시");
  });

  it("여름(PDT, UTC-7): 자정 = 한국 오후 4시", () => {
    const now = utc("2026-07-01T12:00:00Z");
    expect(new Date(nextPacificMidnight(now)).toISOString()).toBe("2026-07-02T07:00:00.000Z");
    expect(formatKstTime(nextPacificMidnight(now))).toBe("오후 4시");
  });

  it("서머타임 시작 전날 밤 → 다음 자정은 아직 PST", () => {
    const now = utc("2026-03-08T04:00:00Z"); // 3/7 20:00 PST
    expect(pacificDayKey(now)).toBe("2026-03-07");
    expect(new Date(nextPacificMidnight(now)).toISOString()).toBe("2026-03-08T08:00:00.000Z");
  });

  it("서머타임 시작일 전환 직전(01:30 PST) → 다음 자정은 PDT 로 보정", () => {
    const now = utc("2026-03-08T09:30:00Z"); // 3/8 01:30 PST
    expect(pacificDayKey(now)).toBe("2026-03-08");
    expect(new Date(nextPacificMidnight(now)).toISOString()).toBe("2026-03-09T07:00:00.000Z");
  });

  it("서머타임 종료일 전환 직전(01:30 PDT) → 다음 자정은 PST 로 보정", () => {
    const now = utc("2026-11-01T08:30:00Z"); // 11/1 01:30 PDT
    expect(pacificDayKey(now)).toBe("2026-11-01");
    expect(new Date(nextPacificMidnight(now)).toISOString()).toBe("2026-11-02T08:00:00.000Z");
  });

  it("서머타임 종료 전날 밤 → 다음 자정은 PDT", () => {
    const now = utc("2026-11-01T06:00:00Z"); // 10/31 23:00 PDT
    expect(pacificDayKey(now)).toBe("2026-10-31");
    expect(new Date(nextPacificMidnight(now)).toISOString()).toBe("2026-11-01T07:00:00.000Z");
  });

  it("초기화 안내 문구: 한국 시간 기준 오늘/내일", () => {
    expect(formatResetLabel(utc("2026-01-15T01:00:00Z"))).toBe("오늘 오후 5시"); // KST 10:00
    expect(formatResetLabel(utc("2026-01-15T09:00:00Z"))).toBe("내일 오후 5시"); // KST 18:00
    expect(formatResetLabel(utc("2026-07-15T01:00:00Z"))).toBe("오늘 오후 4시");
  });
});

describe("일일 리셋", () => {
  it("태평양 자정 직전까지는 유지되고 자정에 초기화된다", async () => {
    const t = setup("2026-01-16T07:59:00Z"); // 1/15 23:59 PST
    await t.guard.guardedCall(H, LITE, ok);
    expect(t.guard.status(H, LITE).used).toBe(1);
    t.setNow("2026-01-16T07:59:59Z");
    expect(t.guard.status(H, LITE).used).toBe(1);
    t.setNow("2026-01-16T08:00:00Z"); // 1/16 00:00 PST = KST 17:00
    expect(t.guard.status(H, LITE).used).toBe(0);
  });

  it("서머타임 기간에는 UTC 07:00(한국 오후 4시)에 초기화된다", async () => {
    const t = setup("2026-07-02T06:59:00Z");
    await t.guard.guardedCall(H, LITE, ok);
    t.setNow("2026-07-02T06:59:59Z");
    expect(t.guard.status(H, LITE).used).toBe(1);
    t.setNow("2026-07-02T07:00:00Z");
    expect(t.guard.status(H, LITE).used).toBe(0);
  });

  it("서머타임 시작일(23시간짜리 하루)에도 자정에 정확히 초기화된다", async () => {
    const t = setup("2026-03-08T08:30:00Z"); // 3/8 00:30 PST
    await t.guard.guardedCall(H, LITE, ok);
    t.setNow("2026-03-09T06:59:59Z"); // 3/8 23:59:59 PDT
    expect(t.guard.status(H, LITE).used).toBe(1);
    t.setNow("2026-03-09T07:00:00Z");
    expect(t.guard.status(H, LITE).used).toBe(0);
  });

  it("서머타임 종료일(25시간짜리 하루)에도 자정에 정확히 초기화된다", async () => {
    const t = setup("2026-11-01T07:30:00Z"); // 11/1 00:30 PDT
    await t.guard.guardedCall(H, LITE, ok);
    t.setNow("2026-11-02T07:59:59Z"); // 11/1 23:59:59 PST
    expect(t.guard.status(H, LITE).used).toBe(1);
    t.setNow("2026-11-02T08:00:00Z");
    expect(t.guard.status(H, LITE).used).toBe(0);
  });

  it("429 잠금도 다음 날 풀린다", async () => {
    const t = setup();
    await t.guard.guardedCall(H, LITE, () => Promise.reject({ status: 429, message: "quota" })).catch(() => {});
    expect(t.guard.status(H, LITE).lockedBy429).toBe(true);
    t.setNow("2026-01-16T08:00:00Z");
    const s = t.guard.status(H, LITE);
    expect(s.lockedBy429).toBe(false);
    expect(s.remaining).toBe(3);
  });
});

describe("safeRpd 차단", () => {
  it("safeRpd 에 도달하면 호출하지 않고 차단한다", async () => {
    const t = setup();
    for (let i = 0; i < 3; i++) {
      await t.guard.guardedCall(H, LITE, ok);
      t.advance(5000);
    }
    expect(t.guard.status(H, LITE)).toMatchObject({ used: 3, remaining: 0, blocked: "daily_limit" });
    const fn = vi.fn(ok);
    const err = await expectQuotaError(t.guard.guardedCall(H, LITE, fn), "daily_limit");
    expect(fn).not.toHaveBeenCalled();
    expect(err.message).toContain("3회");
    expect(err.message).toContain("오후 5시");
    expect(t.guard.status(H, LITE).used).toBe(3);
  });

  it("실패한 호출도 사용량에 포함된다", async () => {
    const t = setup();
    await t.guard.guardedCall(H, LITE, () => Promise.reject(new Error("network"))).catch(() => {});
    expect(t.guard.status(H, LITE).used).toBe(1);
  });

  it("다른 모델에 여유가 있으면 대안으로 제시하지만 자동 전환하지 않는다", async () => {
    const t = setup();
    await t.guard.guardedCall(H, FLASH, ok);
    t.advance(10000);
    await t.guard.guardedCall(H, FLASH, ok);
    t.advance(10000);
    const fn = vi.fn(ok);
    const err = await expectQuotaError(t.guard.guardedCall(H, FLASH, fn), "daily_limit");
    expect(err.alternative).toBe(LITE);
    expect(fn).not.toHaveBeenCalled();
    expect(t.guard.status(H, LITE).used).toBe(0);
  });

  it("모든 모델이 소진되면 대안이 없다", async () => {
    const t = setup();
    t.guard.markExhausted(H, LITE);
    t.guard.markExhausted(H, FLASH);
    const err = t.guard.check(H, FLASH)!;
    expect(err.alternative).toBeNull();
  });
});

describe("최소 간격 차단", () => {
  it("minIntervalMs 이내 재호출을 막고 남은 시간을 알려 준다", async () => {
    const t = setup();
    await t.guard.guardedCall(H, LITE, ok);
    t.advance(1200);
    expect(t.guard.status(H, LITE)).toMatchObject({ blocked: "interval", waitMs: 3800 });
    const fn = vi.fn(ok);
    const err = await expectQuotaError(t.guard.guardedCall(H, LITE, fn), "interval");
    expect(err.message).toContain("4초");
    expect(fn).not.toHaveBeenCalled();
    expect(t.guard.status(H, LITE).used).toBe(1);
    t.advance(3800);
    expect(t.guard.status(H, LITE).blocked).toBeNull();
    await expect(t.guard.guardedCall(H, LITE, ok)).resolves.toBe("ok");
  });

  it("간격은 모델별로 독립이다", async () => {
    const t = setup();
    await t.guard.guardedCall(H, LITE, ok);
    expect(t.guard.status(H, FLASH).blocked).toBeNull();
  });

  it("진행 중인 요청이 있으면 같은 키로 동시에 호출할 수 없다", async () => {
    const t = setup();
    let release!: () => void;
    const pending = t.guard.guardedCall(H, LITE, () => new Promise<void>((r) => (release = r)));
    expect(t.guard.isInsideCall(H)).toBe(true);
    await expectQuotaError(t.guard.guardedCall(H, FLASH, ok), "in_flight");
    release();
    await pending;
    expect(t.guard.isInsideCall(H)).toBe(false);
    expect(t.guard.status(H, FLASH).used).toBe(0);
  });
});

describe("429 처리", () => {
  it.each([
    [{ status: 429, message: "Too Many Requests" }],
    [Object.assign(new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'), {})],
  ])("429 수신 시 사용량을 safeRpd 로 올리고 당일 잠근다 (재시도 없음)", async (rejection) => {
    const t = setup();
    const fn = vi.fn(() => Promise.reject(rejection));
    const err = await expectQuotaError(t.guard.guardedCall(H, LITE, fn), "rate_limited");
    expect(fn).toHaveBeenCalledTimes(1);
    // 시작 시각 10:00Z = 한국 19:00 → 다음 초기화는 내일 오후 5시
    expect(err.message).toBe("오늘 무료 사용량을 모두 썼어요. 내일 오후 5시에 다시 쓸 수 있어요.");
    expect(err.alternative).toBe(FLASH);
    expect(t.guard.status(H, LITE)).toMatchObject({ used: 3, remaining: 0, lockedBy429: true, blocked: "rate_limited" });

    t.advance(60 * 60 * 1000);
    const again = vi.fn(ok);
    await expectQuotaError(t.guard.guardedCall(H, LITE, again), "rate_limited");
    expect(again).not.toHaveBeenCalled();
  });

  it("429 가 아닌 오류는 잠그지 않는다", async () => {
    const t = setup();
    await t.guard.guardedCall(H, LITE, () => Promise.reject({ status: 500 })).catch(() => {});
    expect(t.guard.status(H, LITE).lockedBy429).toBe(false);
    expect(isRateLimitError({ status: 503 })).toBe(false);
    expect(isRateLimitError({ code: 429 })).toBe(true);
  });
});

describe("모델별·키별 독립 카운트", () => {
  it("한 모델 사용이 다른 모델 횟수에 영향을 주지 않는다", async () => {
    const t = setup();
    await t.guard.guardedCall(H, LITE, ok);
    t.advance(5000);
    await t.guard.guardedCall(H, LITE, ok);
    await t.guard.guardedCall(H, FLASH, ok);
    expect(t.guard.status(H, LITE).used).toBe(2);
    expect(t.guard.status(H, FLASH).used).toBe(1);
    t.guard.markExhausted(H, FLASH);
    expect(t.guard.status(H, LITE).remaining).toBe(1);
  });

  it("API 키(해시)가 다르면 별도로 센다", async () => {
    const t = setup();
    await t.guard.guardedCall("aaaa1111", LITE, ok);
    expect(t.guard.status("bbbb2222", LITE).used).toBe(0);
  });

  it("저장소에는 키 원문이 아니라 해시만 남는다", async () => {
    const t = setup();
    await t.guard.guardedCall(H, LITE, ok);
    expect(t.repo.keys()).toEqual([`essaycoach:quota:v1:${H}`]);
  });

  it("알 수 없는 모델은 차단한다", async () => {
    const t = setup();
    await expectQuotaError(t.guard.guardedCall(H, "gpt-x", ok), "unknown_model");
  });

  it("실제 설정의 safeRpd 는 freeRpd 보다 작다", async () => {
    const { MODELS } = await import("@/config/models");
    for (const m of MODELS) {
      expect(m.safeRpd).toBeLessThan(m.freeRpd);
      expect(m.minIntervalMs).toBeGreaterThan(0);
    }
  });
});
