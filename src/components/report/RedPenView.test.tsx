import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRedPenLayout, RedPenView } from "./RedPenView";
import { CorrectionTable } from "./CorrectionTable";
import type { RedPenItem } from "@/lib/schema";

const essay = "Many people thinks homework is bad. Students are tired.";
const redPen: RedPenItem[] = [
  { id: "r1", original: "Many people thinks homework is bad.", revised: "Many people think homework is harmful.", reason: "people은 여러 명이에요.", suggestedAddition: "For example, ..." },
  { id: "r2", original: "Students is tired.", revised: "Students are exhausted.", reason: "원문과 다름" },
];

function Harness() {
  const layout = useRedPenLayout(essay, redPen);
  return (
    <>
      <RedPenView essay={essay} redPen={redPen} />
      <CorrectionTable corrections={[]} unmatchedRedPen={layout.unmatchedItems} />
    </>
  );
}

describe("RedPenView", () => {
  it("일치 구간만 본문에 표시하고, 불일치 항목은 정정 목록에만 표시한다", async () => {
    render(<Harness />);
    const text = screen.getByTestId("redpen-text");
    expect(text.textContent).toContain("Students are tired.");
    expect(within(text).getByText("Many people thinks homework is bad.").tagName).toBe("DEL");
    expect(within(text).queryByText(/exhausted/)).toBeNull();
    expect(within(screen.getByTestId("unmatched-redpen")).getByText(/Students are exhausted/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /첨삭 1/ }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("이런 예시를 추가해 보세요");
  });
});
