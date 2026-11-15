import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { SentenceReviewView } from "./SentenceReview";

const essay = "Many people thinks homework is bad. I agree. It is boring.";

describe("SentenceReviewView", () => {
  it("학생/최소 첨삭/추천 문장과 파란색 삽입·삭제 문장을 보여 준다", () => {
    render(
      <SentenceReviewView
        no="④"
        essay={essay}
        review={{
          items: [
            { no: 1, action: "revise", minimal: "Many people think homework is bad.", recommended: "Many people believe homework is harmful.", note: "수 일치" },
            { no: 2, action: "keep", minimal: "I agree.", recommended: "I agree.", note: "" },
            { no: 3, action: "delete", minimal: "", recommended: "", note: "근거가 아니에요" },
          ],
          insertions: [{ afterNo: 2, sentence: "For example, I sleep six hours.", reason: "예시" }],
        }}
      />,
    );
    const s1 = screen.getByTestId("sentence-1");
    expect(within(s1).getByText("Many people thinks homework is bad.")).toBeInTheDocument();
    const added = within(s1).getByText("think");
    expect(added.className).toMatch(/text-redpen/);
    expect(within(s1).getByText("thinks", { selector: "del" }).className).toMatch(/text-neutral-400/);
    expect(within(s1).getByText("thinks", { selector: "del" }).className).not.toMatch(/text-redpen/);
    expect(within(s1).getByText("thinks", { selector: "del" })).toBeInTheDocument();
    expect(within(s1).getByText("Many people believe homework is harmful.").className).toMatch(/font-bold/);

    expect(within(screen.getByTestId("sentence-2")).getByText(/고칠 곳 없음/)).toBeInTheDocument();

    const del = within(screen.getByTestId("sentence-3")).getByText("It is boring.");
    expect(del.className).toMatch(/text-blue-600/);
    expect(del.className).toMatch(/line-through/);

    const ins = screen.getByTestId("insert-row");
    expect(within(ins).getByText("For example, I sleep six hours.").className).toMatch(/text-blue-600.*font-bold|font-bold.*text-blue-600/);
    const order = screen.getAllByTestId(/sentence-|insert-row/).map((el) => el.dataset.testid);
    expect(order).toEqual(["sentence-1", "sentence-2", "insert-row", "sentence-3"]);
  });
});
