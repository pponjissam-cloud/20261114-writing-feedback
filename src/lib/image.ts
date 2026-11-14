import type { ImageInput } from "@/lib/llm/gemini";

/** 손글씨 판독에 충분하면서 요청 크기(인라인 20MB 제한)를 넉넉히 밑도는 크기 */
export const MAX_EDGE_PX = 2048;
export const JPEG_QUALITY = 0.85;
const RAW_FALLBACK_MAX_BYTES = 6 * 1024 * 1024;
const GEMINI_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export interface PreparedImage extends ImageInput {
  id: string;
  name: string;
  /** 미리보기용 object URL (사용 후 revoke) */
  previewUrl: string;
}

export function fitWithin(width: number, height: number, maxEdge = MAX_EDGE_PX) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function stripDataUrl(dataUrl: string): string {
  const i = dataUrl.indexOf(",");
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name);
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * 휴대폰 사진(수 MB)을 줄여 JPEG base64 로 만든다. EXIF 회전은 createImageBitmap 이 반영.
 * 브라우저가 디코딩하지 못하는 형식(일부 HEIC)은 작으면 원본 그대로 보낸다.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const previewUrl = URL.createObjectURL(file);
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.fillStyle = "#fff"; // 투명 PNG 배경을 흰색으로
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const data = stripDataUrl(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    return { id, name: file.name, previewUrl, mimeType: "image/jpeg", data };
  } catch {
    const type = file.type || (/\.heif$/i.test(file.name) ? "image/heif" : "image/heic");
    if (GEMINI_IMAGE_TYPES.includes(type) && file.size <= RAW_FALLBACK_MAX_BYTES) {
      return { id, name: file.name, previewUrl, mimeType: type, data: stripDataUrl(await readAsDataUrl(file)) };
    }
    URL.revokeObjectURL(previewUrl);
    throw new Error(`"${file.name}" 사진을 열 수 없어요. JPG나 PNG로 다시 찍어 올려 주세요.`);
  }
}

/** [?] 개수 — 학생이 사진을 보고 채워야 할 곳 */
export function countUnreadable(text: string): number {
  return text.split("[?]").length - 1;
}
