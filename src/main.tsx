import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { assertRubricTotal } from "@/lib/scoring";
import "./index.css";

const root = createRoot(document.getElementById("root")!);

try {
  // 배점 설정 실수(합계 ≠ 100)는 잘못된 점수를 보여 주기 전에 바로 드러나게 한다
  assertRubricTotal();
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (e) {
  root.render(<pre style={{ padding: 24, color: "#b91c1c", whiteSpace: "pre-wrap" }}>{(e as Error).message}</pre>);
}
