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

export const PAGE_CONTENT_WIDTH_MM = 210 - PAGE_MARGIN_MM * 2;

/**
 * zoom 은 높이뿐 아니라 폭도 줄이므로, 줄인 장은 오른쪽 여백이 넓어진다.
 * 그래서 줄일 때는 배치 폭을 1/zoom 배로 넓혀(줄인 뒤 폭 = 인쇄 폭) 좌우 여백을 같게 유지한다.
 * 폭이 넓어지면 줄바꿈이 줄어 높이도 달라지므로 몇 번 반복해 맞춘다.
 */
export function fitPrintPages(root: ParentNode = document): number[] {
  const pages = Array.from(root.querySelectorAll<HTMLElement>(".print-page"));
  return pages.map((p) => {
    p.style.zoom = "";
    p.style.width = "";
    let z = zoomToFit(p.scrollHeight);
    for (let i = 0; i < 4 && z < 1; i++) {
      p.style.width = `${PAGE_CONTENT_WIDTH_MM / z}mm`;
      const next = zoomToFit(p.scrollHeight);
      if (Math.abs(next - z) < 0.005) {
        z = Math.min(z, next);
        break;
      }
      z = next;
    }
    if (z >= 1) {
      p.style.width = "";
      return 1;
    }
    // 실제로 줄인 뒤의 높이를 다시 재서, 줄바꿈·반올림 차이로 아직 넘치면 조금씩 더 줄인다
    const available = (PAGE_CONTENT_HEIGHT_MM - SAFETY_MM) * MM_TO_PX;
    for (let i = 0; i < 12; i++) {
      p.style.width = `${PAGE_CONTENT_WIDTH_MM / z}mm`;
      p.style.zoom = String(z);
      const rendered = p.getBoundingClientRect().height;
      if (!rendered || rendered <= available) break;
      z = Math.floor(z * Math.min(0.98, available / rendered) * 1000) / 1000;
    }
    return z;
  });
}

export function preparePrint() {
  document.documentElement.classList.add("printing");
  return fitPrintPages();
}

export function finishPrint() {
  document.documentElement.classList.remove("printing");
  document.querySelectorAll<HTMLElement>(".print-page").forEach((p) => {
    p.style.zoom = "";
    p.style.width = "";
  });
}

/** Ctrl+P 로 인쇄해도 같은 레이아웃이 되도록 전역 이벤트에 연결 */
export function installPrintFit() {
  window.addEventListener("beforeprint", preparePrint);
  window.addEventListener("afterprint", finishPrint);
}
