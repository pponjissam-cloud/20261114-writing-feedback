import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { MAX_IMAGES } from "@/lib/llm/gemini";
import { isImageFile, prepareImage, type PreparedImage } from "@/lib/image";
import { Button } from "@/components/ui/button";

export function PhotoUpload({ images, onChange, disabled }: { images: PreparedImage[]; onChange: (next: PreparedImage[]) => void; disabled?: boolean }) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files).filter(isImageFile);
    if (list.length < files.length) setError("사진 파일만 올릴 수 있어요.");
    const room = MAX_IMAGES - images.length;
    if (list.length > room) setError(`사진은 최대 ${MAX_IMAGES}장까지예요. 앞의 ${Math.max(room, 0)}장만 추가했어요.`);
    setBusy(true);
    const added: PreparedImage[] = [];
    for (const f of list.slice(0, Math.max(room, 0))) {
      try {
        added.push(await prepareImage(f));
      } catch (e) {
        setError((e as Error).message);
      }
    }
    setBusy(false);
    onChange([...images, ...added]);
  };

  const remove = (id: string) => {
    const img = images.find((i) => i.id === id);
    if (img) URL.revokeObjectURL(img.previewUrl);
    onChange(images.filter((i) => i.id !== id));
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...images];
    const [item] = next.splice(index, 1);
    next.splice(index + dir, 0, item!);
    onChange(next);
  };

  const full = images.length >= MAX_IMAGES;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-5 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!disabled) void addFiles(e.dataTransfer.files);
        }}
      >
        <p className="text-sm">
          공책에 쓴 에세이를 찍어 올려 주세요. <span className="text-muted-foreground">(최대 {MAX_IMAGES}장, 페이지 순서대로)</span>
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" onClick={() => cameraRef.current?.click()} disabled={disabled || busy || full}>
            <Camera /> 카메라로 찍기
          </Button>
          <Button type="button" variant="outline" onClick={() => galleryRef.current?.click()} disabled={disabled || busy || full}>
            <ImagePlus /> 사진 선택
          </Button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label="카메라로 찍기" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={galleryRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden" aria-label="사진 파일 선택" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
        <ul className="text-left text-xs text-muted-foreground">
          <li>· 밝은 곳에서, 그림자 없이, 한 페이지씩 정면으로 찍어 주세요.</li>
          <li>· 글씨가 화면을 가득 채우게 찍으면 더 정확하게 읽어요.</li>
        </ul>
        {busy && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> 사진을 준비하고 있어요…
          </p>
        )}
      </div>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      {images.length > 0 && (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="올린 사진">
          {images.map((img, i) => (
            <li key={img.id} className="relative overflow-hidden rounded-md border bg-muted">
              <img src={img.previewUrl} alt={`${i + 1}쪽 사진`} className="aspect-[3/4] w-full object-cover" />
              <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 text-xs font-bold text-white">{i + 1}쪽</span>
              <button type="button" className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/70 text-white" onClick={() => remove(img.id)} aria-label={`${i + 1}쪽 사진 삭제`} disabled={disabled}>
                <X className="size-3.5" />
              </button>
              {images.length > 1 && (
                <div className="absolute inset-x-1 bottom-1 flex justify-between">
                  <button type="button" className="rounded bg-black/70 px-1.5 text-xs text-white disabled:opacity-30" onClick={() => move(i, -1)} disabled={disabled || i === 0} aria-label={`${i + 1}쪽을 앞으로`}>◀</button>
                  <button type="button" className="rounded bg-black/70 px-1.5 text-xs text-white disabled:opacity-30" onClick={() => move(i, 1)} disabled={disabled || i === images.length - 1} aria-label={`${i + 1}쪽을 뒤로`}>▶</button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** 옮겨 적은 글을 고칠 때 옆에 띄워 두는 원본 사진 */
export function PhotoReference({ images }: { images: PreparedImage[] }) {
  if (images.length === 0) return null;
  return (
    <div className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto rounded-md border bg-muted p-2" aria-label="원본 사진">
      {images.map((img, i) => (
        <a key={img.id} href={img.previewUrl} target="_blank" rel="noreferrer" className="block" title="크게 보기">
          <img src={img.previewUrl} alt={`${i + 1}쪽 원본`} className="w-full rounded" />
        </a>
      ))}
    </div>
  );
}
