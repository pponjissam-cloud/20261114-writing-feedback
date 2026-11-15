/**
 * 리포트를 정확히 A4 2장으로 인쇄하기 위한 장별 자동 축소.
 * 글 길이에 따라 내용 높이가 달라지므로, 인쇄 직전에 각 장(.print-page)을
 * A4 인쇄 폭으로 배치해 높이를 재고, 넘치면 그 장만 비율대로 줄인다.
 */
const MM_TO_PX = 96 / 25.4;
export const PAGE_MARGIN_MM = 10;
export const PAGE_CONTENT_HEIGHT_MM = 297 - PAGE_MARGIN_MM * 2;
// 브라우저별 반올림·머리글 오차를 흡수할 여유
const SAFETY_MM = 4;

export function zoomToFit(contentHeightPx: number, availableHeightPx = (PAGE_CONTENT_HEIGHT_MM - SAFETY_MM) * MM_TO_PX): number {
  if (contentHeightPx <= 0) return 1;
  return Math.min(1, Math.floor((availableHeightPx / contentHeightPx) * 1000) / 1000);
}

export function fitPrintPages(root: ParentNode = document): number[] {
  const pages = Array.from(root.querySelectorAll<HTMLElement>(".print-page"));
  pages.forEach((p) => (p.style.zoom = ""));
  return pages.map((p) => {
    const z = zoomToFit(p.scrollHeight);
    p.style.zoom = z < 1 ? String(z) : "";
    return z;
  });
}

export function preparePrint() {
  document.documentElement.classList.add("printing");
  return fitPrintPages();
}

export function finishPrint() {
  document.documentElement.classList.remove("printing");
  document.querySelectorAll<HTMLElement>(".print-page").forEach((p) => (p.style.zoom = ""));
}

/** Ctrl+P 로 인쇄해도 같은 레이아웃이 되도록 전역 이벤트에 연결 */
export function installPrintFit() {
  window.addEventListener("beforeprint", preparePrint);
  window.addEventListener("afterprint", finishPrint);
}
