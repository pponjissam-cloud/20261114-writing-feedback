import { describe, expect, it, vi } from "vitest";
import { createApiKeyStore, hashKey, normalizeApiKey, redactSecrets } from "./apiKey";
import { memoryRepo } from "./storage";

const KEY = "AIzaSyTEST_KEY_1234567890abcdefghij";

describe("apiKey", () => {
  it("기본(session) 저장 후 local 로 바꾸면 이전 위치에서 지운다", () => {
    const s = memoryRepo();
    const l = memoryRepo();
    const store = createApiKeyStore(s, l);
    const listener = vi.fn();
    store.subscribe(listener);
    store.save(` ${KEY} `, "session");
    expect(store.get()).toBe(KEY);
    expect(store.mode()).toBe("session");
    store.save(KEY, "local");
    expect(s.keys()).toHaveLength(0);
    expect(store.mode()).toBe("local");
    store.clear();
    expect(store.get()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("형식이 이상한 키를 거부한다 (메시지에 키를 넣지 않음)", () => {
    expect(() => normalizeApiKey("")).toThrow();
    expect(() => normalizeApiKey("AIza abc def ghi jkl mno pqr")).toThrow(/공백/);
    try { normalizeApiKey("short"); } catch (e) { expect(String(e)).not.toContain("short"); }
  });

  it("SHA-256 해시 앞 8자리를 만든다", async () => {
    const h = await hashKey(KEY);
    expect(h).toMatch(/^[0-9a-f]{8}$/);
    expect(await hashKey(KEY)).toBe(h);
    expect(await hashKey(KEY + "x")).not.toBe(h);
    expect(await hashKey("abc")).toBe("ba7816bf");
  });

  it("문자열 속 키를 가린다", () => {
    expect(redactSecrets(`bad key ${KEY}`, KEY)).not.toContain(KEY);
    expect(redactSecrets("https://x/y?key=SECRET123&a=1")).toBe("https://x/y?key=[REDACTED]&a=1");
    expect(redactSecrets("AIzaSyAnotherLooking_Key_000000000")).toBe("[REDACTED]");
  });
});
