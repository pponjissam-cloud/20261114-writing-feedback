import { describe, expect, it } from "vitest";
import { countUnreadable, fitWithin, isImageFile, stripDataUrl } from "./image";
import { parseTranscription } from "./schema";

describe("image helpers", () => {
  it("긴 변을 2048px 이하로 줄이고 작은 사진은 키우지 않는다", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1536, height: 2048 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("data URL 접두사를 떼어 낸다", () => {
    expect(stripDataUrl("data:image/jpeg;base64,QUJD")).toBe("QUJD");
  });

  it("HEIC 처럼 type 이 비어 있는 사진도 이미지로 인식한다", () => {
    expect(isImageFile(new File([""], "IMG_1.HEIC"))).toBe(true);
    expect(isImageFile(new File([""], "a.pdf", { type: "application/pdf" }))).toBe(false);
  });

  it("[?] 개수를 센다", () => {
    expect(countUnreadable("I [?] it [?].")).toBe(2);
    expect(countUnreadable("none")).toBe(0);
  });

  it("판독 결과를 검증한다", () => {
    expect(parseTranscription('{"isEssay":true,"topic":"","text":"Hi","unreadableCount":0}').ok).toBe(true);
    expect(parseTranscription('{"isEssay":true,"text":"Hi"}').ok).toBe(false);
    expect(parseTranscription("nope").ok).toBe(false);
  });
});
