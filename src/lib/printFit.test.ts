import { describe, expect, it } from "vitest";
import { fitPrintPages, zoomToFit } from "./printFit";

describe("print fit", () => {
  it("넘치는 장만 비율대로 줄이고, 들어가는 장은 그대로 둔다", () => {
    expect(zoomToFit(500, 1000)).toBe(1);
    expect(zoomToFit(2000, 1000)).toBe(0.5);
    expect(zoomToFit(3000, 1000)).toBe(0.333);
    expect(zoomToFit(0, 1000)).toBe(1);
  });

  it(".print-page 마다 따로 계산한다", () => {
    document.body.innerHTML = `<div class="print-page" id="a"></div><div class="print-page" id="b"></div>`;
    Object.defineProperty(document.getElementById("a")!, "scrollHeight", { value: 500 });
    Object.defineProperty(document.getElementById("b")!, "scrollHeight", { value: 5000 });
    const z = fitPrintPages();
    expect(z[0]).toBe(1);
    expect(z[1]).toBeLessThan(1);
    expect(document.getElementById("b")!.style.zoom).toBe(String(z[1]));
  });
});
